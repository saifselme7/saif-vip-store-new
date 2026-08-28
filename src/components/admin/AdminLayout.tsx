import { Outlet, Link, useLocation } from 'react-router-dom'
import { useState } from 'react'
import {
  LayoutDashboard,
  Package,
  Tags,
  Boxes,
  ShoppingCart,
  CreditCard,
  Users,
  Ticket,
  Star,
  BarChart3,
  Settings,
  ArrowLeft,
  X,
  Menu,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'

interface NavItem {
  path: string
  label: string
  icon: typeof Package
  badge?: 'payments' | 'orders'
}

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Overview',
    items: [{ path: '/admin', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    title: 'Catalog',
    items: [
      { path: '/admin/products', label: 'Products', icon: Package },
      { path: '/admin/categories', label: 'Categories', icon: Tags },
      { path: '/admin/inventory', label: 'Inventory', icon: Boxes },
    ],
  },
  {
    title: 'Orders',
    items: [
      { path: '/admin/orders', label: 'All Orders', icon: ShoppingCart, badge: 'orders' },
      { path: '/admin/payments', label: 'Payment Verification', icon: CreditCard, badge: 'payments' },
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
    title: 'Analytics',
    items: [{ path: '/admin/analytics', label: 'Sales Analytics', icon: BarChart3 }],
  },
  {
    title: 'System',
    items: [{ path: '/admin/settings', label: 'Settings', icon: Settings }],
  },
]

export default function AdminLayout() {
  const location = useLocation()
  const { profile } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isActive = (path: string) =>
    path === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(path)

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="px-5 py-6 border-b border-saif-border">
        <p className="text-sm font-bold tracking-tight text-saif-text">
          SAIF STORE <span className="text-saif-accent">ADMIN</span>
        </p>
        <p className="text-xs text-saif-dim mt-1 truncate">{profile?.full_name || 'Administrator'}</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Admin navigation">
        {NAV_GROUPS.map(group => (
          <div key={group.title}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-saif-faint px-2 mb-1.5">
              {group.title}
            </p>
            <div className="space-y-0.5">
              {group.items.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 text-sm rounded-sm transition-colors',
                    isActive(item.path)
                      ? 'bg-saif-accent/15 text-saif-text border border-saif-accent/30'
                      : 'text-saif-dim hover:text-saif-text hover:bg-white/5 border border-transparent',
                  )}
                  aria-current={isActive(item.path) ? 'page' : undefined}
                >
                  <item.icon size={15} className={isActive(item.path) ? 'text-saif-accent' : ''} />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-saif-border">
        <Link
          to="/"
          className="flex items-center gap-2 text-xs text-saif-dim hover:text-saif-text transition-colors"
        >
          <ArrowLeft size={14} /> Back to Store
        </Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-black flex">
      {/* Desktop sidebar */}
      <aside className="w-60 border-r border-saif-border hidden md:flex flex-col fixed h-full top-0 left-0 bg-black z-30">
        {sidebar}
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[120] md:hidden" role="dialog" aria-modal="true" aria-label="Admin navigation">
          <div className="absolute inset-0 bg-black/80" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-black border-r border-saif-border animate-scaleIn">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-3 text-saif-dim hover:text-saif-text p-1"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex-1 md:ml-60 min-w-0">
        {/* Mobile topbar */}
        <div className="md:hidden sticky top-0 z-20 bg-black/95 backdrop-blur-md border-b border-saif-border px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-saif-text p-1"
            aria-label="Open admin menu"
          >
            <Menu size={20} />
          </button>
          <p className="text-sm font-bold tracking-tight text-saif-text">
            SAIF STORE <span className="text-saif-accent">ADMIN</span>
          </p>
        </div>

        <main className="p-5 lg:p-8 max-w-[1400px]">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
