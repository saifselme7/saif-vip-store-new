import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SlidersHorizontal, X, ChevronDown } from 'lucide-react'
import { useProducts, type ProductFilters } from '@/hooks/useProducts'
import { useCategories } from '@/hooks/useCategories'
import { useProductRatings } from '@/hooks/useProductRatings'
import ProductCard from '@/components/ProductCard'
import Footer from '@/components/Footer'
import EmptyState from '@/components/EmptyState'
import { ProductGridSkeleton } from '@/components/ui/Skeletons'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useI18n } from '@/i18n'
import { localizeCategory } from '@/lib/bilingual'
import { isStorefrontCategory } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { Product } from '@/types'

type SortOption = 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'popular' | 'rating'

interface LocalFilters {
  category: string
  type: string
  featured: boolean
  bestseller: boolean
  onSale: boolean
  inStock: boolean
  search: string
  minPrice: string
  maxPrice: string
  size: string
  color: string
  sort: SortOption
}

const DEFAULT_FILTERS: LocalFilters = {
  category: '',
  type: '',
  featured: false,
  bestseller: false,
  onSale: false,
  inStock: false,
  search: '',
  minPrice: '',
  maxPrice: '',
  size: '',
  color: '',
  sort: 'newest',
}

function filtersFromParams(params: URLSearchParams): LocalFilters {
  return {
    ...DEFAULT_FILTERS,
    category: params.get('category') || '',
    type: params.get('type') || '',
    featured: params.get('featured') === 'true',
    bestseller: params.get('bestseller') === 'true',
    onSale: params.get('onSale') === 'true',
    search: params.get('q') || '',
    minPrice: params.get('minPrice') || '',
    maxPrice: params.get('maxPrice') || '',
    sort: (params.get('sort') as SortOption) || 'newest',
  }
}

export default function ProductsPage() {
  const { t, lang } = useI18n()
  const [searchParams, setSearchParams] = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [localFilters, setLocalFilters] = useState<LocalFilters>(() => filtersFromParams(searchParams))
  const { categories } = useCategories()
  const { getRating } = useProductRatings()
  usePageMeta({
    title: `${t('nav.shop')} — SAIF STORE`,
    description: t('meta.description'),
  })

  // Sync URL → state (back/forward navigation)
  useEffect(() => {
    setLocalFilters(filtersFromParams(searchParams))
  }, [searchParams])

  function applyFilter<K extends keyof LocalFilters>(key: K, value: LocalFilters[K]) {
    const next = { ...localFilters, [key]: value }
    setLocalFilters(next)
    syncUrl(next)
  }

  function syncUrl(filters: LocalFilters) {
    const params = new URLSearchParams()
    if (filters.category) params.set('category', filters.category)
    if (filters.type) params.set('type', filters.type)
    if (filters.featured) params.set('featured', 'true')
    if (filters.bestseller) params.set('bestseller', 'true')
    if (filters.onSale) params.set('onSale', 'true')
    if (filters.inStock) params.set('inStock', 'true')
    if (filters.search) params.set('q', filters.search)
    if (filters.minPrice) params.set('minPrice', filters.minPrice)
    if (filters.maxPrice) params.set('maxPrice', filters.maxPrice)
    if (filters.size) params.set('size', filters.size)
    if (filters.color) params.set('color', filters.color)
    if (filters.sort !== 'newest') params.set('sort', filters.sort)
    setSearchParams(params, { replace: true })
  }

  function clearFilters() {
    setLocalFilters(DEFAULT_FILTERS)
    setSearchParams(new URLSearchParams(), { replace: true })
  }

  const serverFilters: ProductFilters = {
    category: localFilters.category || undefined,
    type: (localFilters.type as 'physical' | 'digital') || undefined,
    featured: localFilters.featured || undefined,
    bestseller: localFilters.bestseller || undefined,
    onSale: localFilters.onSale || undefined,
    inStock: localFilters.inStock || undefined,
    search: localFilters.search || undefined,
    minPrice: localFilters.minPrice ? Number(localFilters.minPrice) : undefined,
    maxPrice: localFilters.maxPrice ? Number(localFilters.maxPrice) : undefined,
    sort: localFilters.sort === 'rating' ? 'newest' : localFilters.sort,
  }

  const { products, loading, error } = useProducts(serverFilters)

  // Size / color / rating are applied client-side (they need variant + review data)
  const displayProducts = useMemo(() => {
    let list = products
    if (localFilters.size) {
      list = list.filter(p => p.variants?.some(v => v.size === localFilters.size && v.stock > 0))
    }
    if (localFilters.color) {
      list = list.filter(p => p.variants?.some(v => v.color === localFilters.color && v.stock > 0))
    }
    if (localFilters.sort === 'rating') {
      list = [...list].sort((a, b) => {
        const ra = getRating(a.id)?.avg_rating ?? 0
        const rb = getRating(b.id)?.avg_rating ?? 0
        if (rb !== ra) return rb - ra
        return (getRating(b.id)?.review_count ?? 0) - (getRating(a.id)?.review_count ?? 0)
      })
    }
    if (localFilters.sort === 'popular') {
      list = [...list].sort((a, b) => Number(b.bestseller) - Number(a.bestseller))
    }
    return list
  }, [products, localFilters.size, localFilters.color, localFilters.sort, getRating])

  // Available facet values from the current result set
  const availableSizes = useMemo(
    () => [...new Set(products.flatMap(p => p.variants?.map(v => v.size).filter(Boolean) ?? []))] as string[],
    [products],
  )
  const availableColors = useMemo(
    () => [...new Set(products.flatMap(p => p.variants?.map(v => v.color).filter(Boolean) ?? []))] as string[],
    [products],
  )

  const hasFilters =
    localFilters.category || localFilters.type || localFilters.featured || localFilters.bestseller ||
    localFilters.onSale || localFilters.inStock || localFilters.search || localFilters.minPrice ||
    localFilters.maxPrice || localFilters.size || localFilters.color

  const activeCategory = categories.find(c => c.id === localFilters.category)
  const visibleCategories = categories.filter(isStorefrontCategory)

  const filterPanel = (
    <div className="space-y-7">
      <FilterGroup title={t('filters.category')}>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('filters.category')}>
          <button
            onClick={() => applyFilter('category', '')}
            aria-pressed={localFilters.category === ''}
            className={cn(
              'min-h-[44px] px-4 text-xs border rounded-full transition-colors',
              localFilters.category === ''
                ? 'border-saif-text bg-saif-text text-saif-bg font-semibold'
                : 'border-saif-border text-saif-dim hover:text-saif-text hover:border-saif-text',
            )}
          >
            {t('filters.allCategories')}
          </button>
          {visibleCategories.map(c => (
            <button
              key={c.id}
              onClick={() => applyFilter('category', c.id)}
              aria-pressed={localFilters.category === c.id}
              className={cn(
                'min-h-[44px] px-4 text-xs border rounded-full transition-colors',
                localFilters.category === c.id
                  ? 'border-saif-text bg-saif-text text-saif-bg font-semibold'
                  : 'border-saif-border text-saif-dim hover:text-saif-text hover:border-saif-text',
              )}
            >
              {localizeCategory(c, lang).name}
            </button>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title={t('filters.priceRange')}>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={localFilters.minPrice}
            onChange={e => applyFilter('minPrice', e.target.value)}
            placeholder={t('filters.min')}
            className="input"
            aria-label={t('filters.min')}
          />
          <span className="text-saif-dim">—</span>
          <input
            type="number"
            min={0}
            value={localFilters.maxPrice}
            onChange={e => applyFilter('maxPrice', e.target.value)}
            placeholder={t('filters.max')}
            className="input"
            aria-label={t('filters.max')}
          />
        </div>
      </FilterGroup>

      {availableSizes.length > 0 && (
        <FilterGroup title={t('filters.size')}>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('filters.size')}>
            {availableSizes.map(size => (
              <button
                key={size}
                onClick={() => applyFilter('size', localFilters.size === size ? '' : size)}
                aria-pressed={localFilters.size === size}
                className={cn(
                  'min-w-[44px] min-h-[44px] px-3 text-xs border rounded-sm transition-colors',
                  localFilters.size === size
                    ? 'border-saif-text bg-saif-text text-saif-bg font-semibold'
                    : 'border-saif-border text-saif-dim hover:text-saif-text hover:border-saif-text',
                )}
              >
                {size}
              </button>
            ))}
          </div>
        </FilterGroup>
      )}

      {availableColors.length > 0 && (
        <FilterGroup title={t('filters.color')}>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('filters.color')}>
            {availableColors.map(color => (
              <button
                key={color}
                onClick={() => applyFilter('color', localFilters.color === color ? '' : color)}
                aria-pressed={localFilters.color === color}
                className={cn(
                  'min-h-[44px] px-4 text-xs border rounded-full transition-colors',
                  localFilters.color === color
                    ? 'border-saif-text bg-saif-text text-saif-bg font-semibold'
                    : 'border-saif-border text-saif-dim hover:text-saif-text hover:border-saif-text',
                )}
              >
                {color}
              </button>
            ))}
          </div>
        </FilterGroup>
      )}

      <FilterGroup title={t('filters.availability')}>
        <div className="space-y-2.5">
          <Toggle
            label={t('filters.inStockOnly')}
            checked={localFilters.inStock}
            onChange={v => applyFilter('inStock', v)}
          />
          <Toggle label={t('filters.onSale')} checked={localFilters.onSale} onChange={v => applyFilter('onSale', v)} />
          <Toggle label={t('filters.featured')} checked={localFilters.featured} onChange={v => applyFilter('featured', v)} />
          <Toggle label={t('filters.bestSellers')} checked={localFilters.bestseller} onChange={v => applyFilter('bestseller', v)} />
        </div>
      </FilterGroup>

      {hasFilters ? (
        <button
          onClick={clearFilters}
          className="text-xs text-saif-dim hover:text-saif-accent transition-colors flex items-center gap-1"
        >
          <X size={12} /> {t('filters.clearAll')}
        </button>
      ) : null}
    </div>
  )

  return (
    <div className="animate-[pageIn_0.6s_ease]">
      <div className="theme-paper min-h-screen pt-28 md:pt-32 px-5 lg:px-10 pb-20">
        <div className="max-w-7xl mx-auto">
          {/* Editorial header */}
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5 mb-10 md:mb-14">
            <div className="min-w-0">
              <p className="eyebrow mb-4">
                <span className="text-saif-accent tabular-nums">01</span>
                <span className="w-3 h-px bg-saif-border" aria-hidden="true" />
                {t('filters.shop')}
              </p>
              <h1 className="font-display text-saif-text text-[clamp(42px,8vw,110px)] leading-[0.92]">
                {activeCategory ? localizeCategory(activeCategory, lang).name : t('filters.shop')}
              </h1>
              <p className="mt-4 text-sm text-saif-dim" aria-live="polite">
                {loading
                  ? t('common.loading')
                  : t.plural('filters.results', displayProducts.length)}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label className="sr-only" htmlFor="sort-select">
                {t('filters.sortBy')}
              </label>
              <div className="relative">
                <select
                  id="sort-select"
                  value={localFilters.sort}
                  onChange={e => applyFilter('sort', e.target.value as SortOption)}
                  className="appearance-none bg-transparent border border-saif-border text-saif-text text-xs px-4 py-2.5 pe-8 focus:outline-none focus:border-saif-text cursor-pointer rounded-sm"
                >
                  {(['newest', 'oldest', 'price_asc', 'price_desc', 'popular', 'rating'] as SortOption[]).map(value => (
                    <option key={value} value={value} className="bg-black text-white">
                      {t(`filters.sort.${value}`)}
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute end-2.5 top-1/2 -translate-y-1/2 text-saif-dim pointer-events-none" />
              </div>
              <button
                onClick={() => setFiltersOpen(!filtersOpen)}
                className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-saif-text border border-saif-border px-4 py-2.5 hover:border-saif-text transition-colors rounded-sm lg:hidden"
                aria-expanded={filtersOpen}
              >
                <SlidersHorizontal size={14} />
                {t('filters.showFilters')}{hasFilters ? ' •' : ''}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-10">
            {/* Desktop filters */}
            <aside className="hidden lg:block" aria-label={t('filters.title')}>
              <div className="sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto pe-2">{filterPanel}</div>
            </aside>

            {/* Mobile filter sheet — same paper theme as the catalogue */}
            {filtersOpen && (
              <div className="fixed inset-0 z-[150] lg:hidden" role="dialog" aria-modal="true" aria-label={t('filters.title')}>
                <div className="absolute inset-0 bg-black/70" onClick={() => setFiltersOpen(false)} />
                <div className="theme-paper absolute bottom-0 inset-x-0 max-h-[85vh] overflow-y-auto border-t border-saif-border p-6 rounded-t-2xl animate-scaleIn">
                  <div className="flex items-center justify-between mb-6 sticky top-0 pb-2" style={{ backgroundColor: 'rgb(var(--saif-bg))' }}>
                    <h2 className="text-base font-bold text-saif-text">{t('filters.filters')}</h2>
                    <button onClick={() => setFiltersOpen(false)} aria-label={t('common.close')} className="w-11 h-11 flex items-center justify-center text-saif-dim hover:text-saif-text">
                      <X size={20} />
                    </button>
                  </div>
                  {filterPanel}
                  <button onClick={() => setFiltersOpen(false)} className="btn btn-primary w-full mt-8">
                    {t('filters.showResults', { count: displayProducts.length })}
                  </button>
                </div>
              </div>
            )}

            {/* Results */}
            <div>
              {loading ? (
                <ProductGridSkeleton count={12} />
              ) : error ? (
                <EmptyState
                  title={t('filters.couldNotLoad')}
                  description={error}
                  action={
                    <button className="btn btn-sm" onClick={() => window.location.reload()}>
                      {t('common.retry')}
                    </button>
                  }
                />
              ) : displayProducts.length === 0 ? (
                <EmptyState
                  title={t('filters.noProducts')}
                  description={t('filters.noProductsDesc')}
                  action={
                    <button className="btn btn-sm" onClick={clearFilters}>
                      {t('filters.clearAll')}
                    </button>
                  }
                />
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-10 md:gap-x-5 md:gap-y-14">
                  {displayProducts.map(p => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-saif-dim mb-3">{title}</h3>
      {children}
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 text-sm text-saif-dim hover:text-saif-text transition-colors cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="w-4 h-4 accent-[#E63946]"
      />
      {label}
    </label>
  )
}

export type { Product }
