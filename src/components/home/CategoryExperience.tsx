import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import Reveal from '@/components/motion/Reveal'
import SectionHeader from '@/components/SectionHeader'
import { useI18n } from '@/i18n'
import { isStorefrontCategory } from '@/lib/constants'
import { localizeCategory } from '@/lib/bilingual'
import { configText, type CategoriesConfig } from '@/hooks/useHomepageSections'
import type { Category, Product } from '@/types'

interface CategoryExperienceProps {
  categories: Category[]
  products: Product[]
  title?: string | null
  description?: string | null
  config?: Record<string, unknown> | null
}

/**
 * Shop-by-category as an editorial moment: a large campaign tile, two
 * supporting tiles, then a hairline index of the remaining categories —
 * all driven by live database categories and real product counts.
 * Imagery is shown at its natural colours.
 */
export default function CategoryExperience({ categories, products, title, description, config }: CategoryExperienceProps) {
  const { t, lang } = useI18n()
  const cfg = (config ?? {}) as CategoriesConfig

  const countByCategory = categories.reduce<Record<string, number>>((map, cat) => {
    map[cat.id] = products.filter(p => p.category_id === cat.id).length
    return map
  }, {})

  const imageFor = (cat: Category) =>
    cat.image || products.find(p => p.category_id === cat.id && p.thumbnail)?.thumbnail || null

  // Clothing categories only, and only ones with pieces to show.
  const visible = categories.filter(
    cat => isStorefrontCategory(cat) && (countByCategory[cat.id] ?? 0) > 0 && imageFor(cat),
  )
  const tiles = visible.slice(0, 3)
  const rest = visible.slice(3)

  return (
    <section className="px-5 lg:px-10 py-24 md:py-32" aria-labelledby="categories-heading">
      <div className="max-w-7xl mx-auto">
        <SectionHeader
          index="02"
          eyebrow={t('categories.eyebrow')}
          title={title ?? t('categories.title')}
          description={description ?? t('categories.description')}
          viewAllTo="/products"
          viewAllLabel={t('categories.viewCollection')}
        />

        {tiles.length === 0 ? (
          <p className="border border-dashed border-saif-border rounded-sm py-10 text-center text-sm text-saif-dim">
            {t('home.productsWillAppear')}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-x-5 gap-y-10 md:gap-y-5">
            {/* Lead tile */}
            <CategoryTile
              category={tiles[0]}
              count={countByCategory[tiles[0].id] ?? 0}
              image={imageFor(tiles[0])}
              ctaText={configText(cfg, 'cta_text', lang) ?? t('categories.cta')}
              className="md:col-span-7 md:row-span-2 md:h-[42rem]"
              aspect="aspect-[4/3] md:aspect-auto md:h-full"
              big
              delay={0}
            />
            {tiles.slice(1).map((cat, i) => (
              <CategoryTile
                key={cat.id}
                category={cat}
                count={countByCategory[cat.id] ?? 0}
                image={imageFor(cat)}
                ctaText={configText(cfg, 'cta_text', lang) ?? t('categories.cta')}
                className="md:col-span-5 md:h-[20.375rem]"
                aspect="aspect-[16/10] md:aspect-auto md:h-full"
                delay={140 + i * 120}
              />
            ))}
          </div>
        )}

        {/* Remaining categories — editorial index rows */}
        {rest.length > 0 && (
          <Reveal variant="fade" delay={200} duration={900} className="mt-10 md:mt-12">
            <ul className="border-t border-saif-border">
              {rest.map(cat => (
                <li key={cat.id}>
                  <Link
                    to={`/products?category=${cat.id}`}
                    className="group flex items-center justify-between gap-6 py-5 border-b border-saif-border transition-colors duration-500 hover:bg-saif-surface/60"
                  >
                    <span className="flex items-baseline gap-4 min-w-0">
                      <span className="text-lg md:text-2xl font-bold tracking-tight text-saif-text group-hover:text-saif-accent transition-colors duration-300 truncate">
                        {localizeCategory(cat, lang).name}
                      </span>
                      <span className="text-[11px] tabular-nums text-saif-faint">
                        {t.plural('categories.products', countByCategory[cat.id] ?? 0)}
                      </span>
                    </span>
                    <ArrowUpRight
                      size={18}
                      className="text-saif-faint group-hover:text-saif-accent group-hover:-translate-y-0.5 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-all duration-500 ease-saif flex-shrink-0"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </Reveal>
        )}
      </div>
    </section>
  )
}

function CategoryTile({
  category,
  count,
  image,
  ctaText,
  className,
  aspect,
  big,
  delay,
}: {
  category: Category
  count: number
  image: string | null
  ctaText: string
  className?: string
  aspect: string
  big?: boolean
  delay: number
}) {
  const { t, lang } = useI18n()
  return (
    <Reveal variant="mask" delay={delay} duration={1100} className={className}>
      <Link to={`/products?category=${category.id}`} className="group flex flex-col h-full" aria-label={localizeCategory(category, lang).name}>
        <div className={`relative overflow-hidden bg-saif-panel flex-1 min-h-0 ${aspect}`}>
          <img
            src={image || ''}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover scale-[1.01] group-hover:scale-[1.06] transition-transform duration-[1300ms] ease-saif"
          />
        </div>
        <div className="flex items-end justify-between gap-4 pt-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-saif-faint">
              {t.plural('categories.products', count)}
            </p>
            <h3
              className={`mt-1 font-display text-saif-text leading-none ${
                big ? 'text-[clamp(30px,4vw,54px)]' : 'text-[clamp(22px,3vw,34px)]'
              }`}
            >
              {localizeCategory(category, lang).name}
            </h3>
          </div>
          <span className="link-underline flex-shrink-0 pb-1">{ctaText}</span>
        </div>
      </Link>
    </Reveal>
  )
}
