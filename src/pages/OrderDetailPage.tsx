import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  Copy,
  RotateCcw,
  Upload,
  X,
  FileImage,
  Clock,
  Zap,
  Truck,
  CheckCircle2,
  Package,
  ShieldCheck,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { useOrder } from '@/hooks/useOrders'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/context/AppContext'
import { useToast } from '@/context/ToastContext'
import { useCart } from '@/context/CartContext'
import { usePageMeta } from '@/hooks/usePageMeta'
import { customerCancelOrder, submitPayment } from '@/lib/api'
import { uploadPaymentScreenshot, createScreenshotSignedUrl, getPaymentInstructions, CUSTOMER_CAN_RESUBMIT } from '@/lib/payments'
import { validatePayerIdentifier, validateAmount, validateScreenshotFile, type FieldErrors } from '@/lib/validation'
import { PAYMENT_METHOD_LABELS, MAX_SCREENSHOT_SIZE_MB } from '@/lib/constants'
import { formatPrice, formatDate, copyToClipboard, cn } from '@/lib/utils'
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/ui/StatusBadge'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Footer from '@/components/Footer'
import Loading from '@/components/Loading'
import EmptyState from '@/components/EmptyState'
import type { Order, OrderEvent, PaymentStatus } from '@/types'

const EVENT_ICONS: Record<string, typeof Clock> = {
  order_created: Package,
  status_change: CheckCircle2,
  payment_submitted: Upload,
  payment_reviewed: ShieldCheck,
  note: FileImage,
  fulfillment: Zap,
  cancellation: AlertTriangle,
}

const TIMELINE_STATUS_ORDER: PaymentStatus[] = ['awaiting_payment', 'payment_submitted', 'under_review', 'approved']

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { order, loading, refetch } = useOrder(id)
  const { settings } = useApp()
  const { addToast } = useToast()
  const { addItem } = useCart()
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  // Payment resubmission state
  const [resubmitOpen, setResubmitOpen] = useState(false)
  const [payerIdentifier, setPayerIdentifier] = useState('')
  const [transferredAmount, setTransferredAmount] = useState('')
  const [customerNote, setCustomerNote] = useState('')
  const [screenshot, setScreenshot] = useState<File | null>(null)
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [urlLoading, setUrlLoading] = useState(false)

  usePageMeta({ title: order ? `Order ${order.order_number}` : 'Order', description: 'Order details and payment status.' })

  const currency = settings?.currency ?? 'EGP'
  const payment = order?.payment ?? null
  const receivingNumber = settings?.payment_number || '01040324811'

  useEffect(() => {
    if (!payment?.screenshot_path) return
    setUrlLoading(true)
    createScreenshotSignedUrl(payment.screenshot_path).then(url => {
      setSignedUrl(url)
      setUrlLoading(false)
    })
  }, [payment?.screenshot_path])

  const canResubmit = payment ? CUSTOMER_CAN_RESUBMIT.includes(payment.payment_status) : false
  const canCancel =
    order &&
    ['payment_review', 'pending'].includes(order.status) &&
    ['awaiting_payment', 'rejected'].includes(order.payment_status ?? '')

  function openResubmit() {
    setPayerIdentifier(payment?.payer_identifier ?? '')
    setTransferredAmount(payment?.expected_amount ? String(payment.expected_amount) : String(order?.total ?? ''))
    setCustomerNote('')
    setScreenshot(null)
    setScreenshotPreview(null)
    setErrors({})
    setResubmitOpen(true)
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const err = validateScreenshotFile(file)
    if (err) {
      setErrors(prev => ({ ...prev, screenshot: err }))
      e.target.value = ''
      return
    }
    setErrors(prev => ({ ...prev, screenshot: undefined }))
    setScreenshot(file)
    const reader = new FileReader()
    reader.onload = () => setScreenshotPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function handleResubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!order || !payment) return
    const errs: FieldErrors = {}
    errs.payerIdentifier = validatePayerIdentifier(payerIdentifier, payment.payment_method)
    errs.transferredAmount = validateAmount(transferredAmount, order.total)
    if (!screenshot && !payment.screenshot_path) errs.screenshot = 'Upload a screenshot of your transfer'
    setErrors(errs)
    if (Object.values(errs).some(v => v)) return

    setSubmitting(true)
    try {
      let path = payment.screenshot_path
      if (screenshot) {
        const upload = await uploadPaymentScreenshot(order.user_id, screenshot, order.id)
        if (upload.error || !upload.path) {
          addToast(upload.error || 'Upload failed — please try again', 'error')
          setSubmitting(false)
          return
        }
        path = upload.path
      }

      const { error } = await submitPayment({
        orderId: order.id,
        payerIdentifier: payerIdentifier.trim(),
        transferredAmount: Number(transferredAmount),
        screenshotPath: path!,
        customerNote: customerNote.trim() || null,
      })
      if (error) {
        addToast(error, 'error')
      } else {
        addToast('Payment resubmitted — under review again')
        setResubmitOpen(false)
        refetch()
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCancel() {
    if (!order) return
    setCancelling(true)
    const { error } = await customerCancelOrder(order.id)
    setCancelling(false)
    setCancelOpen(false)
    if (error) {
      addToast(error, 'error')
    } else {
      addToast('Order cancelled')
      refetch()
    }
  }

  async function handleReorder() {
    if (!order?.items?.length) return
    const { data: products } = await supabase
      .from('products')
      .select('*, categories(*), variants:product_variants(*)')
      .in('id', order.items.map(i => i.product_id))
    let added = 0
    for (const item of order.items) {
      const product = (products || []).find((p: { id: string }) => p.id === item.product_id)
      if (!product || product.status !== 'active') continue
      const variant = product.variants?.find((v: { id: string }) => v.id === item.variant_id) ?? null
      const result = addItem(product, variant, item.quantity)
      if (result.ok) added++
    }
    if (added > 0) {
      addToast(`${added} item${added > 1 ? 's' : ''} added back to your bag`)
      navigate('/cart')
    } else {
      addToast('These items are no longer available', 'error')
    }
  }

  async function handleCopyNumber() {
    if (!order) return
    const ok = await copyToClipboard(order.order_number)
    addToast(ok ? 'Order number copied' : 'Copy failed', ok ? 'success' : 'error')
  }

  if (loading) {
    return (
      <div className="pt-28">
        <Loading />
        <Footer />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="pt-28 px-5">
        <EmptyState
          title="Order not found"
          description="This order does not exist or belongs to another account."
          action={
            <Link to="/orders" className="btn btn-sm">
              My Orders
            </Link>
          }
        />
        <Footer />
      </div>
    )
  }

  const events = (order.events ?? []) as OrderEvent[]
  const shipping = order.shipping_address as { address?: string; governorate?: string; city?: string } | null
  const hasPhysicalItems = order.items?.some(i => i.product_type === 'physical')
  const currentPaymentStep = payment ? TIMELINE_STATUS_ORDER.indexOf(payment.payment_status) : -1

  return (
    <div className="animate-[pageIn_0.6s_ease] pt-24 md:pt-28 px-5 lg:px-10 pb-20">
      <div className="max-w-4xl mx-auto">
        <Link to="/orders" className="text-xs text-saif-dim hover:text-saif-text transition-colors inline-flex items-center gap-1 mb-6">
          ← All Orders
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-saif-text flex items-center gap-3 flex-wrap">
              {order.order_number}
              <button onClick={handleCopyNumber} className="text-saif-dim hover:text-saif-accent transition-colors" aria-label="Copy order number">
                <Copy size={16} />
              </button>
            </h1>
            <p className="text-sm text-saif-dim mt-2">{formatDate(order.created_at, true)}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={order.payment_status} />
          </div>
        </div>

        {/* Payment status banner */}
        {payment && (payment.payment_status === 'awaiting_payment' || payment.payment_status === 'rejected') && (
          <div
            className={cn(
              'border p-5 rounded-sm mb-8',
              payment.payment_status === 'rejected' ? 'border-red-500/40 bg-red-500/[0.04]' : 'border-yellow-500/40 bg-yellow-500/[0.03]',
            )}
          >
            <h2 className="text-sm font-bold text-saif-text flex items-center gap-2 mb-2">
              <AlertTriangle size={15} className={payment.payment_status === 'rejected' ? 'text-red-400' : 'text-yellow-400'} />
              {payment.payment_status === 'rejected' ? 'Payment rejected' : 'Payment pending'}
            </h2>
            {payment.payment_status === 'rejected' ? (
              <p className="text-sm text-saif-dim mb-3">
                Reason: <span className="text-red-400">{payment.rejection_reason}</span>. You can resubmit correct payment
                proof below.
              </p>
            ) : (
              <p className="text-sm text-saif-dim mb-3">
                Transfer {formatPrice(payment.expected_amount, currency)} to {receivingNumber} via{' '}
                {PAYMENT_METHOD_LABELS[payment.payment_method]} and upload your screenshot.
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <button onClick={openResubmit} className="btn btn-sm btn-primary">
                <Upload size={13} /> Submit Payment Proof
              </button>
              {canCancel && (
                <button onClick={() => setCancelOpen(true)} className="btn btn-sm btn-danger">
                  Cancel Order
                </button>
              )}
            </div>
          </div>
        )}

        {payment && payment.payment_status === 'under_review' && (
          <div className="border border-purple-500/40 bg-purple-500/[0.03] p-5 rounded-sm mb-8 flex items-center gap-3">
            <Loader2 size={16} className="text-purple-400 animate-spin" />
            <p className="text-sm text-saif-dim">
              Your payment is <span className="text-purple-400 font-semibold">under review</span>. We verify transfers
              manually — usually within a few hours.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
          <div className="space-y-8">
            {/* Items */}
            <section className="border border-saif-border rounded-sm p-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-saif-text mb-5">Items</h2>
              <div className="space-y-4">
                {order.items?.map(item => (
                  <div key={item.id} className="flex gap-4">
                    <div className="w-16 h-20 bg-saif-panel overflow-hidden flex-shrink-0 rounded-sm">
                      {item.image && <img src={item.image} alt="" className="w-full h-full object-cover" loading="lazy" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-saif-text">{item.product_name}</p>
                          {item.variant_name && <p className="text-xs text-saif-dim mt-0.5">{item.variant_name}</p>}
                          {item.product_type === 'digital' && (
                            <span className="text-[10px] text-saif-accent uppercase tracking-wider">Digital</span>
                          )}
                        </div>
                        <span className="text-sm font-semibold text-saif-text flex-shrink-0">
                          {formatPrice(item.total, currency)}
                        </span>
                      </div>
                      <p className="text-xs text-saif-dim mt-1">
                        {formatPrice(item.price, currency)} × {item.quantity}
                      </p>

                      {/* Digital fulfillment (only shown after payment approval) */}
                      {item.product_type === 'digital' && item.fulfillment_note && order.payment_status === 'approved' && (
                        <div className="mt-3 border border-green-500/30 bg-green-500/5 p-3 rounded-sm">
                          <p className="text-xs font-semibold text-green-400 flex items-center gap-1.5 mb-1">
                            <Zap size={11} /> Digital delivery
                          </p>
                          <p className="text-xs text-saif-dim whitespace-pre-line">{item.fulfillment_note}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-saif-border mt-5 pt-5 space-y-2 text-sm">
                <div className="flex justify-between text-saif-dim">
                  <span>Subtotal</span>
                  <span className="text-saif-text">{formatPrice(order.subtotal, currency)}</span>
                </div>
                {order.discount > 0 && (
                  <div className="flex justify-between text-saif-dim">
                    <span>Discount {order.coupon_code ? <span className="font-mono text-green-400 text-xs">({order.coupon_code})</span> : null}</span>
                    <span className="text-green-400">−{formatPrice(order.discount, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-saif-dim">
                  <span>Shipping</span>
                  <span className="text-saif-text">
                    {hasPhysicalItems ? (order.shipping_fee === 0 ? 'Free' : formatPrice(order.shipping_fee, currency)) : '—'}
                  </span>
                </div>
                <div className="flex justify-between text-base font-bold text-saif-text pt-2 border-t border-saif-border">
                  <span>Total</span>
                  <span>{formatPrice(order.total, currency)}</span>
                </div>
              </div>
            </section>

            {/* Timeline */}
            {events.length > 0 && (
              <section className="border border-saif-border rounded-sm p-6">
                <h2 className="text-sm font-bold uppercase tracking-wider text-saif-text mb-5">Order Timeline</h2>
                <ol className="relative border-l border-saif-border ml-2 space-y-6">
                  {events.map(event => {
                    const Icon = EVENT_ICONS[event.event_type] ?? Clock
                    return (
                      <li key={event.id} className="ml-5">
                        <span className="absolute -left-[13px] w-6 h-6 bg-black border border-saif-border rounded-full flex items-center justify-center">
                          <Icon size={11} className="text-saif-accent" />
                        </span>
                        <p className="text-sm text-saif-text">{event.message || event.event_type.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-saif-dim mt-0.5">{formatDate(event.created_at, true)}</p>
                      </li>
                    )
                  })}
                </ol>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            {/* Payment card */}
            {payment && (
              <section className="border border-saif-border rounded-sm p-5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-saif-text mb-4">Payment</h2>

                {/* Progress steps */}
                <div className="space-y-3 mb-5">
                  {[
                    { key: 'awaiting_payment', label: 'Order placed' },
                    { key: 'payment_submitted', label: 'Proof submitted' },
                    { key: 'under_review', label: 'Under review' },
                    { key: 'approved', label: 'Payment approved' },
                  ].map((step, i) => {
                    const done =
                      i <= currentPaymentStep ||
                      (payment.payment_status === 'rejected' && i <= 1) ||
                      payment.payment_status === 'approved'
                    const rejected = payment.payment_status === 'rejected' && i === 3
                    return (
                      <div key={step.key} className="flex items-center gap-3">
                        <span
                          className={cn(
                            'w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0',
                            rejected
                              ? 'border-red-500 bg-red-500/20'
                              : done
                                ? 'border-green-500 bg-green-500/20'
                                : 'border-saif-border',
                          )}
                        >
                          {rejected ? (
                            <X size={10} className="text-red-400" />
                          ) : done ? (
                            <CheckCircle2 size={10} className="text-green-400" />
                          ) : null}
                        </span>
                        <span className={cn('text-xs', done ? 'text-saif-text' : 'text-saif-faint')}>{step.label}</span>
                      </div>
                    )
                  })}
                </div>

                <dl className="space-y-2.5 text-xs">
                  <div className="flex justify-between gap-2">
                    <dt className="text-saif-dim">Method</dt>
                    <dd className="text-saif-text">{PAYMENT_METHOD_LABELS[payment.payment_method]}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-saif-dim">Expected</dt>
                    <dd className="text-saif-text">{formatPrice(payment.expected_amount, currency)}</dd>
                  </div>
                  {payment.transferred_amount !== null && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-saif-dim">Transferred</dt>
                      <dd className="text-saif-text">{formatPrice(payment.transferred_amount, currency)}</dd>
                    </div>
                  )}
                  {payment.payer_identifier && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-saif-dim">Paid from</dt>
                      <dd className="text-saif-text font-mono">{payment.payer_identifier}</dd>
                    </div>
                  )}
                  {payment.verified_at && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-saif-dim">Verified</dt>
                      <dd className="text-saif-text">{formatDate(payment.verified_at, true)}</dd>
                    </div>
                  )}
                </dl>

                {payment.rejection_reason && (
                  <p className="text-xs text-red-400 mt-3 border-t border-saif-border pt-3">
                    Rejection reason: {payment.rejection_reason}
                  </p>
                )}

                {/* Screenshot */}
                {payment.screenshot_path && (
                  <div className="mt-4 border-t border-saif-border pt-4">
                    <p className="text-xs text-saif-dim mb-2">Your transfer screenshot</p>
                    {urlLoading ? (
                      <div className="h-32 skeleton rounded-sm" />
                    ) : signedUrl ? (
                      <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="block group">
                        <img
                          src={signedUrl}
                          alt="Transfer screenshot"
                          className="w-full h-32 object-cover rounded-sm border border-saif-border group-hover:border-saif-text transition-colors"
                        />
                      </a>
                    ) : (
                      <p className="text-xs text-saif-dim">Screenshot unavailable.</p>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* Delivery */}
            <section className="border border-saif-border rounded-sm p-5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-saif-text mb-4 flex items-center gap-2">
                <Truck size={13} /> Delivery
              </h2>
              {shipping?.address ? (
                <div className="text-xs text-saif-dim space-y-1">
                  <p className="text-saif-text text-sm">{order.customer_name}</p>
                  <p>{shipping.address}</p>
                  <p>
                    {shipping.city}
                    {shipping.governorate ? `, ${shipping.governorate}` : ''}
                  </p>
                  <p className="pt-2">{order.customer_phone}</p>
                  <p>{order.customer_email}</p>
                </div>
              ) : (
                <p className="text-xs text-saif-dim">Digital order — nothing to ship.</p>
              )}
              {order.notes && (
                <p className="text-xs text-saif-dim mt-3 border-t border-saif-border pt-3">
                  <span className="text-saif-text">Your note:</span> {order.notes}
                </p>
              )}
            </section>

            <button onClick={handleReorder} className="btn btn-sm w-full">
              <RotateCcw size={13} /> Reorder Items
            </button>
          </aside>
        </div>
      </div>

      {/* Cancel confirmation */}
      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={handleCancel}
        title="Cancel this order?"
        message="The reserved items will be returned to stock. This cannot be undone."
        confirmLabel="Cancel Order"
        danger
        busy={cancelling}
      />

      {/* Resubmit payment modal */}
      {resubmitOpen && payment && order && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label="Submit payment proof">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => (submitting ? undefined : setResubmitOpen(false))} />
          <div className="relative w-full bg-black border border-saif-border max-w-lg max-h-[92vh] overflow-y-auto animate-scaleIn rounded-t-lg sm:rounded-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-saif-border sticky top-0 bg-black z-10">
              <h2 className="text-base font-bold tracking-tight text-saif-text">Submit Payment Proof</h2>
              <button onClick={() => setResubmitOpen(false)} className="text-saif-dim hover:text-saif-text p-1" aria-label="Close" disabled={submitting}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleResubmit} className="p-6 space-y-5">
              {/* Instructions */}
              <div className="border border-saif-accent/40 bg-saif-accent/5 p-4 rounded-sm text-xs text-saif-dim leading-relaxed">
                <p className="text-saif-text font-semibold mb-1.5">
                  {PAYMENT_METHOD_LABELS[payment.payment_method]} · {receivingNumber}
                </p>
                <p className="font-bold text-saif-accent text-sm mb-2">
                  Transfer exactly {formatPrice(payment.expected_amount, currency)}
                </p>
                <ul className="list-disc list-inside space-y-1">
                  {getPaymentInstructions(payment.payment_method, receivingNumber).map(line => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>

              <div>
                <label className="label" htmlFor="re-payer">
                  {payment.payment_method === 'vodafone_cash' ? 'Vodafone number you paid from' : 'Phone / account you paid from'}
                </label>
                <input
                  id="re-payer"
                  className={cn('input', errors.payerIdentifier && 'input-error')}
                  value={payerIdentifier}
                  onChange={e => setPayerIdentifier(e.target.value)}
                />
                {errors.payerIdentifier && <p className="field-error">{errors.payerIdentifier}</p>}
              </div>

              <div>
                <label className="label" htmlFor="re-amount">Transferred Amount</label>
                <input
                  id="re-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  className={cn('input', errors.transferredAmount && 'input-error')}
                  value={transferredAmount}
                  onChange={e => setTransferredAmount(e.target.value)}
                />
                {errors.transferredAmount && <p className="field-error">{errors.transferredAmount}</p>}
              </div>

              <div>
                <span className="label">Transfer Screenshot {payment.screenshot_path ? '(replace if needed)' : '*'}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileSelect}
                  className="sr-only"
                  id="re-screenshot"
                />
                {!screenshot ? (
                  <label
                    htmlFor="re-screenshot"
                    className={cn(
                      'flex flex-col items-center gap-2 border border-dashed p-6 cursor-pointer hover:border-saif-dim transition-colors rounded-sm text-center',
                      errors.screenshot && 'border-saif-accent/60',
                    )}
                  >
                    <Upload size={20} className="text-saif-dim" />
                    <span className="text-xs text-saif-dim">
                      {payment.screenshot_path ? 'Choose a new screenshot (optional)' : `PNG, JPG or WEBP · max ${MAX_SCREENSHOT_SIZE_MB}MB`}
                    </span>
                  </label>
                ) : (
                  <div className="flex items-center gap-3 border border-saif-border p-3 rounded-sm">
                    <div className="w-12 h-12 bg-saif-panel overflow-hidden rounded-sm flex-shrink-0">
                      {screenshotPreview && <img src={screenshotPreview} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <p className="text-xs text-saif-text truncate flex-1">{screenshot.name}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setScreenshot(null)
                        setScreenshotPreview(null)
                      }}
                      className="p-1 text-saif-dim hover:text-saif-accent"
                      aria-label="Remove screenshot"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
                {errors.screenshot && <p className="field-error">{errors.screenshot}</p>}
              </div>

              <div>
                <label className="label" htmlFor="re-note">Note (Optional)</label>
                <textarea
                  id="re-note"
                  className="input resize-none"
                  rows={2}
                  value={customerNote}
                  onChange={e => setCustomerNote(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit for Review'}
              </button>
              <p className="text-xs text-saif-dim text-center">
                The payment will be marked as under review — approval is always manual.
              </p>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}
