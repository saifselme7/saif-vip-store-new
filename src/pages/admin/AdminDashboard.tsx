import { Link } from 'react-router-dom'
import { Package, ShoppingCart, Users, AlertTriangle, DollarSign, BadgeCheck, Zap, TrendingUp } from 'lucide-react'
import { useAnalytics, usePaymentQueue } from '@/hooks/useAdmin'
import { useAllOrders } from '@/hooks/useOrders'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { PAYMENT_STATUS_COLORS, PAYMENT_STATUS_LABELS, ORDER_STATUS_LABELS } from '@/lib/constants'
import { formatPrice, formatDate, formatDateTime } from '@/lib/utils'
import Loading from '@/components/Loading'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatusBadge } from '@/components/ui/Badge'
import type { Product } from '@/types'

export default function AdminDashboard() {
  const { data, loading } = useAnalytics()
  const { payments, loading: paymentsLoading } = usePaymentQueue()
  const { orders, loading: ordersLoading } = useAllOrders()
  const [lowStock, setLowStock] = useState<Product[]>([])
  const [stockLoading, setStockLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('products')
      .select('*')
      .eq('status', 'active')
      .eq('product_type', 'physical')
      .lte('stock', 5)
      .order('stock', { ascending: true })
      .limit(8)
      .then(({ data }) => {
        setLowStock((data || []) as Product[])
        setStockLoading(false)
      })
  }, [])

  const t = data?.totals

  const cards = [
    { label: 'Total Revenue', value: t ? formatPrice(t.revenue) : '—', icon: DollarSign, to: '/admin/analytics' },
    { label: 'Orders', value: t?.orders ?? '—', icon: ShoppingCart, to: '/admin/orders' },
    { label: 'Payments To Review', value: t?.awaiting_payments ?? '—', icon: BadgeCheck, to: '/admin/payments', alert: (t?.awaiting_payments ?? 0) > 0 },
    { label: 'Pending Orders', value: t?.pending_orders ?? '—', icon: TrendingUp, to: '/admin/orders?status=pending' },
    { label: 'Customers', value: t?.customers ?? '—', icon: Users, to: '/admin/customers' },
    { label: 'Products', value: t?.products ?? '—', icon: Package, to: '/admin/products' },
    { label: 'Low Stock', value: t?.low_stock ?? '—', icon: AlertTriangle, to: '/admin/inventory?filter=low', alert: (t?.low_stock ?? 0) > 0 },
    { label: 'Out of Stock', value: t?.out_of_stock ?? '—', icon: AlertTriangle, to: '/admin/inventory?filter=out', alert: (t?.out_of_stock ?? 0) > 0 },
  ]

  return (
    <div className="animate-[pageIn_0.4s_ease]">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-saif-text">Dashboard</h1>
        <Link to="/admin/analytics" className="text-xs text-saif-dim hover:text-saif-text transition-colors">Full analytics →</Link>
      </div>

      {/* Stat cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {cards.map(card => (
            <Link key={card.label} to={card.to} className={`border p-4 transition-colors hover:bg-white/[0.03] ${card.alert ? 'border-saif-accent/60' : 'border-saif-border'}`}>
              <div className="flex items-center justify-between mb-2">
                <card.icon size={16} className={card.alert ? 'text-saif-accent' : 'text-saif-dim'} />
              </div>
              <p className="text-xl font-bold text-saif-text truncate">{card.value}</p>
              <p className="text-[10px] text-saif-dim uppercase tracking-wider mt-1">{card.label}</p>
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-8">
        {/* Recent payment submissions */}
        <section className="border border-saif-border">
          <header className="flex items-center justify-between p-4 border-b border-saif-border">
            <h2 className="text-xs font-bold uppercase tracking-widest text-saif-text">Payment Submissions</h2>
            <Link to="/admin/payments" className="text-xs text-saif-dim hover:text-saif-text">Verify →</Link>
          </header>
          <div className="divide-y divide-[rgba(245,240,232,0.08)]">
            {paymentsLoading ? <div className="p-4"><Loading /></div> : payments.slice(0, 5).map(p => (
              <Link key={p.id} to="/admin/payments" className="flex items-center justify-between gap-3 p-4 hover:bg-white/[0.03] transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-saif-text truncate">
                    {p.orders?.customer_name || 'Customer'} · {p.orders?.order_number}
                  </p>
                  <p className="text-xs text-saif-dim mt-0.5">
                    {p.payment_method === 'instapay' ? 'InstaPay' : 'Vodafone Cash'} · {formatDateTime(p.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-sm font-semibold text-saif-text">{formatPrice(p.expected_amount)}</span>
                  <StatusBadge className={PAYMENT_STATUS_COLORS[p.status]}>{PAYMENT_STATUS_LABELS[p.status]}</StatusBadge>
                </div>
              </Link>
            ))}
            {!paymentsLoading && payments.length === 0 && (
              <p className="p-4 text-sm text-saif-dim">No payment submissions yet.</p>
            )}
          </div>
        </section>

        {/* Recent orders */}
        <section className="border border-saif-border">
          <header className="flex items-center justify-between p-4 border-b border-saif-border">
            <h2 className="text-xs font-bold uppercase tracking-widest text-saif-text">Recent Orders</h2>
            <Link to="/admin/orders" className="text-xs text-saif-dim hover:text-saif-text">All orders →</Link>
          </header>
          <div className="divide-y divide-[rgba(245,240,232,0.08)]">
            {ordersLoading ? <div className="p-4"><Loading /></div> : orders.slice(0, 5).map(o => (
              <Link key={o.id} to={`/admin/orders?open=${o.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-white/[0.03] transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-saif-text truncate">{o.order_number}</p>
                  <p className="text-xs text-saif-dim mt-0.5">{o.customer_name} · {formatDate(o.created_at)}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-sm font-semibold text-saif-text">{formatPrice(o.total)}</span>
                  <span className="text-[10px] uppercase tracking-wider text-saif-dim">{ORDER_STATUS_LABELS[o.status]}</span>
                </div>
              </Link>
            ))}
            {!ordersLoading && orders.length === 0 && (
              <p className="p-4 text-sm text-saif-dim">No orders yet.</p>
            )}
          </div>
        </section>
      </div>

      {/* Low stock */}
      <section className="border border-saif-border mt-6">
        <header className="flex items-center justify-between p-4 border-b border-saif-border">
          <h2 className="text-xs font-bold uppercase tracking-widest text-saif-text flex items-center gap-2">
            <AlertTriangle size={13} className="text-saif-accent" /> Stock Alerts
          </h2>
          <Link to="/admin/inventory" className="text-xs text-saif-dim hover:text-saif-text">Inventory →</Link>
        </header>
        {stockLoading ? <div className="p-4"><Loading /></div> : lowStock.length === 0 ? (
          <p className="p-4 text-sm text-saif-dim">All stocked up — nothing at or below threshold.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 divide-[rgba(245,240,232,0.08)]">
            {lowStock.map(p => (
              <Link key={p.id} to="/admin/inventory" className="flex items-center gap-3 p-4 hover:bg-white/[0.03] transition-colors">
                <img src={p.thumbnail || p.images?.[0] || ''} alt="" className="w-10 h-12 object-cover bg-[#111]" loading="lazy" />
                <div className="min-w-0">
                  <p className="text-sm text-saif-text font-medium truncate">{p.name}</p>
                  <p className={`text-xs mt-0.5 font-semibold ${p.stock <= 0 ? 'text-red-400' : 'text-saif-accent'}`}>
                    {p.stock <= 0 ? 'Out of stock' : `${p.stock} left (threshold ${p.low_stock_threshold})`}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
