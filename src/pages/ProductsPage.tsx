import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SlidersHorizontal, X } from 'lucide-react'
import { useProducts, type ProductSort } from '@/hooks/useProducts'
import { useCategories } from '@/hooks/useCategories'
import { usePageMeta } from '@/hooks/usePageMeta'
import ProductCard from '@/components/ProductCard'
import EmptyState from '@/components/EmptyState'
import { ProductGridSkeleton } from '@/components/ui/Skeleton'
import type { Category } from '@/types'

const SORT_OPTIONS: Array<{ id: ProductSort; label: string }> = [
  { id: 'newest', label: 'Newest' },
  { id: 'oldest', label: 'Oldest' },
  { id: 'price_asc', label: 'Price: Low → High' },
  { id: 'price_desc', label: 'Price: High → Low' },
  { id: 'name', label: 'Name A–Z' },
]

export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [minPrice, setMinPrice] = useState(searchParams.get('min') || '')
  const [maxPrice, setMaxPrice] = useState(searchParams.get('max') || '')

  const category = searchParams.get('category') || ''
  const type = searchParams.get('type') || ''
  const onSale = searchParams.get('sale') === '1'
  const featured = searchParams.get('featured') === 'true'
  const bestseller = searchParams.get('bestseller') === 'true'
  const inStock = searchParams.get('stock') === '1'
  const sort = (searchParams.get('sort') as ProductSort) || 'newest'
  const q = searchParams.get('q') || ''

  usePageMeta(q ? `Search: ${q}` : 'Shop', 'Browse the full SAIF STORE catalog.')

  const { categories } = useCategories()
  const { products, loading } = useProducts({
    category: category || undefined,
    type: (type as 'physical' | 'digital') || undefined,
    featured: featured || undefined,
    bestseller: bestseller || undefined,
    onSale: onSale || undefined,
    search: q || undefined,
    minPrice: minPrice ? Number(minPrice) : undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
    inStock: inStock || undefined,
    sort,
  })

  // Sync price inputs → URL (debounced by native input + apply button).
  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams)
    if (value === null || value === '') next.delete(key)
    else next.set(key, value)
    setSearchParams(next, { replace: true })
  }

  function applyPrice() {
    const next = new URLSearchParams(searchParams)
    if (minPrice) next.set('min', minPrice); else next.delete('min')
    if (maxPrice) next.set('max', maxPrice); else next.delete('max')
    setSearchParams(next, { replace: true })
  }

  const activeCategory: Category | undefined = useMemo(
    () => categories.find(c => c.id === category),
    [categories, category],
  )

  const hasFilters = Boolean(category || type || onSale || featured || bestseller || inStock || minPrice || maxPrice)

  function clearAll() {
    setMinPrice('')
    setMaxPrice('')
    setSearchParams(new URLSearchParams(), { replace: true })
  }

  // Close mobile filter drawer on Escape.
  useEffect(() => {
    if (!filtersOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFiltersOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [filtersOpen])

  const filterPanel = (
    <div className="space-y-8">
      <FilterGroup label="Category">
        <FilterChip active={!category} onClick={() => setParam('category', null)}>All</FilterChip>
        {categories.map(c => (
          <FilterChip key={c.id} active={category === c.id} onClick={() => setParam('category', c.id)}>
            {c.name}
          </FilterChip>
        ))}
      </FilterGroup>

      <FilterGroup label="Type">
        <FilterChip active={!type} onClick={() => setParam('type', null)}>All</FilterChip>
        <FilterChip active={type === 'physical'} onClick={() => setParam('type', 'physical')}>Physical</FilterChip>
        <FilterChip active={type === 'digital'} onClick={() => setParam('type', 'digital')}>Digital</FilterChip>
      </FilterGroup>

      <FilterGroup label="Availability & Deals">
        <FilterChip active={inStock} onClick={() => setParam('stock', inStock ? null : '1')}>In Stock</FilterChip>
        <FilterChip active={onSale} onClick={() => setParam('sale', onSale ? null : '1')}>On Sale</FilterChip>
        <FilterChip active={featured} onClick={() => setParam('featured', featured ? null : 'true')}>Featured</FilterChip>
        <FilterChip active={bestseller} onClick={() => setParam('bestseller', bestseller ? null : 'true')}>Best Sellers</FilterChip>
      </FilterGroup>

      <FilterGroup label="Price Range">
        <div className="flex gap-2 items-center">
          <input
            type="number"
            inputMode="numeric"
            min="0"
            placeholder="Min"
            value={minPrice}
            onChange={e => setMinPrice(e.target.value)}
            aria-label="Minimum price"
            className="input text-xs px-3 py-2"
          />
          <span className="text-saif-dim text-xs">—</span>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            placeholder="Max"
            value={maxPrice}
            onChange={e => setMaxPrice(e.target.value)}
            aria-label="Maximum price"
            className="input text-xs px-3 py-2"
          />
        </div>
        <button onClick={applyPrice} className="btn text-[10px] mt-2 px-4 py-2">Apply</button>
      </FilterGroup>

      {hasFilters && (
        <button onClick={clearAll} className="text-xs text-saif-dim hover:text-saif-accent transition-colors flex items-center gap-1">
          <X size={12} /> Clear all filters
        </button>
      )}
    </div>
  )

  return (
    <div className="animate-[pageIn_0.5s_ease] px-4 sm:px-6 lg:px-10 pt-10 pb-20">
      <div className="max-w-7xl mx-auto">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter text-saif-text">
            {q ? 'Search' : activeCategory?.name || (type === 'digital' ? 'Digital' : type === 'physical' ? 'Streetwear' : onSale ? 'Offers' : featured ? 'Featured' : bestseller ? 'Best Sellers' : 'Shop All')}
          </h1>
          {q && <p className="mt-2 text-sm text-saif-dim">Results for “{q}”</p>}
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 mb-8">
          <button
            onClick={() => setFiltersOpen(true)}
            className="lg:hidden btn text-[10px] px-4 py-2.5"
            aria-haspopup="dialog"
          >
            <SlidersHorizontal size={13} className="mr-1.5" /> Filters{hasFilters ? ' •' : ''}
          </button>
          <p className="text-xs text-saif-dim hidden sm:block" aria-live="polite">
            {loading ? 'Loading…' : `${products.length} product${products.length === 1 ? '' : 's'}`}
          </p>
          <div className="flex items-center gap-2">
            <label htmlFor="sort" className="text-xs text-saif-dim uppercase tracking-wider hidden sm:block">Sort</label>
            <select
              id="sort"
              value={sort}
              onChange={e => setParam('sort', e.target.value === 'newest' ? null : e.target.value)}
              className="bg-[#0A0A0A] border border-saif-border text-saif-text text-xs px-3 py-2.5 focus:outline-none focus:border-saif-text cursor-pointer"
            >
              {SORT_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
        </div>

        <div className="flex gap-10">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block w-56 flex-shrink-0 sticky top-24 self-start" aria-label="Filters">
            {filterPanel}
          </aside>

          {/* Grid */}
          <div className="flex-1 min-w-0">
            {loading ? <ProductGridSkeleton count={8} /> : products.length === 0 ? (
              <EmptyState title="No products found" description="Try adjusting your filters or search query." />
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-5">
                {products.map(p => <ProductCard key={p.id} product={p} />)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile filter drawer */}
      {filtersOpen && (
        <div className="fixed inset-0 z-[120] lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <button aria-label="Close filters" className="absolute inset-0 bg-black/70" onClick={() => setFiltersOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-xs bg-[#0A0A0A] border-l border-saif-border p-6 overflow-y-auto animate-[fadeUp_0.2s_ease]">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-sm font-bold uppercase tracking-widest text-saif-text">Filters</h2>
              <button onClick={() => setFiltersOpen(false)} className="text-saif-dim hover:text-saif-text" aria-label="Close">
                <X size={20} />
              </button>
            </div>
            {filterPanel}
            <button onClick={() => setFiltersOpen(false)} className="btn btn-primary w-full mt-8 text-xs">
              Show Results
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-saif-text mb-3">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`px-3 py-1.5 text-xs border transition-colors ${
        active
          ? 'border-saif-text bg-saif-text text-black font-semibold'
          : 'border-saif-border text-saif-dim hover:border-saif-text hover:text-saif-text'
      }`}
    >
      {children}
    </button>
  )
}
