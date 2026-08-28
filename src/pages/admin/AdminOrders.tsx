import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAdminOrders } from '@/hooks/admin/useAdminData'
import { useApp } from '@/context/AppContext'
import { useDebounce } from '@/hooks/useDebounce'
import { usePageMeta } from '@/hooks/usePageMeta'
import { formatPrice, formatDate } from '@/lib/utils'
import { ORDER_STATUSES, ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '@/lib/constants'
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/ui/StatusBadge'
import { PageHeader, SearchInput, FilterTabs, DataList, type Cell } from '@/components/admin/ui'
import Loading from '@/components/Loading'

export default function AdminOrders() {
  const { orders, loading, refetch } = useAdminOrders()
  const { settings } = useApp()
  const currency = settings?.currency ?? 'EGP'
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [sort, setSort] = useState<'newest' | 'oldest' | 'total_desc'>('newest')
  usePageMeta({ title: 'Admin — Orders' })

  const debouncedSearch = useDebounce(search, 250)

  const filtered = useMemo(() => {
    let list = [...orders]
    const q = debouncedSearch.trim().toLowerCase()
    if (q) {
      list = list.filter(
        o =>
          o.order_number.toLowerCase().includes(q) ||
          o.customer_name.toLowerCase().includes(q) ||
          (o.customer_email || '').toLowerCase().includes(q) ||
          (o.customer_phone || '').includes(q),
      )
    }
    if (statusFilter) list = list.filter(o => o.status === statusFilter)
    if (paymentFilter) list = list.filter(o => (o.payment_status ?? '') === paymentFilter)
    if (sort === 'oldest') list.sort((a, b) => a.created_at.localeCompare(b.created_at))
    else if (sort === 'total_desc') list.sort((a, b) => b.total - a.total)
    return list
  }, [orders, debouncedSearch, statusFilter, paymentFilter, sort])

  if (loading) {
    return (
      <div>
        <PageHeader title="Orders" />
        <Loading />
      </div>
    )
  }

  const rows: Cell[][] = filtered.map(o => [
    {
      label: 'Order',
      primary: true,
      content: (
        <Link to={`/admin/orders/${o.id}`} className="font-mono text-xs font-semibold text-saif-text hover:text-saif-accent transition-colors">
          {o.order_number}
        </Link>
      ),
    },
    {
      label: 'Customer',
      content: (
        <div className="min-w-0">
          <p className="text-saif-text truncate">{o.customer_name}</p>
          <p className="text-xs text-saif-dim truncate">{o.customer_phone || o.customer_email}</p>
        </div>
      ),
    },
    {
      label: 'Items',
      hideOnMobile: true,
      content: <span className="text-saif-dim">{o.items?.length ?? 0}</span>,
    },
    {
      label: 'Total',
      content: <span className="font-semibold text-saif-text">{formatPrice(o.total, currency)}</span>,
    },
    {
      label: 'Payment',
      content: (
        <div className="space-y-1">
          <PaymentStatusBadge status={o.payment_status} />
          {o.payment_method && (
            <p className="text-[10px] text-saif-dim">{PAYMENT_METHOD_LABELS[o.payment_method]}</p>
          )}
        </div>
      ),
    },
    { label: 'Status', content: <OrderStatusBadge status={o.status} /> },
    {
      label: 'Date',
      content: <span className="text-xs text-saif-dim whitespace-nowrap">{formatDate(o.created_at, true)}</span>,
    },
  ])

  const statusOptions = [
    { value: '', label: 'All', count: orders.length },
    ...ORDER_STATUSES.map(s => ({
      value: s,
      label: ORDER_STATUS_LABELS[s],
      count: orders.filter(o => o.status === s).length,
    })).filter(o => o.count > 0),
  ]

  const paymentOptions = [
    { value: '', label: 'Any payment' },
    { value: 'awaiting_payment', label: 'Awaiting' },
    { value: 'under_review', label: 'Under review' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'cancelled', label: 'Cancelled' },
  ]

  return (
    <div className="animate-[pageIn_0.4s_ease]">
      <PageHeader
        title="Orders"
        description={`${orders.length} orders`}
        actions={
          <button className="btn btn-sm" onClick={refetch}>
            Refresh
          </button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Order #, name, phone, email…" className="flex-1" />
        <select
          value={paymentFilter}
          onChange={e => setPaymentFilter(e.target.value)}
          className="input py-2.5 text-xs w-full sm:w-40"
          aria-label="Filter by payment status"
        >
          {paymentOptions.map(o => (
            <option key={o.value} value={o.value} className="bg-black">
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={e => setSort(e.target.value as typeof sort)}
          className="input py-2.5 text-xs w-full sm:w-40"
          aria-label="Sort orders"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="total_desc">Highest total</option>
        </select>
      </div>

      <div className="mb-6">
        <FilterTabs value={statusFilter} onChange={setStatusFilter} options={statusOptions} ariaLabel="Order status filter" />
      </div>

      <DataList
        columns={['Order', 'Customer', 'Items', 'Total', 'Payment', 'Status', 'Date']}
        rows={rows}
        empty={filtered.length === 0}
      />
    </div>
  )
}
