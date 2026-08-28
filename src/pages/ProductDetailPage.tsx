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

type Tab = 'description' | 'specifications' | 'shipping'

export default function ProductDetailPage() {
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

  useEffect(() => {
    setSelectedVariantId(null)
    setQuantity(1)
    setTab('description')
  }, [slug])

  usePageMeta({
    title: product ? product.name : 'Product',
    description: product?.short_description || product?.description?.slice(0, 150),
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
      name: product.name,
      description: product.short_description || product.description,
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
          title="Product not found"
          description="This product may have been removed or is unavailable."
          action={
            <Link to="/products" className="btn btn-sm">
              Back to Shop
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
  const specs = (product.specifications ?? {}) as Record<string, string>

  function handleAddToCart(openDrawer = true) {
    if (!product) return
    if (!isDigital && variants.length > 0 && !selectedVariant) {
      addToast('Please select an option first', 'error')
      return
    }
    const result = addItem(product, selectedVariant, quantity)
    if (result.ok) {
      addToast(`${product.name} added to bag`)
      if (openDrawer) setIsOpen(true)
    } else {
      addToast(result.message || 'Could not add to bag', 'error')
    }
  }

  function handleBuyNow() {
    if (!product) return
    if (!isDigital && variants.length > 0 && !selectedVariant) {
      addToast('Please select an option first', 'error')
      return
    }
    const result = addItem(product, selectedVariant, quantity)
    if (result.ok) {
      navigate('/checkout')
    } else {
      addToast(result.message || 'Could not add to bag', 'error')
    }
  }

  async function toggleWishlist() {
    if (!user || !product) {
      addToast('Sign in to save items to your wishlist', 'info')
      return
    }
    if (inWishlist) {
      const ok = await remove(product.id)
      if (ok) addToast('Removed from wishlist')
    } else {
      const ok = await add(product.id)
      if (ok) addToast('Saved to wishlist')
    }
  }

  async function handleShare() {
    if (!product) return
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ title: product.name, url })
        return
      } catch {
        /* user cancelled */
      }
    }
    const copied = await copyToClipboard(url)
    addToast(copied ? 'Product link copied' : 'Could not copy link', copied ? 'success' : 'error')
  }

  return (
    <div className="animate-[pageIn_0.6s_ease]">
      <div className="pt-24 md:pt-28 px-5 lg:px-10 pb-20 max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-saif-dim mb-8" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-saif-text transition-colors">Home</Link>
          <ChevronRight size={11} />
          <Link to="/products" className="hover:text-saif-text transition-colors">Shop</Link>
          {product.categories && (
            <>
              <ChevronRight size={11} />
              <Link to={`/products?category=${product.categories.id}`} className="hover:text-saif-text transition-colors">
                {product.categories.name}
              </Link>
            </>
          )}
          <ChevronRight size={11} />
          <span className="text-saif-text truncate max-w-[140px] sm:max-w-none">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
          {/* Gallery */}
          <Reveal variant="mask" duration={1100} className="lg:sticky lg:top-28 lg:self-start">
            <ProductGallery images={product.images || []} alt={product.name} />
          </Reveal>

          {/* Info */}
          <div className="pt-2">
            <Reveal variant="up" delay={150} duration={900}>
            <div className="flex items-start justify-between gap-4">
              <div>
                {product.categories?.name && (
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-saif-dim mb-3">
                    {product.categories.name}
                  </p>
                )}
                <h1 className="text-[clamp(30px,4.5vw,52px)] font-black tracking-tighter leading-[1.02] text-saif-text">
                  {product.name}
                </h1>
              </div>
              <div className="flex gap-1.5 mt-2 flex-shrink-0">
                <button
                  onClick={toggleWishlist}
                  className="w-10 h-10 border border-saif-border flex items-center justify-center hover:border-saif-text transition-colors rounded-sm"
                  aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
                  aria-pressed={inWishlist}
                >
                  <Heart size={17} className={inWishlist ? 'fill-saif-accent text-saif-accent' : 'text-saif-text'} />
                </button>
                <button
                  onClick={handleShare}
                  className="w-10 h-10 border border-saif-border flex items-center justify-center hover:border-saif-text transition-colors rounded-sm"
                  aria-label="Share product"
                >
                  <Share2 size={16} className="text-saif-text" />
                </button>
              </div>
            </div>

            <div className="flex items-center flex-wrap gap-3 mt-5">
              <span className="text-2xl font-bold text-saif-text">{formatPrice(unitPrice, currency)}</span>
              {product.compare_at_price && product.compare_at_price > unitPrice && (
                <>
                  <span className="text-base text-saif-dim line-through">
                    {formatPrice(product.compare_at_price, currency)}
                  </span>
                  <span className="badge bg-saif-accent text-black border-saif-accent">-{discount}%</span>
                </>
              )}
            </div>

            <p className="mt-6 text-sm md:text-base text-saif-dim leading-relaxed">
              {product.short_description || product.description}
            </p>

            {/* Stock status */}
            <div className="mt-6 flex items-center gap-3 text-sm">
              {isDigital ? (
                <span className="flex items-center gap-2 text-saif-accent">
                  <Zap size={15} /> Digital product — no shipping required
                </span>
              ) : soldOut ? (
                <span className="flex items-center gap-2 text-red-400">
                  <Package size={15} /> Out of stock
                </span>
              ) : availableStock <= product.low_stock_threshold ? (
                <span className="flex items-center gap-2 text-yellow-400">
                  <Package size={15} /> Low stock — only {availableStock} left
                </span>
              ) : (
                <span className="flex items-center gap-2 text-green-400">
                  <Package size={15} /> In stock
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
                <span className="label">Quantity</span>
                <QuantityStepper
                  value={quantity}
                  onChange={setQuantity}
                  max={Math.max(1, isDigital ? 99 : availableStock)}
                  ariaLabel="Quantity"
                />
              </div>
            )}

            {/* Actions */}
            <div className="mt-10 flex flex-col sm:flex-row gap-3">
              <button onClick={() => handleAddToCart()} disabled={soldOut} className="btn btn-primary flex-1">
                {soldOut ? 'Sold Out' : 'Add to Bag'}
              </button>
              <button onClick={handleBuyNow} disabled={soldOut} className="btn flex-1">
                Buy Now
              </button>
            </div>

            {/* Meta tabs */}
            <div className="mt-12 border-t border-saif-border">
              <div className="flex gap-6 border-b border-saif-border" role="tablist" aria-label="Product information">
                <TabButton active={tab === 'description'} onClick={() => setTab('description')}>
                  Description
                </TabButton>
                {Object.keys(specs).length > 0 && (
                  <TabButton active={tab === 'specifications'} onClick={() => setTab('specifications')}>
                    Specifications
                  </TabButton>
                )}
                <TabButton active={tab === 'shipping'} onClick={() => setTab('shipping')}>
                  {isDigital ? 'Digital Delivery' : 'Shipping'}
                </TabButton>
              </div>

              <div className="py-6">
                {tab === 'description' && (
                  <div className="text-sm text-saif-dim leading-relaxed whitespace-pre-line">
                    {product.description || product.short_description}
                  </div>
                )}
                {tab === 'specifications' && (
                  <dl className="divide-y divide-saif-border">
                    {Object.entries(specs).map(([key, value]) => (
                      <div key={key} className="flex justify-between gap-6 py-3 text-sm">
                        <dt className="text-saif-dim">{key}</dt>
                        <dd className="text-saif-text text-right">{String(value)}</dd>
                      </div>
                    ))}
                    {product.sku && (
                      <div className="flex justify-between gap-6 py-3 text-sm">
                        <dt className="text-saif-dim">SKU</dt>
                        <dd className="text-saif-text font-mono">{product.sku}</dd>
                      </div>
                    )}
                  </dl>
                )}
                {tab === 'shipping' && (
                  <div className="space-y-4 text-sm text-saif-dim leading-relaxed">
                    {isDigital ? (
                      <>
                        <div className="flex items-start gap-3">
                          <Zap size={16} className="text-saif-accent mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-saif-text font-medium">Digital delivery</p>
                            <p>
                              {product.delivery_info ||
                                'This item is delivered digitally after your payment is verified. You will be contacted using the details provided at checkout.'}
                            </p>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-start gap-3">
                          <Truck size={16} className="text-saif-text mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-saif-text font-medium">Shipping</p>
                            <p>
                              {settings?.shipping_fee
                                ? `Flat shipping fee of ${formatPrice(settings.shipping_fee, currency)} across Egypt.`
                                : 'Free shipping across Egypt.'}{' '}
                              {settings?.free_shipping_threshold
                                ? `Orders over ${formatPrice(settings.free_shipping_threshold, currency)} ship free.`
                                : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Shield size={16} className="text-saif-text mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-saif-text font-medium">Verified manual payments</p>
                            <p>
                              Pay with InstaPay or Vodafone Cash. Your transfer is verified by our team before the order ships.
                            </p>
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
          <section className="mt-20 pt-12 border-t border-saif-border" aria-labelledby="related-heading">
            <h2 id="related-heading" className="text-xl font-bold tracking-tight text-saif-text mb-8">
              You May Also Like
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {related.map(p => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}

        {/* Reviews */}
        <ProductReviews product={product} />
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
