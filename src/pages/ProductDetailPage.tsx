import { useEffect, useMemo, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Heart, Truck, Shield, Zap, Share2, Package, ChevronRight } from 'lucide-react'
import { useProduct, useRelatedProducts } from '@/hooks/useProducts'
import { useCart } from '@/context/CartContext'
import { useAuth } from '@/context/AuthContext'
import { useWishlist } from '@/hooks/useWishlist'
import { useToast } from '@/context/ToastContext'
import { useApp } from '@/context/AppContext'
import { usePageMeta } from '@/hooks/usePageMeta'
import { formatPrice, discountPercent, copyToClipboard, cn } from '@/lib/utils'
import ProductGallery from '@/components/product/ProductGallery'
import VariantSelector from '@/components/product/VariantSelector'
import ProductReviews from '@/components/product/ProductReviews'
import ProductCard from '@/components/ProductCard'
import QuantityStepper from '@/components/ui/QuantityStepper'
import Footer from '@/components/Footer'
import Loading from '@/components/Loading'
import EmptyState from '@/components/EmptyState'
import Reveal from '@/components/motion/Reveal'
import { useI18n } from '@/i18n'
import { localizeProduct, localizeCategory } from '@/lib/bilingual'

type Tab = 'description' | 'specifications' | 'shipping'

export default function ProductDetailPage() {
  const { t, lang, formatPrice: fmt, isRTL } = useI18n()
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { product, loading } = useProduct(slug || '')
  const { addItem, setIsOpen } = useCart()
  const { user } = useAuth()
  const { add, remove, isInWishlist } = useWishlist()
  const { addToast } = useToast()
  const { settings } = useApp()
  const { products: related } = useRelatedProducts(product)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [tab, setTab] = useState<Tab>('description')

  // All hooks run unconditionally BEFORE any early return (Rules of Hooks).
  // `variants` and the size/color facets are safe to derive from a nullable
  // product — the guards below still short-circuit the actual rendering.
  const variants = product?.variants ?? []
  const sizes = useMemo(() => [...new Set(variants.map(v => v.size).filter(Boolean))] as string[], [variants])
  const colors = useMemo(() => [...new Set(variants.map(v => v.color).filter(Boolean))] as string[], [variants])

  const currency = settings?.currency ?? 'EGP'
  const loc = localizeProduct(product, lang)

  useEffect(() => {
    setSelectedVariantId(null)
    setQuantity(1)
    setTab('description')
  }, [slug])

  usePageMeta({
    title: loc.seoTitle || (product ? loc.name : t('product.notFound')),
    description: loc.seoDescription || loc.shortDescription || loc.description?.slice(0, 150) || undefined,
    image: product?.thumbnail ?? undefined,
    type: 'product',
  })

  // Structured data for the current product (SEO)
  useEffect(() => {
    if (!product) return
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.id = 'product-jsonld'
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: loc.name,
      description: loc.shortDescription || loc.description,
      image: product.images,
      sku: product.sku,
      brand: { '@type': 'Brand', name: 'SAIF STORE' },
      offers: {
        '@type': 'Offer',
        price: product.price,
        priceCurrency: currency,
        availability: product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      },
    })
    document.head.appendChild(script)
    return () => {
      document.getElementById('product-jsonld')?.remove()
    }
  }, [product, currency])

  if (loading) {
    return (
      <div className="pt-28">
        <Loading />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="pt-28 px-5">
        <EmptyState
          title={t('product.notFound')}
          description={t('product.notFoundDesc')}
          action={
            <Link to="/products" className="btn btn-sm">
              {t('product.backToShop')}
            </Link>
          }
        />
        <Footer />
      </div>
    )
  }

  const selectedVariant = variants.find(v => v.id === selectedVariantId) ?? null
  const isDigital = product.product_type === 'digital'
  const inWishlist = isInWishlist(product.id)
  const availableStock = selectedVariant ? selectedVariant.stock : product.stock
  const unitPrice = selectedVariant?.price ?? product.price
  const discount = discountPercent(product.price, product.compare_at_price)
  const soldOut = !isDigital && availableStock <= 0
  const specs = loc.specifications
  const categoryLabel = product.categories ? localizeCategory(product.categories, lang).name : null

  function handleAddToCart(openDrawer = true) {
    if (!product) return
    if (!isDigital && variants.length > 0 && !selectedVariant) {
      addToast(t('product.selectOptionFirst'), 'error')
      return
    }
    const result = addItem(product, selectedVariant, quantity)
    if (result.ok) {
      addToast(t('product.addedToBag', { name: loc.name }))
      if (openDrawer) setIsOpen(true)
    } else {
      addToast(result.message || t('product.couldNotAdd'), 'error')
    }
  }

  function handleBuyNow() {
    if (!product) return
    if (!isDigital && variants.length > 0 && !selectedVariant) {
      addToast(t('product.selectOptionFirst'), 'error')
      return
    }
    const result = addItem(product, selectedVariant, quantity)
    if (result.ok) {
      navigate('/checkout')
    } else {
      addToast(result.message || t('product.couldNotAdd'), 'error')
    }
  }

  async function toggleWishlist() {
    if (!user || !product) {
      addToast(t('product.signInForWishlist'), 'info')
      return
    }
    if (inWishlist) {
      const ok = await remove(product.id)
      if (ok) addToast(t('product.removedFromWishlist'))
    } else {
      const ok = await add(product.id)
      if (ok) addToast(t('product.addedToWishlist'))
    }
  }

  async function handleShare() {
    if (!product) return
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ title: loc.name, url })
        return
      } catch {
        /* user cancelled */
      }
    }
    const copied = await copyToClipboard(url)
    addToast(copied ? t('product.shareLinkCopied') : t('errors.generic'), copied ? 'success' : 'error')
  }

  return (
    <div className="animate-[pageIn_0.6s_ease]">
      <div className="theme-paper min-h-screen pt-24 md:pt-32 px-5 lg:px-10 pb-20">
        <div className="max-w-7xl mx-auto">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs text-saif-dim mb-8" aria-label={t('a11y.breadcrumb')}>
            <Link to="/" className="hover:text-saif-text transition-colors">{t('nav.home')}</Link>
            <ChevronRight size={11} className={isRTL ? 'rotate-180' : ''} />
            <Link to="/products" className="hover:text-saif-text transition-colors">{t('nav.shop')}</Link>
            {product.categories && (
              <>
                <ChevronRight size={11} className={isRTL ? 'rotate-180' : ''} />
                <Link to={`/products?category=${product.categories.id}`} className="hover:text-saif-text transition-colors">
                  {categoryLabel}
                </Link>
              </>
            )}
            <ChevronRight size={11} className={isRTL ? 'rotate-180' : ''} />
            <span className="text-saif-text truncate max-w-[140px] sm:max-w-none">{loc.name}</span>
          </nav>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
            {/* Gallery */}
            <Reveal variant="mask" duration={1100} className="lg:sticky lg:top-28 lg:self-start">
              <ProductGallery images={product.images || []} alt={loc.name} />
            </Reveal>

            {/* Info */}
            <div className="pt-2">
              <Reveal variant="up" delay={150} duration={900}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    {categoryLabel && (
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-saif-dim mb-3">
                        {categoryLabel}
                      </p>
                    )}
                    <h1 className="text-[clamp(30px,4.5vw,54px)] font-display text-saif-text leading-[1.02]">
                      {loc.name}
                    </h1>
                  </div>
                  <div className="flex gap-1.5 mt-2 flex-shrink-0">
                    <button
                      onClick={toggleWishlist}
                      className="w-10 h-10 border border-saif-border flex items-center justify-center hover:border-saif-text transition-colors rounded-sm"
                      aria-label={inWishlist ? t('product.removedFromWishlist') : t('product.addedToWishlist')}
                      aria-pressed={inWishlist}
                    >
                      <Heart size={17} className={inWishlist ? 'fill-saif-accent text-saif-accent' : 'text-saif-text'} />
                    </button>
                    <button
                      onClick={handleShare}
                      className="w-10 h-10 border border-saif-border flex items-center justify-center hover:border-saif-text transition-colors rounded-sm"
                      aria-label={t('product.share')}
                    >
                      <Share2 size={16} className="text-saif-text" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center flex-wrap gap-3 mt-5">
                  <span className="text-2xl md:text-3xl font-bold text-saif-text tabular-nums ltr-iso">
                    {fmt(unitPrice)}
                  </span>
                  {product.compare_at_price && product.compare_at_price > unitPrice && (
                    <>
                      <span className="text-base text-saif-faint line-through tabular-nums ltr-iso">
                        {fmt(product.compare_at_price)}
                      </span>
                      <span className="badge bg-saif-accent text-black border-saif-accent">−{discount}%</span>
                    </>
                  )}
                </div>

                <p className="mt-6 text-sm md:text-base text-saif-dim leading-relaxed">
                  {loc.shortDescription || loc.description}
                </p>

                {/* Stock status */}
                <div className="mt-6 flex items-center gap-3 text-sm">
                  {isDigital ? (
                    <span className="flex items-center gap-2 text-saif-accent">
                      <Zap size={15} /> {t('product.digitalBadge')}
                    </span>
                  ) : soldOut ? (
                    <span className="flex items-center gap-2 text-saif-accent">
                      <Package size={15} /> {t('product.soldOut')}
                    </span>
                  ) : availableStock <= product.low_stock_threshold ? (
                    <span className="flex items-center gap-2 text-saif-accent">
                      <Package size={15} /> {t('product.lowStock', { count: availableStock })}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-saif-dim">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" aria-hidden="true" />
                      {t('product.inStock')}
                    </span>
                  )}
                </div>

                {/* Variants */}
                {!isDigital && variants.length > 0 && (
                  <VariantSelector
                    variants={variants}
                    sizes={sizes}
                    colors={colors}
                    selectedId={selectedVariantId}
                    onSelect={id => {
                      setSelectedVariantId(id)
                      setQuantity(1)
                    }}
                    className="mt-8"
                  />
                )}

                {/* Quantity */}
                {!soldOut && (
                  <div className="mt-8">
                    <span className="label">{t('product.quantity')}</span>
                    <QuantityStepper
                      value={quantity}
                      onChange={setQuantity}
                      max={Math.max(1, isDigital ? 99 : availableStock)}
                      ariaLabel={t('product.quantity')}
                    />
                  </div>
                )}

                {/* Actions */}
                <div className="mt-10 flex flex-col sm:flex-row gap-3">
                  <button onClick={() => handleAddToCart()} disabled={soldOut} className="btn btn-primary flex-1">
                    {soldOut ? t('product.soldOut') : t('product.addToBag')}
                  </button>
                  <button onClick={handleBuyNow} disabled={soldOut} className="btn flex-1">
                    {t('product.buyNow')}
                  </button>
                </div>

                {/* Meta tabs */}
                <div className="mt-14 border-t border-saif-border">
                  <div className="flex gap-6 border-b border-saif-border" role="tablist" aria-label={t('a11y.productInfo')}>
                    <TabButton active={tab === 'description'} onClick={() => setTab('description')}>
                      {t('product.description')}
                    </TabButton>
                    {Object.keys(specs).length > 0 && (
                      <TabButton active={tab === 'specifications'} onClick={() => setTab('specifications')}>
                        {t('product.specifications')}
                      </TabButton>
                    )}
                    <TabButton active={tab === 'shipping'} onClick={() => setTab('shipping')}>
                      {isDigital ? t('product.digitalDelivery') : t('product.shippingTab')}
                    </TabButton>
                  </div>

                  <div className="py-6">
                    {tab === 'description' && (
                      <div className="text-sm text-saif-dim leading-relaxed whitespace-pre-line">
                        {loc.description || loc.shortDescription}
                      </div>
                    )}
                    {tab === 'specifications' && (
                      <dl className="divide-y divide-saif-border">
                        {Object.entries(specs).map(([key, value]) => (
                          <div key={key} className="flex justify-between gap-6 py-3 text-sm">
                            <dt className="text-saif-dim">{key}</dt>
                            <dd className="text-saif-text text-end">{String(value)}</dd>
                          </div>
                        ))}
                        {product.sku && (
                          <div className="flex justify-between gap-6 py-3 text-sm">
                            <dt className="text-saif-dim">{t('product.sku')}</dt>
                            <dd className="text-saif-text font-mono ltr-iso">{product.sku}</dd>
                          </div>
                        )}
                      </dl>
                    )}
                    {tab === 'shipping' && (
                      <div className="space-y-4 text-sm text-saif-dim leading-relaxed">
                        {isDigital ? (
                          <div className="flex items-start gap-3">
                            <Zap size={16} className="text-saif-accent mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-saif-text font-medium">{t('product.digitalDelivery')}</p>
                              <p>{loc.deliveryInfo || t('product.digitalDeliveryFallback')}</p>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-start gap-3">
                              <Truck size={16} className="text-saif-text mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-saif-text font-medium">{t('product.shippingTab')}</p>
                                <p>
                                  {settings?.shipping_fee
                                    ? t('product.flatShipping', { amount: formatPrice(settings.shipping_fee, currency) })
                                    : t('home.trustShippingEgypt')}{' '}
                                  {settings?.free_shipping_threshold
                                    ? t('product.freeShippingOver', { amount: formatPrice(settings.free_shipping_threshold, currency) })
                                    : ''}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <Shield size={16} className="text-saif-text mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-saif-text font-medium">{t('product.verifiedPayments')}</p>
                                <p>{t('product.verifiedPaymentsDesc')}</p>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Reveal>
            </div>
          </div>

          {/* Related products */}
          {related.length > 0 && (
            <section className="mt-24 md:mt-32 pt-12 border-t border-saif-border" aria-labelledby="related-heading">
              <div className="flex items-end justify-between gap-6 mb-8 md:mb-12">
                <div>
                  <p className="eyebrow mb-4">
                    <span className="text-saif-accent tabular-nums">02</span>
                    <span className="w-3 h-px bg-saif-border" aria-hidden="true" />
                    {t('nav.shop')}
                  </p>
                  <h2 id="related-heading" className="font-display text-saif-text text-[clamp(26px,4vw,48px)] leading-none">
                    {t('product.relatedProducts')}
                  </h2>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-10 md:gap-x-5 md:gap-y-14">
                {related.map(p => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </section>
          )}

          {/* Reviews */}
          <ProductReviews product={product} />
        </div>
      </div>
      <Footer />
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'py-4 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 -mb-px',
        active ? 'text-saif-text border-saif-accent' : 'text-saif-dim border-transparent hover:text-saif-text',
      )}
    >
      {children}
    </button>
  )
}
