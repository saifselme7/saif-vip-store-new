import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/context/AppContext'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useI18n } from '@/i18n'
import {
  useHomepageSections,
  sectionText,
  isLegacyDigitalText,
  RETIRED_SECTION_KEYS,
  type RailConfig,
  type SpotlightConfig,
} from '@/hooks/useHomepageSections'
import ProductCard from '@/components/ProductCard'
import Footer from '@/components/Footer'
import Reveal from '@/components/motion/Reveal'
import FashionIntro from '@/components/home/FashionIntro'
import HeroSection from '@/components/home/HeroSection'
import MarqueeBand from '@/components/home/MarqueeBand'
import BrandStatement from '@/components/home/BrandStatement'
import CategoryExperience from '@/components/home/CategoryExperience'
import EditorialMoment from '@/components/home/EditorialMoment'
import ReviewsStrip from '@/components/home/ReviewsStrip'
import HowItWorks from '@/components/home/HowItWorks'
import FinalCTA from '@/components/home/FinalCTA'
import { ProductGridSkeleton } from '@/components/ui/Skeletons'
import { Link } from 'react-router-dom'
import type { Category, HomepageSection, Product, Review } from '@/types'

/**
 * Homepage themes — the editorial rhythm of the storefront: black campaign
 * sections alternating with warm off-white catalogue sections. Any section
 * key not listed renders on the default black theme.
 */
const PAPER_SECTIONS = new Set(['rail_new', 'rail_bestsellers', 'brand', 'rail_featured', 'how_it_works'])

export default function HomePage() {
  const { settings } = useApp()
  const { t, lang } = useI18n()
  const rawDesc =
    lang === 'ar' && settings?.seo_description ? settings.seo_description : settings?.store_description
  const pageDescription =
    rawDesc && !isLegacyDigitalText(rawDesc) ? rawDesc : t('meta.description')

  usePageMeta({
    title: settings?.seo_title || 'SAIF STORE — Wear Your Statement',
    description: pageDescription,
    image: settings?.og_image ?? undefined,
  })

  const { sections } = useHomepageSections()
  const { products, loading } = useHomeProducts()
  const { reviews } = useHomeReviews()
  const { categories } = useHomeCategories()

  // Rail product sources (computed once from live data)
  const rails = useMemo(() => {
    const manual = (ids: string[] | undefined) =>
      ids ? ids.map(id => products.find(p => p.id === id)).filter((p): p is Product => !!p) : []
    return {
      auto: (rail: HomepageSection) => {
        const cfg = (rail.config ?? {}) as RailConfig
        if (cfg.source === 'manual') return manual(cfg.product_ids)
        // The legacy digital source has no pieces in the clothing catalogue.
        if (cfg.source === 'digital') return []
        const list =
          cfg.source === 'offers'
            ? products.filter(p => p.compare_at_price && p.compare_at_price > p.price)
            : cfg.source === 'bestsellers'
              ? products.filter(p => p.bestseller)
              : cfg.source === 'newest'
                ? products
                : products.filter(p => p.featured)
        return list.slice(0, cfg.limit ?? 8)
      },
    }
  }, [products])

  const spotlight = useMemo(() => {
    const section = sections.find(s => s.section_key === 'spotlight')
    const cfg = ((section?.config ?? {}) as SpotlightConfig)
    if (cfg.product_id) {
      const found = products.find(p => p.id === cfg.product_id)
      if (found) return found
    }
    return (
      products.find(p => p.featured) ??
      products.find(p => p.bestseller) ??
      products.find(p => p.thumbnail) ??
      products[0] ??
      null
    )
  }, [sections, products])

  const heroImage = useMemo(
    () => spotlight?.thumbnail || spotlight?.images?.[0] || null,
    [spotlight],
  )

  const renderable = sections.filter(
    s => s.is_enabled && s.section_key !== 'announcement' && !RETIRED_SECTION_KEYS.has(s.section_key),
  )

  return (
    <div className="animate-[pageIn_0.6s_ease]">
      <FashionIntro />

      {renderable.map(section => {
        const { title, subtitle } = sectionText(section, lang)
        const themed = (node: React.ReactNode) =>
          PAPER_SECTIONS.has(section.section_key) ? (
            <div key={section.id} className="theme-paper">
              {node}
            </div>
          ) : (
            node
          )

        switch (section.section_key) {
          case 'hero': {
            const rawSubtitle =
              lang === 'ar' && settings?.hero_subtitle_ar
                ? settings.hero_subtitle_ar
                : (settings?.hero_subtitle || t('hero.subtitle'))
            const sanitizedSubtitle =
              rawSubtitle && !isLegacyDigitalText(rawSubtitle) ? rawSubtitle : t('hero.subtitle')

            return (
              <div key={section.id}>
                <HeroSection
                  heroTitle={
                    lang === 'ar' && settings?.hero_title_ar
                      ? settings.hero_title_ar
                      : (settings?.hero_title || 'SAIF STORE')
                  }
                  heroSubtitle={sanitizedSubtitle}
                  heroImage={heroImage}
                  config={section.config}
                />
                {/* Trust band — the hero's lower boundary (always after hero) */}
                <MarqueeBand />
              </div>
            )
          }
          case 'brand':
            return themed(
              <BrandStatement
                key={section.id}
                heading={title}
                description={subtitle}
                config={section.config as Record<string, unknown>}
              />,
            )
          case 'categories':
            return (
              <CategoryExperience
                key={section.id}
                categories={categories}
                products={products}
                title={title}
                description={subtitle}
                config={section.config as Record<string, unknown>}
              />
            )
          case 'spotlight':
            return <EditorialMoment key={section.id} product={spotlight} config={section.config} />
          case 'rail_featured':
          case 'rail_new':
          case 'rail_offers':
          case 'rail_bestsellers':
            return themed(
              <ProductRailSection
                key={section.id}
                section={section}
                title={title}
                subtitle={subtitle}
                products={rails.auto(section)}
                loading={loading}
              />,
            )
          case 'reviews':
            return <ReviewsStrip key={section.id} reviews={reviews} title={title} description={subtitle} config={section.config} />
          case 'how_it_works':
            return themed(
              <HowItWorks key={section.id} title={title} description={subtitle} config={section.config} />,
            )
          case 'final_cta':
            return <FinalCTA key={section.id} heading={title} description={subtitle} config={section.config} />
          default:
            return null
        }
      })}

      <Footer />
    </div>
  )
}

/** Product rail section (featured / new / offers / bestsellers). */
function ProductRailSection({
  section,
  title,
  subtitle,
  products,
  loading,
}: {
  section: HomepageSection
  title: string | null
  subtitle: string | null
  products: Product[]
  loading: boolean
}) {
  const { t, lang } = useI18n()
  const railKey = section.section_key.replace('rail_', '')
  const rail = t(`rails.${railKey}.eyebrow`)
  const cfg = (section.config ?? {}) as RailConfig
  const isOffers = section.section_key === 'rail_offers'

  return (
    <section
      className="px-5 lg:px-10 py-24 md:py-32 border-t border-saif-border"
      aria-labelledby={`${section.section_key}-heading`}
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4 mb-10 md:mb-14">
          <div className="min-w-0">
            <Reveal variant="fade" duration={700}>
              <p className="eyebrow">
                <span className="text-saif-accent tabular-nums">{String(section.position).padStart(2, '0')}</span>
                <span className="w-3 h-px bg-saif-border" aria-hidden="true" />
                {rail}
              </p>
            </Reveal>
            <Reveal variant="up" delay={90}>
              <h2
                id={`${section.section_key}-heading`}
                className="mt-4 text-[clamp(28px,4.5vw,52px)] font-display text-saif-text leading-[1.02] text-balance"
              >
                {title ?? t(`rails.${railKey}.title`)}
              </h2>
            </Reveal>
            {subtitle && (
              <Reveal variant="fade" delay={200} duration={900}>
                <p className="mt-4 text-sm md:text-[15px] text-saif-dim leading-relaxed max-w-lg text-balance">
                  {subtitle}
                </p>
              </Reveal>
            )}
          </div>
          {cfg.view_all && (
            <Reveal variant="fade" delay={280} className="pb-2 flex-shrink-0">
              <Link to={cfg.view_all} className="link-underline inline-flex items-center gap-2 py-2 -m-2 px-2">
                {t('common.viewAll')}
                <span className="text-saif-accent" aria-hidden="true">→</span>
              </Link>
            </Reveal>
          )}
        </div>

        {loading ? (
          <ProductGridSkeleton />
        ) : products.length === 0 ? (
          <p
            className={cn2(
              'text-sm text-saif-dim py-8 text-center',
              isOffers ? '' : 'border border-dashed border-saif-border rounded-sm',
            )}
          >
            {t('home.productsWillAppear')}
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-10 md:gap-x-5 md:gap-y-14">
            {products.map((p, i) => (
              <Reveal key={p.id} variant="up" delay={Math.min(i, 7) * 90} duration={850} threshold={0.08}>
                <ProductCard product={p} priorityImage={i < 4} />
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

// Small local helpers to avoid extra imports in this file's map callbacks
function cn2(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

/**
 * Single query for all homepage product rails — clothing pieces only. The
 * storefront presents the fashion catalogue; every other surface (shop,
 * search, orders, admin) still serves the full database.
 */
function useHomeProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('products')
      .select('*, categories(*), variants:product_variants(*)')
      .eq('status', 'active')
      .eq('product_type', 'physical')
      .order('created_at', { ascending: false })
      .limit(40)
      .then(({ data }) => {
        if (cancelled) return
        setProducts((data || []) as Product[])
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { products, loading }
}

function useHomeReviews() {
  const [reviews, setReviews] = useState<(Review & { products?: { name: string; name_ar?: string | null } | null })[]>([])

  useEffect(() => {
    let cancelled = false
    supabase
      .from('reviews')
      .select('*, profiles(full_name, avatar_url), products(name, name_ar)')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data }) => {
        if (cancelled) return
        setReviews((data || []) as unknown as (Review & { products?: { name: string; name_ar?: string | null } | null })[])
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { reviews }
}

function useHomeCategories() {
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    let cancelled = false
    supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        if (cancelled) return
        setCategories((data || []) as Category[])
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { categories }
}
