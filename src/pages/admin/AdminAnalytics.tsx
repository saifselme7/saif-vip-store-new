import { useEffect, useState } from 'react'
import { TrendingUp, ShoppingCart, DollarSign, Zap, CreditCard, Package } from 'lucide-react'
import { adminSalesAnalytics } from '@/lib/api'
import { useApp } from '@/context/AppContext'
import { usePageMeta } from '@/hooks/usePageMeta'
import { formatPrice, cn } from '@/lib/utils'
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '@/lib/constants'
import { PageHeader, StatCard, FilterTabs } from '@/components/admin/ui'
import { CardSkeleton } from '@/components/ui/Skeletons'

interface Analytics {
  days: number
  daily: { day: string; revenue: number; orders: number }[]
  paid_daily: { day: string; revenue: number; orders: number }[]
  total_revenue_paid: number
  total_revenue_all: number
  total_orders: number
  avg_order_value: number
  top_products: { name: string; quantity: number; revenue: number }[]
  top_categories: { name: string; quantity: number; revenue: number }[]
  payment_methods: { payment_method: string; count: number; amount: number }[]
  order_status_distribution: { status: string; count: number }[]
  product_type_split: { product_type: string; quantity: number; revenue: number }[]
}

export default function AdminAnalytics() {
  const { settings } = useApp()
  const currency = settings?.currency ?? 'EGP'
  const [days, setDays] = useState('30')
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  usePageMeta({ title: 'Admin — Analytics' })

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    adminSalesAnalytics<Analytics>(Number(days)).then(({ data: d, error: err }) => {
      if (cancelled) return
      if (err || !d) setError(err || 'Failed to load analytics.')
      else setData(d)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [days])

  const maxDaily = Math.max(1, ...(data?.daily ?? []).map(t => Number(t.revenue)))
  const maxProductRevenue = Math.max(1, ...(data?.top_products ?? []).map(p => Number(p.revenue)))
  const maxCategoryRevenue = Math.max(1, ...(data?.top_categories ?? []).map(c => Number(c.revenue)))
  const totalStatusCount = (data?.order_status_distribution ?? []).reduce((s, x) => s + Number(x.count), 0) || 1
  const totalTypeRevenue = (data?.product_type_split ?? []).reduce((s, x) => s + Number(x.revenue), 0) || 1

  return (
    <div className="animate-[pageIn_0.4s_ease]">
      <PageHeader
        title="Sales Analytics"
        description="Aggregated from real order data."
        actions={
          <FilterTabs
            value={days}
            onChange={setDays}
            options={[
              { value: '7', label: '7 days' },
              { value: '30', label: '30 days' },
              { value: '90', label: '90 days' },
            ]}
          />
        }
      />

      {error && (
        <div className="border border-saif-accent/40 bg-saif-accent/5 p-6 rounded-sm mb-6">
          <p className="text-sm text-saif-text mb-1">Could not load analytics.</p>
          <p className="text-xs text-saif-dim">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <CardSkeleton key={i} className="h-28" />
          ))}
        </div>
      ) : data ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            <StatCard label={`Revenue (paid)`} value={formatPrice(data.total_revenue_paid, currency)} icon={DollarSign} />
            <StatCard label="All-time Orders" value={data.total_orders} icon={ShoppingCart} />
            <StatCard label="Avg Order Value" value={formatPrice(data.avg_order_value, currency)} icon={TrendingUp} />
            <StatCard label={`Revenue (all orders)`} value={formatPrice(data.total_revenue_all, currency)} icon={CreditCard} />
          </div>

          {/* Daily chart */}
          <section className="card p-5 mb-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-saif-text mb-6">
              Orders & Revenue — Last {data.days} Days
            </h2>
            <div className="flex items-end gap-1 h-48 overflow-x-auto pb-2" role="img" aria-label="Daily revenue chart">
              {data.daily.map(t => {
                const revenue = Number(t.revenue)
                const paid = Number((data.paid_daily.find(p => p.day === t.day) || {}).revenue || 0)
                return (
                  <div key={t.day} className="flex flex-col items-center gap-1.5 min-w-[14px] flex-1 group relative">
                    <div
                      className="w-full rounded-t-sm bg-saif-accent/80 group-hover:bg-saif-accent transition-colors relative"
                      style={{ height: `${Math.max(3, (revenue / maxDaily) * 160)}px` }}
                      title={`${t.day}: ${formatPrice(revenue, currency)} (${t.orders} orders, ${formatPrice(paid, currency)} paid)`}
                    >
                      {paid > 0 && paid < revenue && (
                        <div
                          className="absolute bottom-0 left-0 right-0 bg-green-500/70 rounded-t-sm"
                          style={{ height: `${(paid / Math.max(revenue, 1)) * 100}%` }}
                          title={`Paid: ${formatPrice(paid, currency)}`}
                        />
                      )}
                    </div>
                    <span className="text-[8px] text-saif-faint rotate-45 origin-left">{new Date(t.day).getDate()}</span>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-4 mt-4 text-[10px] text-saif-dim">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-saif-accent/80 rounded-sm" /> All orders
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-green-500/70 rounded-sm" /> Paid orders
              </span>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top products */}
            <section className="card p-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-saif-text mb-4 flex items-center gap-2">
                <Package size={13} className="text-saif-accent" /> Top Products (paid)
              </h2>
              {data.top_products.length === 0 ? (
                <p className="text-sm text-saif-dim py-6 text-center">No sales yet.</p>
              ) : (
                <div className="space-y-3">
                  {data.top_products.map(p => (
                    <div key={p.name}>
                      <div className="flex justify-between gap-3 text-xs mb-1.5">
                        <span className="text-saif-text truncate">{p.name}</span>
                        <span className="text-saif-dim flex-shrink-0">
                          {p.quantity} sold · {formatPrice(Number(p.revenue), currency)}
                        </span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-saif-accent rounded-full"
                          style={{ width: `${(Number(p.revenue) / maxProductRevenue) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Top categories */}
            <section className="card p-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-saif-text mb-4 flex items-center gap-2">
                <TrendingUp size={13} className="text-saif-accent" /> Top Categories (paid)
              </h2>
              {data.top_categories.length === 0 ? (
                <p className="text-sm text-saif-dim py-6 text-center">No sales yet.</p>
              ) : (
                <div className="space-y-3">
                  {data.top_categories.map(c => (
                    <div key={c.name}>
                      <div className="flex justify-between gap-3 text-xs mb-1.5">
                        <span className="text-saif-text truncate">{c.name}</span>
                        <span className="text-saif-dim flex-shrink-0">
                          {c.quantity} sold · {formatPrice(Number(c.revenue), currency)}
                        </span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-saif-text rounded-full"
                          style={{ width: `${(Number(c.revenue) / maxCategoryRevenue) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Payment methods */}
            <section className="card p-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-saif-text mb-4 flex items-center gap-2">
                <CreditCard size={13} className="text-saif-accent" /> Payment Methods
              </h2>
              {data.payment_methods.length === 0 ? (
                <p className="text-sm text-saif-dim py-6 text-center">No payments yet.</p>
              ) : (
                <div className="space-y-3">
                  {data.payment_methods.map(m => {
                    const total = data.payment_methods.reduce((s, x) => s + Number(x.count), 0)
                    const pct = (Number(m.count) / Math.max(total, 1)) * 100
                    return (
                      <div key={m.payment_method}>
                        <div className="flex justify-between gap-3 text-xs mb-1.5">
                          <span className="text-saif-text">
                            {PAYMENT_METHOD_LABELS[m.payment_method as 'instapay' | 'vodafone_cash'] ?? m.payment_method}
                          </span>
                          <span className="text-saif-dim">
                            {m.count} payments · {formatPrice(Number(m.amount), currency)}
                          </span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-saif-accent rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Order status distribution */}
            <section className="card p-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-saif-text mb-4 flex items-center gap-2">
                <ShoppingCart size={13} className="text-saif-accent" /> Order Status Distribution
              </h2>
              {data.order_status_distribution.length === 0 ? (
                <p className="text-sm text-saif-dim py-6 text-center">No orders yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {data.order_status_distribution.map(s => {
                    const pct = (Number(s.count) / totalStatusCount) * 100
                    return (
                      <div key={s.status}>
                        <div className="flex justify-between gap-3 text-xs mb-1">
                          <span className="text-saif-text">{ORDER_STATUS_LABELS[s.status as keyof typeof ORDER_STATUS_LABELS] ?? s.status}</span>
                          <span className="text-saif-dim">
                            {s.count} · {pct.toFixed(0)}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-saif-text rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Digital vs physical */}
            <section className="card p-5 lg:col-span-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-saif-text mb-4 flex items-center gap-2">
                <Zap size={13} className="text-saif-accent" /> Digital vs Physical (paid)
              </h2>
              {data.product_type_split.length === 0 ? (
                <p className="text-sm text-saif-dim py-6 text-center">No sales yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {['digital', 'physical'].map(type => {
                    const entry = data.product_type_split.find(s => s.product_type === type)
                    const revenue = Number(entry?.revenue || 0)
                    const pct = (revenue / totalTypeRevenue) * 100
                    return (
                      <div key={type} className="border border-saif-border rounded-sm p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className={cn('text-sm font-semibold capitalize', type === 'digital' ? 'text-saif-accent' : 'text-saif-text')}>
                            {type}
                          </span>
                          <span className="text-xs text-saif-dim">{entry?.quantity || 0} items</span>
                        </div>
                        <p className="text-xl font-bold text-saif-text">{formatPrice(revenue, currency)}</p>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mt-3">
                          <div
                            className={cn('h-full rounded-full', type === 'digital' ? 'bg-saif-accent' : 'bg-saif-text')}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-saif-dim mt-1.5">{pct.toFixed(0)}% of paid revenue</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </div>
        </>
      ) : null}
    </div>
  )
}
