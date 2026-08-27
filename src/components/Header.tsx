import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Search, ShoppingBag, Menu, X, User, Heart, ChevronDown, LogOut, LayoutDashboard } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useCart } from '@/context/CartContext'
import { useWishlist } from '@/context/WishlistContext'
import { useApp } from '@/context/AppContext'
import { useCategories } from '@/hooks/useCategories'
import { useDebouncedValue } from '@/hooks/useDebounce'
import type { Product } from '@/types'

function Wordmark() {
  return (
    <span className="text-xl font-black tracking-tighter text-saif-text">
      SAIF<span className="text-saif-accent">.</span>STORE
      <sup className="text-[9px] font-normal ml-0.5">®</sup>
    </span>
  )
}

export default function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile, signOut, isAdmin } = useAuth()
  const { count } = useCart()
  const { count: wishlistCount } = useWishlist()
  const { mobileMenuOpen, setMobileMenuOpen, settings } = useApp()
  const { categories } = useCategories()

  const [visible, setVisible] = useState(true)
  const [scrolled, setScrolled] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Product[]>([])
  const [searching, setSearching] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [countPulse, setCountPulse] = useState(false)
  const lastScrollY = useRef(0)
  const accountRef = useRef<HTMLDivElement>(null)
  const debouncedQuery = useDebouncedValue(searchQuery, 300)

  // Intelligent scroll behavior: solid when scrolled, hide on scroll-down,
  // reappear on scroll-up.
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      setScrolled(y > 24)
      setVisible(y < 80 || y < lastScrollY.current)
      lastScrollY.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Reset transient UI on navigation.
  useEffect(() => {
    setMobileMenuOpen(false)
    setSearchOpen(false)
    setAccountOpen(false)
    setCategoriesOpen(false)
  }, [location.pathname, location.search, setMobileMenuOpen])

  // Cart badge pulse feedback.
  useEffect(() => {
    if (count === 0) return
    setCountPulse(true)
    const t = setTimeout(() => setCountPulse(false), 500)
    return () => clearTimeout(t)
  }, [count])

  // Debounced search suggestions — never one request per keystroke.
  useEffect(() => {
    let cancelled = false
    const q = debouncedQuery.trim()
    if (q.length < 2) {
      setSuggestions([])
      setSearching(false)
      return
    }
    const clean = q.replace(/[%,(){}"]/g, ' ').trim()
    const tagTerm = q.replace(/[^a-zA-Z0-9-]/g, '')
    if (!clean && !tagTerm) {
      setSuggestions([])
      setSearching(false)
      return
    }
    setSearching(true)
    const orExpr = clean && tagTerm
      ? `name.ilike.%${clean}%,tags.cs.{${tagTerm}}`
      : clean ? `name.ilike.%${clean}%` : `tags.cs.{${tagTerm}}`
    supabase
      .from('products')
      .select('id, name, slug, price, compare_at_price, thumbnail, product_type, categories(name)')
      .eq('status', 'active')
      .or(orExpr)
      .limit(5)
      .then(({ data }) => {
        if (!cancelled) {
          setSuggestions((data || []) as unknown as Product[])
          setSearching(false)
        }
      })
    return () => { cancelled = true }
  }, [debouncedQuery])

  // Close account menu on outside click.
  useEffect(() => {
    if (!accountOpen) return
    const onClick = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [accountOpen])

  const submitSearch = useCallback((q: string) => {
    const query = q.trim()
    if (!query) return
    navigate(`/search?q=${encodeURIComponent(query)}`)
    setSearchOpen(false)
    setSearchQuery('')
    setSuggestions([])
  }, [navigate])

  async function handleSignOut() {
    await signOut()
    setAccountOpen(false)
    navigate('/')
  }

  const announcement = settings?.announcement

  return (
    <>
      {/* Announcement bar */}
      {announcement && !mobileMenuOpen && (
        <div className="bg-saif-accent text-white text-center text-[11px] sm:text-xs font-semibold py-2 px-4 tracking-wide">
          {announcement}
        </div>
      )}

      <header
        className={`sticky top-0 z-50 transition-all duration-300 ease-saif ${
          visible ? 'translate-y-0' : '-translate-y-full'
        } ${scrolled || searchOpen ? 'bg-black/90 backdrop-blur-md border-b border-saif-border' : 'bg-black border-b border-transparent'}`}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 lg:px-10 h-16">
          {/* Mobile menu button */}
          <button
            className="lg:hidden text-saif-text hover:opacity-70 transition-opacity -ml-1 p-1"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          {/* Logo */}
          <Link to="/" aria-label="SAIF STORE home" className="hover:opacity-80 transition-opacity">
            <Wordmark />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-7" aria-label="Main">
            <NavLink to="/">Home</NavLink>
            <NavLink to="/products">Shop</NavLink>
            <div
              className="relative"
              onMouseEnter={() => setCategoriesOpen(true)}
              onMouseLeave={() => setCategoriesOpen(false)}
            >
              <NavLink to="/products" withChevron>Categories</NavLink>
              {categoriesOpen && categories.length > 0 && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 pt-3 w-52">
                  <div className="bg-[#0A0A0A] border border-saif-border p-2 shadow-2xl">
                    {categories.map(cat => (
                      <Link
                        key={cat.id}
                        to={`/products?category=${cat.id}`}
                        className="block px-3 py-2 text-sm text-saif-dim hover:text-saif-text hover:bg-white/5 transition-colors"
                      >
                        {cat.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <NavLink to="/products?type=digital">Digital</NavLink>
            <NavLink to="/products?sale=1">Offers</NavLink>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="p-2 text-saif-text hover:opacity-60 transition-opacity"
              aria-label="Search"
            >
              <Search size={19} />
            </button>

            <Link
              to="/wishlist"
              className="p-2 text-saif-text hover:opacity-60 transition-opacity relative hidden sm:block"
              aria-label={`Wishlist (${wishlistCount})`}
            >
              <Heart size={19} />
              {wishlistCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-saif-text text-black text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {wishlistCount}
                </span>
              )}
            </Link>

            {/* Account */}
            <div className="relative hidden sm:block" ref={accountRef}>
              <button
                onClick={() => setAccountOpen(!accountOpen)}
                className="p-2 text-saif-text hover:opacity-60 transition-opacity flex items-center"
                aria-label="Account menu"
                aria-expanded={accountOpen}
              >
                <User size={19} />
              </button>
              {accountOpen && (
                <div className="absolute right-0 top-full pt-2 w-52">
                  <div className="bg-[#0A0A0A] border border-saif-border p-2 shadow-2xl">
                    {user ? (
                      <>
                        <p className="px-3 py-2 text-xs text-saif-dim border-b border-saif-border mb-1 truncate">
                          {profile?.full_name || user.email}
                        </p>
                        <MenuLink to="/account"><User size={14} /> Account</MenuLink>
                        <MenuLink to="/orders"><ShoppingBag size={14} /> Orders</MenuLink>
                        <MenuLink to="/wishlist"><Heart size={14} /> Wishlist</MenuLink>
                        {isAdmin && (
                          <MenuLink to="/admin"><LayoutDashboard size={14} /> Admin Dashboard</MenuLink>
                        )}
                        <button
                          onClick={handleSignOut}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-saif-accent hover:bg-white/5 transition-colors"
                        >
                          <LogOut size={14} /> Sign Out
                        </button>
                      </>
                    ) : (
                      <>
                        <MenuLink to="/login"><User size={14} /> Sign In</MenuLink>
                        <MenuLink to="/register"><Heart size={14} /> Create Account</MenuLink>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => navigate('/cart')}
              className="p-2 text-saif-text hover:opacity-60 transition-opacity relative"
              aria-label={`Shopping bag (${count})`}
            >
              <ShoppingBag size={19} />
              {count > 0 && (
                <span className={`absolute -top-0.5 -right-0.5 bg-saif-accent text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center transition-transform duration-300 ${countPulse ? 'scale-125' : 'scale-100'}`}>
                  {count > 99 ? '99' : count}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Search overlay with suggestions */}
        {searchOpen && (
          <div className="border-t border-saif-border px-4 sm:px-6 lg:px-10 py-4 animate-[fadeUp_0.25s_ease]">
            <form onSubmit={e => { e.preventDefault(); submitSearch(searchQuery) }} className="max-w-2xl mx-auto relative">
              <input
                type="search"
                role="searchbox"
                placeholder="Search products, categories, tags…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                autoFocus
                aria-label="Search products"
                className="w-full bg-transparent text-saif-text text-base sm:text-lg border-b border-saif-border pb-2 focus:outline-none focus:border-saif-text placeholder:text-saif-dim/50"
              />
              {searchQuery.trim().length >= 2 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[#0A0A0A] border border-saif-border shadow-2xl z-50">
                  {searching ? (
                    <p className="px-4 py-3 text-sm text-saif-dim">Searching…</p>
                  ) : suggestions.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-saif-dim">No matches — press Enter to search everything.</p>
                  ) : (
                    suggestions.map(p => (
                      <Link
                        key={p.id}
                        to={`/products/${p.slug}`}
                        onClick={() => { setSearchOpen(false); setSearchQuery('') }}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors"
                      >
                        <img
                          src={p.thumbnail || p.images?.[0] || ''}
                          alt=""
                          className="w-9 h-11 object-cover bg-[#111]"
                          loading="lazy"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-saif-text truncate">{p.name}</p>
                          <p className="text-xs text-saif-dim">{p.product_type === 'digital' ? 'Digital' : 'Physical'}</p>
                        </div>
                        <span className="text-xs font-semibold text-saif-text">{p.price} {settings?.currency || 'EGP'}</span>
                      </Link>
                    ))
                  )}
                  <button
                    type="submit"
                    className="w-full text-left px-4 py-2.5 text-xs uppercase tracking-wider text-saif-dim hover:text-saif-text border-t border-saif-border transition-colors"
                  >
                    View all results →
                  </button>
                </div>
              )}
            </form>
          </div>
        )}
      </header>

      {/* Mobile menu */}
      <div
        className={`fixed inset-0 bg-black z-40 flex flex-col items-center justify-center gap-6 transition-all duration-300 lg:hidden ${
          mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!mobileMenuOpen}
      >
        <MobileLink to="/">Home</MobileLink>
        <MobileLink to="/products">Shop</MobileLink>
        <MobileLink to="/products?type=digital">Digital</MobileLink>
        <MobileLink to="/products?sale=1">Offers</MobileLink>
        <div className="w-16 h-px bg-saif-border my-2" />
        {categories.map(cat => (
          <Link key={cat.id} to={`/products?category=${cat.id}`} className="text-xl font-semibold text-saif-dim hover:text-saif-text transition-colors">
            {cat.name}
          </Link>
        ))}
        <div className="w-16 h-px bg-saif-border my-2" />
        {user ? (
          <>
            <MobileLink to="/account">Account</MobileLink>
            <MobileLink to="/orders">Orders</MobileLink>
            <MobileLink to="/wishlist">Wishlist</MobileLink>
            {isAdmin && <Link to="/admin" className="text-xl font-semibold text-saif-accent">Admin</Link>}
          </>
        ) : (
          <MobileLink to="/login">Sign In</MobileLink>
        )}
      </div>
    </>
  )
}

function NavLink({ to, children, withChevron }: { to: string; children: React.ReactNode; withChevron?: boolean }) {
  return (
    <Link to={to} className="text-sm font-medium text-saif-text hover:opacity-60 transition-opacity relative group flex items-center gap-1">
      {children}
      {withChevron && <ChevronDown size={13} className="opacity-60" />}
      <span className="absolute -bottom-1 left-0 w-0 h-px bg-saif-text transition-all duration-300 group-hover:w-full" />
    </Link>
  )
}

function MenuLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="flex items-center gap-2 px-3 py-2 text-sm text-saif-dim hover:text-saif-text hover:bg-white/5 transition-colors">
      {children}
    </Link>
  )
}

function MobileLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="text-2xl font-bold tracking-tight text-saif-text hover:opacity-70 transition-opacity">
      {children}
    </Link>
  )
}
