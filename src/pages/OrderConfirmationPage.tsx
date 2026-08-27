import { useParams, Link } from 'react-router-dom'
import { Clock, Copy, CheckCircle2 } from 'lucide-react'
import { useOrder, latestPayment } from '@/hooks/useOrders'
import { useApp } from '@/context/AppContext'
import { usePageMeta } from '@/hooks/usePageMeta'
import { PAYMENT_METHODS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS } from '@/lib/constants'
import { formatPrice, formatDateTime, copyToClipboard } from '@/lib/utils'
import Loading from '@/components/Loading'
import Price from '@/components/ui/Price'
import { StatusBadge } from '@/components/ui/Badge'

export default function OrderConfirmationPage() {
  const { id } = useParams<{ id: string }>()
  const { order, loading } = useOrder(id)
  const { settings, addToast } = useApp()

  usePageMeta('Order Received', 'Your SAIF STORE order has been received.')

  if (loading) return <div className="pt-16"><Loading /></div>
  if (!order) return (
    <div className="pt-16 px-6 text-center min-h-[50vh]">
      <p className="text-saif-dim">Order not found.</p>
      <Link to="/orders" className="btn mt-4 text-xs">My Orders</Link>
    </div>
  )

  const payment = latestPayment(order)
  const currency = settings?.currency || 'EGP'
  const methodName = PAYMENT_METHODS.find(m => m.id === order.payment_method)?.name || order.payment_method

  return (
    <div className="animate-[pageIn_0.5s_ease] px-4 sm:px-6 lg:px-10 pt-14 pb-20">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-400/10 border border-amber-400/30 mb-5">
            <Clock size={26} className="text-amber-400" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-saif-text">Order Received</h1>
          <p className="mt-3 text-sm text-saif-dim leading-relaxed max-w-md mx-auto">
            {payment
              ? 'Your payment proof was submitted and is now under manual review. We usually verify within a few hours — nothing is confirmed until then.'
              : 'Your order was created. Submit your payment proof to start verification.'}
          </p>
        </div>

        <div className="border border-saif-border divide-y divide-[rgba(245,240,232,0.08)] mb-8">
          <Row label="Order Number">
            <span className="flex items-center gap-2">
              <span className="font-bold text-saif-text">{order.order_number}</span>
              <button
                onClick={async () => {
                  const ok = await copyToClipboard(order.order_number)
                  addToast(ok ? 'Order number copied' : 'Could not copy', ok ? 'success' : 'error')
                }}
                className="p-1 border border-saif-border text-saif-dim hover:text-saif-text transition-colors"
                aria-label="Copy order number"
              >
                <Copy size={11} />
              </button>
            </span>
          </Row>
          <Row label="Date">{formatDateTime(order.created_at)}</Row>
          <Row label="Payment Method">{methodName || '—'}</Row>
          <Row label="Payment Status">
            <StatusBadge className={payment ? PAYMENT_STATUS_COLORS[payment.status] : PAYMENT_STATUS_COLORS.awaiting_payment}>
              {payment ? PAYMENT_STATUS_LABELS[payment.status] : 'Awaiting Payment'}
            </StatusBadge>
          </Row>
          <div className="p-5">
            <p className="text-xs uppercase tracking-widest text-saif-dim mb-3">Items</p>
            <div className="space-y-2">
              {order.items?.map(item => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-saif-dim">{item.product_name}{item.variant_name ? ` (${item.variant_name})` : ''} × {item.quantity}</span>
                  <Price value={item.total} className="text-saif-text" />
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-saif-border space-y-1.5 text-sm">
              <div className="flex justify-between text-saif-dim"><span>Subtotal</span><Price value={order.subtotal} className="text-saif-text" /></div>
              {order.discount > 0 && <div className="flex justify-between text-green-400"><span>Discount</span><span>−{formatPrice(order.discount, currency)}</span></div>}
              <div className="flex justify-between text-saif-dim"><span>Shipping</span><span>{order.shipping_fee === 0 ? 'Free' : formatPrice(order.shipping_fee, currency)}</span></div>
              <div className="flex justify-between text-base font-bold text-saif-text pt-1"><span>Total</span><Price value={order.total} className="text-saif-text" /></div>
            </div>
          </div>
        </div>

        {/* Next steps */}
        <div className="border border-saif-border p-5 mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-saif-text mb-3 flex items-center gap-2">
            <CheckCircle2 size={14} className="text-saif-accent" /> What happens next
          </h2>
          <ol className="space-y-2 text-sm text-saif-dim list-decimal list-inside leading-relaxed">
            <li>Our team verifies your transfer against the screenshot.</li>
            <li>Once approved, your order is confirmed ({order.items?.some(i => i.product_type === 'digital') ? 'digital items are fulfilled and physical items ship' : 'physical items are prepared and shipped'}).</li>
            <li>You can track everything from your order page — no need to contact us.</li>
          </ol>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to={`/orders/${order.id}`} className="btn btn-primary">Track This Order</Link>
          <Link to="/products" className="btn">Continue Shopping</Link>
        </div>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 p-5">
      <span className="text-xs uppercase tracking-widest text-saif-dim">{label}</span>
      <span className="text-sm text-saif-text">{children}</span>
    </div>
  )
}
