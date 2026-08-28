import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Check,
  ChevronLeft,
  Upload,
  X,
  FileImage,
  Smartphone,
  Landmark,
  ShieldCheck,
  Loader2,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useCart } from '@/context/CartContext'
import { useToast } from '@/context/ToastContext'
import { useApp } from '@/context/AppContext'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useI18n } from '@/i18n'
import { placeOrder, submitPayment } from '@/lib/api'
import { uploadPaymentScreenshot, getPaymentInstructions } from '@/lib/payments'
import {
  validateFullName,
  validateEmail,
  validatePhone,
  validateGovernorate,
  validateCity,
  validateAddress,
  validatePayerIdentifier,
  validateAmount,
  validateScreenshotFile,
  normalizePhone,
  type FieldErrors,
} from '@/lib/validation'
import { EGYPT_GOVERNORATES, MAX_SCREENSHOT_SIZE_MB } from '@/lib/constants'
import { formatPrice, cn } from '@/lib/utils'
import { effectiveStock } from '@/lib/pricing'
import Footer from '@/components/Footer'
import EmptyState from '@/components/EmptyState'
import Loading from '@/components/Loading'
import type { PaymentMethod } from '@/types'

type Step = 'information' | 'payment' | 'verification'

const STEPS: { id: Step; labelKey: string }[] = [
  { id: 'information', labelKey: 'checkout.steps.information' },
  { id: 'payment', labelKey: 'checkout.steps.payment' },
  { id: 'verification', labelKey: 'checkout.steps.proof' },
]

export default function CheckoutPage() {
  const { t, lang, formatPrice, isRTL } = useI18n()
  const navigate = useNavigate()
  const { user, profile, loading: authLoading } = useAuth()
  const {
    items,
    count,
    subtotal,
    discount,
    shipping,
    total,
    coupon,
    couponChecking,
    couponError,
    hasPhysical,
    applyCoupon,
    removeCoupon,
    clearCartSilently,
  } = useCart()
  const { settings } = useApp()
  const { addToast } = useToast()
  usePageMeta({
    title: 'Checkout',
    description: 'Complete your SAIF STORE order with InstaPay or Vodafone Cash.',
  })

  const [step, setStep] = useState<Step>('information')
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    name: profile?.full_name || '',
    email: user?.email || '',
    phone: profile?.phone || '',
    governorate: '',
    city: '',
    address: '',
    notes: '',
  })
  const [errors, setErrors] = useState<FieldErrors>({})

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null)

  const [payerIdentifier, setPayerIdentifier] = useState('')
  const [transferredAmount, setTransferredAmount] = useState('')
  const [customerNote, setCustomerNote] = useState('')
  const [screenshot, setScreenshot] = useState<File | null>(null)
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const currency = settings?.currency ?? 'EGP'
  const receivingNumber = settings?.payment_number || '01040324811'

  const availableMethods = useMemo(() => {
    const methods: { id: PaymentMethod; label: string; description: string; icon: typeof Smartphone; enabled: boolean }[] = [
      {
        id: 'instapay',
        label: t('checkout.instapay'),
        description: t('checkout.instapayDesc'),
        icon: Landmark,
        enabled: settings?.instapay_enabled !== false,
      },
      {
        id: 'vodafone_cash',
        label: t('checkout.vodafoneCash'),
        description: t('checkout.vodafoneCashDesc'),
        icon: Smartphone,
        enabled: settings?.vodafone_cash_enabled !== false,
      },
    ]
    return methods
  }, [settings])

  const [couponCode, setCouponCode] = useState('')

  // Stock sanity check for display (the server enforces it authoritatively)
  const stockIssues = items.filter(i => i.product.product_type !== 'digital' && i.quantity > effectiveStock(i))

  // ------------------------------------------------------------------
  // Step validation
  // ------------------------------------------------------------------

  function validateInformationStep(): boolean {
    const errs: FieldErrors = {}
    errs.name = validateFullName(form.name)
    errs.email = validateEmail(form.email)
    errs.phone = validatePhone(form.phone)
    if (hasPhysical) {
      errs.governorate = validateGovernorate(form.governorate)
      errs.city = validateCity(form.city)
      errs.address = validateAddress(form.address)
    }
    const next = Object.fromEntries(Object.entries(errs).filter(([, v]) => v)) as FieldErrors
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function validatePaymentStep(): boolean {
    if (!paymentMethod) {
      addToast(t('checkout.errors.chooseMethod'), 'error')
      return false
    }
    return true
  }

  function validateVerificationStep(): boolean {
    if (!paymentMethod) return false
    const errs: FieldErrors = {}
    errs.payerIdentifier = validatePayerIdentifier(payerIdentifier, paymentMethod)
    errs.transferredAmount = validateAmount(transferredAmount, total)
    if (!screenshot) errs.screenshot = 'Upload a screenshot of your transfer'
    setErrors(errs)
    const valid = Object.values(errs).every(v => !v)
    if (!valid) addToast(t('checkout.errors.completeDetails'), 'error')
    return valid
  }

  function goNext() {
    if (step === 'information') {
      if (!validateInformationStep()) return
      setStep('payment')
    } else if (step === 'payment') {
      if (!validatePaymentStep()) return
      setStep('verification')
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function goBack() {
    if (step === 'verification') setStep('payment')
    else if (step === 'payment') setStep('information')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ------------------------------------------------------------------
  // Screenshot handling
  // ------------------------------------------------------------------

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const err = validateScreenshotFile(file)
    if (err) {
      setErrors(prev => ({ ...prev, screenshot: err }))
      addToast(err, 'error')
      e.target.value = ''
      return
    }
    setErrors(prev => ({ ...prev, screenshot: undefined }))
    setScreenshot(file)
    const reader = new FileReader()
    reader.onload = () => setScreenshotPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  function clearScreenshot() {
    setScreenshot(null)
    setScreenshotPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ------------------------------------------------------------------
  // Submit
  // ------------------------------------------------------------------

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !paymentMethod || items.length === 0) return
    if (!validateInformationStep() || !validateVerificationStep()) {
      setStep('verification')
      return
    }

    setSubmitting(true)
    try {
      // 1. Place the order atomically (server computes totals, reserves stock,
      //    creates the order, items and awaiting payment record).
      const { result, error: orderError } = await placeOrder({
        customer: {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: normalizePhone(form.phone),
        },
        items: items.map(i => ({
          product_id: i.product.id,
          variant_id: i.variant?.id ?? null,
          quantity: i.quantity,
        })),
        couponCode: coupon?.code ?? null,
        paymentMethod,
        shipping: hasPhysical
          ? {
              address: form.address.trim(),
              governorate: form.governorate,
              city: form.city.trim(),
            }
          : null,
        notes: form.notes.trim() || null,
      })

      if (orderError || !result) {
        addToast(orderError || t('errors.generic'), 'error')
        setSubmitting(false)
        return
      }

      // 2. Upload the payment screenshot to private storage.
      setUploadProgress(5)
      const upload = await uploadPaymentScreenshot(
        user.id,
        screenshot!,
        result.order_id,
        p => setUploadProgress(Math.max(5, Math.round(p * 0.4))),
      )

      if (upload.error || !upload.path) {
        // The order exists with status awaiting_payment — the customer can
        // retry the upload from their order page.
        addToast(
          `Order ${result.order_number} created, but the screenshot upload failed. Open it from your orders page to submit payment proof.`,
          'error',
        )
        clearCartSilently()
        navigate(`/orders/${result.order_id}`)
        return
      }

      // 3. Submit the payment for manual review.
      const { error: paymentError } = await submitPayment({
        orderId: result.order_id,
        payerIdentifier: payerIdentifier.trim(),
        transferredAmount: Number(transferredAmount),
        screenshotPath: upload.path,
        customerNote: customerNote.trim() || null,
      })

      if (paymentError) {
        addToast(
          `Order ${result.order_number} created, but the payment submission failed: ${paymentError}. You can retry from your order page.`,
          'error',
        )
        clearCartSilently()
        navigate(`/orders/${result.order_id}`)
        return
      }

      clearCartSilently()
      addToast(t('payment.submittedToast'))
      navigate(`/orders/${result.order_id}/confirmation`)
    } catch (err) {
      addToast(t('errors.generic'), 'error')
    } finally {
      setSubmitting(false)
      setUploadProgress(0)
    }
  }

  // ------------------------------------------------------------------
  // Guards
  // ------------------------------------------------------------------

  if (authLoading) {
    return (
      <div className="pt-28">
        <Loading />
        <Footer />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="pt-28 px-5 min-h-[70vh]">
        <EmptyState
          title={t('checkout.signInRequired')}
          description={t('checkout.signInRequiredDesc')}
          action={
            <Link to="/login?redirect=/checkout" className="btn btn-primary">
              Sign In
            </Link>
          }
        />
        <Footer />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="pt-28 px-5 min-h-[70vh]">
        <EmptyState
          title={t('checkout.emptyCart')}
          description={t('checkout.emptyCartDesc')}
          action={
            <Link to="/products" className="btn btn-primary">
              Continue Shopping
            </Link>
          }
        />
        <Footer />
      </div>
    )
  }

  const stepIndex = STEPS.findIndex(s => s.id === step)

  return (
    <div className="animate-[pageIn_0.6s_ease] pt-24 md:pt-28 px-5 lg:px-10 pb-20">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-[clamp(34px,5vw,60px)] font-black tracking-tighter text-saif-text mb-8">{t('checkout.title')}</h1>

        {/* Step indicator */}
        <ol className="flex items-center gap-2 sm:gap-3 mb-12" aria-label={t('checkout.title')}>
          {STEPS.map((s, i) => (
            <li key={s.id} className="flex items-center gap-2 sm:gap-3 flex-1 last:flex-none">
              <button
                type="button"
                onClick={() => {
                  if (i < stepIndex) {
                    setStep(s.id)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }
                }}
                disabled={i > stepIndex || submitting}
                className={cn(
                  'flex items-center gap-3 min-h-[44px] px-1 -my-1 rounded-sm',
                  i < stepIndex && !submitting && 'cursor-pointer hover:opacity-80 transition-opacity',
                )}
                aria-current={i === stepIndex ? 'step' : undefined}
              >
                <span
                  className={cn(
                    'w-9 h-9 rounded-full border flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all duration-500 ease-saif',
                    i < stepIndex
                      ? 'bg-saif-text text-black border-saif-text'
                      : i === stepIndex
                        ? 'border-saif-accent text-saif-accent shadow-[0_0_0_4px_rgba(230,57,70,0.12)]'
                        : 'border-saif-border text-saif-faint',
                  )}
                >
                  {i < stepIndex ? <Check size={14} /> : i + 1}
                </span>
                <span
                  className={cn(
                    'text-[11px] font-semibold uppercase tracking-[0.14em] hidden sm:block',
                    i === stepIndex ? 'text-saif-text' : i < stepIndex ? 'text-saif-dim' : 'text-saif-faint',
                  )}
                >
                  {t(s.labelKey)}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <span className="flex-1 h-px bg-saif-border relative overflow-hidden" aria-hidden="true">
                  {i < stepIndex && <span className="absolute inset-0 bg-saif-accent transition-all duration-700" />}
                </span>
              )}
            </li>
          ))}
        </ol>

        {stockIssues.length > 0 && (
          <div className="border border-yellow-500/40 bg-yellow-500/10 text-yellow-400 text-sm px-4 py-3 mb-6 rounded-sm">
            Some items in your bag exceed available stock: {stockIssues.map(i => i.product.name).join(', ')}. Update
            quantities in your <Link to="/cart" className="underline">{t('checkout.bagLink')}</Link> before continuing.
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-10">
          <form onSubmit={handleSubmit} noValidate>
            {/* ============ STEP 1: INFORMATION ============ */}
            {step === 'information' && (
              <div className="space-y-8 animate-scaleIn">
                <section>
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-saif-dim mb-5">{t('checkout.customerInfo')}</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="label" htmlFor="co-name">{t('checkout.fullName')}</label>
                      <input
                        id="co-name"
                        className={cn('input', errors.name && 'input-error')}
                        value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                        autoComplete="name"
                      />
                      {errors.name && <p className="field-error">{errors.name}</p>}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="label" htmlFor="co-email">{t('checkout.email')}</label>
                        <input
                          id="co-email"
                          type="email"
                          className={cn('input', errors.email && 'input-error')}
                          value={form.email}
                          onChange={e => setForm({ ...form, email: e.target.value })}
                          autoComplete="email"
                        />
                        {errors.email && <p className="field-error">{errors.email}</p>}
                      </div>
                      <div>
                        <label className="label" htmlFor="co-phone">{t('checkout.phone')}</label>
                        <input
                          id="co-phone"
                          type="tel"
                          className={cn('input', errors.phone && 'input-error')}
                          value={form.phone}
                          onChange={e => setForm({ ...form, phone: e.target.value })}
                          placeholder="01xxxxxxxxx"
                          autoComplete="tel"
                        />
                        {errors.phone && <p className="field-error">{errors.phone}</p>}
                      </div>
                    </div>
                  </div>
                </section>

                {hasPhysical && (
                  <section>
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-saif-dim mb-5">{t('checkout.deliveryInfo')}</h2>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="label" htmlFor="co-gov">{t('checkout.governorate')}</label>
                          <select
                            id="co-gov"
                            className={cn('input', errors.governorate && 'input-error')}
                            value={form.governorate}
                            onChange={e => setForm({ ...form, governorate: e.target.value })}
                          >
                            <option value="">{t('checkout.selectGovernorate')}</option>
                            {EGYPT_GOVERNORATES.map(g => (
                              <option key={g} value={g} className="bg-black">{g}</option>
                            ))}
                          </select>
                          {errors.governorate && <p className="field-error">{errors.governorate}</p>}
                        </div>
                        <div>
                          <label className="label" htmlFor="co-city">{t('checkout.city')}</label>
                          <input
                            id="co-city"
                            className={cn('input', errors.city && 'input-error')}
                            value={form.city}
                            onChange={e => setForm({ ...form, city: e.target.value })}
                            placeholder={t('checkout.city')}
                          />
                          {errors.city && <p className="field-error">{errors.city}</p>}
                        </div>
                      </div>
                      <div>
                        <label className="label" htmlFor="co-address">{t('checkout.address')}</label>
                        <input
                          id="co-address"
                          className={cn('input', errors.address && 'input-error')}
                          value={form.address}
                          onChange={e => setForm({ ...form, address: e.target.value })}
                          placeholder={t('checkout.addressPlaceholder')}
                          autoComplete="street-address"
                        />
                        {errors.address && <p className="field-error">{errors.address}</p>}
                      </div>
                    </div>
                  </section>
                )}

                {!hasPhysical && (
                  <p className="text-sm text-saif-dim">
                    Your bag contains digital products only — no delivery address is needed. Digital items are
                    delivered after payment verification.
                  </p>
                )}

                <section>
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-saif-dim mb-5">{t('checkout.orderNotes')}</h2>
                  <textarea
                    className="input resize-none"
                    rows={3}
                    value={form.notes}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                    placeholder={t('checkout.notesPlaceholder')}
                  />
                </section>

                <button type="button" onClick={goNext} className="btn btn-primary w-full sm:w-auto">
                  {t('checkout.continueToPayment')} <ChevronLeft size={14} className="rotate-180" />
                </button>
              </div>
            )}

            {/* ============ STEP 2: PAYMENT METHOD ============ */}
            {step === 'payment' && (
              <div className="space-y-8 animate-scaleIn">
                <section>
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-saif-dim mb-2">{t('checkout.paymentMethod')}</h2>
                  <p className="text-xs text-saif-faint mb-5">
                    {t('checkout.paymentMethodDesc')}
                  </p>

                  <div className="space-y-3" role="radiogroup" aria-label={t('checkout.paymentMethod')}>
                    {availableMethods.map(method => (
                      <label
                        key={method.id}
                        className={cn(
                          'flex items-start gap-4 border p-5 cursor-pointer transition-all rounded-sm',
                          paymentMethod === method.id
                            ? 'border-saif-text bg-white/[0.03]'
                            : 'border-saif-border hover:border-saif-dim',
                          !method.enabled && 'opacity-40 pointer-events-none',
                        )}
                      >
                        <input
                          type="radio"
                          name="payment-method"
                          className="sr-only"
                          checked={paymentMethod === method.id}
                          onChange={() => setPaymentMethod(method.id)}
                          disabled={!method.enabled}
                        />
                        <method.icon size={22} className={paymentMethod === method.id ? 'text-saif-accent' : 'text-saif-dim'} />
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-saif-text">{method.label}</span>
                            {paymentMethod === method.id && <Check size={16} className="text-saif-accent" />}
                          </div>
                          <p className="text-xs text-saif-dim mt-1">{method.description}</p>
                          {!method.enabled && <p className="text-xs text-saif-dim mt-1">{t('checkout.methodUnavailable')}</p>}
                        </div>
                      </label>
                    ))}
                  </div>
                </section>

                <section className="border border-saif-border p-5 rounded-sm">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-saif-dim mb-3">{t('checkout.howManualWorks')}</h3>
                  <ol className="space-y-2 text-xs text-saif-dim leading-relaxed list-decimal list-inside">
                    <li>{t('checkout.howManual1')}</li>
                    <li>{t('checkout.howManual2')}</li>
                    <li>{t('checkout.howManual3')}</li>
                    <li>{t('checkout.howManual4')}</li>
                  </ol>
                </section>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button type="button" onClick={goBack} className="btn" disabled={submitting}>
                    <ChevronLeft size={14} /> Back
                  </button>
                  <button type="button" onClick={goNext} className="btn btn-primary sm:flex-1">
                    {t('checkout.continueToProof')}
                  </button>
                </div>
              </div>
            )}

            {/* ============ STEP 3: PAYMENT VERIFICATION ============ */}
            {step === 'verification' && paymentMethod && (
              <div className="space-y-8 animate-scaleIn">
                {/* Payment instructions — unmistakable hierarchy */}
                <section className="relative border border-saif-accent/40 bg-saif-accent/[0.04] p-6 md:p-8 rounded-sm overflow-hidden">
                  <span className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-saif-accent via-saif-accent/40 to-transparent" aria-hidden="true" />
                  <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
                    <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-saif-text flex items-center gap-2.5">
                      <ShieldCheck size={16} className="text-saif-accent" />
                      {paymentMethod === 'instapay' ? 'InstaPay' : 'Vodafone Cash'} Transfer
                    </h2>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-saif-faint">
                      Verified manually by our team
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-5 sm:gap-8 items-center mb-7">
                    <div>
                      <p className="label mb-2.5">{t('checkout.sendToThisNumber')}</p>
                      <button
                        type="button"
                        className="group w-full flex items-center justify-between gap-4 font-mono text-2xl md:text-[28px] font-bold tracking-[0.12em] text-saif-text border border-saif-text/60 px-5 py-4 hover:border-saif-accent hover:text-saif-accent transition-colors rounded-sm"
                        title="Click to copy"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(receivingNumber)
                            addToast(t('payment.numberCopied'))
                          } catch {
                            addToast(receivingNumber, 'info')
                          }
                        }}
                      >
                        <span dir="ltr">{receivingNumber}</span>
                        <span className="text-[10px] font-sans font-semibold uppercase tracking-[0.15em] text-saif-faint group-hover:text-saif-accent transition-colors">
                          {t('common.copy')}
                        </span>
                      </button>
                    </div>
                    <div className="sm:text-right sm:border-l sm:border-saif-border sm:pl-8">
                      <p className="label mb-1 sm:mb-2.5">{t('checkout.exactAmount')}</p>
                      <p className="text-3xl font-black text-saif-accent tabular-nums tracking-tight">
                        {formatPrice(total)}
                      </p>
                    </div>
                  </div>

                  <ol className="space-y-2.5">
                    {getPaymentInstructions(paymentMethod, receivingNumber, lang).map((line, i) => (
                      <li key={line} className="flex gap-3.5 items-start text-sm text-saif-dim leading-relaxed">
                        <span className="text-[11px] font-bold text-saif-accent tabular-nums pt-0.5 flex-shrink-0">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        {line}
                      </li>
                    ))}
                  </ol>
                  {settings?.payment_instructions && (
                    <p className="mt-5 text-xs text-saif-dim italic border-t border-saif-border pt-4">
                      {settings.payment_instructions}
                    </p>
                  )}
                </section>

                {/* Payment form */}
                <section className="space-y-4">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-saif-dim">{t('checkout.transferTitle')}</h2>

                  <div>
                    <label className="label" htmlFor="payer-id">
                      {paymentMethod === 'vodafone_cash' ? t('checkout.payerNumberVodafone') : t('checkout.payerNumber')}
                    </label>
                    <input
                      id="payer-id"
                      className={cn('input', errors.payerIdentifier && 'input-error')}
                      value={payerIdentifier}
                      onChange={e => setPayerIdentifier(e.target.value)}
                      placeholder={paymentMethod === 'vodafone_cash' ? '01xxxxxxxxx' : 'Phone number or InstaPay handle'}
                      inputMode={paymentMethod === 'vodafone_cash' ? 'numeric' : 'text'}
                    />
                    {errors.payerIdentifier && <p className="field-error">{errors.payerIdentifier}</p>}
                  </div>

                  <div>
                    <label className="label" htmlFor="transferred-amount">{t('checkout.transferredAmount')}</label>
                    <input
                      id="transferred-amount"
                      type="number"
                      step="0.01"
                      min="0"
                      className={cn('input', errors.transferredAmount && 'input-error')}
                      value={transferredAmount}
                      onChange={e => setTransferredAmount(e.target.value)}
                      placeholder={String(total)}
                    />
                    {errors.transferredAmount ? (
                      <p className="field-error">{errors.transferredAmount}</p>
                    ) : (
                      <p className="text-xs text-saif-dim mt-1.5">
                        {t('checkout.transferredAmountHint', { amount: formatPrice(total) })}
                      </p>
                    )}
                  </div>

                  {/* Screenshot upload */}
                  <div>
                    <span className="label">{t('checkout.uploadScreenshot')} *</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleFileSelect}
                      className="sr-only"
                      id="screenshot-input"
                    />

                    {!screenshot ? (
                      <label
                        htmlFor="screenshot-input"
                        className={cn(
                          'group flex flex-col items-center justify-center gap-4 border border-dashed p-10 md:p-12 cursor-pointer transition-all duration-300 rounded-sm text-center',
                          errors.screenshot
                            ? 'border-saif-accent/60 bg-saif-accent/5'
                            : 'border-saif-border hover:border-saif-accent/60 hover:bg-white/[0.02]',
                        )}
                      >
                        <span className="w-14 h-14 rounded-full border border-saif-border flex items-center justify-center group-hover:border-saif-accent/50 transition-colors">
                          <Upload size={22} className="text-saif-dim group-hover:text-saif-accent transition-colors" />
                        </span>
                        <span className="text-sm text-saif-text font-medium">
                          {t('checkout.uploadCta')}
                        </span>
                        <span className="text-xs text-saif-faint">{t('checkout.uploadHint', { size: MAX_SCREENSHOT_SIZE_MB })}</span>
                      </label>
                    ) : (
                      <div className="border border-saif-border p-3 rounded-sm">
                        <div className="flex items-center gap-3">
                          <div className="w-16 h-16 bg-saif-panel overflow-hidden rounded-sm flex-shrink-0">
                            {screenshotPreview && (
                              <img src={screenshotPreview} alt="Screenshot preview" className="w-full h-full object-cover" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-saif-text truncate flex items-center gap-1.5">
                              <FileImage size={14} className="text-saif-accent flex-shrink-0" />
                              {screenshot.name}
                            </p>
                            <p className="text-xs text-saif-dim mt-0.5">
                              {(screenshot.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={clearScreenshot}
                            className="p-2 text-saif-dim hover:text-saif-accent transition-colors"
                            aria-label={t('a11y.removeItem', { name: t('checkout.uploadScreenshot') })}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    )}
                    {errors.screenshot && <p className="field-error">{errors.screenshot}</p>}
                  </div>

                  <div>
                    <label className="label" htmlFor="customer-note">{t('checkout.customerNote')}</label>
                    <textarea
                      id="customer-note"
                      className="input resize-none"
                      rows={2}
                      value={customerNote}
                      onChange={e => setCustomerNote(e.target.value)}
                      placeholder={t('checkout.customerNotePlaceholder')}
                    />
                  </div>
                </section>

                {submitting && (
                  <div className="border border-saif-border p-4 rounded-sm" aria-live="polite">
                    <p className="text-sm text-saif-text flex items-center gap-2 mb-2">
                      <Loader2 size={15} className="animate-spin text-saif-accent" />
                      {uploadProgress > 0 ? t('checkout.uploadingProof') : t('checkout.placingOrder')}
                    </p>
                    <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-saif-accent transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                        role="progressbar"
                        aria-valuenow={uploadProgress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      />
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                  <button type="button" onClick={goBack} className="btn" disabled={submitting}>
                    <ChevronLeft size={14} /> Back
                  </button>
                  <button type="submit" className="btn btn-primary sm:flex-1" disabled={submitting}>
                    {submitting ? 'Processing…' : `Submit Payment — ${formatPrice(total)}`}
                  </button>
                </div>
                <p className="text-xs text-saif-dim">
                  {t('checkout.neverAutoApproved')}
                </p>
              </div>
            )}
          </form>

          {/* ============ ORDER SUMMARY ============ */}
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="border border-saif-border p-6 rounded-sm">
              <h2 className="text-sm font-bold uppercase tracking-wider text-saif-text mb-5">{t('cart.orderSummary')}</h2>

              <div className="space-y-3 mb-5 max-h-64 overflow-y-auto pr-1">
                {items.map(item => (
                  <div key={item.id} className="flex gap-3">
                    <div className="w-12 h-14 bg-saif-panel overflow-hidden flex-shrink-0 rounded-sm">
                      <img
                        src={item.variant?.image || item.product.thumbnail || item.product.images?.[0] || ''}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-saif-text truncate">{item.product.name}</p>
                      {item.variant && <p className="text-[11px] text-saif-dim">{item.variant.name}</p>}
                      <p className="text-[11px] text-saif-dim">Qty {item.quantity}</p>
                    </div>
                    <span className="text-xs font-semibold text-saif-text flex-shrink-0">
                      {formatPrice((item.variant?.price ?? item.product.price) * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Coupon */}
              {coupon ? (
                <div className="flex items-center justify-between border border-green-500/30 bg-green-500/5 px-3 py-2.5 rounded-sm mb-4">
                  <span className="text-xs font-mono text-green-400">{coupon.code}</span>
                  <button type="button" onClick={removeCoupon} className="text-saif-dim hover:text-saif-accent transition-colors" aria-label={t('cart.removeCoupon')}>
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <div className="mb-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="input text-xs font-mono uppercase"
                      placeholder={t('cart.coupon')}
                      value={couponCode}
                      onChange={e => setCouponCode(e.target.value.toUpperCase())}
                      aria-label={t('cart.coupon')}
                    />
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={async () => {
                        const ok = await applyCoupon(couponCode)
                        if (ok) {
                          addToast(t('cart.applied', { code: couponCode }))
                          setCouponCode('')
                        }
                      }}
                      disabled={couponChecking || !couponCode.trim()}
                    >
                      {couponChecking ? '…' : 'Apply'}
                    </button>
                  </div>
                  {couponError && <p className="field-error">{couponError}</p>}
                </div>
              )}

              <div className="border-t border-saif-border pt-4 space-y-2 text-sm">
                <div className="flex justify-between text-saif-dim">
                  <span>{t('common.subtotal')} ({count})</span>
                  <span className="text-saif-text">{formatPrice(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-saif-dim">
                    <span>{t('common.discount')}</span>
                    <span className="text-green-400">−{formatPrice(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-saif-dim">
                  <span>{t('common.shipping')}</span>
                  <span className={shipping === 0 ? 'text-green-400' : 'text-saif-text'}>
                    {hasPhysical ? (shipping === 0 ? 'Free' : formatPrice(shipping)) : '—'}
                  </span>
                </div>
                <div className="flex justify-between text-base font-bold text-saif-text pt-2 border-t border-saif-border">
                  <span>{t('common.total')}</span>
                  <span>{formatPrice(total)}</span>
                </div>
              </div>

              <p className="text-[11px] text-saif-faint mt-4 leading-relaxed">
                {t('checkout.serverValidated')}
              </p>
            </div>
          </aside>
        </div>
      </div>
      <Footer />
    </div>
  )
}
