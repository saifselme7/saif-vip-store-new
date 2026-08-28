import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Package,
  ShoppingCart,
  Users,
  AlertTriangle,
  DollarSign,
  CreditCard,
  Clock,
  CheckCircle2,
  XCircle,
  Zap,
  TrendingUp,
  ArrowRight,
  Boxes,
} from 'lucide-react'
import { adminDashboardStats } from '@/lib/api'
import { useApp } from '@/context/AppContext'
import { formatPrice, formatDate, cn } from '@/lib/utils'
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, ORDER_STATUS_LABELS } from '@/lib/constants'
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/ui/StatusBadge'
import { PageHeader, StatCard } from '@/components/admin/ui'
import { CardSkeleton, LineSkeleton } from '@/components/ui/Skeletons'

interface DashboardStats {
  total_orders: number
  total_revenue: number
  total_customers: number
  total_products: number
  pending_orders: number
  payments_awaiting: number
  payments_under_review: number
  payments_approved: number
  payments_rejected: number
  low_stock_products: number
  out_of_stock_products: number
  digital_orders: number
  recent_orders: {
    id: string
    order_number: string
    customer_name: string
    total: number
    status: string
    payment_status: string | null
    created_at: string
  }[]
  recent_payments: {
    id: string
    order_id: string
    payment_method: string
    payment_status: string
    expected_amount: number
    transferred_amount: number | null
    payer_identifier: string | null
    created_at: string
    order_number: string
    customer_name: string
    customer_phone: string | null
  }[]
  best_sellers: {
    id: string
    name: string
    slug: string
    thumbnail: string | null
    quantity_sold: number
    revenue: number
  }[]
  low_stock_list: { id: string; name: string; sku: string | null; stock: number; low_stock_threshold: number }[]
  sales_trend: { day: string; revenue: number; orders: number }[]
}

export default function AdminDashboard() {
  const { settings } = useApp()
  const currency = settings?.currency ?? 'EGP'
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await adminDashboardStats<DashboardStats>()
    if (err || !data) setError(err || 'Failed to load dashboard statistics.')
    else setStats(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const maxTrendRevenue = Math.max(1, ...(stats?.sales_trend?.map(t => Number(t.revenue)) ?? [1]))

  if (loading) {
    return (
      <div>
        <PageHeader title="Dashboard" description="Store overview from live data." />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <CardSkeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CardSkeleton className="h-72" />
          <CardSkeleton className="h-72" />
        </div>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <div className="border border-saif-accent/40 bg-saif-accent/5 p-6 rounded-sm">
          <p className="text-sm text-saif-text mb-2">Could not load statistics.</p>
          <p className="text-xs text-saif-dim mb-4">{error}</p>
          <p className="text-xs text-saif-dim">
            Make sure the database functions from <span className="font-mono">supabase/functions.sql</span> have been
            applied.
          </p>
          <button className="btn btn-sm mt-4" onClick={load}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  const pendingVerification = stats.payments_awaiting + stats.payments_under_review

  return (
    <div className="animate-[pageIn_0.4s_ease]">
      <PageHeader
        title="Dashboard"
        description="Live overview of your store."
        actions={
          <button className="btn btn-sm" onClick={load}>
            Refresh
          </button>
        }
      />

      {/* Key stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
        <StatCard label="Paid Revenue" value={formatPrice(stats.total_revenue, currency)} icon={DollarSign} hint="approved payments" />
        <StatCard label="Total Orders" value={stats.total_orders} icon={ShoppingCart} />
        <StatCard label="Customers" value={stats.total_customers} icon={Users} />
        <StatCard label="Products" value={stats.total_products} icon={Package} />
        <StatCard
          label="Payment Reviews"
          value={pendingVerification}
          icon={CreditCard}
          alert={pendingVerification > 0}
          hint="needs action"
        />
        <StatCard label="Approved Payments" value={stats.payments_approved} icon={CheckCircle2} />
        <StatCard label="Rejected Payments" value={stats.payments_rejected} icon={XCircle} />
        <StatCard
          label="Low / Out of Stock"
          value={`${stats.low_stock_products} / ${stats.out_of_stock_products}`}
          icon={AlertTriangle}
          alert={stats.out_of_stock_products > 0}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        {/* Payment queue preview */}
        <section className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-saif-text flex items-center gap-2">
              <CreditCard size={14} className="text-saif-accent" /> Recent Payments
            </h2>
            <Link to="/admin/payments" className="text-xs text-saif-dim hover:text-saif-text transition-colors flex items-center gap-1">
              Verify <ArrowRight size={11} />
            </Link>
          </div>
          {stats.recent_payments.length === 0 ? (
            <p className="text-sm text-saif-dim py-6 text-center">No payment submissions yet.</p>
          ) : (
            <div className="divide-y divide-saif-border">
              {stats.recent_payments.slice(0, 5).map(p => (
                <Link
                  key={p.id}
                  to={`/admin/payments?focus=${p.id}`}
                  className="flex items-center justify-between gap-3 py-3 hover:bg-white/[0.03] transition-colors -mx-2 px-2 rounded-sm"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-saif-text truncate">
                      {p.order_number} · <span className="text-saif-dim">{p.customer_name}</span>
                    </p>
                    <p className="text-xs text-saif-dim mt-0.5">
                      {PAYMENT_METHOD_LABELS[p.payment_method as 'instapay' | 'vodafone_cash']} ·{' '}
                      {formatPrice(p.transferred_amount ?? p.expected_amount, currency)} · {formatDate(p.created_at)}
                    </p>
                  </div>
                  <PaymentStatusBadge status={p.payment_status} />
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Recent orders */}
        <section className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-saif-text flex items-center gap-2">
              <ShoppingCart size={14} className="text-saif-accent" /> Recent Orders
            </h2>
            <Link to="/admin/orders" className="text-xs text-saif-dim hover:text-saif-text transition-colors flex items-center gap-1">
              All Orders <ArrowRight size={11} />
            </Link>
          </div>
          {stats.recent_orders.length === 0 ? (
            <p className="text-sm text-saif-dim py-6 text-center">No orders yet.</p>
          ) : (
            <div className="divide-y divide-saif-border">
              {stats.recent_orders.slice(0, 5).map(o => (
                <Link
                  key={o.id}
                  to={`/admin/orders/${o.id}`}
                  className="flex items-center justify-between gap-3 py-3 hover:bg-white/[0.03] transition-colors -mx-2 px-2 rounded-sm"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-saif-text truncate">
                      {o.order_number} · <span className="text-saif-dim">{o.customer_name}</span>
                    </p>
                    <p className="text-xs text-saif-dim mt-0.5">
                      {formatPrice(o.total, currency)} · {formatDate(o.created_at)}
                    </p>
                  </div>
                  <OrderStatusBadge status={o.status} />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
        {/* Sales trend */}
        <section className="card p-5 xl:col-span-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-saif-text flex items-center gap-2 mb-6">
            <TrendingUp size={14} className="text-saif-accent" /> Paid Revenue — Last 14 Days
          </h2>
          <div className="flex items-end gap-1.5 h-40" role="img" aria-label="Daily paid revenue for the last 14 days">
            {stats.sales_trend.map(t => (
              <div key={t.day} className="flex-1 flex flex-col items-center gap-1.5 group">
                <div
                  className={cn(
                    'w-full rounded-t-sm transition-all duration-500',
                    Number(t.revenue) > 0 ? 'bg-saif-accent/80 group-hover:bg-saif-accent' : 'bg-white/10',
                  )}
                  style={{ height: `${Math.max(3, (Number(t.revenue) / maxTrendRevenue) * 130)}px` }}
                  title={`${t.day}: ${formatPrice(Number(t.revenue), currency)} (${t.orders} orders)`}
                />
                <span className="text-[9px] text-saif-faint">{new Date(t.day).getDate()}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Best sellers */}
        <section className="card p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-saif-text flex items-center gap-2 mb-4">
            <TrendingUp size={14} className="text-saif-accent" /> Best Sellers
          </h2>
          {stats.best_sellers.length === 0 ? (
            <p className="text-sm text-saif-dim py-6 text-center">No sales data yet.</p>
          ) : (
            <div className="space-y-3">
              {stats.best_sellers.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-saif-dim w-4">{i + 1}</span>
                  <div className="w-9 h-11 bg-saif-panel overflow-hidden rounded-sm flex-shrink-0">
                    {p.thumbnail && <img src={p.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-saif-text truncate">{p.name}</p>
                    <p className="text-[10px] text-saif-dim">
                      {p.quantity_sold} sold · {formatPrice(Number(p.revenue), currency)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Low stock */}
        <section className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-saif-text flex items-center gap-2">
              <Boxes size={14} className="text-saif-accent" /> Inventory Alerts
            </h2>
            <Link to="/admin/inventory" className="text-xs text-saif-dim hover:text-saif-text transition-colors flex items-center gap-1">
              Manage <ArrowRight size={11} />
            </Link>
          </div>
          {stats.low_stock_list.length === 0 ? (
            <p className="text-sm text-saif-dim py-6 text-center">All products are sufficiently stocked.</p>
          ) : (
            <div className="divide-y divide-saif-border">
              {stats.low_stock_list.map(p => (
                <div key={p.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm text-saif-text truncate">{p.name}</p>
                    <p className="text-xs text-saif-dim">{p.sku || 'No SKU'}</p>
                  </div>
                  <span
                    className={cn(
                      'text-sm font-bold tabular-nums flex-shrink-0',
                      p.stock === 0 ? 'text-red-400' : 'text-yellow-400',
                    )}
                  >
                    {p.stock === 0 ? 'Out of stock' : `${p.stock} left`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Quick facts */}
        <section className="card p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-saif-text flex items-center gap-2 mb-4">
            <Clock size={14} className="text-saif-accent" /> At a Glance
          </h2>
          <dl className="divide-y divide-saif-border text-sm">
            <div className="flex justify-between py-3">
              <dt className="text-saif-dim">Orders in payment review</dt>
              <dd className="text-saif-text font-semibold">{stats.pending_orders}</dd>
            </div>
            <div className="flex justify-between py-3">
              <dt className="text-saif-dim">Digital orders</dt>
              <dd className="text-saif-text font-semibold flex items-center gap-1.5">
                <Zap size={12} className="text-saif-accent" />
                {stats.digital_orders}
              </dd>
            </div>
            <div className="flex justify-between py-3">
              <dt className="text-saif-dim">Payments awaiting customer</dt>
              <dd className="text-saif-text font-semibold">{stats.payments_awaiting}</dd>
            </div>
            <div className="flex justify-between py-3">
              <dt className="text-saif-dim">Payments under review</dt>
              <dd className="text-saif-text font-semibold">{stats.payments_under_review}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  )
}
