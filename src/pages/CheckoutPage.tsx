import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Copy, CreditCard, Smartphone, Upload, Wallet, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useCart } from '@/context/CartContext'
import { useApp } from '@/context/AppContext'
import { usePageMeta } from '@/hooks/usePageMeta'
import { EGYPT_GOVERNORATES, PAYMENT_METHODS, DEFAULT_PAYMENT_NUMBER } from '@/lib/constants'
import { validateCustomerInfo, validatePaymentForm, amountMismatch, hasPhysicalItem, type FieldErrors } from '@/lib/checkout'
import { formatPrice, copyToClipboard } from '@/lib/utils'
import { uploadPaymentScreenshot, MAX_SCREENSHOT_BYTES } from '@/lib/storage'
import type { CheckoutCustomerInfo, PaymentMethod } from '@/types'
import Field from '@/components/ui/Field'
import Price from '@/components/ui/Price'

type Step = 0 | 1 | 2
const STEPS = ['Information', 'Review', 'Payment']

export default function CheckoutPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { items, subtotal, discount, shipping, total, coupon, clearCart } = useCart()
  const { settings, addToast } = useApp()

  const [step, setStep] = useState<Step>(0)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [placing, setPlacing] = useState(false)
  const [placeStatus, setPlaceStatus] = useState('')

  const [info, setInfo] = useState<CheckoutCustomerInfo>({
    name: profile?.full_name || '',
    email: user?.email || '',
    phone: profile?.phone || '',
    governorate: '',
    city: '',
    address: '',
    notes: '',
  })

  const [method, setMethod] = useState<PaymentMethod | null>(null)
  const [payerIdentifier, setPayerIdentifier] = useState('')
  const [transferredAmount, setTransferredAmount] = useState<string>('')
  const [paymentNote, setPaymentNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)

  usePageMeta('Checkout', 'Complete your SAIF STORE order.')

  const needsShipping = hasPhysicalItem(items)
  const currency = settings?.currency || 'EGP'
  const paymentNumber = settings?.payment_number || DEFAULT_PAYMENT_NUMBER

  // Prefill transferred amount when totals/method change.
  useEffect(() => {
    setTransferredAmount(String(total))
  }, [total])

  // Auth guard: checkout requires an account (orders are per-user).
  useEffect(() => {
    if (!user) navigate('/login?next=/checkout', { replace: true })
  }, [user, navigate])

  // Sync profile defaults once loaded.
  useEffect(() => {
    setInfo(prev => ({
      ...prev,
      name: prev.name || profile?.full_name || '',
      email: prev.email || user?.email || '',
      phone: prev.phone || profile?.phone || '',
    }))
  }, [profile, user])

  useEffect(() => {
    return () => { if (filePreview) URL.revokeObjectURL(filePreview) }
  }, [filePreview])

  const methodMeta = useMemo(() => PAYMENT_METHODS.find(m => m.id === method), [method])

  function setField<K extends keyof CheckoutCustomerInfo>(key: K, value: string) {
    setInfo(prev => ({ ...prev, [key]: value }))
    setErrors(prev => ({ ...prev, [key]: undefined }))
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(f.type)) {
      addToast('Screenshot must be a PNG, JPG or WEBP image', 'error')
      return
    }
    if (f.size > MAX_SCREENSHOT_BYTES) {
      addToast('Screenshot too large — maximum 5 MB', 'error')
      return
    }
    if (filePreview) URL.revokeObjectURL(filePreview)
    setFile(f)
    setFilePreview(URL.createObjectURL(f))
    setErrors(prev => ({ ...prev, screenshot_path: undefined }))
  }

  function goFromInformation() {
    const errs = validateCustomerInfo(info, needsShipping)
    setErrors(errs)
    if (Object.keys(errs).some(k => errs[k])) {
      addToast('Please fix the highlighted fields', 'error')
      return
    }
    setStep(1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function submitOrder() {
    if (!user) return
    if (!method) {
      setErrors({ method: 'Choose how you will pay.' })
      return
    }
    const payErrors = validatePaymentForm({
      transferred_amount: transferredAmount === '' ? '' : Number(transferredAmount),
      payer_identifier: payerIdentifier,
      screenshot_path: file ? 'pending' : null,
    })
    setErrors(payErrors)
    if (Object.keys(payErrors).some(k => payErrors[k])) {
      addToast('Complete all payment fields before submitting', 'error')
      return
    }

    setPlacing(true)
    try {
      // 1) Atomic server-side order creation (prices & stock re-validated in DB).
      setPlaceStatus('Creating your order…')
      const { data: orderRes, error: orderError } = await supabase.rpc('place_order', {
        p_items: items.map(i => ({
          product_id: i.product.id,
          variant_id: i.variant?.id ?? null,
          quantity: i.quantity,
        })),
        p_coupon_code: coupon?.code ?? null,
        p_customer: { ...info },
        p_payment_method: method,
      })
      if (orderError || !orderRes) {
        throw new Error(orderError?.message || 'Could not create the order.')
      }
      const placed = orderRes as { order_id: string; order_number: string; total: number }

      // Stock is reserved and the order exists from here on — clear the bag.
      clearCart()

      // 2) Upload the payment screenshot (owner-private storage path).
      setPlaceStatus('Uploading your payment screenshot…')
      const upload = await uploadPaymentScreenshot(user.id, placed.order_id, file!)
      if (!upload.ok || !upload.path) {
        throw new RecoverableError(placed.order_id, upload.error || 'Screenshot upload failed.')
      }

      // 3) Register the payment for manual review.
      setPlaceStatus('Submitting payment for review…')
      const { error: payError } = await supabase.rpc('submit_payment', {
        p_order_id: placed.order_id,
        p_payment_method: method,
        p_transferred_amount: Number(transferredAmount),
        p_payer_identifier: payerIdentifier.trim(),
        p_screenshot_path: upload.path,
        p_customer_note: paymentNote.trim() || null,
      })
      if (payError) {
        throw new RecoverableError(placed.order_id, payError.message)
      }

      navigate(`/orders/${placed.order_id}/confirmation`, { replace: true })
    } catch (err) {
      if (err instanceof RecoverableError) {
        // Order exists but payment evidence wasn't attached — the customer
        // can complete payment from the order page. Nothing is lost.
        addToast(`Order created, but: ${err.message}. Submit your payment from the order page.`, 'error')
        navigate(`/orders/${err.orderId}`, { replace: true })
      } else {
        addToast(err instanceof Error ? err.message : 'Something went wrong. Please try again.', 'error')
        setPlacing(false)
        setPlaceStatus('')
      }
    }
  }

  if (!user) return null

  if (items.length === 0) {
    return (
      <div className="animate-[pageIn_0.5s_ease] px-6 pt-20 text-center min-h-[50vh]">
        <h1 className="text-3xl font-black tracking-tight text-saif-text mb-4">Your bag is empty</h1>
        <p className="text-sm text-saif-dim mb-8">Add products before checking out.</p>
        <Link to="/products" className="btn">Continue Shopping</Link>
      </div>
    )
  }

  return (
    <div className="animate-[pageIn_0.5s_ease] px-4 sm:px-6 lg:px-10 pt-10 pb-20">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-saif-text mb-8">Checkout</h1>

        {/* Step indicator */}
        <ol className="flex items-center gap-2 sm:gap-4 mb-10" aria-label="Checkout progress">
          {STEPS.map((label, i) => (
            <li key={label} className="flex items-center gap-2 sm:gap-4">
              <button
                onClick={() => !placing && i < step && setStep(i as Step)}
                disabled={placing || i > step}
                className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wider ${
                  i === step ? 'text-saif-text' : i < step ? 'text-saif-accent cursor-pointer' : 'text-saif-dim/50'
                }`}
                aria-current={i === step ? 'step' : undefined}
              >
                <span className={`w-6 h-6 rounded-full border flex items-center justify-center text-[10px] ${
                  i === step ? 'border-saif-text bg-saif-text text-black' : i < step ? 'border-saif-accent bg-saif-accent text-white' : 'border-saif-border'
                }`}>
                  {i < step ? <Check size={12} /> : i + 1}
                </span>
                <span className="hidden sm:inline">{label}</span>
              </button>
              {i < STEPS.length - 1 && <span className="w-6 sm:w-12 h-px bg-saif-border" />}
            </li>
          ))}
        </ol>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
          {/* ---------- Main column ---------- */}
          <div className="lg:col-span-3">
            {/* STEP 0 — Information */}
            {step === 0 && (
              <section aria-label="Customer information" className="space-y-5">
                <h2 className="text-sm font-bold uppercase tracking-widest text-saif-text">Contact</h2>
                <Field label="Full Name" required error={errors.name} htmlFor="co-name">
                  <input id="co-name" className="input" value={info.name} onChange={e => setField('name', e.target.value)} autoComplete="name" />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Email" required error={errors.email} htmlFor="co-email">
                    <input id="co-email" type="email" className="input" value={info.email} onChange={e => setField('email', e.target.value)} autoComplete="email" />
                  </Field>
                  <Field label="Phone" required error={errors.phone} hint="Egyptian mobile — 01xxxxxxxxx" htmlFor="co-phone">
                    <input id="co-phone" type="tel" dir="ltr" className="input" value={info.phone} onChange={e => setField('phone', e.target.value)} autoComplete="tel" />
                  </Field>
                </div>

                {needsShipping && (
                  <>
                    <h2 className="text-sm font-bold uppercase tracking-widest text-saif-text pt-4">Delivery</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="Governorate" required error={errors.governorate} htmlFor="co-gov">
                        <select id="co-gov" className="input bg-[#0A0A0A]" value={info.governorate} onChange={e => setField('governorate', e.target.value)}>
                          <option value="">Select…</option>
                          {EGYPT_GOVERNORATES.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </Field>
                      <Field label="City / Area" required error={errors.city} htmlFor="co-city">
                        <input id="co-city" className="input" value={info.city} onChange={e => setField('city', e.target.value)} />
                      </Field>
                    </div>
                    <Field label="Full Address" required error={errors.address} hint="Street, building, floor, apartment." htmlFor="co-address">
                      <textarea id="co-address" rows={2} className="input resize-none" value={info.address} onChange={e => setField('address', e.target.value)} />
                    </Field>
                  </>
                )}

                <Field label="Order Notes (optional)" htmlFor="co-notes">
                  <textarea id="co-notes" rows={2} className="input resize-none" value={info.notes} onChange={e => setField('notes', e.target.value)} placeholder="Delivery instructions, preferred time…" />
                </Field>

                <button onClick={goFromInformation} className="btn btn-primary w-full">
                  Continue to Review <ArrowRight size={14} className="ml-2" />
                </button>
              </section>
            )}

            {/* STEP 1 — Review */}
            {step === 1 && (
              <section aria-label="Review order" className="space-y-6">
                <div className="border border-saif-border divide-y divide-[rgba(245,240,232,0.08)]">
                  {items.map(item => (
                    <div key={item.id} className="flex items-center gap-4 p-4">
                      <img
                        src={item.product.thumbnail || item.product.images?.[0] || ''}
                        alt={item.product.name}
                        className="w-14 h-[4.5rem] object-cover bg-[#111]"
                        loading="lazy"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-saif-text truncate">{item.product.name}</p>
                        <p className="text-xs text-saif-dim mt-0.5">
                          {item.variant ? `${item.variant.name} · ` : ''}Qty {item.quantity} · {item.product.product_type === 'digital' ? 'Digital' : 'Physical'}
                        </p>
                      </div>
                      <Price value={(item.variant?.price ?? item.product.price) * item.quantity} className="text-sm font-semibold text-saif-text" />
                    </div>
                  ))}
                </div>

                <div className="border border-saif-border p-5 space-y-2 text-sm">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-saif-text mb-3">Deliver To</h3>
                  <p className="text-saif-text font-medium">{info.name}</p>
                  <p className="text-saif-dim">{info.email} · <span dir="ltr">{info.phone}</span></p>
                  {needsShipping ? (
                    <p className="text-saif-dim">{info.address}, {info.city}, {info.governorate}</p>
                  ) : (
                    <p className="text-saif-dim">Digital order — no shipping needed.</p>
                  )}
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setStep(0)} className="btn flex-1"><ArrowLeft size={14} className="mr-2" /> Back</button>
                  <button onClick={() => { setStep(2); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="btn btn-primary flex-1">
                    Continue to Payment <ArrowRight size={14} className="ml-2" />
                  </button>
                </div>
              </section>
            )}

            {/* STEP 2 — Payment */}
            {step === 2 && (
              <section aria-label="Payment" className="space-y-6">
                <div className="bg-[#0A0A0A] border border-saif-accent/30 p-4 flex gap-3 items-start">
                  <CreditCard size={16} className="text-saif-accent mt-0.5 shrink-0" />
                  <p className="text-xs text-saif-dim leading-relaxed">
                    SAIF STORE uses <span className="text-saif-text font-semibold">manual payment verification</span>.
                    You transfer the total with InstaPay or Vodafone Cash, upload the receipt, and our team
                    confirms it — usually within a few hours. Nothing is charged automatically.
                  </p>
                </div>

                {/* Method selection */}
                <div>
                  <p className="label">Payment Method <span className="text-saif-accent">*</span></p>
                  <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Payment method">
                    {PAYMENT_METHODS.map(m => (
                      <button
                        key={m.id}
                        role="radio"
                        aria-checked={method === m.id}
                        onClick={() => { setMethod(m.id); setErrors(prev => ({ ...prev, method: undefined })) }}
                        className={`p-4 border text-left transition-colors ${
                          method === m.id ? 'border-saif-accent bg-saif-accent/10' : 'border-saif-border hover:border-saif-text'
                        }`}
                      >
                        {m.id === 'instapay' ? <Smartphone size={18} className={method === m.id ? 'text-saif-accent' : 'text-saif-dim'} /> : <Wallet size={18} className={method === m.id ? 'text-saif-accent' : 'text-saif-dim'} />}
                        <p className="mt-2 text-sm font-bold text-saif-text">{m.name}</p>
                        <p className="text-xs text-saif-dim mt-0.5">Manual verification</p>
                      </button>
                    ))}
                  </div>
                  {errors.method && <p className="text-xs text-red-400 mt-2" role="alert">{errors.method}</p>}
                </div>

                {methodMeta && (
                  <>
                    {/* Transfer destination */}
                    <div className="border border-saif-border p-5">
                      <p className="text-xs font-bold uppercase tracking-widest text-saif-dim">Send exactly</p>
                      <p className="text-2xl font-black text-saif-text mt-1">{formatPrice(total, currency)}</p>
                      <p className="text-xs font-bold uppercase tracking-widest text-saif-dim mt-5">To ({methodMeta.name})</p>
                      <div className="mt-1 flex items-center gap-3">
                        <p dir="ltr" className="text-xl font-bold tracking-wider text-saif-accent">{paymentNumber}</p>
                        <button
                          onClick={async () => {
                            const ok = await copyToClipboard(paymentNumber)
                            addToast(ok ? 'Number copied' : 'Could not copy', ok ? 'success' : 'error')
                          }}
                          className="p-1.5 border border-saif-border text-saif-dim hover:text-saif-text transition-colors"
                          aria-label="Copy payment number"
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                      <ol className="mt-5 space-y-1.5 list-decimal list-inside text-xs text-saif-dim leading-relaxed">
                        {methodMeta.instructions.map((line, i) => <li key={i}>{line}</li>)}
                      </ol>
                    </div>

                    {/* Evidence form */}
                    <div className="space-y-4">
                      <Field
                        label={method === 'vodafone_cash' ? 'Your Vodafone Cash number' : 'Your InstaPay account / phone number'}
                        required
                        error={errors.payer_identifier}
                        hint="The number you transferred FROM — used to match your payment."
                        htmlFor="pay-payer"
                      >
                        <input id="pay-payer" dir="ltr" className="input" value={payerIdentifier} onChange={e => { setPayerIdentifier(e.target.value); setErrors(p => ({ ...p, payer_identifier: undefined })) }} placeholder="01xxxxxxxxx" />
                      </Field>

                      <Field
                        label="Amount you transferred"
                        required
                        error={errors.transferred_amount}
                        hint={amountMismatch(transferredAmount === '' ? '' : Number(transferredAmount), total)
                          ? `Heads up: the order total is ${formatPrice(total, currency)}. If the amounts differ, verification may take longer.`
                          : `Should equal the order total: ${formatPrice(total, currency)}`}
                        htmlFor="pay-amount"
                      >
                        <input id="pay-amount" type="number" min="0" step="0.01" inputMode="decimal" className="input" value={transferredAmount} onChange={e => { setTransferredAmount(e.target.value); setErrors(p => ({ ...p, transferred_amount: undefined })) }} />
                      </Field>

                      <Field label="Optional note" htmlFor="pay-note">
                        <input id="pay-note" className="input" value={paymentNote} onChange={e => setPaymentNote(e.target.value)} placeholder="e.g. transferred from another name" />
                      </Field>

                      <div>
                        <p className="label">Transfer Screenshot <span className="text-saif-accent">*</span></p>
                        {filePreview ? (
                          <div className="relative border border-saif-border inline-block">
                            <img src={filePreview} alt="Payment screenshot preview" className="max-h-48" />
                            <button
                              onClick={() => { setFile(null); if (filePreview) URL.revokeObjectURL(filePreview); setFilePreview(null) }}
                              className="absolute top-2 right-2 p-1.5 bg-black/80 text-saif-text hover:text-saif-accent transition-colors"
                              aria-label="Remove screenshot"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center gap-2 border border-dashed border-saif-border hover:border-saif-text transition-colors cursor-pointer p-8 text-center">
                            <Upload size={20} className="text-saif-dim" />
                            <span className="text-sm text-saif-text">Choose screenshot</span>
                            <span className="text-xs text-saif-dim">PNG, JPG or WEBP · max 5 MB</span>
                            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange} className="sr-only" />
                          </label>
                        )}
                        {errors.screenshot_path && <p className="text-xs text-red-400 mt-2" role="alert">{errors.screenshot_path}</p>}
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button onClick={() => setStep(1)} disabled={placing} className="btn flex-1">
                        <ArrowLeft size={14} className="mr-2" /> Back
                      </button>
                      <button onClick={submitOrder} disabled={placing} className="btn btn-primary flex-[2]">
                        {placing ? (placeStatus || 'Submitting…') : 'Submit Order & Payment'}
                      </button>
                    </div>
                  </>
                )}
              </section>
            )}
          </div>

          {/* ---------- Summary sidebar ---------- */}
          <aside className="lg:col-span-2">
            <div className="border border-saif-border p-6 lg:sticky lg:top-24">
              <h2 className="text-sm font-bold uppercase tracking-widest text-saif-text mb-5">Summary</h2>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between text-saif-dim">
                  <span>Subtotal ({items.reduce((s, i) => s + i.quantity, 0)} items)</span>
                  <Price value={subtotal} className="text-saif-text" />
                </div>
                {coupon && (
                  <div className="flex justify-between text-green-400">
                    <span>Coupon {coupon.code}</span>
                    <span>−{formatPrice(discount, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-saif-dim">
                  <span>Shipping</span>
                  <span>{needsShipping ? (shipping === 0 ? 'Free' : formatPrice(shipping, currency)) : '—'}</span>
                </div>
                <div className="border-t border-saif-border pt-3 flex justify-between text-base font-bold text-saif-text">
                  <span>Total</span>
                  <Price value={total} className="text-saif-text" />
                </div>
              </div>
              {settings?.minimum_order_amount != null && subtotal < settings.minimum_order_amount && (
                <p className="mt-4 text-xs text-red-400" role="alert">
                  Minimum order is {formatPrice(settings.minimum_order_amount, currency)}.
                </p>
              )}
              <p className="mt-4 text-xs text-saif-dim leading-relaxed">
                Payment is verified manually. Your order ships / is fulfilled only after approval.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

class RecoverableError extends Error {
  orderId: string
  constructor(orderId: string, message: string) {
    super(message)
    this.orderId = orderId
  }
}
