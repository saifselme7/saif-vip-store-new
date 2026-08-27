import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { useProducts } from '@/hooks/useProducts'
import { useDebouncedValue } from '@/hooks/useDebounce'
import { usePageMeta } from '@/hooks/usePageMeta'
import ProductCard from '@/components/ProductCard'
import EmptyState from '@/components/EmptyState'
import { ProductGridSkeleton } from '@/components/ui/Skeleton'

const RECENT_KEY = 'saif-recent-searches'

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') || ''
  const [input, setInput] = useState(query)
  const debouncedInput = useDebouncedValue(input, 350)
  const [recent, setRecent] = useState<string[]>([])

  // Live-search as you type (debounced), URL stays the committed query.
  const activeQuery = debouncedInput.trim() || query

  usePageMeta(query ? `Search: ${query}` : 'Search', 'Search the SAIF STORE catalog.')

  const { products, loading } = useProducts({ search: activeQuery || undefined })

  useEffect(() => { setInput(query) }, [query])

  useEffect(() => {
    try { setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')) } catch { /* ignore */ }
  }, [])

  function commit(q: string) {
    const term = q.trim()
    if (!term) return
    setSearchParams({ q: term })
    try {
      const prev: string[] = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
      localStorage.setItem(RECENT_KEY, JSON.stringify([term, ...prev.filter(x => x !== term)].slice(0, 6)))
      setRecent([term, ...prev.filter(x => x !== term)].slice(0, 6))
    } catch { /* ignore */ }
  }

  return (
    <div className="animate-[pageIn_0.5s_ease] px-4 sm:px-6 lg:px-10 pt-10 pb-20">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-saif-text mb-8">Search</h1>

        <form onSubmit={e => { e.preventDefault(); commit(input) }} className="max-w-xl mb-6 relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-saif-dim pointer-events-none" />
          <input
            type="search"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Search products, descriptions, tags…"
            aria-label="Search products"
            className="w-full bg-transparent border border-saif-border text-saif-text text-sm pl-11 pr-10 py-3.5 focus:outline-none focus:border-saif-text placeholder:text-saif-dim/40"
          />
          {input && (
            <button
              type="button"
              onClick={() => { setInput(''); setSearchParams({}) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-saif-dim hover:text-saif-text"
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </form>

        {recent.length > 0 && !activeQuery && (
          <div className="mb-8 flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-widest text-saif-dim">Recent:</span>
            {recent.map(r => (
              <button key={r} onClick={() => commit(r)} className="text-xs border border-saif-border px-3 py-1.5 text-saif-dim hover:text-saif-text hover:border-saif-text transition-colors">
                {r}
              </button>
            ))}
          </div>
        )}

        {activeQuery && (
          <p className="text-sm text-saif-dim mb-6" aria-live="polite">
            {loading ? 'Searching…' : `${products.length} result${products.length === 1 ? '' : 's'} for “${activeQuery}”`}
          </p>
        )}

        {!activeQuery && !loading ? (
          <EmptyState title="Search the catalog" description="Try a product name, category or tag like “hoodie” or “tiktok”." />
        ) : loading ? (
          <ProductGridSkeleton count={8} />
        ) : products.length === 0 ? (
          <EmptyState title="No results" description="Try a different term or browse the full shop." />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-6">
            {products.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </div>
    </div>
  )
}
