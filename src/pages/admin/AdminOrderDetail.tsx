import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CreditCard, Zap, Clock, Truck, Save, X, ShieldCheck } from 'lucide-react'
import { useAdminOrder } from '@/hooks/admin/useAdminData'
import { useApp } from '@/context/AppContext'
import { useToast } from '@/context/ToastContext'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useI18n } from '@/i18n'
import { adminUpdateOrderStatus, adminAddOrderNote, adminSetFulfillment, reviewPayment } from '@/lib/api'
import { createScreenshotSignedUrl, paymentMethodLabel } from '@/lib/payments'
import { formatPrice, formatDate, cn } from '@/lib/utils'
import { ORDER_STATUSES, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '@/lib/constants'
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/ui/StatusBadge'
import { PageHeader } from '@/components/admin/ui'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Loading from '@/components/Loading'
import { useEffect } from 'react'
import type { OrderItem } from '@/types'

export default function AdminOrderDetail() {
  const { t } = useI18n()
  const { id } = useParams<{ id: string }>()
  const { order, loading, refetch } = useAdminOrder(id)
  const { settings } = useApp()
  const { addToast } = useToast()
  const currency = settings?.currency ?? 'EGP'

  const [statusValue, setStatusValue] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [updating, setUpdating] = useState(false)
  const [noteValue, setNoteValue] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null)
  const [zoomOpen, setZoomOpen] = useState(false)
  const [fulfillItem, setFulfillItem] = useState<OrderItem | null>(null)
  const [fulfillNote, setFulfillNote] = useState('')
  const [fulfilling, setFulfilling] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejecting, setRejecting] = useState(false)

  usePageMeta({ title: order ? `Order ${order.order_number}` : 'Order' })

  useEffect(() => {
    if (order && !statusValue) {
      setStatusValue(order.status)
      setNoteValue(order.internal_note || '')
    }
  }, [order, statusValue])

  useEffect(() => {
    if (!order?.payment?.screenshot_path) return
    createScreenshotSignedUrl(order.payment.screenshot_path, 600).then(setScreenshotUrl)
  }, [order?.payment?.screenshot_path])

  if (loading) {
    return <Loading />
  }

  if (!order) {
    return (
      <div>
        <Link to="/admin/orders" className="text-xs text-saif-dim hover:text-saif-text transition-colors inline-flex items-center gap-1 mb-4">
          <ArrowLeft size={12} /> All Orders
        </Link>
        <PageHeader title="Order not found" description="It may have been deleted." />
      </div>
    )
  }

  const payment = order.payment
  const shipping = order.shipping_address as { address?: string; governorate?: string; city?: string } | null
  const digitalItems = (order.items || []).filter(i => i.product_type === 'digital')
  const events = order.events || []

  async function handleStatusUpdate() {
    if (!order || !statusValue) return
    if (statusValue === order.status) {
      addToast(t('admin.orders.notFound'), 'info')
      return
    }
    setUpdating(true)
    const { error } = await adminUpdateOrderStatus(order.id, statusValue, statusMessage.trim() || null)
    setUpdating(false)
    if (error) addToast(error, 'error')
    else {
      addToast(t('admin.orders.statusUpdated'))
      setStatusMessage('')
      refetch()
    }
  }

  async function handleSaveNote() {
    if (!order) return
    setSavingNote(true)
    const { error } = await adminAddOrderNote(order.id, noteValue.trim())
    setSavingNote(false)
    if (error) addToast(error, 'error')
    else {
      addToast(t('admin.orders.noteSaved'))
      refetch()
    }
  }

  async function handleApprove() {
    if (!payment) return
    setUpdating(true)
    const { error } = await reviewPayment(payment.id, 'approved', null, null)
    setUpdating(false)
    if (error) addToast(error, 'error')
    else {
      addToast(t('admin.orders.paymentApproved'))
      refetch()
    }
  }

  async function handleReject() {
    if (!payment || !rejectionReason.trim()) {
      addToast(t('admin.orders.rejectReasonLabel'), 'error')
      return
    }
    setRejecting(true)
    const { error } = await reviewPayment(payment.id, 'rejected', null, rejectionReason.trim())
    setRejecting(false)
    if (error) addToast(error, 'error')
    else {
      addToast(t('admin.orders.paymentRejected'))
      setRejectOpen(false)
      setRejectionReason('')
      refetch()
    }
  }

  async function handleFulfill() {
    if (!fulfillItem || !fulfillNote.trim()) {
      addToast(t('errors.generic'), 'error')
      return
    }
    setFulfilling(true)
    const { error } = await adminSetFulfillment(fulfillItem.id, fulfillNote.trim())
    setFulfilling(false)
    if (error) addToast(error, 'error')
    else {
      addToast(t('admin.orders.fulfillSaved'))
      setFulfillItem(null)
      setFulfillNote('')
      refetch()
    }
  }

  return (
    <div className="animate-[pageIn_0.4s_ease] max-w-5xl">
      <Link to="/admin/orders" className="text-xs text-saif-dim hover:text-saif-text transition-colors inline-flex items-center gap-1 mb-4">
        <ArrowLeft size={12} /> All Orders
      </Link>

      <PageHeader
        title={order.order_number}
        description={`${formatDate(order.created_at, true)} · ${order.items?.length ?? 0} items`}
        actions={
          <>
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={order.payment_status} />
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        <div className="space-y-6">
          {/* Items */}
          <section className="card p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-saif-text mb-4">{t('orders.items')}</h2>
            <div className="space-y-4">
              {order.items?.map(item => (
                <div key={item.id} className="flex gap-3">
                  <div className="w-12 h-14 bg-saif-panel overflow-hidden rounded-sm flex-shrink-0">
                    {item.image && <img src={item.image} alt="" className="w-full h-full object-cover" loading="lazy" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-saif-text truncate">{item.product_name}</p>
                        {item.variant_name && <p className="text-xs text-saif-dim">{item.variant_name}</p>}
                        <p className="text-xs text-saif-dim mt-0.5">
                          {formatPrice(item.price, currency)} × {item.quantity}
                          {item.product_type === 'digital' && <span className="text-saif-accent"> · digital</span>}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-saif-text flex-shrink-0">
                        {formatPrice(item.total, currency)}
                      </span>
                    </div>

                    {/* Digital fulfillment */}
                    {item.product_type === 'digital' && (
                      <div className="mt-2">
                        {item.fulfillment_note ? (
                          <div className="border border-green-500/30 bg-green-500/5 p-2.5 rounded-sm">
                            <p className="text-xs text-saif-dim whitespace-pre-line">{item.fulfillment_note}</p>
                            <p className="text-[10px] text-green-400 mt-1.5">Fulfilled {formatDate(item.fulfilled_at, true)}</p>
                          </div>
                        ) : order.payment_status === 'approved' ? (
                          <button
                            className="btn btn-sm"
                            onClick={() => {
                              setFulfillItem(item)
                              setFulfillNote('')
                            }}
                          >
                            <Zap size={12} /> Add Delivery Details
                          </button>
                        ) : (
                          <p className="text-xs text-saif-faint">Delivery available after payment approval.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-saif-border mt-4 pt-4 space-y-1.5 text-sm">
              <div className="flex justify-between text-saif-dim">
                <span>Subtotal</span>
                <span className="text-saif-text">{formatPrice(order.subtotal, currency)}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-saif-dim">
                  <span>Discount {order.coupon_code && <span className="font-mono text-xs">({order.coupon_code})</span>}</span>
                  <span className="text-green-400">−{formatPrice(order.discount, currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-saif-dim">
                <span>Shipping</span>
                <span className="text-saif-text">{order.shipping_fee === 0 ? 'Free' : formatPrice(order.shipping_fee, currency)}</span>
              </div>
              <div className="flex justify-between font-bold text-saif-text pt-1.5 border-t border-saif-border">
                <span>Total</span>
                <span>{formatPrice(order.total, currency)}</span>
              </div>
            </div>
          </section>

          {/* Timeline */}
          {events.length > 0 && (
            <section className="card p-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-saif-text mb-4 flex items-center gap-2">
                <Clock size={13} className="text-saif-accent" /> Timeline
              </h2>
              <ol className="relative border-l border-saif-border ml-2 space-y-5">
                {events.map(event => (
                  <li key={event.id} className="ml-4">
                    <span className="absolute -left-[5px] w-2.5 h-2.5 bg-saif-accent rounded-full mt-1.5" />
                    <p className="text-sm text-saif-text">{event.message || event.event_type.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-saif-dim mt-0.5">{formatDate(event.created_at, true)}</p>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Payment verification panel */}
          {payment && (
            <section className="card p-5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-saif-text mb-4 flex items-center gap-2">
                <CreditCard size={13} className="text-saif-accent" /> Payment
              </h2>

              <dl className="space-y-2.5 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-saif-dim">Method</dt>
                  <dd className="text-saif-text">{paymentMethodLabel(payment.payment_method)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-saif-dim">Expected</dt>
                  <dd className="text-saif-text font-semibold">{formatPrice(payment.expected_amount, currency)}</dd>
                </div>
                {payment.transferred_amount !== null && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-saif-dim">Transferred</dt>
                    <dd
                      className={cn(
                        'font-semibold',
                        Number(payment.transferred_amount) < Number(payment.expected_amount)
                          ? 'text-yellow-400'
                          : 'text-green-400',
                      )}
                    >
                      {formatPrice(payment.transferred_amount, currency)}
                    </dd>
                  </div>
                )}
                {payment.payer_identifier && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-saif-dim">Paid from</dt>
                    <dd className="text-saif-text font-mono">{payment.payer_identifier}</dd>
                  </div>
                )}
                {payment.customer_note && (
                  <div>
                    <dt className="text-saif-dim mb-1">{t('payment.customerNote')}</dt>
                    <dd className="text-saif-text bg-white/5 p-2 rounded-sm">{payment.customer_note}</dd>
                  </div>
                )}
                {payment.verified_at && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-saif-dim">Verified</dt>
                    <dd className="text-saif-text">{formatDate(payment.verified_at, true)}</dd>
                  </div>
                )}
              </dl>

              {/* Screenshot */}
              {payment.screenshot_path && (
                <div className="mt-4">
                  <p className="text-[10px] uppercase tracking-wider text-saif-dim mb-2">Transfer screenshot</p>
                  {screenshotUrl ? (
                    <button
                      onClick={() => setZoomOpen(true)}
                      className="block w-full group"
                      aria-label={t('admin.payments.enlarge')}
                    >
                      <img
                        src={screenshotUrl}
                        alt="Payment screenshot"
                        className="w-full h-44 object-cover rounded-sm border border-saif-border group-hover:border-saif-text transition-colors"
                      />
                      <span className="text-[10px] text-saif-dim group-hover:text-saif-text transition-colors mt-1.5 block">
                        Click to enlarge
                      </span>
                    </button>
                  ) : (
                    <div className="h-32 skeleton rounded-sm" />
                  )}
                </div>
              )}

              {/* Actions */}
              {payment.payment_status !== 'approved' && payment.payment_status !== 'cancelled' && (
                <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-saif-border">
                  {payment.payment_status !== 'rejected' && (
                    <button className="btn btn-sm btn-primary" onClick={handleApprove} disabled={updating}>
                      <ShieldCheck size={12} /> Approve Payment
                    </button>
                  )}
                  <button className="btn btn-sm btn-danger" onClick={() => setRejectOpen(true)} disabled={updating}>
                    <X size={12} /> Reject Payment
                  </button>
                  <Link to={`/admin/payments?focus=${payment.id}`} className="btn btn-sm btn-ghost">
                    Open Full Verification
                  </Link>
                </div>
              )}

              {payment.rejection_reason && (
                <p className="text-xs text-red-400 mt-3 pt-3 border-t border-saif-border">
                  Rejected: {payment.rejection_reason}
                </p>
              )}
            </section>
          )}

          {/* Status update */}
          <section className="card p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-saif-text mb-4">{t('admin.orders.updateStatus')}</h2>
            <label className="sr-only" htmlFor="st-select">{t('common.status')}</label>
            <select id="st-select" className="input text-xs mb-2" value={statusValue} onChange={e => setStatusValue(e.target.value)}>
              {ORDER_STATUSES.map(s => (
                <option key={s} value={s} className="bg-black">
                  {ORDER_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="st-msg">{t('admin.orders.statusMessage')}</label>
            <input
              id="st-msg"
              className="input text-xs mb-3"
              placeholder={t('admin.orders.statusMessage')}
              value={statusMessage}
              onChange={e => setStatusMessage(e.target.value)}
            />
            <button className="btn btn-sm w-full" onClick={handleStatusUpdate} disabled={updating || statusValue === order.status}>
              {updating ? 'Updating…' : 'Update Status'}
            </button>
            <p className="text-[10px] text-saif-dim mt-2 leading-relaxed">
              Cancelling an order automatically returns reserved stock.
            </p>
          </section>

          {/* Customer */}
          <section className="card p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-saif-text mb-4 flex items-center gap-2">
              <Truck size={13} className="text-saif-accent" /> Customer & Delivery
            </h2>
            <div className="text-xs text-saif-dim space-y-1">
              <p className="text-saif-text text-sm">{order.customer_name}</p>
              <p>{order.customer_email}</p>
              {order.customer_phone && <p dir="ltr">{order.customer_phone}</p>}
              {shipping?.address && (
                <div className="pt-2 border-t border-saif-border mt-2">
                  <p>{shipping.address}</p>
                  <p>
                    {shipping.city}
                    {shipping.governorate ? `, ${shipping.governorate}` : ''}
                  </p>
                </div>
              )}
              {order.notes && (
                <p className="pt-2 border-t border-saif-border mt-2">
                  <span className="text-saif-text">Customer note:</span> {order.notes}
                </p>
              )}
            </div>
          </section>

          {/* Internal note */}
          <section className="card p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-saif-text mb-3">{t('admin.orders.internalNote')}</h2>
            <label className="sr-only" htmlFor="in-note">{t('admin.orders.internalNote')}</label>
            <textarea
              id="in-note"
              className="input text-xs resize-none"
              rows={3}
              placeholder={t('admin.orders.internalNotePlaceholder')}
              value={noteValue}
              onChange={e => setNoteValue(e.target.value)}
            />
            <button className="btn btn-sm w-full mt-2" onClick={handleSaveNote} disabled={savingNote || !noteValue.trim()}>
              <Save size={12} /> {savingNote ? 'Saving…' : 'Save Note'}
            </button>
          </section>
        </div>
      </div>

      {/* Screenshot zoom */}
      {zoomOpen && screenshotUrl && (
        <div
          className="fixed inset-0 z-[250] bg-black/95 flex items-center justify-center p-4 md:p-10"
          role="dialog"
          aria-modal="true"
          aria-label={t('payment.yourScreenshot')}
          onClick={() => setZoomOpen(false)}
        >
          <button className="absolute top-5 right-5 text-saif-dim hover:text-saif-text p-2" aria-label={t('common.close')}>
            <X size={26} />
          </button>
          <img src={screenshotUrl} alt="Payment screenshot (full size)" className="max-w-full max-h-full object-contain" />
        </div>
      )}

      {/* Reject dialog */}
      <ConfirmDialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        onConfirm={handleReject}
        title="Reject this payment?"
        confirmLabel="Reject Payment"
        danger
        busy={rejecting}
        message={
          <div>
            <p className="mb-3">The customer will see the rejection reason and can resubmit correct proof.</p>
            <label className="label" htmlFor="reject-reason">
              Rejection reason (required)
            </label>
            <textarea
              id="reject-reason"
              className="input text-xs resize-none"
              rows={3}
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              placeholder="e.g. transferred amount doesn't match the order total"
              autoFocus
            />
          </div>
        }
      />

      {/* Fulfillment dialog */}
      {fulfillItem && (
        <ConfirmDialog
          open={!!fulfillItem}
          onClose={() => setFulfillItem(null)}
          onConfirm={handleFulfill}
          title={`Deliver "${fulfillItem.product_name}"`}
          confirmLabel="Save Delivery Details"
          busy={fulfilling}
          message={
            <div>
              <p className="mb-3 text-xs text-saif-dim">
                The customer will see these details in their account (digital purchases section).
              </p>
              <label className="label" htmlFor="ff-note">
                Delivery details (required)
              </label>
              <textarea
                id="ff-note"
                className="input text-xs resize-none"
                rows={4}
                value={fulfillNote}
                onChange={e => setFulfillNote(e.target.value)}
                placeholder="e.g. Boost delivered to @username — 1000/1000. Or: download link sent to email."
                autoFocus
              />
            </div>
          }
        />
      )}
    </div>
  )
}
