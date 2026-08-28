import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/context/AppContext'
import { usePageMeta } from '@/hooks/usePageMeta'
import ProductCard from '@/components/ProductCard'
import Footer from '@/components/Footer'
import SectionHeader from '@/components/SectionHeader'
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
import type { Category, Product, Review } from '@/types'

export default function HomePage() {
  const { settings } = useApp()
  usePageMeta({
    title: 'SAIF STORE — Premium Streetwear & Digital Products',
    description:
      settings?.store_description ||
      'Premium streetwear and digital products, curated in Egypt. Manual payment via InstaPay & Vodafone Cash.',
  })

  const { products, loading } = useHomeProducts()
  const { reviews } = useHomeReviews()
  const { categories } = useHomeCategories()

  const featured = useMemo(() => products.filter(p => p.featured).slice(0, 8), [products])
  const newArrivals = useMemo(() => products.slice(0, 8), [products])
  const bestSellers = useMemo(() => products.filter(p => p.bestseller).slice(0, 8), [products])
  const digital = useMemo(() => products.filter(p => p.product_type === 'digital').slice(0, 4), [products])
  const onSale = useMemo(
    () => products.filter(p => p.compare_at_price && p.compare_at_price > p.price).slice(0, 4),
    [products],
  )
  const spotlight = useMemo(
    () => featured[0] ?? bestSellers[0] ?? products[0] ?? null,
    [featured, bestSellers, products],
  )
  const heroImage = useMemo(
    () => spotlight?.thumbnail || spotlight?.images?.[0] || null,
    [spotlight],
  )

  return (
    <div className="animate-[pageIn_0.6s_ease]">
      {/* ===================== HERO ===================== */}
      <HeroSection
        heroTitle={settings?.hero_title || 'SAIF STORE'}
        heroSubtitle={
          settings?.hero_subtitle || 'Premium fashion and digital products. Carefully curated for the modern individual.'
        }
        heroImage={heroImage}
      />

      {/* ============ TRUST BAND (hero boundary) ============ */}
      <MarqueeBand />

      {/* ===================== 01 — BRAND ===================== */}
      <BrandStatement />

      {/* ================== 02 — CATEGORIES ================== */}
      <CategoryExperience categories={categories} products={products} />

      {/* ============= 03 — EDITORIAL SPOTLIGHT ============= */}
      <EditorialMoment product={spotlight} />

      {/* ================== 04 — FEATURED ==================== */}
      <section className="px-5 lg:px-10 py-24 md:py-32" aria-labelledby="featured-heading">
        <div className="max-w-7xl mx-auto">
          <SectionHeader
            index="04"
            eyebrow="Featured"
            title="Hand-picked from the current drop."
            description="The pieces we would put in your hands first."
            viewAllTo="/products?featured=true"
          />
          <ProductRail loading={loading} products={featured} priority />
        </div>
      </section>

      {/* ================ 05 — NEW ARRIVALS ================= */}
      <section className="px-5 lg:px-10 py-24 md:py-32 border-t border-saif-border" aria-labelledby="new-heading">
        <div className="max-w-7xl mx-auto">
          <SectionHeader
            index="05"
            eyebrow="New Arrivals"
            title="Fresh in."
            description="The latest additions to the catalogue."
            viewAllTo="/products?sort=newest"
          />
          <ProductRail loading={loading} products={newArrivals} />
        </div>
      </section>

      {/* ================== 06 — PRICE DROP ================= */}
      {onSale.length > 0 && (
        <section className="px-5 lg:px-10 py-24 md:py-32 border-t border-saif-border" aria-labelledby="offers-heading">
          <div className="max-w-7xl mx-auto">
            <div className="border border-saif-accent/25 bg-saif-accent/[0.03] rounded-sm p-6 md:p-10">
              <SectionHeader
                index="06"
                eyebrow="Price Drop"
                title="Marked down. While they last."
                description="Real discounts on current stock — no countdowns, no games. When it's gone, it's gone."
                viewAllTo="/products?onSale=true"
                viewAllLabel="All Offers"
              />
              <ProductRail loading={loading} products={onSale} />
            </div>
          </div>
        </section>
      )}

      {/* =============== 07 — DIGITAL ESSENTS =============== */}
      {digital.length > 0 && (
        <section
          className="relative py-24 md:py-32 border-y border-saif-border bg-saif-panel overflow-hidden"
          aria-labelledby="digital-heading"
        >
          <span
            className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-saif-accent/60 to-transparent"
            aria-hidden="true"
          />
          <span
            className="absolute -right-24 top-1/2 -translate-y-1/2 text-outline-faint text-[clamp(120px,20vw,300px)] font-black leading-none tracking-tighter select-none pointer-events-none hidden lg:block"
            aria-hidden="true"
          >
            DIGI
          </span>

          <div className="max-w-7xl mx-auto px-5 lg:px-10 relative z-10">
            <SectionHeader
              index="07"
              eyebrow="Digital Essentials"
              title="Delivered after verification."
              description="No shipping, no waiting on couriers — digital orders are fulfilled by our team once your payment is approved."
              viewAllTo="/products?type=digital"
              viewAllLabel="All Digital"
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-12">
              {[
                {
                  icon: Zap,
                  title: 'No shipping',
                  text: 'Nothing to ship — digital orders never pay delivery fees.',
                },
                {
                  icon: Package,
                  title: 'Clear delivery windows',
                  text: 'Each product lists its realistic delivery time, stated up front.',
                },
                {
                  icon: Timer,
                  title: 'Tracked in your account',
                  text: 'Follow every digital order from "under review" to delivered.',
                },
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

            <ProductRail loading={loading} products={digital} />
          </div>
        </section>
      )}

      {/* ================= 08 — MOST WANTED ================= */}
      {bestSellers.length > 0 && (
        <section className="px-5 lg:px-10 py-24 md:py-32" aria-labelledby="bestsellers-heading">
          <div className="max-w-7xl mx-auto">
            <SectionHeader
              index="08"
              eyebrow="Most Wanted"
              title="The pieces everyone comes back for."
              description="Best sellers, ranked by real orders."
              viewAllTo="/products?bestseller=true"
            />
            <ProductRail loading={loading} products={bestSellers} />
          </div>
        </section>
      )}

      {/* ================== 09 — REVIEWS ==================== */}
      <ReviewsStrip reviews={reviews} />

      {/* ================= 10 — HOW IT WORKS ================ */}
      <HowItWorks />

      {/* =================== 11 — FINAL CTA ================= */}
      <FinalCTA />

      <Footer />
    </div>
  )
}

/** Product grid with controlled staggered entrance. */
function ProductRail({
  products,
  loading,
  priority,
}: {
  products: Product[]
  loading: boolean
  priority?: boolean
}) {
  if (loading) return <ProductGridSkeleton />
  if (products.length === 0) {
    return (
      <p className="text-sm text-saif-dim py-8 text-center border border-dashed border-saif-border rounded-sm">
        Products will appear here once the catalogue is filled.
      </p>
    )
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-10 md:gap-x-5 md:gap-y-14">
      {products.map((p, i) => (
        <Reveal key={p.id} variant="up" delay={Math.min(i, 7) * 90} duration={850} threshold={0.08}>
          <ProductCard product={p} priorityImage={priority && i < 4} />
        </Reveal>
      ))}
    </div>
  )
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
  const [reviews, setReviews] = useState<(Review & { products?: { name: string } | null })[]>([])

  useEffect(() => {
    let cancelled = false
    supabase
      .from('reviews')
      .select('*, profiles(full_name, avatar_url), products(name)')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data }) => {
        if (cancelled) return
        setReviews((data || []) as unknown as (Review & { products?: { name: string } | null })[])
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
