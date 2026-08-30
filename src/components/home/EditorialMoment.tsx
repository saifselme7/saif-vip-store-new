import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import Reveal from '@/components/motion/Reveal'
import { useParallax } from '@/hooks/useParallax'
import { useCart } from '@/context/CartContext'
import { useToast } from '@/context/ToastContext'
import { formatPrice, discountPercent } from '@/lib/utils'
import { useI18n } from '@/i18n'
import { localizeProduct } from '@/lib/bilingual'
import { configText, type SpotlightConfig } from '@/hooks/useHomepageSections'
import type { Product } from '@/types'

/**
 * Featured look — one product staged like a campaign: a fully-lit parallax
 * image on one side, oversized type and the live price/stock logic on the
 * other. The add-to-bag flow is the real cart flow.
 */
export default function EditorialMoment({ product, config }: { product: Product | null; config?: unknown }) {
  const { t, lang, formatPrice: fmt } = useI18n()
  const cfg = (config ?? {}) as SpotlightConfig
  const { addItem, setIsOpen } = useCart()
  const { addToast } = useToast()
  const parallaxRef = useParallax<HTMLDivElement>(-46)

  if (!product) return null

  const loc = localizeProduct(product, lang)
  const discount = discountPercent(product.price, product.compare_at_price)
  const defaultVariant = product.variants?.find(v => v.stock > 0) ?? null
  const needsSelection = product.product_type === 'physical' && (product.variants?.length ?? 0) > 0
  const image = product.thumbnail || product.images?.[0] || ''

  function handleAddToCart() {
    if (needsSelection && !defaultVariant) {
      window.location.assign(`/products/${product!.slug}`)
      return
    }
    const result = addItem(product!, defaultVariant, 1)
    if (result.ok) {
      addToast(t('product.addedToBag', { name: loc.name }))
      setIsOpen(true)
    } else {
      addToast(result.message || t('product.couldNotAdd'), 'error')
    }
  }

  return (
    <section className="relative py-24 md:py-36 overflow-hidden" aria-labelledby="spotlight-heading">
      {/* Oversized ghost index — signature numbering motif */}
      <span
        className="ghost-index text-outline-faint -top-8 end-0 text-[clamp(140px,26vw,380px)] font-display hidden md:block"
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
              className="mt-5 text-[clamp(38px,6vw,84px)] font-display text-saif-text leading-[0.98] text-balance"
            >
              {loc.name}
            </h2>
          </Reveal>

          {loc.shortDescription && (
            <Reveal variant="fade" delay={220} duration={900}>
              <p className="mt-6 text-sm md:text-[15px] text-saif-dim leading-relaxed max-w-md">
                {loc.shortDescription}
              </p>
            </Reveal>
          )}

          <Reveal variant="fade" delay={300}>
            <div className="mt-8 flex items-baseline gap-4 flex-wrap">
              <span className="text-3xl md:text-4xl font-bold text-saif-text tabular-nums ltr-iso">
                {fmt(product.price)}
              </span>
              {discount > 0 && product.compare_at_price && (
                <>
                  <span className="text-lg text-saif-faint line-through tabular-nums ltr-iso">
                    {fmt(product.compare_at_price)}
                  </span>
                  <span className="badge bg-saif-accent text-black border-saif-accent">−{discount}%</span>
                </>
              )}
            </div>
          </Reveal>

          <Reveal variant="scale" delay={400} duration={700}>
            <div className="mt-10 flex flex-col sm:flex-row gap-3">
              <button onClick={handleAddToCart} data-magnetic className="btn btn-primary">
                {needsSelection && !defaultVariant
                  ? (configText(cfg, 'choose_text', lang) ?? t('spotlight.chooseOptions'))
                  : t('product.addToBag')}
              </button>
              <Link to={`/products/${product.slug}`} className="btn">
                {configText(cfg, 'cta_text', lang) ?? t('spotlight.cta')}
                <ArrowRight size={14} className={lang === 'ar' ? 'rotate-180' : ''} aria-hidden="true" />
              </Link>
            </div>
          </Reveal>
        </div>

        {/* Campaign image */}
        <Reveal variant="mask" duration={1200} className="order-1 lg:order-2">
          <div className="relative aspect-[4/5] overflow-hidden bg-saif-panel">
            <div ref={parallaxRef} className="parallax absolute -inset-y-[8%] inset-x-0">
              <img
                src={image}
                alt={loc.name}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
              />
            </div>
            {product.bestseller && (
              <span className="absolute top-5 start-5 badge bg-black/85 backdrop-blur-sm text-saif-text border-saif-border">
                {t('rails.bestsellers.eyebrow')}
              </span>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
