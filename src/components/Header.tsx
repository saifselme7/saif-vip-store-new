import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Search, ShoppingBag, Menu, X, User, Heart, Clock, ArrowRight } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useCart } from '@/context/CartContext'
import { useToast } from '@/context/ToastContext'
import { useApp } from '@/context/AppContext'
import { useCategories } from '@/hooks/useCategories'
import { useDebounce } from '@/hooks/useDebounce'
import { supabase } from '@/lib/supabase'
import { formatPrice, cn } from '@/lib/utils'

interface Suggestion {
  id: string
  name: string
  slug: string
  thumbnail: string | null
  price: number
  categories?: { name: string } | null
}

const RECENT_SEARCHES_KEY = 'saif-recent-searches'
const MAX_RECENT = 5

function getRecentSearches(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]')
  } catch {
    return []
  }
}

function pushRecentSearch(term: string) {
  const list = getRecentSearches().filter(s => s.toLowerCase() !== term.toLowerCase())
  list.unshift(term)
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list.slice(0, MAX_RECENT)))
}

export default function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile } = useAuth()
  const { count, setIsOpen } = useCart()
  const { addToast } = useToast()
  const { settings } = useApp()
  const { categories } = useCategories()
  const [scrolled, setScrolled] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchPanelRef = useRef<HTMLDivElement>(null)
  const lastScrollY = useRef(0)

  const debouncedQuery = useDebounce(searchQuery, 300)

  // Scroll-aware header: solid after threshold, hides scrolling down, shows scrolling up
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      setScrolled(y > 24)
      if (Math.abs(y - lastScrollY.current) > 12) {
        setHidden(y > lastScrollY.current && y > 300 && !searchOpen)
        lastScrollY.current = y
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [searchOpen])

  useEffect(() => {
    setMobileMenuOpen(false)
    setSearchOpen(false)
  }, [location.pathname])

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileMenuOpen])

  // Close search on outside click
  useEffect(() => {
    if (!searchOpen) return
    const onPointerDown = (e: PointerEvent) => {
      if (!searchPanelRef.current?.contains(e.target as Node)) setSearchOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [searchOpen])

  // Debounced suggestions — never queries on every keystroke
  useEffect(() => {
    const term = debouncedQuery.trim()
    if (term.length < 2) {
      setSuggestions([])
      setSuggestLoading(false)
      return
    }
    let cancelled = false
    setSuggestLoading(true)
    supabase
      .from('products')
      .select('id, name, slug, thumbnail, price, categories(name)')
      .eq('status', 'active')
      .ilike('name', `%${term}%`)
      .limit(6)
      .then(({ data }) => {
        if (cancelled) return
        setSuggestions((data || []) as unknown as Suggestion[])
        setSuggestLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [debouncedQuery])

  const recentSearches = useMemo(
    () => (searchQuery.trim().length >= 2 ? [] : getRecentSearches()),
    [searchQuery],
  )

  const submitSearch = useCallback(
    (term: string) => {
      const t = term.trim()
      if (!t) return
      pushRecentSearch(t)
      navigate(`/search?q=${encodeURIComponent(t)}`)
      setSearchOpen(false)
      setSearchQuery('')
      setActiveIndex(-1)
      searchInputRef.current?.blur()
    },
    [navigate],
  )

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      if (searchQuery) {
        setSearchQuery('')
        setActiveIndex(-1)
      } else {
        setSearchOpen(false)
      }
      return
    }
    if (suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => (i - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        e.preventDefault()
        const target = suggestions[activeIndex]
        pushRecentSearch(searchQuery.trim())
        navigate(`/products/${target.slug}`)
        setSearchOpen(false)
        setSearchQuery('')
        setActiveIndex(-1)
      }
      // Otherwise the form submits normally with the typed term.
    }
  }

  function onCartClick() {
    if (count === 0) {
      addToast('Your bag is empty', 'info')
      navigate('/cart')
      return
    }
    setIsOpen(true)
  }

  const iconBtn =
    'inline-flex items-center justify-center w-11 h-11 text-saif-text hover:text-saif-accent transition-colors duration-300'

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      {/* Announcement bar — 36px tall, exactly matching the header offset */}
      {settings?.announcement && (
        <div className="fixed top-0 left-0 right-0 z-[101] bg-saif-accent text-black text-center text-xs font-semibold py-2.5 px-4 tracking-wide">
          {settings.announcement}
        </div>
      )}

      <header
        className={cn(
          'fixed left-0 right-0 z-[100] transition-[transform,background-color,border-color] duration-500 ease-saif',
          settings?.announcement ? 'top-9' : 'top-0',
          hidden ? '-translate-y-full' : 'translate-y-0',
          scrolled || searchOpen
            ? 'bg-black/85 backdrop-blur-xl border-b border-saif-border'
            : 'bg-transparent border-b border-transparent',
        )}
      >
        <div className="flex items-center justify-between px-5 lg:px-10 py-3">
          {/* Mobile menu button */}
          <button
            className="lg:hidden w-11 h-11 flex items-center justify-center text-saif-text hover:text-saif-accent transition-colors -ml-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          {/* Logo */}
          <Link
            to="/"
            className="group flex items-baseline text-lg sm:text-xl font-bold tracking-tight text-saif-text"
          >
            <span className="transition-colors duration-300 group-hover:text-saif-accent">SAIF</span>
            <span className="font-light text-saif-dim group-hover:text-saif-text transition-colors duration-300">
              STORE
            </span>
            <sup className="text-[9px] font-normal text-saif-faint ml-0.5" aria-hidden="true">
              ®
            </sup>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-9" aria-label="Main navigation">
            <NavLink to="/">Home</NavLink>
            <NavLink to="/products">Shop</NavLink>
            <div className="relative group">
              <button
                className="text-sm font-medium text-saif-text hover:text-saif-accent transition-colors duration-300 flex items-center gap-1.5 py-2"
                aria-haspopup="true"
              >
                Categories
                <span className="w-1 h-1 rotate-45 bg-saif-accent" aria-hidden="true" />
              </button>
              <div className="absolute left-1/2 -translate-x-1/2 top-full pt-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-200 pointer-events-none group-hover:pointer-events-auto group-focus-within:pointer-events-auto">
                <div className="bg-black border border-saif-border min-w-[230px] py-2 shadow-2xl rounded-sm">
                  {categories.map(cat => (
                    <Link
                      key={cat.id}
                      to={`/products?category=${cat.id}`}
                      className="flex items-center justify-between gap-4 px-4 py-2.5 min-h-[44px] text-sm text-saif-dim hover:text-saif-text hover:bg-white/5 transition-colors"
                    >
                      {cat.name}
                      <ArrowRight size={12} className="opacity-40 text-saif-accent transition-opacity" aria-hidden="true" />
                    </Link>
                  ))}
                  <Link
                    to="/products"
                    className="block px-4 py-3 min-h-[44px] text-[11px] font-semibold uppercase tracking-[0.15em] text-saif-accent hover:bg-white/5 transition-colors border-t border-saif-border mt-1"
                  >
                    View Everything
                  </Link>
                </div>
              </div>
            </div>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-0.5 sm:gap-1">
            <button
              onClick={() => {
                setSearchOpen(!searchOpen)
                setActiveIndex(-1)
              }}
              className={iconBtn}
              aria-label={searchOpen ? 'Close search' : 'Open search'}
              aria-expanded={searchOpen}
            >
              <Search size={19} />
            </button>
            <Link to={user ? '/wishlist' : '/login'} className={cn(iconBtn, 'hidden sm:inline-flex')} aria-label="Wishlist">
              <Heart size={19} />
            </Link>
            <Link
              to={user ? '/account' : '/login'}
              className={cn(iconBtn, 'hidden sm:inline-flex')}
              aria-label={user ? 'Account' : 'Sign in'}
            >
              <User size={19} />
            </Link>
            <button onClick={onCartClick} className={cn(iconBtn, 'relative')} aria-label={`Shopping bag, ${count} items`}>
              <ShoppingBag size={19} />
              {count > 0 && (
                <span
                  key={count}
                  className="absolute top-1 right-0.5 bg-saif-accent text-black text-[10px] font-bold min-w-[1.2rem] h-[1.2rem] px-1 rounded-full flex items-center justify-center animate-scaleIn tabular-nums"
                >
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Search overlay — combobox semantics + keyboard navigation */}
        {searchOpen && (
          <div ref={searchPanelRef} className="border-t border-saif-border bg-black/95 backdrop-blur-xl animate-[fadeUp_0.3s_ease]">
            <div className="max-w-2xl mx-auto px-5 lg:px-10 py-6">
              <form
                role="search"
                onSubmit={e => {
                  e.preventDefault()
                  submitSearch(searchQuery)
                }}
              >
                <div
                  className="relative"
                  role="combobox"
                  aria-expanded={suggestions.length > 0}
                  aria-haspopup="listbox"
                  aria-owns="header-search-listbox"
                >
                  <Search size={19} className="absolute left-0 top-1/2 -translate-y-1/2 text-saif-dim" aria-hidden="true" />
                  <label htmlFor="header-search" className="sr-only">
                    Search products
                  </label>
                  <input
                    id="header-search"
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search products, categories…"
                    value={searchQuery}
                    onChange={e => {
                      setSearchQuery(e.target.value)
                      setActiveIndex(-1)
                    }}
                    onKeyDown={handleSearchKeyDown}
                    autoFocus
                    autoComplete="off"
                    role="searchbox"
                    aria-autocomplete="list"
                    aria-activedescendant={
                      activeIndex >= 0 ? `search-option-${activeIndex}` : undefined
                    }
                    aria-controls="header-search-listbox"
                    className="w-full bg-transparent text-saif-text text-xl border-b border-saif-border pb-3 pl-10 pr-10 focus:outline-none focus:border-saif-accent placeholder:text-saif-faint transition-colors"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('')
                        setActiveIndex(-1)
                        searchInputRef.current?.focus()
                      }}
                      className="absolute right-0 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-saif-dim hover:text-saif-text"
                      aria-label="Clear search"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
              </form>

              {/* Suggestions */}
              {searchQuery.trim().length >= 2 && (
                <div className="mt-5">
                  {suggestLoading ? (
                    <div className="space-y-2" aria-label="Loading suggestions">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="h-14 skeleton rounded-sm" />
                      ))}
                    </div>
                  ) : suggestions.length > 0 ? (
                    <ul id="header-search-listbox" role="listbox" aria-label="Search suggestions" className="space-y-0.5">
                      {suggestions.map((s, i) => (
                        <li key={s.id} role="option" aria-selected={i === activeIndex} id={`search-option-${i}`}>
                          <Link
                            to={`/products/${s.slug}`}
                            onClick={() => setSearchOpen(false)}
                            onMouseEnter={() => setActiveIndex(i)}
                            className={cn(
                              'flex items-center gap-4 p-2 -mx-2 rounded-sm transition-colors min-h-[44px]',
                              i === activeIndex ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]',
                            )}
                          >
                            <div className="w-10 h-12 bg-saif-panel overflow-hidden flex-shrink-0 rounded-sm">
                              {s.thumbnail && (
                                <img src={s.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-saif-text truncate">{s.name}</p>
                              {s.categories?.name && <p className="text-xs text-saif-faint">{s.categories.name}</p>}
                            </div>
                            <span className="text-sm font-semibold text-saif-text flex-shrink-0 tabular-nums">
                              {formatPrice(s.price)}
                            </span>
                          </Link>
                        </li>
                      ))}
                      <li>
                        <button
                          onClick={() => submitSearch(searchQuery)}
                          onMouseEnter={() => setActiveIndex(-1)}
                          className="w-full text-left px-2 py-3 min-h-[44px] -mx-2 rounded-sm text-[11px] font-semibold uppercase tracking-[0.18em] text-saif-accent hover:bg-white/[0.04] transition-colors flex items-center gap-2"
                        >
                          View all results for “{searchQuery.trim()}”
                          <ArrowRight size={12} aria-hidden="true" />
                        </button>
                      </li>
                    </ul>
                  ) : (
                    <p className="text-sm text-saif-dim py-4 px-2">No products match “{searchQuery.trim()}”.</p>
                  )}
                </div>
              )}

              {/* Recent searches */}
              {searchQuery.trim().length < 2 && recentSearches.length > 0 && (
                <div className="mt-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-saif-faint mb-3 flex items-center gap-2 px-2">
                    <Clock size={11} aria-hidden="true" /> Recent
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map(term => (
                      <button
                        key={term}
                        onClick={() => submitSearch(term)}
                        className="min-h-[44px] px-5 py-2.5 text-xs border border-saif-border rounded-full text-saif-dim hover:text-saif-text hover:border-saif-text transition-colors"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Mobile menu */}
      <div
        className={cn(
          'fixed inset-0 bg-black z-[95] flex flex-col transition-opacity duration-500 lg:hidden',
          mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
        aria-hidden={!mobileMenuOpen}
      >
        <nav className="flex-1 flex flex-col items-center justify-center gap-5 px-6" aria-label="Mobile navigation">
          <MobileLink to="/" onClick={() => setMobileMenuOpen(false)} big delay={0}>
            Home
          </MobileLink>
          <MobileLink to="/products" onClick={() => setMobileMenuOpen(false)} big delay={60}>
            Shop
          </MobileLink>
          <div className="w-full max-w-xs border-t border-saif-border my-2" aria-hidden="true" />
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 max-w-xs w-full">
            {categories.map(cat => (
              <Link
                key={cat.id}
                to={`/products?category=${cat.id}`}
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm font-medium text-saif-dim hover:text-saif-text transition-colors text-center py-2.5"
                style={{ transitionDelay: `${cat.sort_order * 20}ms` }}
              >
                {cat.name}
              </Link>
            ))}
          </div>
          <div className="w-full max-w-xs border-t border-saif-border my-2" aria-hidden="true" />
          {user ? (
            <div className="flex flex-col items-center gap-4">
              <MobileLink to="/account" onClick={() => setMobileMenuOpen(false)} delay={120}>
                Account
              </MobileLink>
              <MobileLink to="/orders" onClick={() => setMobileMenuOpen(false)} delay={160}>
                Orders
              </MobileLink>
              <MobileLink to="/wishlist" onClick={() => setMobileMenuOpen(false)} delay={200}>
                Wishlist
              </MobileLink>
              {profile?.role === 'admin' && (
                <Link
                  to="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-lg font-bold tracking-tight text-saif-accent py-2.5"
                >
                  Admin Dashboard
                </Link>
              )}
            </div>
          ) : (
            <MobileLink to="/login" onClick={() => setMobileMenuOpen(false)} delay={160}>
              Sign In
            </MobileLink>
          )}
        </nav>
        <p className="pb-10 text-center text-[10px] uppercase tracking-[0.3em] text-saif-faint" aria-hidden="true">
          Streetwear · Digital · Curated
        </p>
      </div>
    </>
  )
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="group relative text-sm font-medium text-saif-text hover:text-saif-accent transition-colors duration-300 py-2"
    >
      {children}
      <span
        className="absolute -bottom-0.5 left-0 w-0 h-[2px] bg-saif-accent transition-all duration-500 ease-saif group-hover:w-full"
        aria-hidden="true"
      />
    </Link>
  )
}

function MobileLink({
  to,
  onClick,
  big,
  delay,
  children,
}: {
  to: string
  onClick: () => void
  big?: boolean
  delay?: number
  children: React.ReactNode
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        'font-bold tracking-tight text-saif-text hover:text-saif-accent transition-all duration-500',
        big ? 'text-3xl' : 'text-lg text-saif-dim',
      )}
    >
      {children}
    </Link>
  )
}

function mobileMenuOpenDelay(_delay?: number) {
  // Stagger is applied via CSS transition-delay once the menu opens; kept simple.
  return undefined
}
