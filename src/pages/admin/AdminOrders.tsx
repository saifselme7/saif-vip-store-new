import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, RefreshCw, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAllOrders, latestPayment } from '@/hooks/useOrders'
import { useApp } from '@/context/AppContext'
import { usePageMeta } from '@/hooks/usePageMeta'
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, PAYMENT_METHODS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS } from '@/lib/constants'
import { formatPrice, formatDateTime } from '@/lib/utils'
import { getScreenshotUrl } from '@/lib/storage'
import type { Order, OrderStatus } from '@/types'
import Loading from '@/components/Loading'
import EmptyState from '@/components/EmptyState'
import Modal from '@/components/ui/Modal'
import { StatusBadge } from '@/components/ui/Badge'

const STATUS_GROUPS: Record<string, OrderStatus[]> = {
  pending: ['pending', 'payment_review'],
  completed: ['delivered', 'completed'],
  cancelled: ['cancelled', 'rejected', 'refunded'],
}

const ALL_STATUSES: OrderStatus[] = ['pending', 'payment_review', 'confirmed', 'processing', 'ready', 'shipped', 'delivered', 'completed', 'cancelled', 'rejected', 'refunded']

export default function AdminOrders() {
  const { orders, loading, refetch } = useAllOrders()
  const { addToast } = useApp()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<string | null>(searchParams.get('open'))

  usePageMeta('Orders', 'Manage all orders.')

  const statusParam = searchParams.get('status') || ''
  const activeStatuses: OrderStatus[] = STATUS_GROUPS[statusParam] || (statusParam ? [statusParam as OrderStatus] : [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return orders.filter(o => {
      if (activeStatuses.length > 0 && !activeStatuses.includes(o.status)) return false
      if (!q) return true
      return (
        o.order_number.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        o.customer_email.toLowerCase().includes(q) ||
        (o.customer_phone || '').includes(q)
      )
    })
  }, [orders, search, activeStatuses])

  const selected = orders.find(o => o.id === openId)

  function setStatusFilter(status: string) {
    const next = new URLSearchParams(searchParams)
    if (status) next.set('status', status); else next.delete('status')
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="animate-[pageIn_0.4s_ease]">
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-saif-text">Orders</h1>
        <button onClick={refetch} className="text-xs text-saif-dim hover:text-saif-text flex items-center gap-1.5">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md mb-5">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-saif-dim" />
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search order #, customer, phone…"
          aria-label="Search orders"
          className="input pl-10 text-sm"
        />
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        <FilterChip active={!statusParam} onClick={() => setStatusFilter('')}>All</FilterChip>
        <FilterChip active={statusParam === 'pending'} onClick={() => setStatusFilter('pending')}>Pending</FilterChip>
        <FilterChip active={statusParam === 'confirmed'} onClick={() => setStatusFilter('confirmed')}>Confirmed</FilterChip>
        <FilterChip active={statusParam === 'processing'} onClick={() => setStatusFilter('processing')}>Processing</FilterChip>
        <FilterChip active={statusParam === 'shipped'} onClick={() => setStatusFilter('shipped')}>Shipped</FilterChip>
        <FilterChip active={statusParam === 'completed'} onClick={() => setStatusFilter('completed')}>Completed</FilterChip>
        <FilterChip active={statusParam === 'cancelled'} onClick={() => setStatusFilter('cancelled')}>Cancelled</FilterChip>
      </div>

      {loading ? <Loading /> : filtered.length === 0 ? (
        <EmptyState title="No orders match" description="Adjust the search or status filter." />
      ) : (
        <div className="border border-saif-border overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b border-saif-border text-left">
                <Th>Order</Th><Th>Customer</Th><Th>Total</Th><Th>Payment</Th><Th>Status</Th><Th>Date</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(order => {
                const payment = latestPayment(order)
                return (
                  <tr key={order.id} onClick={() => setOpenId(order.id)} className="border-b border-saif-border hover:bg-white/[0.03] cursor-pointer transition-colors">
                    <td className="p-4 font-bold text-saif-text whitespace-nowrap">{order.order_number}</td>
                    <td className="p-4">
                      <p className="text-saif-text">{order.customer_name}</p>
                      <p className="text-xs text-saif-dim" dir="ltr">{order.customer_phone || order.customer_email}</p>
                    </td>
                    <td className="p-4 text-saif-text whitespace-nowrap">{formatPrice(order.total)}</td>
                    <td className="p-4">
                      {payment ? (
                        <span className="flex flex-col gap-1">
                          <span className="text-xs text-saif-dim">{PAYMENT_METHODS.find(m => m.id === payment.payment_method)?.name}</span>
                          <StatusBadge className={PAYMENT_STATUS_COLORS[payment.status]}>{PAYMENT_STATUS_LABELS[payment.status]}</StatusBadge>
                        </span>
                      ) : (
                        <span className="text-xs text-saif-dim">None</span>
                      )}
                    </td>
                    <td className="p-4"><StatusBadge className={ORDER_STATUS_COLORS[order.status]}>{ORDER_STATUS_LABELS[order.status]}</StatusBadge></td>
                    <td className="p-4 text-xs text-saif-dim whitespace-nowrap">{formatDateTime(order.created_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail panel */}
      <OrderDetailPanel order={selected ?? null} onClose={() => setOpenId(null)} onChanged={refetch} />
    </div>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`px-3.5 py-2 text-xs border whitespace-nowrap transition-colors ${
        active ? 'border-saif-text text-saif-text font-semibold' : 'border-saif-border text-saif-dim hover:text-saif-text'
      }`}
    >
      {children}
    </button>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="p-4 text-[10px] uppercase tracking-wider text-saif-dim font-semibold">{children}</th>
}

function OrderDetailPanel({ order, onClose, onChanged }: { order: Order | null; onClose: () => void; onChanged: () => void }) {
  const { addToast } = useApp()
  const [newStatus, setNewStatus] = useState<OrderStatus | ''>('')
  const [saving, setSaving] = useState(false)
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null)
  const [shotLoading, setShotLoading] = useState(false)

  const payment = latestPayment(order)

  useEffect(() => {
    setNewStatus('')
    setScreenshotUrl(null)
    if (!payment?.screenshot_path) return
    let cancelled = false
    setShotLoading(true)
    getScreenshotUrl(payment.screenshot_path).then(url => {
      if (!cancelled) { setScreenshotUrl(url); setShotLoading(false) }
    })
    return () => { cancelled = true }
  }, [order?.id, payment?.screenshot_path]) // eslint-disable-line react-hooks/exhaustive-deps

  async function applyStatus() {
    if (!order || !newStatus) return
    setSaving(true)
    const { error } = await supabase.rpc('set_order_status', { p_order_id: order.id, p_status: newStatus })
    setSaving(false)
    if (error) addToast(error.message || 'Failed to update status', 'error')
    else {
      addToast(`Order marked ${ORDER_STATUS_LABELS[newStatus]}${newStatus === 'cancelled' || newStatus === 'refunded' ? ' — stock released' : ''}`)
      setNewStatus('')
      onChanged()
    }
  }

  if (!order) return null

  return (
    <Modal open={!!order} onClose={onClose} title={`Order ${order.order_number}`} wide>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          {/* Customer */}
          <div className="border border-saif-border p-4 text-sm space-y-1">
            <p className="label mb-1">Customer</p>
            <p className="text-saif-text font-medium">{order.customer_name}</p>
            <p className="text-saif-dim">{order.customer_email}</p>
            {order.customer_phone && <p className="text-saif-dim" dir="ltr">{order.customer_phone}</p>}
            {order.shipping_address && Object.keys(order.shipping_address).length > 0 && (
              <p className="text-saif-dim pt-1">
                {[order.shipping_address.address, order.shipping_address.city, order.shipping_address.governorate].filter(Boolean).join(', ')}
              </p>
            )}
            {order.notes && <p className="text-saif-dim italic pt-1">“{order.notes}”</p>}
          </div>

          {/* Items */}
          <div className="border border-saif-border p-4">
            <p className="label mb-2">Items</p>
            <div className="space-y-2">
              {order.items?.map(item => (
                <div key={item.id} className="flex justify-between gap-3 text-sm">
                  <span className="text-saif-dim min-w-0 truncate">
                    {item.product_name}{item.variant_name ? ` (${item.variant_name})` : ''} × {item.quantity}
                    <span className="text-[10px] uppercase ml-1.5">{item.product_type}</span>
                  </span>
                  <span className="text-saif-text flex-shrink-0">{formatPrice(item.total)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-saif-border space-y-1 text-sm">
              <div className="flex justify-between text-saif-dim"><span>Subtotal</span><span className="text-saif-text">{formatPrice(order.subtotal)}</span></div>
              {order.discount > 0 && <div className="flex justify-between text-green-400"><span>Discount {order.coupon_code ? `(${order.coupon_code})` : ''}</span><span>−{formatPrice(order.discount)}</span></div>}
              <div className="flex justify-between text-saif-dim"><span>Shipping</span><span className="text-saif-text">{order.shipping_fee === 0 ? 'Free' : formatPrice(order.shipping_fee)}</span></div>
              <div className="flex justify-between font-bold text-saif-text pt-1"><span>Total</span><span>{formatPrice(order.total)}</span></div>
            </div>
          </div>

          {/* Digital fulfillment */}
          {order.items?.some(i => i.product_type === 'digital') && (
            <DigitalDeliveryEditor order={order} onChanged={onChanged} />
          )}
        </div>

        <div className="space-y-4">
          {/* Status control */}
          <div className="border border-saif-border p-4">
            <p className="label mb-2">Order Status</p>
            <div className="flex items-center gap-2 mb-3">
              <StatusBadge className={ORDER_STATUS_COLORS[order.status]}>{ORDER_STATUS_LABELS[order.status]}</StatusBadge>
              {payment && <StatusBadge className={PAYMENT_STATUS_COLORS[payment.status]}>Payment: {PAYMENT_STATUS_LABELS[payment.status]}</StatusBadge>}
            </div>
            <div className="flex gap-2">
              <select
                value={newStatus}
                onChange={e => setNewStatus(e.target.value as OrderStatus)}
                className="input bg-[#0A0A0A] text-xs flex-1"
                aria-label="New order status"
              >
                <option value="">Change status…</option>
                {ALL_STATUSES.filter(s => s !== order.status).map(s => (
                  <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>
                ))}
              </select>
              <button onClick={applyStatus} disabled={!newStatus || saving} className="btn btn-primary text-[10px] px-4">
                {saving ? '…' : 'Apply'}
              </button>
            </div>
            <p className="text-[10px] text-saif-dim mt-2">Cancelling / refunding releases the reserved stock automatically.</p>
          </div>

          {/* Payment evidence */}
          <div className="border border-saif-border p-4">
            <p className="label mb-2">Payment Evidence</p>
            {payment ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-saif-dim">Method</span><span className="text-saif-text">{PAYMENT_METHODS.find(m => m.id === payment.payment_method)?.name}</span></div>
                <div className="flex justify-between"><span className="text-saif-dim">Expected</span><span className="text-saif-text font-bold">{formatPrice(payment.expected_amount)}</span></div>
                <div className="flex justify-between"><span className="text-saif-dim">Transferred</span><span className="text-saif-text">{payment.transferred_amount != null ? formatPrice(payment.transferred_amount) : '—'}</span></div>
                <div className="flex justify-between"><span className="text-saif-dim">Payer</span><span className="text-saif-text" dir="ltr">{payment.payer_identifier || '—'}</span></div>
                <div className="flex justify-between"><span className="text-saif-dim">Submitted</span><span className="text-saif-text">{formatDateTime(payment.created_at)}</span></div>
                {payment.screenshot_path && (
                  <div className="pt-2">
                    {shotLoading ? <p className="text-xs text-saif-dim">Loading screenshot…</p> : screenshotUrl ? (
                      <a href={screenshotUrl} target="_blank" rel="noreferrer">
                        <img src={screenshotUrl} alt="Payment screenshot" className="max-h-56 border border-saif-border" />
                      </a>
                    ) : <p className="text-xs text-saif-dim">Screenshot unavailable.</p>}
                  </div>
                )}
                <Link to={`/admin/payments?open=${payment.id}`} className="text-xs text-saif-accent hover:underline pt-1 inline-block">
                  Open in verification queue →
                </Link>
              </div>
            ) : (
              <p className="text-sm text-saif-dim">No payment submitted for this order yet.</p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

function DigitalDeliveryEditor({ order, onChanged }: { order: Order; onChanged: () => void }) {
  const { addToast } = useApp()
  const current = (order.digital_delivery || {}) as Record<string, unknown>
  const [notes, setNotes] = useState(String(current.notes || ''))
  const [delivered, setDelivered] = useState(Boolean(current.delivered))
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const { error } = await supabase
      .from('orders')
      .update({
        digital_delivery: {
          ...current,
          notes: notes.trim() || null,
          delivered,
          delivered_at: delivered ? new Date().toISOString() : null,
        },
      })
      .eq('id', order.id)
    setSaving(false)
    if (error) addToast(error.message || 'Failed to save delivery info', 'error')
    else { addToast('Digital delivery info saved'); onChanged() }
  }

  return (
    <div className="border border-saif-border p-4">
      <p className="label mb-2">Digital Fulfillment</p>
      <p className="text-[10px] text-saif-dim mb-2">Visible to the customer only after payment approval.</p>
      <textarea
        rows={2}
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Delivery details: account, code, confirmation…"
        className="input resize-none text-sm"
      />
      <label className="flex items-center gap-2 text-sm text-saif-text mt-3">
        <input type="checkbox" checked={delivered} onChange={e => setDelivered(e.target.checked)} />
        Mark as delivered
      </label>
      <button onClick={save} disabled={saving} className="btn text-[10px] mt-3 px-4">
        {saving ? 'Saving…' : 'Save Fulfillment'}
      </button>
    </div>
  )
}
