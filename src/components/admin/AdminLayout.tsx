import { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Package, Layers, Boxes, ShoppingCart, Clock, BadgeCheck,
  CheckCircle2, XCircle, Users, Ticket, Star, Settings, BarChart3, UserCog,
  ArrowLeft, Menu, X,
} from 'lucide-react'

interface NavItem { path: string; label: string; icon: React.ComponentType<{ size?: number | string }> }
interface NavGroup { title: string; items: NavItem[] }

const groups: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    title: 'Catalog',
    items: [
      { path: '/admin/products', label: 'Products', icon: Package },
      { path: '/admin/categories', label: 'Categories', icon: Layers },
      { path: '/admin/inventory', label: 'Inventory', icon: Boxes },
    ],
  },
  {
    title: 'Orders',
    items: [
      { path: '/admin/orders', label: 'All Orders', icon: ShoppingCart },
      { path: '/admin/orders?status=pending', label: 'Pending', icon: Clock },
      { path: '/admin/payments', label: 'Payment Verification', icon: BadgeCheck },
      { path: '/admin/orders?status=completed', label: 'Completed', icon: CheckCircle2 },
      { path: '/admin/orders?status=cancelled', label: 'Cancelled', icon: XCircle },
    ],
  },
  {
    title: 'Customers',
    items: [{ path: '/admin/customers', label: 'Customers', icon: Users }],
  },
  {
    title: 'Marketing',
    items: [
      { path: '/admin/coupons', label: 'Coupons', icon: Ticket },
      { path: '/admin/reviews', label: 'Reviews', icon: Star },
    ],
  },
  {
    title: 'System',
    items: [
      { path: '/admin/users', label: 'Admin Users', icon: UserCog },
      { path: '/admin/settings', label: 'Settings', icon: Settings },
    ],
  },
]

export default function AdminLayout() {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  function isActive(path: string) {
    const [p, q] = path.split('?')
    if (location.pathname !== p) return false
    if (!q) return !location.search
    const current = new URLSearchParams(location.search)
    const wanted = new URLSearchParams(q)
    for (const [k, v] of wanted) {
      if (current.get(k) !== v) return false
    }
    return true
  }

  const sidebar = (
    <>
      <div className="px-4 py-4 border-b border-saif-border flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-saif-dim">SAIF Admin</p>
        <button className="md:hidden text-saif-dim" onClick={() => setMobileOpen(false)} aria-label="Close admin menu">
          <X size={18} />
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {groups.map(group => (
          <div key={group.title}>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-saif-dim/60 px-3 mb-1.5">{group.title}</p>
            {group.items.map(item => {
              const active = isActive(item.path)
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded transition-colors ${
                    active ? 'bg-white/10 text-saif-text font-medium' : 'text-saif-dim hover:text-saif-text hover:bg-white/5'
                  }`}
                >
                  <item.icon size={15} />
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
      <div className="p-3 border-t border-saif-border">
        <Link to="/" className="flex items-center gap-2 px-3 py-2 text-xs text-saif-dim hover:text-saif-text transition-colors">
          <ArrowLeft size={13} /> Back to Store
        </Link>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-black flex">
      {/* Desktop sidebar */}
      <aside className="w-60 border-r border-saif-border hidden md:flex flex-col fixed inset-y-0 left-0 bg-black z-30">
        {sidebar}
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-black border-b border-saif-border flex items-center justify-between px-4 h-14">
        <p className="text-xs font-bold uppercase tracking-widest text-saif-dim">Admin</p>
        <button onClick={() => setMobileOpen(true)} className="text-saif-text p-1" aria-label="Open admin menu">
          <Menu size={20} />
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button className="absolute inset-0 bg-black/70" aria-label="Close admin menu" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-64 bg-black border-r border-saif-border flex flex-col animate-[fadeUp_0.2s_ease]">
            {sidebar}
          </div>
        </div>
      )}

      <main className="flex-1 md:ml-60 pt-14 md:pt-0 min-w-0">
        <div className="p-4 sm:p-6 lg:p-10 max-w-[1400px]">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
