import { Link } from 'react-router-dom'
import { ArrowRight, Zap } from 'lucide-react'
import Reveal from '@/components/motion/Reveal'
import { useParallax } from '@/hooks/useParallax'
import { useCart } from '@/context/CartContext'
import { useToast } from '@/context/ToastContext'
import { useApp } from '@/context/AppContext'
import { formatPrice, discountPercent } from '@/lib/utils'
import { useI18n } from '@/i18n'
import { configText, type SpotlightConfig } from '@/hooks/useHomepageSections'
import type { Product } from '@/types'

/**
 * The editorial product moment — one product presented like a campaign.
 * Uses the first featured (or best-selling) product from the database.
 */
export default function EditorialMoment({ product, config }: { product: Product | null; config?: unknown }) {
  const { t, lang } = useI18n()
  const cfg = (config ?? {}) as SpotlightConfig
  const { addItem, setIsOpen } = useCart()
  const { addToast } = useToast()
  const { settings } = useApp()
  const currency = settings?.currency ?? 'EGP'
  const parallaxRef = useParallax<HTMLDivElement>(-55)

  if (!product) return null

  const discount = discountPercent(product.price, product.compare_at_price)
  const defaultVariant = product.variants?.find(v => v.stock > 0) ?? null
  const needsSelection = product.product_type === 'physical' && (product.variants?.length ?? 0) > 0

  function handleAddToCart() {
    if (needsSelection && !defaultVariant) {
      window.location.assign(`/products/${product!.slug}`)
      return
    }
    const result = addItem(product!, defaultVariant, 1)
    if (result.ok) {
      addToast(`${product!.name} added to bag`)
      setIsOpen(true)
    } else {
      addToast(result.message || 'Could not add to bag', 'error')
    }
  }

  return (
    <section className="relative py-24 md:py-36 overflow-hidden border-y border-saif-border bg-saif-surface/40" aria-labelledby="spotlight-heading">
      {/* Oversized ghost index — signature numbering motif */}
      <span
        className="absolute -top-8 right-0 text-outline-faint text-[clamp(140px,26vw,380px)] font-black leading-none tracking-tighter select-none pointer-events-none hidden md:block"
        aria-hidden="true"
      >
        Nº1
      </span>

      <div className="max-w-7xl mx-auto px-5 lg:px-10 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
        {/* Copy */}
        <div className="relative z-10 order-2 lg:order-1">
          <Reveal variant="fade" duration={700}>
            <p className="eyebrow">
              <span className="text-saif-accent tabular-nums">03</span>
              <span className="w-3 h-px bg-saif-border" aria-hidden="true" />
              {configText(cfg, 'heading', lang) ?? t('spotlight.eyebrow')}
            </p>
          </Reveal>

          <Reveal variant="up" delay={100}>
            <h2
              id="spotlight-heading"
              className="mt-5 text-[clamp(38px,6vw,84px)] font-black tracking-tighter leading-[0.95] text-saif-text text-balance"
            >
              {product.name}
            </h2>
          </Reveal>

          {product.short_description && (
            <Reveal variant="fade" delay={220} duration={900}>
              <p className="mt-6 text-sm md:text-[15px] text-saif-dim leading-relaxed max-w-md">
                {product.short_description}
              </p>
            </Reveal>
          )}

          <Reveal variant="fade" delay={300}>
            <div className="mt-8 flex items-baseline gap-4 flex-wrap">
              <span className="text-3xl md:text-4xl font-bold text-saif-text tabular-nums">
                {formatPrice(product.price, currency)}
              </span>
              {product.compare_at_price && product.compare_at_price > product.price && (
                <>
                  <span className="text-lg text-saif-faint line-through tabular-nums">
                    {formatPrice(product.compare_at_price, currency)}
                  </span>
                  <span className="badge bg-saif-accent text-black border-saif-accent">−{discount}%</span>
                </>
              )}
              {product.product_type === 'digital' && (
                <span className="badge border-saif-accent/40 text-saif-accent">
                  <Zap size={10} aria-hidden="true" /> Digital
                </span>
              )}
            </div>
          </Reveal>

          <Reveal variant="scale" delay={400} duration={700}>
            <div className="mt-10 flex flex-col sm:flex-row gap-3">
              <button onClick={handleAddToCart} data-magnetic className="btn btn-primary">
                {needsSelection && !defaultVariant ? (configText(cfg, 'choose_text', lang) ?? t('spotlight.chooseOptions')) : t('product.addToBag')}
              </button>
              <Link to={`/products/${product.slug}`} className="btn">
                {configText(cfg, 'cta_text', lang) ?? t('spotlight.cta')} <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          </Reveal>
        </div>

        {/* Campaign image */}
        <Reveal variant="mask" duration={1200} className="order-1 lg:order-2">
          <div className="relative aspect-[4/5] overflow-hidden rounded-sm">
            <div ref={parallaxRef} className="parallax absolute -inset-y-[8%] inset-x-0">
              <img
                src={product.thumbnail || product.images?.[0] || ''}
                alt={product.name}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute inset-0 [background:linear-gradient(to_top,rgba(0,0,0,0.55),transparent_40%)]" aria-hidden="true" />
            {product.bestseller && (
              <span className="absolute top-5 left-5 badge bg-saif-text text-black border-saif-text">Bestseller</span>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
