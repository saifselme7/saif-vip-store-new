import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Search, ShoppingBag, Menu, X, User, Heart, Clock, ArrowRight, Globe, Check, ChevronDown } from 'lucide-react'
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
import { isStorefrontCategory } from '@/lib/constants'

interface Suggestion {
  id: string
  name: string
  name_ar: string | null
  slug: string
  thumbnail: string | null
  price: number
  categories?: { name: string; name_ar?: string | null } | null
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

  // On every route except the homepage the header sits on light or mixed
  // surfaces, so it carries a solid bar. On the homepage it floats over the
  // black hero until the visitor scrolls.
  const isHome = location.pathname === '/'
  const solid = !isHome || scrolled || searchOpen

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

  // Clothing categories for the storefront chrome
  const navCategories = categories.filter(isStorefrontCategory)

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
          solid
            ? 'bg-black/90 backdrop-blur-xl border-b border-saif-border'
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
          <nav className="hidden lg:flex items-center gap-8" aria-label={t('a11y.breadcrumb')}>
            <NavLink to="/">{t('nav.home')}</NavLink>
            <NavLink to="/products">{t('nav.shop')}</NavLink>
            <NavLink to="/products?sort=newest">{t('nav.newArrivals')}</NavLink>
            <NavLink to="/products?bestseller=true">{t('nav.bestSellers')}</NavLink>

            {/* Categories panel */}
            <div className="relative group/cat">
              <button
                className="group relative text-sm font-medium text-saif-text hover:text-saif-accent transition-colors duration-300 flex items-center gap-1.5 py-2"
                aria-haspopup="true"
              >
                {t('nav.categories')}
                <ChevronDown
                  size={13}
                  className="text-saif-faint group-hover/group-cat:rotate-180 transition-transform duration-300"
                  aria-hidden="true"
                />
                <span
                  className="absolute -bottom-0.5 start-0 w-0 h-[2px] bg-saif-accent transition-all duration-500 ease-saif group-hover:w-full"
                  aria-hidden="true"
                />
              </button>
              <div className="absolute start-1/2 rtl:translate-x-1/2 ltr:-translate-x-1/2 top-full pt-4 opacity-0 invisible translate-y-2 group-hover/cat:opacity-100 group-hover/cat:visible group-hover/cat:translate-y-0 group-focus-within/cat:opacity-100 group-focus-within/cat:visible group-focus-within/cat:translate-y-0 transition-all duration-300 ease-saif">
                <div className="w-[22rem] bg-black border border-saif-border shadow-2xl backdrop-blur-xl p-6 rounded-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-saif-faint mb-4">
                    {t('nav.categories')}
                  </p>
                  <ul className="space-y-0.5">
                    {navCategories.map(cat => (
                      <li key={cat.id}>
                        <Link
                          to={`/products?category=${cat.id}`}
                          className="group/cat-item flex items-center justify-between gap-4 min-h-[40px] px-3 -mx-3 text-sm text-saif-dim hover:text-saif-text hover:bg-white/[0.05] transition-colors duration-300 rounded-sm"
                        >
                          {localizeCategory(cat, lang).name}
                          <ArrowRight
                            size={13}
                            className={cn(
                              'text-saif-faint opacity-0 -translate-x-1 group-hover/cat-item:opacity-100 group-hover/cat-item:translate-x-0 transition-all duration-300',
                              isRTL && 'rotate-180',
                            )}
                            aria-hidden="true"
                          />
                        </Link>
                      </li>
                    ))}
                    {navCategories.length === 0 && (
                      <li className="text-sm text-saif-faint px-3 py-2">{t('home.productsWillAppear')}</li>
                    )}
                  </ul>
                  <div className="mt-4 pt-4 border-t border-saif-border flex items-center gap-5">
                    <Link to="/products?sort=newest" className="link-underline !normal-case !tracking-normal !text-xs">
                      {t('nav.newArrivals')}
                    </Link>
                    <Link to="/products?onSale=true" className="link-underline !normal-case !tracking-normal !text-xs">
                      {t('nav.sale')}
                    </Link>
                    <Link to="/products" className="link-underline !normal-case !tracking-normal !text-xs">
                      {t('nav.viewEverything')}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-0.5 sm:gap-1">
            <button
              className={iconBtn}
              onClick={() => setSearchOpen(!searchOpen)}
              aria-label={searchOpen ? t('a11y.closeSearch') : t('a11y.openSearch')}
              aria-expanded={searchOpen}
            >
              {searchOpen ? <X size={20} /> : <Search size={19} />}
            </button>

            <div className="relative" ref={langMenuRef}>
              <button
                className={iconBtn}
                onClick={() => setLangOpen(!langOpen)}
                aria-label={t('a11y.switchLanguage')}
                aria-haspopup="listbox"
                aria-expanded={langOpen}
              >
                <Globe size={19} />
              </button>
              {langOpen && (
                <div
                  role="listbox"
                  aria-label={t('a11y.language')}
                  className="absolute end-0 top-full mt-2 w-36 bg-black border border-saif-border shadow-2xl rounded-sm py-1.5 animate-scaleIn"
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
                        'w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors',
                        lang === l.code ? 'text-saif-accent' : 'text-saif-dim hover:text-saif-text hover:bg-white/[0.05]',
                      )}
                    >
                      {l.name}
                      {lang === l.code && <Check size={14} aria-hidden="true" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {user && (
              <Link to="/wishlist" className={cn(iconBtn, 'hidden sm:inline-flex')} aria-label={t('a11y.wishlist')}>
                <Heart size={19} />
              </Link>
            )}
            {user && (
              <Link to="/account" className={cn(iconBtn, 'hidden sm:inline-flex')} aria-label={t('a11y.account')}>
                <User size={19} />
              </Link>
            )}

            <button className={iconBtn} onClick={onCartClick} aria-label={t('a11y.shoppingBag', { count })}>
              <span className="relative inline-flex">
                <ShoppingBag size={19} />
                {count > 0 && (
                  <span className="absolute -top-1.5 -end-2 min-w-[18px] h-[18px] px-1 rounded-full bg-saif-accent text-black text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {count}
                  </span>
                )}
              </span>
            </button>
          </div>
        </div>

        {/* Search overlay */}
        {searchOpen && (
          <div className="border-t border-saif-border bg-black/95 backdrop-blur-xl" ref={searchPanelRef}>
            <div className="max-w-3xl mx-auto px-5 lg:px-10 py-8 animate-scaleIn">
              <form
                onSubmit={e => {
                  e.preventDefault()
                  submitSearch(searchQuery)
                }}
              >
                <div className="relative">
                  <Search
                    size={20}
                    className="absolute start-0 top-1/2 -translate-y-1/2 text-saif-faint"
                    aria-hidden="true"
                  />
                  <input
                    ref={searchInputRef}
                    autoFocus
                    type="search"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder={t('search.headerPlaceholder')}
                    aria-label={t('a11y.openSearch')}
                    role="combobox"
                    aria-expanded={suggestions.length > 0}
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
        <div
          className="flex-1 flex flex-col justify-center gap-1.5 px-8 overflow-y-auto"
          aria-label={t('a11y.breadcrumb')}
        >
          {[
            { to: '/', label: t('nav.home') },
            { to: '/products', label: t('nav.shop') },
            { to: '/products?sort=newest', label: t('nav.newArrivals') },
            { to: '/products?bestseller=true', label: t('nav.bestSellers') },
          ].map((item, i) => (
            <MobileLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileMenuOpen(false)}
              open={mobileMenuOpen}
              delay={120 + i * 80}
            >
              {item.label}
            </MobileLink>
          ))}

          {navCategories.length > 0 && (
            <>
              <p
                className={cn(
                  'mt-8 mb-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-saif-faint transition-all duration-500 ease-saif',
                  mobileMenuOpen ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
                )}
                style={{ transitionDelay: mobileMenuOpen ? '440ms' : '0ms' }}
              >
                {t('nav.categories')}
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                {navCategories.map((cat, i) => (
                  <Link
                    key={cat.id}
                    to={`/products?category=${cat.id}`}
                    onClick={() => setMobileMenuOpen(false)}
                    style={{ transitionDelay: mobileMenuOpen ? `${480 + i * 40}ms` : '0ms' }}
                    className={cn(
                      'text-sm font-medium text-saif-dim hover:text-saif-text transition-all duration-500 ease-saif py-2.5',
                      mobileMenuOpen ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
                    )}
                  >
                    {localizeCategory(cat, lang).name}
                  </Link>
                ))}
              </div>
            </>
          )}

          <div className="w-full max-w-xs border-t border-saif-border my-5" aria-hidden="true" />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {user ? (
              <>
                <MobileLink to="/account" onClick={() => setMobileMenuOpen(false)} open={mobileMenuOpen} delay={640} small>
                  {t('nav.account')}
                </MobileLink>
                <MobileLink to="/orders" onClick={() => setMobileMenuOpen(false)} open={mobileMenuOpen} delay={680} small>
                  {t('nav.orders')}
                </MobileLink>
                <MobileLink to="/wishlist" onClick={() => setMobileMenuOpen(false)} open={mobileMenuOpen} delay={720} small>
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
              </>
            ) : (
              <MobileLink to="/login" onClick={() => setMobileMenuOpen(false)} open={mobileMenuOpen} delay={640}>
                {t('nav.signIn')}
              </MobileLink>
            )}
          </div>

          {/* Language switcher (mobile) */}
          <div className="mt-7 flex items-center gap-3">
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
        </div>
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
  open,
  delay = 0,
  small,
  children,
}: {
  to: string
  onClick: () => void
  open: boolean
  delay?: number
  small?: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      style={{ transitionDelay: open ? `${delay}ms` : '0ms' }}
      className={cn(
        'font-bold tracking-tight text-saif-text hover:text-saif-accent transition-all duration-500 ease-saif',
        small ? 'text-lg text-saif-dim py-1' : 'text-3xl py-1.5',
        open ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
      )}
    >
      {children}
    </Link>
  )
}
