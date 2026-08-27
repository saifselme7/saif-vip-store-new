import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LogOut, Package, Heart, Zap, LayoutDashboard } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useApp } from '@/context/AppContext'
import { useOrders, latestPayment } from '@/hooks/useOrders'
import { useWishlist } from '@/context/WishlistContext'
import { usePageMeta } from '@/hooks/usePageMeta'
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import ProductCard from '@/components/ProductCard'
import Loading from '@/components/Loading'
import { StatusBadge } from '@/components/ui/Badge'

type Tab = 'overview' | 'orders' | 'wishlist' | 'digital' | 'settings'

export default function AccountPage() {
  const { user, profile, isAdmin, signOut, updateProfile } = useAuth()
  const { addToast } = useApp()
  const { orders, loading: ordersLoading } = useOrders()
  const { items: wishlistItems, loading: wishlistLoading } = useWishlist()
  const [tab, setTab] = useState<Tab>('overview')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ full_name: '', phone: '', initialized: false })

  usePageMeta('My Account', 'Manage your SAIF STORE profile, orders and wishlist.')

  if (!form.initialized && profile) {
    setForm({ full_name: profile.full_name || '', phone: profile.phone || '', initialized: true })
  }

  async function handleSave() {
    setSaving(true)
    const { error } = await updateProfile({ full_name: form.full_name, phone: form.phone })
    setSaving(false)
    if (error) addToast(`Could not save profile: ${error.message}`, 'error')
    else { addToast('Profile updated'); setEditing(false) }
  }

  const digitalOrders = orders.filter(o => o.items?.some(i => i.product_type === 'digital'))

  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'Overview', icon: <Package size={16} /> },
    { id: 'orders', label: 'Orders', icon: <Package size={16} /> },
    { id: 'wishlist', label: 'Wishlist', icon: <Heart size={16} /> },
    { id: 'digital', label: 'Digital', icon: <Zap size={16} /> },
    { id: 'settings', label: 'Settings', icon: <Package size={16} /> },
  ]

  return (
    <div className="animate-[pageIn_0.5s_ease] px-4 sm:px-6 lg:px-10 pt-10 pb-20">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-saif-text mb-10">Account</h1>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="space-y-1">
            <div className="p-4 border border-saif-border mb-3">
              <p className="text-sm font-bold text-saif-text truncate">{profile?.full_name || 'Customer'}</p>
              <p className="text-xs text-saif-dim mt-1 truncate">{user?.email}</p>
              {isAdmin && <p className="text-[10px] text-saif-accent mt-1.5 uppercase tracking-widest font-bold">Admin</p>}
            </div>
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-pressed={tab === t.id}
                className={`w-full flex items-center gap-3 p-3.5 border text-left text-sm font-medium transition-colors ${
                  tab === t.id ? 'border-saif-text bg-white/5 text-saif-text' : 'border-saif-border text-saif-dim hover:text-saif-text'
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
            {isAdmin && (
              <Link to="/admin" className="w-full flex items-center gap-3 p-3.5 border border-saif-accent/40 text-saif-accent hover:bg-saif-accent/10 transition-colors text-sm font-medium">
                <LayoutDashboard size={16} /> Admin Dashboard
              </Link>
            )}
            <button onClick={signOut} className="w-full flex items-center gap-3 p-3.5 border border-saif-border text-saif-accent hover:bg-white/5 transition-colors text-sm font-medium">
              <LogOut size={16} /> Sign Out
            </button>
          </div>

          {/* Main */}
          <div className="md:col-span-3 space-y-6">
            {tab === 'overview' && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <StatCard label="Orders" value={String(orders.length)} />
                  <StatCard label="Wishlist" value={String(wishlistItems.length)} />
                  <StatCard label="Digital" value={String(digitalOrders.length)} />
                </div>
                <div className="border border-saif-border p-6">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-saif-text mb-4">Recent Orders</h2>
                  {ordersLoading ? <Loading /> : orders.length === 0 ? (
                    <p className="text-sm text-saif-dim">No orders yet — <Link to="/products" className="text-saif-text underline">start shopping</Link>.</p>
                  ) : (
                    <div className="space-y-3">
                      {orders.slice(0, 5).map(order => {
                        const payment = latestPayment(order)
                        return (
                          <Link key={order.id} to={`/orders/${order.id}`} className="flex items-center justify-between gap-3 p-3 border border-saif-border hover:bg-white/[0.03] transition-colors">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-saif-text truncate">{order.order_number}</p>
                              <p className="text-xs text-saif-dim">{formatDate(order.created_at)}</p>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                              {payment && <StatusBadge className={PAYMENT_STATUS_COLORS[payment.status]}>{PAYMENT_STATUS_LABELS[payment.status]}</StatusBadge>}
                              <StatusBadge className={ORDER_STATUS_COLORS[order.status]}>{ORDER_STATUS_LABELS[order.status]}</StatusBadge>
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            {tab === 'orders' && (
              <div className="border border-saif-border p-6">
                <h2 className="text-sm font-bold uppercase tracking-widest text-saif-text mb-4">All Orders</h2>
                {ordersLoading ? <Loading /> : orders.length === 0 ? (
                  <p className="text-sm text-saif-dim">No orders yet.</p>
                ) : (
                  <div className="space-y-3">
                    {orders.map(order => {
                      const payment = latestPayment(order)
                      return (
                        <Link key={order.id} to={`/orders/${order.id}`} className="flex items-center justify-between gap-3 p-3 border border-saif-border hover:bg-white/[0.03] transition-colors">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-saif-text truncate">{order.order_number}</p>
                            <p className="text-xs text-saif-dim">{formatDate(order.created_at)} · {order.items?.length || 0} items</p>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            {payment && <StatusBadge className={PAYMENT_STATUS_COLORS[payment.status]}>{PAYMENT_STATUS_LABELS[payment.status]}</StatusBadge>}
                            <StatusBadge className={ORDER_STATUS_COLORS[order.status]}>{ORDER_STATUS_LABELS[order.status]}</StatusBadge>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {tab === 'wishlist' && (
              <div>
                <h2 className="text-sm font-bold uppercase tracking-widest text-saif-text mb-4">Wishlist</h2>
                {wishlistLoading ? <Loading /> : wishlistItems.length === 0 ? (
                  <p className="text-sm text-saif-dim">Your wishlist is empty.</p>
                ) : (
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-5">
                    {wishlistItems.map(p => <ProductCard key={p.id} product={p} />)}
                  </div>
                )}
              </div>
            )}

            {tab === 'digital' && (
              <div className="border border-saif-border p-6">
                <h2 className="text-sm font-bold uppercase tracking-widest text-saif-text mb-4">Digital Purchases</h2>
                {ordersLoading ? <Loading /> : digitalOrders.length === 0 ? (
                  <p className="text-sm text-saif-dim">No digital orders yet — <Link to="/products?type=digital" className="text-saif-text underline">browse digital</Link>.</p>
                ) : (
                  <div className="space-y-3">
                    {digitalOrders.map(order => {
                      const payment = latestPayment(order)
                      return (
                        <Link key={order.id} to={`/orders/${order.id}`} className="block p-4 border border-saif-border hover:bg-white/[0.03] transition-colors">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium text-saif-text truncate">{order.order_number}</p>
                            {payment && <StatusBadge className={PAYMENT_STATUS_COLORS[payment.status]}>{PAYMENT_STATUS_LABELS[payment.status]}</StatusBadge>}
                          </div>
                          <p className="text-xs text-saif-dim mt-1 truncate">
                            {order.items?.filter(i => i.product_type === 'digital').map(i => i.product_name).join(', ')}
                          </p>
                          <p className="text-xs text-saif-dim mt-2">
                            {payment?.status === 'approved'
                              ? 'Approved — delivery details are on the order page.'
                              : 'Delivery details unlock after payment approval.'}
                          </p>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {tab === 'settings' && (
              <div className="border border-saif-border p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-saif-text">Profile Settings</h2>
                  <button onClick={() => setEditing(!editing)} className="text-xs text-saif-dim hover:text-saif-text transition-colors">
                    {editing ? 'Cancel' : 'Edit'}
                  </button>
                </div>
                {editing ? (
                  <div className="space-y-4 max-w-sm">
                    <div>
                      <label htmlFor="acc-name" className="label">Full Name</label>
                      <input id="acc-name" className="input" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
                    </div>
                    <div>
                      <label htmlFor="acc-phone" className="label">Phone</label>
                      <input id="acc-phone" type="tel" dir="ltr" className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                    </div>
                    <button onClick={handleSave} disabled={saving} className="btn btn-primary text-xs">
                      {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                    <p className="text-xs text-saif-dim">Email and account role cannot be changed here.</p>
                  </div>
                ) : (
                  <dl className="space-y-3 text-sm">
                    <div className="flex gap-6"><dt className="text-saif-dim w-24">Name</dt><dd className="text-saif-text">{profile?.full_name || 'Not set'}</dd></div>
                    <div className="flex gap-6"><dt className="text-saif-dim w-24">Email</dt><dd className="text-saif-text">{user?.email}</dd></div>
                    <div className="flex gap-6"><dt className="text-saif-dim w-24">Phone</dt><dd className="text-saif-text" dir="ltr">{profile?.phone || 'Not set'}</dd></div>
                  </dl>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-saif-border p-5 text-center">
      <p className="text-2xl font-black text-saif-text">{value}</p>
      <p className="text-[10px] uppercase tracking-widest text-saif-dim mt-1">{label}</p>
    </div>
  )
}
