import { RefreshCw } from 'lucide-react'
import { useAnalytics } from '@/hooks/useAdmin'
import { usePageMeta } from '@/hooks/usePageMeta'
import { ORDER_STATUS_LABELS } from '@/lib/constants'
import { formatPrice } from '@/lib/utils'
import Loading from '@/components/Loading'
import EmptyState from '@/components/EmptyState'

export default function AdminAnalytics() {
  const { data, loading, refetch } = useAnalytics()
  usePageMeta('Analytics', 'Sales and store analytics.')

  if (loading) return <Loading />
  if (!data) return <EmptyState title="No analytics available" description="Analytics appear once orders exist." />

  const { totals, daily, top_products, payment_methods, order_statuses, product_types } = data
  const maxRevenue = Math.max(...daily.map(d => Number(d.revenue)), 1)
  const paidTotal = payment_methods.reduce((s, m) => s + Number(m.total), 0)

  return (
    <div className="animate-[pageIn_0.4s_ease]">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-saif-text">Analytics</h1>
        <button onClick={refetch} className="text-xs text-saif-dim hover:text-saif-text flex items-center gap-1.5">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <Kpi label="Revenue (paid orders)" value={formatPrice(totals.revenue)} />
        <Kpi label="Orders" value={String(totals.orders)} />
        <Kpi label="Avg Order Value" value={formatPrice(totals.avg_order_value)} />
        <Kpi label="Customers" value={String(totals.customers)} />
      </div>

      {/* Sales over time */}
      <section className="border border-saif-border p-5 mb-6">
        <h2 className="text-xs font-bold uppercase tracking-widest text-saif-text mb-4">Last 30 Days</h2>
        {daily.length === 0 ? (
          <p className="text-sm text-saif-dim">No sales in the last 30 days.</p>
        ) : (
          <>
            <div className="flex items-end gap-[3px] h-40" role="img" aria-label="Daily revenue bar chart">
              {daily.map(d => (
                <div key={d.day} className="flex-1 group relative">
                  <div
                    className="w-full bg-saif-accent/70 group-hover:bg-saif-accent transition-colors"
                    style={{ height: `${Math.max(4, (Number(d.revenue) / maxRevenue) * 100)}%` }}
                  />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block whitespace-nowrap bg-black border border-saif-border px-2 py-1 text-[10px] text-saif-text z-10">
                    {d.day}: {formatPrice(Number(d.revenue))} · {d.orders} orders
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-saif-dim mt-2">
              <span>{daily[0].day}</span>
              <span>{daily[daily.length - 1].day}</span>
            </div>
          </>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top products */}
        <section className="border border-saif-border">
          <h2 className="text-xs font-bold uppercase tracking-widest text-saif-text p-4 border-b border-saif-border">Top Products</h2>
          {top_products.length === 0 ? <p className="p-4 text-sm text-saif-dim">No sales yet.</p> : (
            <div className="divide-y divide-[rgba(245,240,232,0.08)]">
              {top_products.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3 p-3.5 text-sm">
                  <span className="text-saif-dim/50 font-bold w-5">{i + 1}</span>
                  <span className="text-saif-text flex-1 min-w-0 truncate">{p.name}</span>
                  <span className="text-saif-dim text-xs flex-shrink-0">{p.units} sold</span>
                  <span className="text-saif-text font-semibold flex-shrink-0">{formatPrice(Number(p.revenue))}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Payment methods */}
        <section className="border border-saif-border">
          <h2 className="text-xs font-bold uppercase tracking-widest text-saif-text p-4 border-b border-saif-border">Payment Methods (approved)</h2>
          {payment_methods.length === 0 ? <p className="p-4 text-sm text-saif-dim">No approved payments yet.</p> : (
            <div className="p-4 space-y-4">
              {payment_methods.map(m => {
                const pct = paidTotal > 0 ? (Number(m.total) / paidTotal) * 100 : 0
                return (
                  <div key={m.method}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-saif-text font-medium">{m.method === 'instapay' ? 'InstaPay' : 'Vodafone Cash'}</span>
                      <span className="text-saif-dim">{m.count} payments · {formatPrice(Number(m.total))}</span>
                    </div>
                    <div className="h-2 bg-white/5">
                      <div className="h-full bg-saif-accent" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Order status distribution */}
        <section className="border border-saif-border">
          <h2 className="text-xs font-bold uppercase tracking-widest text-saif-text p-4 border-b border-saif-border">Order Statuses</h2>
          <div className="p-4 flex flex-wrap gap-2">
            {order_statuses.map(s => (
              <span key={s.status} className="border border-saif-border px-3 py-2 text-xs text-saif-dim">
                {ORDER_STATUS_LABELS[s.status as keyof typeof ORDER_STATUS_LABELS] || s.status} · <span className="text-saif-text font-bold">{s.count}</span>
              </span>
            ))}
            {order_statuses.length === 0 && <p className="text-sm text-saif-dim">No orders yet.</p>}
          </div>
        </section>

        {/* Digital vs physical */}
        <section className="border border-saif-border">
          <h2 className="text-xs font-bold uppercase tracking-widest text-saif-text p-4 border-b border-saif-border">Digital vs Physical Revenue</h2>
          {product_types.length === 0 ? <p className="p-4 text-sm text-saif-dim">No sales yet.</p> : (
            <div className="p-4 space-y-4">
              {product_types.map(t => (
                <div key={t.type} className="flex justify-between items-center text-sm">
                  <span className="text-saif-text font-medium capitalize">{t.type}</span>
                  <span className="text-saif-text font-semibold">{formatPrice(Number(t.revenue))}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-saif-border p-4">
      <p className="text-lg sm:text-xl font-bold text-saif-text truncate">{value}</p>
      <p className="text-[10px] text-saif-dim uppercase tracking-wider mt-1">{label}</p>
    </div>
  )
}
