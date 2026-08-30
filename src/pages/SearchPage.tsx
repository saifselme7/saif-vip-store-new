import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { useProducts } from '@/hooks/useProducts'
import { useDebounce } from '@/hooks/useDebounce'
import { usePageMeta } from '@/hooks/usePageMeta'
import ProductCard from '@/components/ProductCard'
import Footer from '@/components/Footer'
import EmptyState from '@/components/EmptyState'
import { ProductGridSkeleton } from '@/components/ui/Skeletons'
import { useI18n } from '@/i18n'

export default function SearchPage() {
  const { t } = useI18n()
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') || ''
  const [input, setInput] = useState(query)
  const [submitted, setSubmitted] = useState(query)
  const debouncedInput = useDebounce(input, 450)
  const { products, loading } = useProducts({ search: submitted || undefined })
  usePageMeta({ title: submitted ? `${t('search.title')}: ${submitted}` : `${t('search.title')} — SAIF STORE`, description: t('meta.description') })

  // Live-update results once typing stops (debounced)
  useEffect(() => {
    const term = debouncedInput.trim()
    if (term && term !== submitted) {
      setSubmitted(term)
      setSearchParams(term ? { q: term } : {}, { replace: true })
    }
  }, [debouncedInput, submitted, setSearchParams])

  useEffect(() => {
    setInput(query)
    setSubmitted(query)
  }, [query])

  return (
    <div className="animate-[pageIn_0.6s_ease] pt-24 md:pt-28 px-5 lg:px-10 pb-20">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-[clamp(34px,6vw,72px)] font-display text-saif-text mb-8">{t('search.title')}</h1>

        <form
          onSubmit={e => {
            e.preventDefault()
            const term = input.trim()
            setSubmitted(term)
            setSearchParams(term ? { q: term } : {}, { replace: true })
          }}
          className="max-w-xl mb-10"
          role="search"
        >
          <label htmlFor="search-input" className="sr-only">
            Search products
          </label>
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-saif-dim" />
            <input
              id="search-input"
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={t('search.placeholder')}
              autoComplete="off"
              className="w-full bg-transparent border border-saif-border text-saif-text text-sm pl-11 pr-11 py-3.5 focus:outline-none focus:border-saif-text placeholder:text-saif-faint rounded-sm"
            />
            {input && (
              <button
                type="button"
                onClick={() => {
                  setInput('')
                  setSubmitted('')
                  setSearchParams({}, { replace: true })
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-saif-dim hover:text-saif-text"
                aria-label={t('a11y.clearSearch')}
              >
                <X size={16} />
              </button>
            )}
          </div>
        </form>

        {submitted && (
          <p className="text-sm text-saif-dim mb-6" aria-live="polite">
            {loading ? 'Searching…' : `${products.length} ${products.length === 1 ? 'result' : 'results'} for “${submitted}”`}
          </p>
        )}

        {loading && submitted ? (
          <ProductGridSkeleton />
        ) : !submitted ? (
          <EmptyState
            icon={Search}
            title={t('search.noQueryTitle')}
            description="Search across product names and descriptions."
          />
        ) : products.length === 0 ? (
          <EmptyState
            icon={Search}
            title={`No results for “${submitted}”`}
            description="Try a different search term or browse the full collection."
          />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {products.map(p => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}
