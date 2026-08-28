import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Search, ShoppingBag, Menu, X, User, Heart, Clock, ArrowRight, Globe, Check } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useCart } from '@/context/CartContext'
import { useToast } from '@/context/ToastContext'
import { useApp } from '@/context/AppContext'
import { useI18n, LANGUAGES, type Lang } from '@/i18n'
import { useCategories } from '@/hooks/useCategories'
import { useDebounce } from '@/hooks/useDebounce'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { localizeCategory } from '@/lib/bilingual'

interface Suggestion {
  id: string
  name: string
  name_ar: string | null
  slug: string
  thumbnail: string | null
  price: number
  categories?: { name: string; name_ar: string | null } | null
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
  const { t, lang, setLang, isRTL, formatPrice, localize } = useI18n()
  const { categories } = useCategories()
  const [scrolled, setScrolled] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchPanelRef = useRef<HTMLDivElement>(null)
  const langMenuRef = useRef<HTMLDivElement>(null)
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
    setLangOpen(false)
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

  // Close language menu on outside click
  useEffect(() => {
    if (!langOpen) return
    const onPointerDown = (e: PointerEvent) => {
      if (!langMenuRef.current?.contains(e.target as Node)) setLangOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [langOpen])

  // Debounced suggestions — matches English AND Arabic names, never on every keystroke
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
      .select('id, name, name_ar, slug, thumbnail, price, categories(name, name_ar)')
      .eq('status', 'active')
      .or(`name.ilike.%${term}%,name_ar.ilike.%${term}%`)
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
      const trimmed = term.trim()
      if (!trimmed) return
      pushRecentSearch(trimmed)
      navigate(`/search?q=${encodeURIComponent(trimmed)}`)
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
      addToast(t('cart.empty'), 'info')
      navigate('/cart')
      return
    }
    setIsOpen(true)
  }

  const iconBtn =
    'inline-flex items-center justify-center w-11 h-11 text-saif-text hover:text-saif-accent transition-colors duration-300'

  const announcementText = lang === 'ar' ? settings?.announcement_ar : settings?.announcement

  return (
    <>
      <a href="#main" className="skip-link">
        {t('a11y.skipToContent')}
      </a>

      {/* Announcement bar — 36px tall, exactly matching the header offset */}
      {settings?.announcement_enabled !== false && announcementText && (
        <div className="fixed top-0 left-0 right-0 z-[101] bg-saif-accent text-black text-center text-xs font-semibold py-2.5 px-4 tracking-wide">
          {announcementText}
          {settings?.announcement_link && settings?.announcement_link_text && (
            <>
              {' — '}
              <a href={settings.announcement_link} className="underline underline-offset-2">
                {settings.announcement_link_text}
              </a>
            </>
          )}
        </div>
      )}

      <header
        className={cn(
          'fixed left-0 right-0 z-[100] transition-[transform,background-color,border-color] duration-500 ease-saif',
          settings?.announcement_enabled !== false && announcementText ? 'top-9' : 'top-0',
          hidden ? '-translate-y-full' : 'translate-y-0',
          scrolled || searchOpen
            ? 'bg-black/85 backdrop-blur-xl border-b border-saif-border'
            : 'bg-transparent border-b border-transparent',
        )}
      >
        <div className="flex items-center justify-between px-5 lg:px-10 py-3">
          {/* Mobile menu button */}
          <button
            className="lg:hidden w-11 h-11 flex items-center justify-center text-saif-text hover:text-saif-accent transition-colors -ms-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? t('a11y.closeMenu') : t('a11y.openMenu')}
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
            <sup className="text-[9px] font-normal text-saif-faint ms-0.5" aria-hidden="true">
              ®
            </sup>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-9" aria-label={t('a11y.breadcrumb')}>
            <NavLink to="/">{t('nav.home')}</NavLink>
            <NavLink to="/products">{t('nav.shop')}</NavLink>
            <div className="relative group">
              <button
                className="text-sm font-medium text-saif-text hover:text-saif-accent transition-colors duration-300 flex items-center gap-1.5 py-2"
                aria-haspopup="true"
              >
                {t('nav.categories')}
                <span className="w-1 h-1 rotate-45 bg-saif-accent" aria-hidden="true" />
              </button>
              <div className="absolute start-1/2 -translate-x-1/2 rtl:translate-x-1/2 top-full pt-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-200 pointer-events-none group-hover:pointer-events-auto group-focus-within:pointer-events-auto">
                <div className="bg-black border border-saif-border min-w-[230px] py-2 shadow-2xl rounded-sm">
                  {categories.map(cat => {
                    const loc = localizeCategory(cat, lang)
                    return (
                      <Link
                        key={cat.id}
                        to={`/products?category=${cat.id}`}
                        className="flex items-center justify-between gap-4 px-4 py-2.5 min-h-[44px] text-sm text-saif-dim hover:text-saif-text hover:bg-white/5 transition-colors"
                      >
                        {loc.name}
                      </Link>
                    )
                  })}
                  <Link
                    to="/products"
                    className="block px-4 py-3 min-h-[44px] text-[11px] font-semibold uppercase tracking-[0.15em] text-saif-accent hover:bg-white/5 transition-colors border-t border-saif-border mt-1"
                  >
                    {t('nav.viewEverything')}
                  </Link>
                </div>
              </div>
            </div>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-0.5 sm:gap-1">
            {/* Language switcher */}
            <div className="relative" ref={langMenuRef}>
              <button
                onClick={() => setLangOpen(!langOpen)}
                className={cn(iconBtn, 'gap-1.5 w-auto px-2')}
                aria-label={t('a11y.switchLanguage')}
                aria-expanded={langOpen}
                aria-haspopup="listbox"
              >
                <Globe size={18} aria-hidden="true" />
                <span className="text-xs font-bold uppercase" aria-hidden="true">
                  {lang === 'en' ? 'EN' : 'ع'}
                </span>
              </button>
              {langOpen && (
                <div
                  className="absolute end-0 top-full mt-2 bg-black border border-saif-border rounded-sm shadow-2xl py-1 min-w-[160px] animate-scaleIn z-10"
                  role="listbox"
                  aria-label={t('a11y.language')}
                >
                  {LANGUAGES.map(l => (
                    <button
                      key={l.code}
                      role="option"
                      aria-selected={lang === l.code}
                      onClick={() => {
                        setLang(l.code as Lang)
                        setLangOpen(false)
                      }}
                      className={cn(
                        'w-full flex items-center justify-between gap-3 px-4 py-3 min-h-[44px] text-sm transition-colors',
                        lang === l.code
                          ? 'text-saif-accent bg-white/[0.04]'
                          : 'text-saif-dim hover:text-saif-text hover:bg-white/[0.04]',
                      )}
                    >
                      <span className="flex items-center gap-2.5">
                        <span className="text-[10px] font-bold uppercase text-saif-faint w-5">
                          {l.short}
                        </span>
                        {l.name}
                      </span>
                      {lang === l.code && <Check size={14} aria-hidden="true" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setSearchOpen(!searchOpen)
                setActiveIndex(-1)
              }}
              className={iconBtn}
              aria-label={searchOpen ? t('a11y.closeSearch') : t('a11y.openSearch')}
              aria-expanded={searchOpen}
            >
              <Search size={19} />
            </button>
            <Link
              to={user ? '/wishlist' : '/login'}
              className={cn(iconBtn, 'hidden sm:inline-flex')}
              aria-label={t('a11y.wishlist')}
            >
              <Heart size={19} />
            </Link>
            <Link
              to={user ? '/account' : '/login'}
              className={cn(iconBtn, 'hidden sm:inline-flex')}
              aria-label={user ? t('a11y.account') : t('nav.signIn')}
            >
              <User size={19} />
            </Link>
            <button
              onClick={onCartClick}
              className={cn(iconBtn, 'relative')}
              aria-label={t('a11y.shoppingBag', { count })}
            >
              <ShoppingBag size={19} />
              {count > 0 && (
                <span
                  key={count}
                  className="absolute top-1 end-0.5 bg-saif-accent text-black text-[10px] font-bold min-w-[1.2rem] h-[1.2rem] px-1 rounded-full flex items-center justify-center animate-scaleIn tabular-nums"
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
                  <Search size={19} className="absolute start-0 top-1/2 -translate-y-1/2 text-saif-dim" aria-hidden="true" />
                  <label htmlFor="header-search" className="sr-only">
                    {t('a11y.openSearch')}
                  </label>
                  <input
                    id="header-search"
                    ref={searchInputRef}
                    type="text"
                    placeholder={t('search.headerPlaceholder')}
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
                    aria-activedescendant={activeIndex >= 0 ? `search-option-${activeIndex}` : undefined}
                    aria-controls="header-search-listbox"
                    className="w-full bg-transparent text-saif-text text-xl border-b border-saif-border pb-3 ps-10 pe-10 focus:outline-none focus:border-saif-accent placeholder:text-saif-faint transition-colors"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('')
                        setActiveIndex(-1)
                        searchInputRef.current?.focus()
                      }}
                      className="absolute end-0 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-saif-dim hover:text-saif-text"
                      aria-label={t('a11y.clearSearch')}
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
                    <div className="space-y-2" aria-label={t('common.loading')}>
                      {[1, 2, 3].map(i => (
                        <div key={i} className="h-14 skeleton rounded-sm" />
                      ))}
                    </div>
                  ) : suggestions.length > 0 ? (
                    <ul id="header-search-listbox" role="listbox" aria-label={t('search.suggestions')} className="space-y-0.5">
                      {suggestions.map((s, i) => {
                        const loc = localize(s)
                        return (
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
                                <p className="text-sm text-saif-text truncate">{loc.name}</p>
                                {s.categories && (
                                  <p className="text-xs text-saif-faint">
                                    {localizeCategory(s.categories, lang).name}
                                  </p>
                                )}
                              </div>
                              <span className="text-sm font-semibold text-saif-text flex-shrink-0 tabular-nums ltr-iso">
                                {formatPrice(s.price)}
                              </span>
                            </Link>
                          </li>
                        )
                      })}
                      <li>
                        <button
                          onClick={() => submitSearch(searchQuery)}
                          onMouseEnter={() => setActiveIndex(-1)}
                          className="w-full text-start px-2 py-3 min-h-[44px] -mx-2 rounded-sm text-[11px] font-semibold uppercase tracking-[0.18em] text-saif-accent hover:bg-white/[0.04] transition-colors flex items-center gap-2"
                        >
                          {t('search.viewAllResults', { query: searchQuery.trim() })}
                          <ArrowRight size={12} className={isRTL ? 'rotate-180' : ''} aria-hidden="true" />
                        </button>
                      </li>
                    </ul>
                  ) : (
                    <p className="text-sm text-saif-dim py-4 px-2">
                      {t('search.noResults', { query: searchQuery.trim() })}
                    </p>
                  )}
                </div>
              )}

              {/* Recent searches */}
              {searchQuery.trim().length < 2 && recentSearches.length > 0 && (
                <div className="mt-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-saif-faint mb-3 flex items-center gap-2 px-2">
                    <Clock size={11} aria-hidden="true" /> {t('search.recent')}
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
        <nav className="flex-1 flex flex-col items-center justify-center gap-5 px-6 overflow-y-auto" aria-label={t('a11y.breadcrumb')}>
          <MobileLink to="/" onClick={() => setMobileMenuOpen(false)} big>
            {t('nav.home')}
          </MobileLink>
          <MobileLink to="/products" onClick={() => setMobileMenuOpen(false)} big>
            {t('nav.shop')}
          </MobileLink>
          <div className="w-full max-w-xs border-t border-saif-border my-2" aria-hidden="true" />
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 max-w-xs w-full">
            {categories.map(cat => (
              <Link
                key={cat.id}
                to={`/products?category=${cat.id}`}
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm font-medium text-saif-dim hover:text-saif-text transition-colors text-center py-2.5"
              >
                {localizeCategory(cat, lang).name}
              </Link>
            ))}
          </div>
          <div className="w-full max-w-xs border-t border-saif-border my-2" aria-hidden="true" />
          {user ? (
            <div className="flex flex-col items-center gap-4">
              <MobileLink to="/account" onClick={() => setMobileMenuOpen(false)}>
                {t('nav.account')}
              </MobileLink>
              <MobileLink to="/orders" onClick={() => setMobileMenuOpen(false)}>
                {t('nav.orders')}
              </MobileLink>
              <MobileLink to="/wishlist" onClick={() => setMobileMenuOpen(false)}>
                {t('nav.wishlist')}
              </MobileLink>
              {profile?.role === 'admin' && (
                <Link
                  to="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-lg font-bold tracking-tight text-saif-accent py-2.5"
                >
                  {t('nav.admin')}
                </Link>
              )}
            </div>
          ) : (
            <MobileLink to="/login" onClick={() => setMobileMenuOpen(false)}>
              {t('nav.signIn')}
            </MobileLink>
          )}
          <div className="w-full max-w-xs border-t border-saif-border my-2" aria-hidden="true" />
          {/* Language switcher (mobile) */}
          <div className="flex items-center gap-3">
            {LANGUAGES.map(l => (
              <button
                key={l.code}
                onClick={() => setLang(l.code as Lang)}
                className={cn(
                  'min-h-[44px] px-5 py-2.5 text-sm border rounded-full transition-colors',
                  lang === l.code
                    ? 'border-saif-accent text-saif-accent font-semibold'
                    : 'border-saif-border text-saif-dim',
                )}
                aria-pressed={lang === l.code}
              >
                {l.name}
              </button>
            ))}
          </div>
        </nav>
        <p className="pb-10 text-center text-[10px] uppercase tracking-[0.3em] text-saif-faint" aria-hidden="true">
          {t('home.trustEgypt')}
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
        className="absolute -bottom-0.5 start-0 w-0 h-[2px] bg-saif-accent transition-all duration-500 ease-saif group-hover:w-full"
        aria-hidden="true"
      />
    </Link>
  )
}

function MobileLink({
  to,
  onClick,
  big,
  children,
}: {
  to: string
  onClick: () => void
  big?: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        'font-bold tracking-tight text-saif-text hover:text-saif-accent transition-colors duration-500',
        big ? 'text-3xl' : 'text-lg text-saif-dim',
      )}
    >
      {children}
    </Link>
  )
}
