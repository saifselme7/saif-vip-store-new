import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Copy, Zap, Lock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useOrder, latestPayment } from '@/hooks/useOrders'
import { useApp } from '@/context/AppContext'
import { usePageMeta } from '@/hooks/usePageMeta'
import {
  ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, ORDER_TIMELINE,
  PAYMENT_METHODS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS,
} from '@/lib/constants'
import { formatPrice, formatDateTime, copyToClipboard } from '@/lib/utils'
import type { Order } from '@/types'
import Loading from '@/components/Loading'
import EmptyState from '@/components/EmptyState'
import Price from '@/components/ui/Price'
import Modal from '@/components/ui/Modal'
import { StatusBadge } from '@/components/ui/Badge'
import PaymentEvidenceForm from '@/components/PaymentEvidenceForm'

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { order, loading, refetch } = useOrder(id)
  const { settings, addToast } = useApp()
  const [payModal, setPayModal] = useState(false)
  const [digital, setDigital] = useState<{ unlocked: boolean; delivery?: Record<string, unknown> } | null>(null)

  usePageMeta(order ? `Order ${order.order_number}` : 'Order', 'Order details and payment status.')

  const payment = latestPayment(order)
  const hasDigital = order?.items?.some(i => i.product_type === 'digital') ?? false

  // Digital delivery info — only unlocked server-side after payment approval.
  useEffect(() => {
    if (!order || !hasDigital) return
    let cancelled = false
    supabase.rpc('get_order_digital_delivery', { p_order_id: order.id }).then(({ data }) => {
      if (!cancelled && data) setDigital(data as { unlocked: boolean; delivery?: Record<string, unknown> })
    })
    return () => { cancelled = true }
  }, [order?.id, hasDigital, payment?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="pt-16"><Loading /></div>
  if (!order) return (
    <div className="pt-16 px-6">
      <EmptyState title="Order not found" description="It may belong to another account." />
      <div className="text-center"><Link to="/orders" className="btn text-xs">My Orders</Link></div>
    </div>
  )

  const currency = settings?.currency || 'EGP'
  const methodName = PAYMENT_METHODS.find(m => m.id === order.payment_method)?.name || order.payment_method
  const canSubmitPayment = (order.status === 'pending' || order.status === 'payment_review') &&
    (!payment || payment.status === 'rejected' || payment.status === 'cancelled')

  return (
    <div className="animate-[pageIn_0.5s_ease] px-4 sm:px-6 lg:px-10 pt-10 pb-20">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8">
          <div>
            <p className="text-xs uppercase tracking-widest text-saif-dim mb-1">Order</p>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-saif-text flex items-center gap-3">
              {order.order_number}
              <button
                onClick={async () => {
                  const ok = await copyToClipboard(order.order_number)
                  addToast(ok ? 'Copied' : 'Could not copy', ok ? 'success' : 'error')
                }}
                className="p-1.5 border border-saif-border text-saif-dim hover:text-saif-text transition-colors"
                aria-label="Copy order number"
              >
                <Copy size={13} />
              </button>
            </h1>
            <p className="text-xs text-saif-dim mt-1">{formatDateTime(order.created_at)}</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge className={ORDER_STATUS_COLORS[order.status]}>{ORDER_STATUS_LABELS[order.status]}</StatusBadge>
            {payment && (
              <StatusBadge className={PAYMENT_STATUS_COLORS[payment.status]}>
                {PAYMENT_STATUS_LABELS[payment.status]}
              </StatusBadge>
            )}
          </div>
        </div>

        {/* Timeline */}
        <OrderTimeline order={order} />

        {/* Payment panel */}
        <section className="mt-10 border border-saif-border p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-saif-text">Payment</h2>
            <span className="text-xs text-saif-dim">{methodName || 'Method not selected'}</span>
          </div>

          {payment ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-saif-dim">Expected amount</span>
                <Price value={payment.expected_amount} className="text-saif-text font-semibold" />
              </div>
              {payment.transferred_amount != null && (
                <div className="flex justify-between">
                  <span className="text-saif-dim">You transferred</span>
                  <Price value={payment.transferred_amount} className="text-saif-text" />
                </div>
              )}
              {payment.payer_identifier && (
                <div className="flex justify-between">
                  <span className="text-saif-dim">Paid from</span>
                  <span dir="ltr" className="text-saif-text">{payment.payer_identifier}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-saif-dim">Submitted</span>
                <span className="text-saif-text">{formatDateTime(payment.created_at)}</span>
              </div>
              {payment.status === 'approved' && payment.verified_at && (
                <p className="text-xs text-green-400 pt-1">Approved on {formatDateTime(payment.verified_at)}.</p>
              )}
              {payment.status === 'rejected' && (
                <div className="bg-red-500/10 border border-red-500/30 p-3 mt-2">
                  <p className="text-xs font-semibold text-red-400">Payment rejected</p>
                  {payment.rejection_reason && <p className="text-xs text-saif-dim mt-1">{payment.rejection_reason}</p>}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-saif-dim">No payment submitted yet.</p>
          )}

          {canSubmitPayment && (
            <button onClick={() => setPayModal(true)} className="btn btn-primary w-full mt-5 text-xs">
              {payment?.status === 'rejected' ? 'Re-submit Payment Evidence' : payment ? 'Submit Payment Evidence' : 'Complete Your Payment'}
            </button>
          )}
        </section>

        {/* Digital delivery */}
        {hasDigital && (
          <section className="mt-6 border border-saif-border p-6">
            <h2 className="text-sm font-bold uppercase tracking-widest text-saif-text mb-4 flex items-center gap-2">
              <Zap size={14} className="text-saif-accent" /> Digital Delivery
            </h2>
            {digital?.unlocked ? (
              digital.delivery && Object.keys(digital.delivery).length > 0 ? (
                <div className="space-y-2 text-sm">
                  {Object.entries(digital.delivery).map(([k, v]) => (
                    <div key={k} className="flex gap-4">
                      <span className="text-saif-dim capitalize w-32 flex-shrink-0">{k.replace(/_/g, ' ')}</span>
                      <span className="text-saif-text break-all">{String(v)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-saif-dim">Payment approved — our team is preparing your digital delivery. Check back soon.</p>
              )
            ) : (
              <p className="text-sm text-saif-dim flex items-center gap-2">
                <Lock size={13} /> Delivery details unlock once your payment is approved.
              </p>
            )}
          </section>
        )}

        {/* Items & totals */}
        <section className="mt-6 border border-saif-border divide-y divide-[rgba(245,240,232,0.08)]">
          <div className="p-6 space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-saif-text mb-2">Items</h2>
            {order.items?.map(item => (
              <div key={item.id} className="flex justify-between gap-4 text-sm">
                <div>
                  <p className="text-saif-text font-medium">{item.product_name}</p>
                  <p className="text-xs text-saif-dim mt-0.5">
                    {item.variant_name ? `${item.variant_name} · ` : ''}Qty {item.quantity} · {item.product_type === 'digital' ? 'Digital' : 'Physical'}
                  </p>
                </div>
                <Price value={item.total} className="text-saif-text font-semibold" />
              </div>
            ))}
          </div>
          <div className="p-6 space-y-2 text-sm">
            <div className="flex justify-between text-saif-dim"><span>Subtotal</span><Price value={order.subtotal} className="text-saif-text" /></div>
            {order.discount > 0 && (
              <div className="flex justify-between text-green-400">
                <span>Discount{order.coupon_code ? ` (${order.coupon_code})` : ''}</span>
                <span>−{formatPrice(order.discount, currency)}</span>
              </div>
            )}
            <div className="flex justify-between text-saif-dim"><span>Shipping</span><span>{order.shipping_fee === 0 ? 'Free' : formatPrice(order.shipping_fee, currency)}</span></div>
            <div className="flex justify-between text-base font-bold text-saif-text pt-2 border-t border-saif-border"><span>Total</span><Price value={order.total} className="text-saif-text" /></div>
          </div>
        </section>

        {/* Delivery info */}
        <section className="mt-6 border border-saif-border p-6 text-sm">
          <h2 className="text-sm font-bold uppercase tracking-widest text-saif-text mb-3">Customer & Delivery</h2>
          <p className="text-saif-text font-medium">{order.customer_name}</p>
          <p className="text-saif-dim mt-1">{order.customer_email}{order.customer_phone ? <> · <span dir="ltr">{order.customer_phone}</span></> : null}</p>
          {order.shipping_address && Object.keys(order.shipping_address).length > 0 && (
            <p className="text-saif-dim mt-1">
              {[order.shipping_address.address, order.shipping_address.city, order.shipping_address.governorate].filter(Boolean).join(', ')}
            </p>
          )}
          {order.notes && <p className="text-saif-dim mt-2 italic">“{order.notes}”</p>}
        </section>

        <div className="mt-8 flex gap-3">
          <Link to="/orders" className="btn text-xs">All Orders</Link>
          <Link to="/products" className="btn text-xs">Continue Shopping</Link>
        </div>
      </div>

      {/* Payment (re)submission */}
      <Modal open={payModal} onClose={() => setPayModal(false)} title="Submit Payment" wide>
        <PaymentEvidenceForm
          orderId={order.id}
          expectedAmount={order.total}
          defaultMethod={order.payment_method}
          onDone={() => { setPayModal(false); refetch() }}
        />
      </Modal>
    </div>
  )
}

function OrderTimeline({ order }: { order: Order }) {
  const cancelled = ['cancelled', 'refunded', 'rejected'].includes(order.status)
  const currentIndex = ORDER_TIMELINE.indexOf(order.status)
  // delivered/completed both count as final step.
  const effectiveIndex = order.status === 'completed' || order.status === 'delivered'
    ? ORDER_TIMELINE.length - 1
    : currentIndex

  if (cancelled) {
    return (
      <div className="border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">
        This order was {ORDER_STATUS_LABELS[order.status].toLowerCase()}. If you believe this is a mistake, contact support.
      </div>
    )
  }

  return (
    <ol className="flex items-start gap-0 overflow-x-auto pb-2" aria-label="Order progress">
      {ORDER_TIMELINE.map((s, i) => {
        const done = effectiveIndex >= 0 && i <= effectiveIndex
        const current = i === effectiveIndex
        return (
          <li key={s} className="flex-1 min-w-[90px] text-center relative">
            {i > 0 && (
              <span className={`absolute top-[9px] right-1/2 w-full h-px ${done && i <= effectiveIndex ? 'bg-saif-accent' : 'bg-saif-border'}`} aria-hidden="true" />
            )}
            <span className={`relative z-10 inline-flex w-5 h-5 rounded-full border-2 items-center justify-center ${
              done ? 'bg-saif-accent border-saif-accent' : 'bg-black border-saif-border'
            }`}>
              {done && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
            </span>
            <p className={`mt-2 text-[10px] uppercase tracking-wider ${current ? 'text-saif-text font-bold' : done ? 'text-saif-dim' : 'text-saif-dim/40'}`}>
              {ORDER_STATUS_LABELS[s]}
            </p>
          </li>
        )
      })}
    </ol>
  )
}
