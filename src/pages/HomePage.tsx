import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/context/AppContext'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useI18n } from '@/i18n'
import { useHomepageSections, sectionText, configText, type RailConfig, type SpotlightConfig } from '@/hooks/useHomepageSections'
import ProductCard from '@/components/ProductCard'
import Footer from '@/components/Footer'
import Reveal from '@/components/motion/Reveal'
import HeroSection from '@/components/home/HeroSection'
import MarqueeBand from '@/components/home/MarqueeBand'
import BrandStatement from '@/components/home/BrandStatement'
import CategoryExperience from '@/components/home/CategoryExperience'
import EditorialMoment from '@/components/home/EditorialMoment'
import ReviewsStrip from '@/components/home/ReviewsStrip'
import HowItWorks from '@/components/home/HowItWorks'
import FinalCTA from '@/components/home/FinalCTA'
import { ProductGridSkeleton } from '@/components/ui/Skeletons'
import { Zap, Timer, Package } from 'lucide-react'
import type { Category, HomepageSection, Product, Review } from '@/types'

export default function HomePage() {
  const { settings } = useApp()
  const { t, lang, formatPrice } = useI18n()
  usePageMeta({
    title: settings?.seo_title || 'SAIF STORE — Premium Streetwear & Digital Products',
    description:
      (lang === 'ar' && settings?.seo_description ? settings.seo_description : settings?.store_description) ||
      t('meta.description'),
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
        const list =
          cfg.source === 'offers'
            ? products.filter(p => p.compare_at_price && p.compare_at_price > p.price)
            : cfg.source === 'digital'
              ? products.filter(p => p.product_type === 'digital')
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
    return products.find(p => p.featured) ?? products.find(p => p.bestseller) ?? products[0] ?? null
  }, [sections, products])

  const heroImage = useMemo(
    () => spotlight?.thumbnail || spotlight?.images?.[0] || null,
    [spotlight],
  )

  return (
    <div className="animate-[pageIn_0.6s_ease]">
      {/* Trust band — the hero's bottom boundary (always rendered after hero) */}
      {sections.find(s => s.section_key === 'hero' && s.is_enabled) && <MarqueeBand />}

      {sections
        .filter(s => s.is_enabled && s.section_key !== 'announcement')
        .map(section => {
          const { title, subtitle } = sectionText(section, lang)
          switch (section.section_key) {
            case 'hero':
              return (
                <HeroSection
                  key={section.id}
                  heroTitle={lang === 'ar' && settings?.hero_title_ar ? settings.hero_title_ar : (settings?.hero_title || 'SAIF STORE')}
                  heroSubtitle={lang === 'ar' && settings?.hero_subtitle_ar ? settings.hero_subtitle_ar : (settings?.hero_subtitle || t('hero.subtitle'))}
                  heroImage={heroImage}
                  config={section.config}
                />
              )
            case 'brand':
              return (
                <BrandStatement
                  key={section.id}
                  heading={title}
                  description={subtitle}
                  config={section.config as Record<string, unknown>}
                />
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
            case 'rail_digital':
            case 'rail_bestsellers':
              return (
                <ProductRailSection
                  key={section.id}
                  section={section}
                  title={title}
                  subtitle={subtitle}
                  products={rails.auto(section)}
                  loading={loading}
                />
              )
            case 'reviews':
              return <ReviewsStrip key={section.id} reviews={reviews} title={title} description={subtitle} config={section.config} />
            case 'how_it_works':
              return <HowItWorks key={section.id} title={title} description={subtitle} config={section.config} />
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

/** Product rail section (featured / new / offers / digital / bestsellers). */
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
  const { t } = useI18n()
  const railKey = section.section_key.replace('rail_', '')
  const rail = t(`rails.${railKey}.eyebrow`)
  const cfg = (section.config ?? {}) as RailConfig
  const isDigital = section.section_key === 'rail_digital'
  const isOffers = section.section_key === 'rail_offers'

  return (
    <section
      className={cn2(
        'px-5 lg:px-10 py-24 md:py-32',
        section.section_key !== 'rail_featured' && 'border-t border-saif-border',
        isDigital && 'relative border-y border-saif-border bg-saif-panel overflow-hidden',
      )}
      aria-labelledby={`${section.section_key}-heading`}
    >
      {isDigital && (
        <>
          <span className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-saif-accent/60 to-transparent" aria-hidden="true" />
          <span
            className="absolute -end-24 top-1/2 -translate-y-1/2 text-outline-faint text-[clamp(120px,20vw,300px)] font-black leading-none tracking-tighter select-none pointer-events-none hidden lg:block"
            aria-hidden="true"
          >
            {lang2() === 'ar' ? 'رقمي' : 'DIGI'}
          </span>
        </>
      )}
      <div className={cn2('max-w-7xl mx-auto', isDigital && 'relative z-10')}>
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
                className="mt-4 text-[clamp(26px,4vw,46px)] font-bold leading-[1.02] tracking-tight text-saif-text text-balance"
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
              <Link2 to={cfg.view_all} className="link-underline inline-flex items-center gap-2 py-2 -m-2 px-2">
                {t('common.viewAll')}
                <span className="text-saif-accent" aria-hidden="true">→</span>
              </Link2>
            </Reveal>
          )}
        </div>

        {isDigital && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-12">
            {[
              { icon: Zap, title: t('rails.digital.noShipping'), text: t('rails.digital.noShippingText') },
              { icon: Package, title: t('rails.digital.clearWindows'), text: t('rails.digital.clearWindowsText') },
              { icon: Timer, title: t('rails.digital.tracked'), text: t('rails.digital.trackedText') },
            ].map((item, i) => (
              <Reveal key={item.title} variant="fade" delay={i * 130} duration={900} className="flex gap-4 items-start">
                <span className="w-10 h-10 rounded-full border border-saif-accent/40 flex items-center justify-center flex-shrink-0">
                  <item.icon size={16} className="text-saif-accent" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-saif-text">{item.title}</h3>
                  <p className="mt-1 text-sm text-saif-dim leading-relaxed">{item.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        )}

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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-10 md:gap-x-5 md:gap-y-14">
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
import { Link as Link2 } from 'react-router-dom'
function cn2(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}
function lang2(): string {
  return document.documentElement.lang || 'en'
}

/** Single query for all homepage product rails. */
function useHomeProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('products')
      .select('*, categories(*), variants:product_variants(*)')
      .eq('status', 'active')
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
