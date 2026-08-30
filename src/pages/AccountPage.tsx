import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { LogOut, Package, User, Heart, Settings as SettingsIcon, Zap, ClipboardList, ShieldAlert } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useOrders } from '@/hooks/useOrders'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useI18n } from '@/i18n'
import { formatPrice, formatDate, cn, copyToClipboard } from '@/lib/utils'
import { ORDER_STATUS_LABELS } from '@/lib/constants'
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/ui/StatusBadge'
import { validateFullName, validatePhone, type FieldErrors } from '@/lib/validation'
import Footer from '@/components/Footer'
import Loading from '@/components/Loading'
import EmptyState from '@/components/EmptyState'

type Tab = 'overview' | 'orders' | 'digital' | 'settings'

export default function AccountPage() {
  const { t, formatPrice } = useI18n()
  const { user, profile, signOut, updateProfile } = useAuth()
  const { addToast } = useToast()
  const { orders, loading } = useOrders()
  const [tab, setTab] = useState<Tab>('overview')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  usePageMeta({ title: `${t('account.title')} — SAIF STORE`, description: t('meta.description') })

  const stats = useMemo(() => {
    const totalSpent = orders
      .filter(o => o.payment_status === 'approved')
      .reduce((s, o) => s + (o.total || 0), 0)
    const pendingPayments = orders.filter(
      o => o.payment_status === 'awaiting_payment' || o.payment_status === 'rejected',
    ).length
    return {
      totalOrders: orders.length,
      totalSpent,
      pendingPayments,
    }
  }, [orders])

  const digitalItems = useMemo(
    () =>
      orders
        .filter(o => o.payment_status === 'approved')
        .flatMap(o => (o.items || []).filter(i => i.product_type === 'digital').map(i => ({ ...i, order: o }))),
    [orders],
  )

  async function handleSave() {
    const errs: FieldErrors = {
      name: validateFullName(form.full_name),
      phone: validatePhone(form.phone),
    }
    setErrors(errs)
    if (Object.values(errs).some(v => v)) return

    setSaving(true)
    const { error } = await updateProfile({
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
    })
    setSaving(false)
    if (error) addToast(error || t('errors.generic'), 'error')
    else {
      addToast(t('account.profileSaved'))
      setEditing(false)
    }
  }

  const TABS = useMemo(() => {
    const list: { id: Tab; label: string; icon: typeof User }[] = [
      { id: 'overview', label: t('account.tabs.overview'), icon: User },
      { id: 'orders', label: t('account.tabs.orders'), icon: Package },
    ]
    if (digitalItems.length > 0) {
      list.push({ id: 'digital', label: t('account.tabs.digital'), icon: Zap })
    }
    list.push({ id: 'settings', label: t('account.tabs.settings'), icon: SettingsIcon })
    return list
  }, [t, digitalItems.length])

  return (
    <div className="animate-[pageIn_0.6s_ease] pt-24 md:pt-28 px-5 lg:px-10 pb-20">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-[clamp(34px,6vw,72px)] font-display text-saif-text mb-10">{t('account.title')}</h1>

        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8">
          {/* Sidebar */}
          <aside className="space-y-2">
            <div className="card p-4">
              <div className="w-11 h-11 rounded-full bg-saif-accent/15 border border-saif-accent/30 flex items-center justify-center text-sm font-bold text-saif-accent mb-3">
                {(profile?.full_name || user?.email || 'U').charAt(0).toUpperCase()}
              </div>
              <p className="text-sm font-semibold text-saif-text truncate">{profile?.full_name || 'User'}</p>
              <p className="text-xs text-saif-dim truncate mt-0.5">{user?.email}</p>
              <p className="text-[10px] text-saif-faint uppercase tracking-wider mt-2">{profile?.role}</p>
            </div>

            <nav className="space-y-1" aria-label={t('a11y.accountSections')}>
              {TABS.map(tabItem => (
                <button
                  key={tabItem.id}
                  onClick={() => setTab(tabItem.id)}
                  aria-current={tab === tabItem.id ? 'page' : undefined}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2.5 text-sm rounded-sm transition-colors text-start',
                    tab === tabItem.id ? 'bg-white/10 text-saif-text font-medium' : 'text-saif-dim hover:text-saif-text hover:bg-white/5',
                  )}
                >
                  <tabItem.icon size={15} />
                  {tabItem.label}
                </button>
              ))}
              <Link
                to="/wishlist"
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm rounded-sm transition-colors text-start text-saif-dim hover:text-saif-text hover:bg-white/5"
              >
                <Heart size={15} />
                {t('nav.wishlist')}
              </Link>
              {profile?.role === 'admin' && (
                <Link
                  to="/admin"
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm rounded-sm transition-colors text-start text-saif-accent hover:bg-saif-accent/10"
                >
                  <ClipboardList size={15} />
                  {t('account.adminPanel')}
                </Link>
              )}
              <button
                onClick={signOut}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm rounded-sm transition-colors text-start text-saif-dim hover:text-saif-accent hover:bg-white/5"
              >
                <LogOut size={15} />
                {t('account.signOut')}
              </button>
            </nav>
          </aside>

          {/* Main */}
          <div className="space-y-8">
            {tab === 'overview' && (
              <>
                {/* Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  <StatCard label={t('account.stats.orders')} value={String(stats.totalOrders)} />
                  <StatCard label={t('account.stats.spent')} value={formatPrice(stats.totalSpent)} />
                  <StatCard
                    label={t('account.stats.actionNeeded')}
                    value={String(stats.pendingPayments)}
                    alert={stats.pendingPayments > 0}
                  />
                </div>

                {/* Payment attention banner */}
                {stats.pendingPayments > 0 && (
                  <Link
                    to="/orders"
                    className="block border border-yellow-500/40 bg-yellow-500/[0.04] p-4 rounded-sm hover:border-yellow-500/60 transition-colors"
                  >
                    <p className="text-sm text-yellow-400 font-semibold flex items-center gap-2">
                      <ShieldAlert size={15} />
                      {t('account.attention', { count: stats.pendingPayments })}
                    </p>
                    <p className="text-xs text-saif-dim mt-1">
                      {t('account.attentionDesc')}
                    </p>
                  </Link>
                )}

                {/* Recent orders */}
                <div className="card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-saif-text">{t('account.recentOrders')}</h2>
                    <button onClick={() => setTab('orders')} className="text-xs text-saif-dim hover:text-saif-text transition-colors">
                      {t('account.viewAll')}
                    </button>
                  </div>
                  {loading ? (
                    <Loading />
                  ) : orders.length === 0 ? (
                    <p className="text-sm text-saif-dim">No orders yet — your history will appear here.</p>
                  ) : (
                    <div className="space-y-2">
                      {orders.slice(0, 5).map(order => (
                        <Link
                          key={order.id}
                          to={`/orders/${order.id}`}
                          className="flex items-center justify-between gap-3 p-3 border border-saif-border hover:bg-white/5 transition-colors rounded-sm"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-saif-text">{order.order_number}</p>
                            <p className="text-xs text-saif-dim">{formatDate(order.created_at)}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-sm font-semibold text-saif-text">{formatPrice(order.total)}</span>
                            <PaymentStatusBadge status={order.payment_status} />
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {tab === 'orders' && (
              <div className="card p-6">
                <h2 className="text-sm font-bold uppercase tracking-wider text-saif-text mb-4">{t('account.tabs.orders')}</h2>
                {loading ? (
                  <Loading />
                ) : orders.length === 0 ? (
                  <EmptyState
                    icon={Package}
                    title="No orders yet"
                    description="{t('account.noOrders')}"
                    action={
                      <Link to="/products" className="btn btn-sm btn-primary">
                        Start Shopping
                      </Link>
                    }
                  />
                ) : (
                  <div className="space-y-2">
                    {orders.map(order => (
                      <Link
                        key={order.id}
                        to={`/orders/${order.id}`}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 border border-saif-border hover:bg-white/5 transition-colors rounded-sm"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-saif-text">{order.order_number}</p>
                          <p className="text-xs text-saif-dim">
                            {formatDate(order.created_at)} · {ORDER_STATUS_LABELS[order.status]}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-sm font-semibold text-saif-text">{formatPrice(order.total)}</span>
                          <OrderStatusBadge status={order.status} />
                          <PaymentStatusBadge status={order.payment_status} />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'digital' && (
              <div className="card p-6">
                <h2 className="text-sm font-bold uppercase tracking-wider text-saif-text mb-1">{t('orders.digital.section')}</h2>
                <p className="text-xs text-saif-dim mb-5">
                  Delivery details appear here once the order has been fulfilled.
                </p>
                {loading ? (
                  <Loading />
                ) : digitalItems.length === 0 ? (
                  <EmptyState
                    icon={Zap}
                    title="No digital purchases"
                    description="Approved digital orders and their delivery details will appear here."
                    action={
                      <Link to="/products?type=digital" className="btn btn-sm btn-primary">
                        Browse Digital
                      </Link>
                    }
                  />
                ) : (
                  <div className="space-y-3">
                    {digitalItems.map(item => (
                      <div key={item.id} className="border border-saif-border p-4 rounded-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-saif-text">{item.product_name}</p>
                            <p className="text-xs text-saif-dim mt-0.5">
                              Order <span className="font-mono">{item.order.order_number}</span> ·{' '}
                              {formatDate(item.order.created_at)}
                            </p>
                          </div>
                          {item.fulfilled_at ? (
                            <span className="badge bg-green-500/10 text-green-400 border-green-500/30">Delivered</span>
                          ) : (
                            <span className="badge bg-yellow-500/10 text-yellow-400 border-yellow-500/30">Pending</span>
                          )}
                        </div>
                        {item.fulfillment_note && (
                          <div className="mt-3 border border-green-500/30 bg-green-500/5 p-3 rounded-sm">
                            <p className="text-xs text-saif-dim whitespace-pre-line">{item.fulfillment_note}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'settings' && (
              <div className="card p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-saif-text">{t('account.profile')}</h2>
                  <button
                    onClick={() => {
                      setEditing(!editing)
                      setForm({ full_name: profile?.full_name || '', phone: profile?.phone || '' })
                      setErrors({})
                    }}
                    className="text-xs text-saif-dim hover:text-saif-text transition-colors"
                  >
                    {editing ? 'Cancel' : 'Edit'}
                  </button>
                </div>
                {editing ? (
                  <div className="space-y-4">
                    <div>
                      <label className="label" htmlFor="ac-name">{t('auth.fullName')}</label>
                      <input
                        id="ac-name"
                        type="text"
                        className={cn('input', errors.name && 'input-error')}
                        value={form.full_name}
                        onChange={e => setForm({ ...form, full_name: e.target.value })}
                      />
                      {errors.name && <p className="field-error">{errors.name}</p>}
                    </div>
                    <div>
                      <label className="label" htmlFor="ac-phone">Phone</label>
                      <input
                        id="ac-phone"
                        type="tel"
                        className={cn('input', errors.phone && 'input-error')}
                        value={form.phone}
                        onChange={e => setForm({ ...form, phone: e.target.value })}
                        placeholder="01xxxxxxxxx"
                      />
                      {errors.phone && <p className="field-error">{errors.phone}</p>}
                    </div>
                    <button onClick={handleSave} className="btn btn-primary btn-sm" disabled={saving}>
                      {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5 text-sm">
                    <p className="text-saif-dim">
                      Name: <span className="text-saif-text">{profile?.full_name || 'Not set'}</span>
                    </p>
                    <p className="text-saif-dim">
                      Email: <span className="text-saif-text">{user?.email}</span>
                    </p>
                    <p className="text-saif-dim">
                      Phone: <span className="text-saif-text">{profile?.phone || 'Not set'}</span>
                    </p>
                    <div className="pt-3 border-t border-saif-border flex items-center justify-between gap-3">
                      <p className="text-xs text-saif-dim">Account ID</p>
                      <button
                        className="text-xs font-mono text-saif-dim hover:text-saif-text transition-colors truncate max-w-[200px]"
                        onClick={async () => {
                          const ok = await copyToClipboard(user?.id || '')
                          addToast(ok ? 'Account ID copied' : 'Copy failed', ok ? 'success' : 'error')
                        }}
                        title="Click to copy"
                      >
                        {user?.id}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}

function StatCard({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className={cn('card p-4', alert && 'border-yellow-500/40')}>
      <p className={cn('text-xl font-bold', alert ? 'text-yellow-400' : 'text-saif-text')}>{value}</p>
      <p className="text-[10px] text-saif-dim uppercase tracking-wider mt-1">{label}</p>
    </div>
  )
}
