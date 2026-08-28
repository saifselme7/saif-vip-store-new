import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, ShoppingBag, Mail, Phone } from 'lucide-react'
import { useAdminCustomers, useAdminOrders } from '@/hooks/admin/useAdminData'
import { useApp } from '@/context/AppContext'
import { useDebounce } from '@/hooks/useDebounce'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useI18n } from '@/i18n'
import { formatPrice, formatDate } from '@/lib/utils'
import { PageHeader, SearchInput, DataList, type Cell } from '@/components/admin/ui'
import Modal from '@/components/ui/Modal'
import Loading from '@/components/Loading'
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/ui/StatusBadge'

export default function AdminCustomers() {
  const { t } = useI18n()
  const { customers, loading } = useAdminCustomers()
  const { orders } = useAdminOrders()
  const { settings } = useApp()
  const currency = settings?.currency ?? 'EGP'
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const debouncedSearch = useDebounce(search, 250)
  usePageMeta({ title: 'Admin — Customers' })

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    if (!q) return customers
    return customers.filter(
      c =>
        (c.full_name || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(q),
    )
  }, [customers, debouncedSearch])

  const selected = customers.find(c => c.id === selectedId) ?? null
  const customerOrders = orders.filter(o => o.user_id === selectedId)

  if (loading) {
    return (
      <div>
        <PageHeader title={t('admin.customers.title')} />
        <Loading />
      </div>
    )
  }

  const rows: Cell[][] = filtered.map(c => [
    {
      label: 'Customer',
      primary: true,
      content: (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-xs font-bold text-saif-dim flex-shrink-0">
            {(c.full_name || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-saif-text truncate">{c.full_name || 'Unnamed'}</p>
            <p className="text-xs text-saif-dim truncate">{c.email || '—'}</p>
          </div>
        </div>
      ),
    },
    { label: 'Phone', content: <span className="text-saif-dim font-mono text-xs">{c.phone || '—'}</span> },
    { label: 'Orders', content: <span className="text-saif-text font-semibold tabular-nums">{c.orders_count}</span> },
    {
      label: 'Total Spent',
      content: <span className="text-saif-text font-semibold">{formatPrice(c.total_spent, currency)}</span>,
    },
    {
      label: 'Last Order',
      hideOnMobile: true,
      content: <span className="text-xs text-saif-dim">{c.last_order_at ? formatDate(c.last_order_at) : '—'}</span>,
    },
    { label: 'Joined', hideOnMobile: true, content: <span className="text-xs text-saif-dim">{formatDate(c.created_at)}</span> },
    {
      label: '',
      content: (
        <button className="btn btn-sm" onClick={() => setSelectedId(c.id)}>
          Details
        </button>
      ),
    },
  ])

  return (
    <div className="animate-[pageIn_0.4s_ease]">
      <PageHeader title={t('admin.customers.title')} description={`${customers.length} registered customers`} />

      <div className="mb-6">
        <SearchInput value={search} onChange={setSearch} placeholder={t('admin.customers.searchPlaceholder')} className="max-w-sm" />
      </div>

      <DataList
        columns={['Customer', 'Phone', 'Orders', 'Total Spent', 'Last Order', 'Joined', '']}
        rows={rows}
        empty={filtered.length === 0}
      />

      {/* Customer detail */}
      <Modal
        open={!!selected}
        onClose={() => setSelectedId(null)}
        title={selected?.full_name || 'Customer'}
        wide
      >
        {selected && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="border border-saif-border rounded-sm p-3">
                <p className="text-lg font-bold text-saif-text">{selected.orders_count}</p>
                <p className="text-[10px] uppercase tracking-wider text-saif-dim">{t('admin.customers.orders')}</p>
              </div>
              <div className="border border-saif-border rounded-sm p-3">
                <p className="text-lg font-bold text-saif-text">{formatPrice(selected.total_spent, currency)}</p>
                <p className="text-[10px] uppercase tracking-wider text-saif-dim">{t('admin.customers.spent')}</p>
              </div>
              <div className="border border-saif-border rounded-sm p-3">
                <p className="text-sm font-bold text-saif-text mt-1">{formatDate(selected.last_order_at)}</p>
                <p className="text-[10px] uppercase tracking-wider text-saif-dim">{t('admin.customers.lastOrder')}</p>
              </div>
              <div className="border border-saif-border rounded-sm p-3">
                <p className="text-sm font-bold text-saif-text mt-1">{formatDate(selected.created_at)}</p>
                <p className="text-[10px] uppercase tracking-wider text-saif-dim">{t('admin.customers.joined')}</p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              {selected.email && (
                <p className="flex items-center gap-2 text-saif-dim">
                  <Mail size={13} /> {selected.email}
                </p>
              )}
              {selected.phone && (
                <p className="flex items-center gap-2 text-saif-dim">
                  <Phone size={13} /> <span dir="ltr">{selected.phone}</span>
                </p>
              )}
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-saif-text mb-3 flex items-center gap-2">
                <ShoppingBag size={13} className="text-saif-accent" /> Order History
              </h3>
              {customerOrders.length === 0 ? (
                <p className="text-sm text-saif-dim py-4 text-center border border-saif-border rounded-sm">
                  No orders yet.
                </p>
              ) : (
                <div className="divide-y divide-saif-border border border-saif-border rounded-sm max-h-72 overflow-y-auto">
                  {customerOrders.map(o => (
                    <Link
                      key={o.id}
                      to={`/admin/orders/${o.id}`}
                      className="flex items-center justify-between gap-3 p-3 hover:bg-white/[0.03] transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-mono text-saif-text">{o.order_number}</p>
                        <p className="text-[11px] text-saif-dim">{formatDate(o.created_at)} · {formatPrice(o.total, currency)}</p>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <OrderStatusBadge status={o.status} />
                        <PaymentStatusBadge status={o.payment_status} />
                      </div>
                    </Link>
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
