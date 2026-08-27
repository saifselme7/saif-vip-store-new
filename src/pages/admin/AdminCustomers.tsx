import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAdminCustomers } from '@/hooks/useAdmin'
import { usePageMeta } from '@/hooks/usePageMeta'
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/lib/constants'
import { formatPrice, formatDate } from '@/lib/utils'
import type { CustomerStat } from '@/lib/adminTypes'
import type { Order } from '@/types'
import Loading from '@/components/Loading'
import EmptyState from '@/components/EmptyState'
import Modal from '@/components/ui/Modal'
import { StatusBadge } from '@/components/ui/Badge'

export default function AdminCustomers() {
  const { customers, loading } = useAdminCustomers()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<CustomerStat | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)

  usePageMeta('Customers', 'Customer accounts and their order history.')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return customers
    return customers.filter(c =>
      (c.full_name || '').toLowerCase().includes(q) || (c.phone || '').includes(q),
    )
  }, [customers, search])

  async function openCustomer(c: CustomerStat) {
    setSelected(c)
    setOrdersLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('user_id', c.id)
      .order('created_at', { ascending: false })
    setOrders((data || []) as unknown as Order[])
    setOrdersLoading(false)
  }

  return (
    <div className="animate-[pageIn_0.4s_ease]">
      <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-saif-text mb-6">Customers</h1>

      <div className="relative max-w-md mb-6">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-saif-dim" />
        <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or phone…" aria-label="Search customers" className="input pl-10 text-sm" />
      </div>

      {loading ? <Loading /> : filtered.length === 0 ? (
        <EmptyState title="No customers yet" description="Registered customers appear here with their order stats." />
      ) : (
        <div className="border border-saif-border overflow-x-auto">
          <table className="w-full text-sm min-w-[680px]">
            <thead>
              <tr className="border-b border-saif-border text-left">
                {['Customer', 'Phone', 'Joined', 'Orders', 'Total Spent', 'Last Order'].map(h => (
                  <th key={h} className="p-4 text-[10px] uppercase tracking-wider text-saif-dim font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} onClick={() => openCustomer(c)} className="border-b border-saif-border hover:bg-white/[0.03] cursor-pointer transition-colors">
                  <td className="p-4 font-medium text-saif-text">{c.full_name || 'Unnamed'}</td>
                  <td className="p-4 text-saif-dim" dir="ltr">{c.phone || '—'}</td>
                  <td className="p-4 text-saif-dim text-xs">{formatDate(c.created_at)}</td>
                  <td className="p-4 text-saif-text">{c.order_count}</td>
                  <td className="p-4 text-saif-text font-semibold">{formatPrice(c.total_spent)}</td>
                  <td className="p-4 text-saif-dim text-xs">{c.last_order_at ? formatDate(c.last_order_at) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Customer detail */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.full_name || 'Customer'} wide>
        {selected && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MiniStat label="Orders" value={String(selected.order_count)} />
              <MiniStat label="Total Spent" value={formatPrice(selected.total_spent)} />
              <MiniStat label="Joined" value={formatDate(selected.created_at)} />
              <MiniStat label="Phone" value={selected.phone || '—'} />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-saif-text mb-3">Order History</h3>
              {ordersLoading ? <Loading /> : orders.length === 0 ? (
                <p className="text-sm text-saif-dim">No orders from this customer.</p>
              ) : (
                <div className="space-y-2">
                  {orders.map(o => (
                    <div key={o.id} className="border border-saif-border p-3.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-saif-text truncate">{o.order_number}</p>
                        <p className="text-xs text-saif-dim">{formatDate(o.created_at)} · {o.items?.length || 0} items</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-sm font-semibold text-saif-text">{formatPrice(o.total)}</span>
                        <StatusBadge className={ORDER_STATUS_COLORS[o.status]}>{ORDER_STATUS_LABELS[o.status]}</StatusBadge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-saif-border p-3">
      <p className="text-[10px] uppercase tracking-widest text-saif-dim">{label}</p>
      <p className="text-sm font-bold text-saif-text mt-1 truncate" dir="auto">{value}</p>
    </div>
  )
}
