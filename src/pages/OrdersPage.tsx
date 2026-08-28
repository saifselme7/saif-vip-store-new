import { Link } from 'react-router-dom'
import { Package, ChevronRight } from 'lucide-react'
import { useOrders } from '@/hooks/useOrders'
import { usePageMeta } from '@/hooks/usePageMeta'
import { formatPrice, formatDate } from '@/lib/utils'
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/ui/StatusBadge'
import Footer from '@/components/Footer'
import Loading from '@/components/Loading'
import EmptyState from '@/components/EmptyState'

export default function OrdersPage() {
  const { orders, loading } = useOrders()
  usePageMeta({ title: 'My Orders', description: 'Track your SAIF STORE orders and payment verification status.' })

  if (loading) {
    return (
      <div className="pt-28">
        <Loading />
        <Footer />
      </div>
    )
  }

  return (
    <div className="animate-[pageIn_0.6s_ease] pt-24 md:pt-28 px-5 lg:px-10 pb-20">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-[clamp(34px,6vw,72px)] font-black tracking-tighter text-saif-text mb-10">My Orders</h1>

        {orders.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No orders yet"
            description="Your order history and payment statuses will appear here."
            action={
              <Link to="/products" className="btn btn-primary">
                Start Shopping
              </Link>
            }
          />
        ) : (
          <div className="space-y-4">
            {orders.map(order => (
              <Link
                key={order.id}
                to={`/orders/${order.id}`}
                className="block border border-saif-border p-5 sm:p-6 hover:border-saif-dim transition-colors rounded-sm group"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-saif-text">{order.order_number}</p>
                      <ChevronRight size={13} className="text-saif-dim group-hover:text-saif-accent transition-colors hidden sm:block" />
                    </div>
                    <p className="text-xs text-saif-dim mt-1.5">
                      {formatDate(order.created_at, true)} · {order.items?.length || 0}{' '}
                      {(order.items?.length || 0) === 1 ? 'item' : 'items'}
                      {order.payment?.payment_status === 'rejected' && (
                        <span className="text-red-400"> · payment rejected — action needed</span>
                      )}
                      {order.payment?.payment_status === 'awaiting_payment' && (
                        <span className="text-yellow-400"> · awaiting your payment</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-semibold text-saif-text">{formatPrice(order.total)}</span>
                    <OrderStatusBadge status={order.status} />
                    <PaymentStatusBadge status={order.payment_status} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}
