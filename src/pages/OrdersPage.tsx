import { Link } from 'react-router-dom'
import { useOrders, latestPayment } from '@/hooks/useOrders'
import { usePageMeta } from '@/hooks/usePageMeta'
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS } from '@/lib/constants'
import { formatPrice, formatDate } from '@/lib/utils'
import EmptyState from '@/components/EmptyState'
import Loading from '@/components/Loading'
import Price from '@/components/ui/Price'
import { StatusBadge } from '@/components/ui/Badge'

export default function OrdersPage() {
  const { orders, loading } = useOrders()
  usePageMeta('My Orders', 'Your SAIF STORE order history.')

  return (
    <div className="animate-[pageIn_0.5s_ease] px-4 sm:px-6 lg:px-10 pt-10 pb-20">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-saif-text mb-10">Orders</h1>
        {loading ? <Loading /> : orders.length === 0 ? (
          <>
            <EmptyState title="No orders yet" description="When you place an order it will appear here with live payment status." />
            <div className="text-center"><Link to="/products" className="btn text-xs">Start Shopping</Link></div>
          </>
        ) : (
          <div className="space-y-4">
            {orders.map(order => {
              const payment = latestPayment(order)
              return (
                <Link
                  key={order.id}
                  to={`/orders/${order.id}`}
                  className="block border border-saif-border p-5 sm:p-6 hover:border-saif-text/40 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-saif-text truncate">{order.order_number}</p>
                      <p className="text-xs text-saif-dim mt-1">
                        {formatDate(order.created_at)} · {order.items?.length || 0} item{(order.items?.length || 0) === 1 ? '' : 's'}
                      </p>
                      <p className="text-xs text-saif-dim mt-0.5 truncate">
                        {order.items?.map(i => i.product_name).join(', ')}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 sm:flex-col sm:items-end">
                      <Price value={order.total} className="text-sm font-bold text-saif-text" />
                      <div className="flex gap-2">
                        <StatusBadge className={ORDER_STATUS_COLORS[order.status]}>
                          {ORDER_STATUS_LABELS[order.status]}
                        </StatusBadge>
                        <StatusBadge className={payment ? PAYMENT_STATUS_COLORS[payment.status] : PAYMENT_STATUS_COLORS.awaiting_payment}>
                          {payment ? PAYMENT_STATUS_LABELS[payment.status] : 'Awaiting Payment'}
                        </StatusBadge>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
