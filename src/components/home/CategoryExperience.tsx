import { Link } from 'react-router-dom'
import { ArrowUpRight, Package, Zap } from 'lucide-react'
import Reveal from '@/components/motion/Reveal'
import SectionHeader from '@/components/SectionHeader'
import { useI18n } from '@/i18n'
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
 * Editorial category moment: two large panels — Streetwear vs Digital —
 * followed by the live category index. All counts are real database data.
 */
export default function CategoryExperience({ categories, products, title, description, config }: CategoryExperienceProps) {
  const { t, lang } = useI18n()
  const cfg = (config ?? {}) as CategoriesConfig
  const physical = products.filter(p => p.product_type === 'physical')
  const digital = products.filter(p => p.product_type === 'digital')
  const physicalImage = physical.find(p => p.thumbnail)?.thumbnail
  const digitalImage = digital.find(p => p.thumbnail)?.thumbnail

  const countByCategory = categories.reduce<Record<string, number>>((map, cat) => {
    map[cat.id] = products.filter(p => p.category_id === cat.id).length
    return map
  }, {})

  return (
    <section className="px-5 lg:px-10 py-24 md:py-32" aria-labelledby="categories-heading">
      <div className="max-w-7xl mx-auto">
        <SectionHeader
          index="02"
          eyebrow={t('categories.eyebrow')}
          title={title ?? t('categories.title')}
          description={description ?? t('categories.description')}
        />

        {/* Split panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
          <Panel
            to="/products?type=physical"
            image={physicalImage}
            icon={Package}
            label={configText(cfg, 'streetwear_label', lang) ?? t('categories.streetwear')}
            ctaText={configText(cfg, 'cta_text', lang) ?? t('categories.cta')}
            count={physical.length}
            note="Shipped across Egypt"
            delay={0}
          />
          <Panel
            to="/products?type=digital"
            image={digitalImage}
            icon={Zap}
            label={configText(cfg, 'digital_label', lang) ?? t('categories.digital')}
            ctaText={configText(cfg, 'cta_text', lang) ?? t('categories.cta')}
            count={digital.length}
            note="No shipping — delivered after verification"
            accent
            delay={140}
          />
        </div>

        {/* Category index */}
        {categories.length > 0 && (
          <Reveal variant="fade" delay={200} duration={900} className="mt-5">
            <div
              className="flex gap-2.5 overflow-x-auto pb-2 -mx-5 px-5 lg:mx-0 lg:px-0 [scrollbar-width:thin]"
              role="list"
              aria-label={t('a11y.productCategories')}
            >
              {categories.map(cat => (
                <Link
                  key={cat.id}
                  to={`/products?category=${cat.id}`}
                  role="listitem"
                  className="group flex items-center gap-3 min-h-[44px] px-5 py-3 border border-saif-border rounded-full text-sm text-saif-dim hover:text-saif-text hover:border-saif-text transition-colors duration-300 flex-shrink-0"
                >
                  {cat.name}
                  <span className="text-[11px] tabular-nums text-saif-faint group-hover:text-saif-accent transition-colors" aria-label={`${countByCategory[cat.id] ?? 0} products`}>
                    {countByCategory[cat.id] ?? 0}
                  </span>
                </Link>
              ))}
            </div>
          </Reveal>
        )}
      </div>
    </section>
  )
}

function Panel({
  to,
  image,
  icon: Icon,
  label,
  count,
  note,
  accent,
  delay,
  ctaText,
}: {
  to: string
  image?: string | null
  icon: typeof Package
  label: string
  count: number
  note: string
  accent?: boolean
  delay: number
  ctaText: string
}) {
  const { t } = useI18n()
  return (
    <Reveal variant="mask" delay={delay} duration={1100}>
      <Link
        to={to}
        className="group relative block aspect-[4/3] md:aspect-auto md:h-[30rem] lg:h-[34rem] overflow-hidden rounded-sm border border-saif-border"
      >
        {image ? (
          <img
            src={image}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-55 group-hover:scale-[1.04] transition-all duration-[1200ms] ease-saif"
          />
        ) : (
          <div className="absolute inset-0 bg-saif-panel" />
        )}
        <div
          className={`absolute inset-0 transition-opacity duration-700 ${
            accent
              ? 'bg-gradient-to-t from-[#1a0508] via-black/60 to-black/30 group-hover:from-[#23070c]'
              : 'bg-gradient-to-t from-black via-black/50 to-black/20'
          }`}
          aria-hidden="true"
        />

        {/* Top-right arrow */}
        <span className="absolute top-5 right-5 w-11 h-11 rounded-full border border-saif-text/25 backdrop-blur-sm flex items-center justify-center text-saif-text group-hover:bg-saif-accent group-hover:border-saif-accent group-hover:text-black group-hover:-rotate-45 transition-all duration-500 ease-saif">
          <ArrowUpRight size={17} aria-hidden="true" />
        </span>

        {/* Label block */}
        <div className="absolute bottom-0 inset-x-0 p-6 md:p-9">
          <p className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-saif-accent">
            <Icon size={13} aria-hidden="true" />
            {t.plural('categories.products', count)}
          </p>
          <h3 className="mt-3 text-[clamp(34px,5vw,64px)] font-black tracking-tighter leading-[0.95] text-saif-text">
            {label}
          </h3>
          <p className="mt-3 text-sm text-saif-dim">{note}</p>
          <span className="link-underline inline-flex items-center gap-2 mt-5">
            {ctaText}
            <span className="w-0 group-hover:w-4 h-px bg-saif-accent transition-all duration-500" aria-hidden="true" />
          </span>
        </div>
      </Link>
    </Reveal>
  )
}
