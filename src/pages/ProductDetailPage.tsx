import { useEffect, useMemo, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Heart, Minus, Plus, Truck, ShieldCheck, Zap, ChevronRight, Share2, X } from 'lucide-react'
import { useProduct, useRelatedProducts } from '@/hooks/useProducts'
import { useReviews } from '@/hooks/useReviews'
import { useCart } from '@/context/CartContext'
import { useAuth } from '@/context/AuthContext'
import { useWishlist } from '@/context/WishlistContext'
import { useApp } from '@/context/AppContext'
import { usePageMeta } from '@/hooks/usePageMeta'
import { supabase } from '@/lib/supabase'
import { availableStock, discountPercent, isOutOfStock } from '@/lib/checkout'
import { formatDate, formatPrice, copyToClipboard } from '@/lib/utils'
import type { Product, ProductVariant } from '@/types'
import ProductCard from '@/components/ProductCard'
import SectionHeading from '@/components/SectionHeading'
import Price from '@/components/ui/Price'
import RatingStars from '@/components/ui/RatingStars'
import Modal from '@/components/ui/Modal'
import Loading from '@/components/Loading'
import EmptyState from '@/components/EmptyState'

const RECENT_KEY = 'saif-recent-products'

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { product, loading, error } = useProduct(slug || '')
  const { addItem } = useCart()
  const { user } = useAuth()
  const { has, toggle } = useWishlist()
  const { addToast, settings } = useApp()
  const { reviews } = useReviews(product?.id)
  const { products: related } = useRelatedProducts(product)

  const [selectedImage, setSelectedImage] = useState(0)
  const [selectedSize, setSelectedSize] = useState<string | null>(null)
  const [selectedColor, setSelectedColor] = useState<string | null>(null)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [zoomOpen, setZoomOpen] = useState(false)

  usePageMeta(product?.name, product?.short_description || product?.description)

  // Reset selections when navigating between products.
  useEffect(() => {
    setSelectedImage(0)
    setSelectedSize(null)
    setSelectedColor(null)
    setSelectedVariantId(null)
    setQuantity(1)
  }, [slug])

  // Recently viewed (localStorage, most recent first).
  useEffect(() => {
    if (!product) return
    try {
      const raw = localStorage.getItem(RECENT_KEY)
      const list: string[] = raw ? JSON.parse(raw) : []
      const next = [product.id, ...list.filter(id => id !== product.id)].slice(0, 8)
      localStorage.setItem(RECENT_KEY, JSON.stringify(next))
    } catch { /* ignore */ }
  }, [product?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const variants = useMemo(() => product?.variants ?? [], [product])
  const sizes = useMemo(() => [...new Set(variants.map(v => v.size).filter(Boolean))] as string[], [variants])
  const colors = useMemo(() => [...new Set(variants.map(v => v.color).filter(Boolean))] as string[], [variants])
  const hasOptions = variants.length > 0 && (sizes.length > 0 || colors.length > 0)

  // The variant matching the current size+color selection.
  const matchedVariant: ProductVariant | null = useMemo(() => {
    if (!hasOptions) return variants[0] ?? null
    return (
      variants.find(v =>
        (!sizes.length || v.size === selectedSize) &&
        (!colors.length || v.color === selectedColor),
      ) ?? null
    )
  }, [variants, sizes, colors, selectedSize, selectedColor, hasOptions])

  useEffect(() => {
    setSelectedVariantId(matchedVariant?.id ?? null)
  }, [matchedVariant])

  if (loading) return <div className="pt-16"><Loading /></div>
  if (error || !product) return (
    <div className="pt-16 px-6">
      <EmptyState title="Product not found" description="This product may have been removed or is unavailable." />
      <div className="text-center"><Link to="/products" className="btn text-xs">Back to Shop</Link></div>
    </div>
  )

  const outOfStock = isOutOfStock(product)
  const isDigital = product.product_type === 'digital'
  const percent = discountPercent(product)
  const inWishlist = has(product.id)
  const currency = settings?.currency || 'EGP'
  const maxQty = availableStock(product, hasOptions ? matchedVariant?.id : null)
  const currentStock = hasOptions ? (matchedVariant?.stock ?? 0) : product.stock
  const images = product.images?.length ? product.images : product.thumbnail ? [product.thumbnail] : []
  const categoryName = Array.isArray(product.categories) ? product.categories[0]?.name : product.categories?.name
  const needsOption = hasOptions && !matchedVariant

  const effectivePrice = hasOptions && matchedVariant?.price != null ? matchedVariant.price : product.price

  function optionDisabled(kind: 'size' | 'color', value: string) {
    return !variants.some(v =>
      v.stock > 0 &&
      (kind === 'size' ? v.size === value : v.color === value) &&
      (kind === 'size' ? !selectedColor || v.color === selectedColor : !selectedSize || v.size === selectedSize)
    )
  }

  async function handleAdd(goToCheckout = false) {
    if (outOfStock) return
    if (needsOption) {
      addToast('Please select your size/color first', 'info')
      return
    }
    const variant = hasOptions ? matchedVariant : null
    if (addItem(product!, variant, quantity)) {
      addToast(`${product!.name} added to bag`)
      if (goToCheckout) navigate('/checkout')
    }
  }

  async function handleShare() {
    const ok = await copyToClipboard(window.location.href)
    addToast(ok ? 'Link copied to clipboard' : 'Could not copy link', ok ? 'success' : 'error')
  }

  const specs = Object.entries((product.metadata || {}) as Record<string, unknown>)

  return (
    <div className="animate-[pageIn_0.5s_ease]">
      <div className="px-4 sm:px-6 lg:px-10 pt-8 pb-20 max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-saif-dim mb-8" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-saif-text transition-colors">Home</Link>
          <ChevronRight size={12} />
          <Link to="/products" className="hover:text-saif-text transition-colors">Shop</Link>
          {categoryName && (
            <>
              <ChevronRight size={12} />
              <Link to={`/products?category=${product.category_id}`} className="hover:text-saif-text transition-colors">{categoryName}</Link>
            </>
          )}
          <ChevronRight size={12} />
          <span className="text-saif-text truncate max-w-[160px]">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
          {/* ---------- Gallery ---------- */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <button
              className="w-full aspect-[3/4] bg-[#111] overflow-hidden block cursor-zoom-in group relative"
              onClick={() => images.length > 0 && setZoomOpen(true)}
              aria-label="Zoom image"
            >
              {images[selectedImage] ? (
                <img
                  src={images[selectedImage]}
                  alt={`${product.name} — image ${selectedImage + 1}`}
                  className="w-full h-full object-cover transition-transform duration-700 ease-saif group-hover:scale-105"
                />
              ) : (
                <span className="w-full h-full flex items-center justify-center text-saif-dim text-sm">No image</span>
              )}
              {percent !== null && (
                <span className="absolute top-4 left-4 bg-saif-accent text-white text-xs font-bold px-2.5 py-1 uppercase tracking-wider">
                  −{percent}%
                </span>
              )}
            </button>
            {images.length > 1 && (
              <div className="flex gap-2 mt-3" role="tablist" aria-label="Product images">
                {images.map((img, i) => (
                  <button
                    key={i}
                    role="tab"
                    aria-selected={selectedImage === i}
                    onClick={() => setSelectedImage(i)}
                    className={`w-16 h-20 overflow-hidden border-2 transition-colors ${
                      selectedImage === i ? 'border-saif-text' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ---------- Info ---------- */}
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                {categoryName && <p className="text-[10px] uppercase tracking-[0.25em] text-saif-dim mb-2">{categoryName}</p>}
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-[1.02] text-saif-text">
                  {product.name}
                </h1>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={handleShare} aria-label="Copy product link" className="p-2 border border-saif-border text-saif-dim hover:text-saif-text hover:border-saif-text transition-colors">
                  <Share2 size={16} />
                </button>
                <button onClick={() => toggle(product)} aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'} className="p-2 border border-saif-border transition-colors hover:border-saif-text">
                  <Heart size={16} className={inWishlist ? 'fill-saif-accent text-saif-accent' : 'text-saif-dim hover:text-saif-text'} />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-4">
              <Price value={effectivePrice} compareAt={product.compare_at_price} className="text-2xl font-bold text-saif-text" compareClassName="text-base" />
              {reviews.length > 0 && (
                <a href="#reviews" className="flex items-center gap-1.5 text-xs text-saif-dim hover:text-saif-text transition-colors">
                  <RatingStars rating={reviews.reduce((s, r) => s + r.rating, 0) / reviews.length} size={12} />
                  ({reviews.length})
                </a>
              )}
            </div>

            {/* Stock state */}
            <p className={`mt-3 text-xs font-semibold uppercase tracking-wider ${outOfStock ? 'text-red-400' : isDigital ? 'text-green-400' : currentStock <= (product.low_stock_threshold ?? 5) ? 'text-saif-accent' : 'text-green-400'}`} aria-live="polite">
              {outOfStock ? 'Out of stock' : isDigital ? 'Available instantly after approval' : currentStock <= (product.low_stock_threshold ?? 5) ? `Low stock — ${currentStock} left` : 'In stock'}
            </p>

            <p className="mt-6 text-sm sm:text-base text-saif-dim leading-relaxed whitespace-pre-line">{product.description}</p>

            {/* Size options */}
            {sizes.length > 0 && (
              <div className="mt-8">
                <p className="label">Size{selectedSize && <span className="text-saif-text ml-2 normal-case">— {selectedSize}</span>}</p>
                <div className="flex flex-wrap gap-2">
                  {sizes.map(s => (
                    <button
                      key={s}
                      onClick={() => setSelectedSize(selectedSize === s ? null : s)}
                      disabled={optionDisabled('size', s)}
                      aria-pressed={selectedSize === s}
                      className={`min-w-[3rem] px-4 py-2.5 text-sm font-medium border transition-all ${
                        selectedSize === s
                          ? 'border-saif-text bg-saif-text text-black'
                          : optionDisabled('size', s)
                            ? 'border-saif-border text-saif-dim/30 line-through cursor-not-allowed'
                            : 'border-saif-border text-saif-text hover:border-saif-text'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Color options */}
            {colors.length > 0 && (
              <div className="mt-6">
                <p className="label">Color{selectedColor && <span className="text-saif-text ml-2 normal-case">— {selectedColor}</span>}</p>
                <div className="flex flex-wrap gap-2">
                  {colors.map(c => (
                    <button
                      key={c}
                      onClick={() => setSelectedColor(selectedColor === c ? null : c)}
                      disabled={optionDisabled('color', c)}
                      aria-pressed={selectedColor === c}
                      className={`px-4 py-2.5 text-sm font-medium border transition-all ${
                        selectedColor === c
                          ? 'border-saif-text bg-saif-text text-black'
                          : optionDisabled('color', c)
                            ? 'border-saif-border text-saif-dim/30 line-through cursor-not-allowed'
                            : 'border-saif-border text-saif-text hover:border-saif-text'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Variant list fallback (variants without size/color) */}
            {variants.length > 0 && !hasOptions && (
              <div className="mt-8">
                <p className="label">Option</p>
                <div className="flex flex-wrap gap-2">
                  {variants.map(v => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariantId(selectedVariantId === v.id ? null : v.id)}
                      disabled={v.stock <= 0}
                      aria-pressed={selectedVariantId === v.id}
                      className={`px-4 py-2.5 text-sm border transition-all ${
                        selectedVariantId === v.id
                          ? 'border-saif-text bg-saif-text text-black'
                          : v.stock <= 0
                            ? 'border-saif-border text-saif-dim/30 line-through cursor-not-allowed'
                            : 'border-saif-border text-saif-text hover:border-saif-text'
                      }`}
                    >
                      {v.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity */}
            {!isDigital && !outOfStock && (
              <div className="mt-8">
                <p className="label">Quantity</p>
                <div className="flex items-center border border-saif-border w-fit">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-4 py-2.5 text-saif-text hover:bg-white/5" aria-label="Decrease quantity">
                    <Minus size={14} />
                  </button>
                  <span className="px-5 text-sm font-medium text-saif-text min-w-[3rem] text-center" aria-live="polite">{quantity}</span>
                  <button onClick={() => setQuantity(Math.min(maxQty === Number.MAX_SAFE_INTEGER ? quantity + 1 : maxQty, quantity + 1))} className="px-4 py-2.5 text-saif-text hover:bg-white/5" aria-label="Increase quantity">
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="mt-9 flex flex-col sm:flex-row gap-3">
              <button onClick={() => handleAdd(false)} disabled={outOfStock} className="btn btn-primary flex-1">
                {outOfStock ? 'Sold Out' : needsOption ? 'Select Options' : 'Add to Bag'}
              </button>
              <button onClick={() => handleAdd(true)} disabled={outOfStock || needsOption} className="btn flex-1">
                Buy Now
              </button>
            </div>

            {/* Meta & policies */}
            <div className="mt-10 pt-7 border-t border-saif-border space-y-3.5">
              <div className="flex items-start gap-3 text-sm text-saif-dim">
                {isDigital ? <Zap size={16} className="mt-0.5 shrink-0" /> : <Truck size={16} className="mt-0.5 shrink-0" />}
                <span>
                  {isDigital
                    ? <>Fulfilled by our team after your payment is approved{product.metadata?.delivery_time ? <> · {String(product.metadata.delivery_time)}</> : null}.</>
                    : <>Ships across Egypt{settings?.free_shipping_threshold ? <> · free over {formatPrice(settings.free_shipping_threshold, currency)}</> : null}.</>}
                </span>
              </div>
              <div className="flex items-start gap-3 text-sm text-saif-dim">
                <ShieldCheck size={16} className="mt-0.5 shrink-0" />
                <span>Pay via InstaPay or Vodafone Cash — every transfer manually verified.</span>
              </div>
              {product.sku && <p className="text-xs text-saif-dim">SKU: {product.sku}</p>}
            </div>

            {/* Specifications */}
            {specs.length > 0 && (
              <div className="mt-8 pt-7 border-t border-saif-border">
                <h3 className="text-sm font-bold uppercase tracking-widest text-saif-text mb-4">Details</h3>
                <dl className="space-y-2">
                  {specs.map(([k, v]) => (
                    <div key={k} className="flex gap-4 text-sm">
                      <dt className="text-saif-dim w-36 flex-shrink-0 capitalize">{k.replace(/_/g, ' ')}</dt>
                      <dd className="text-saif-text">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        </div>

        {/* ---------- Reviews ---------- */}
        <section id="reviews" className="mt-20 pt-12 border-t border-saif-border">
          <SectionHeading title={`Reviews${reviews.length ? ` (${reviews.length})` : ''}`} subtitle="Approved reviews from customers." />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2 space-y-6">
              {reviews.length === 0 ? (
                <p className="text-sm text-saif-dim">No reviews yet. Be the first to review this product after your order.</p>
              ) : (
                reviews.map(r => (
                  <article key={r.id} className="border-b border-saif-border pb-6">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-saif-text">{r.user?.full_name || 'Customer'}</p>
                      <span className="text-xs text-saif-dim">{formatDate(r.created_at)}</span>
                    </div>
                    <RatingStars rating={r.rating} className="mt-1.5" />
                    <p className="mt-2 text-sm font-semibold text-saif-text">{r.title}</p>
                    <p className="mt-1 text-sm text-saif-dim leading-relaxed">{r.body}</p>
                  </article>
                ))
              )}
            </div>
            <ReviewForm productId={product.id} />
          </div>
        </section>

        {/* ---------- Related ---------- */}
        {related.length > 0 && (
          <section className="mt-20 pt-12 border-t border-saif-border">
            <SectionHeading title="You May Also Like" viewAllTo="/products" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-6">
              {related.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          </section>
        )}
      </div>

      {/* Zoom modal */}
      <Modal open={zoomOpen} onClose={() => setZoomOpen(false)} title={product.name} wide>
        {images[selectedImage] && (
          <img src={images[selectedImage]} alt={product.name} className="w-full max-h-[75vh] object-contain bg-[#111]" />
        )}
        {images.length > 1 && (
          <div className="flex gap-2 mt-4 justify-center">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setSelectedImage(i)}
                aria-label={`Image ${i + 1}`}
                className={`w-2.5 h-2.5 rounded-full ${selectedImage === i ? 'bg-saif-accent' : 'bg-saif-border'}`}
              />
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}

function ReviewForm({ productId }: { productId: string }) {
  const { user } = useAuth()
  const { addToast } = useApp()
  const [rating, setRating] = useState(0)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (rating === 0) { addToast('Please choose a star rating', 'error'); return }
    if (title.trim().length < 3 || body.trim().length < 10) {
      addToast('Please write a short title and review', 'error')
      return
    }
    setSubmitting(true)
    const { error } = await supabase.from('reviews').insert({
      product_id: productId,
      user_id: user.id,
      rating,
      title: title.trim(),
      body: body.trim(),
    })
    setSubmitting(false)
    if (error) {
      addToast(`Could not submit review: ${error.message}`, 'error')
    } else {
      setSubmitted(true)
      addToast('Review submitted — it will appear after moderation.')
    }
  }

  if (submitted) {
    return (
      <div className="border border-saif-border p-6 h-fit">
        <p className="text-sm font-semibold text-saif-text">Thank you!</p>
        <p className="mt-2 text-sm text-saif-dim">Your review is pending moderation and will appear once approved.</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="border border-saif-border p-6 h-fit">
        <p className="text-sm text-saif-dim">
          <Link to="/login" className="text-saif-text underline">Sign in</Link> to write a review.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="border border-saif-border p-6 h-fit space-y-4">
      <h3 className="text-sm font-bold uppercase tracking-widest text-saif-text">Write a Review</h3>
      <div>
        <p className="label">Rating</p>
        <RatingStars rating={rating} size={22} interactive onChange={setRating} />
      </div>
      <div>
        <label htmlFor="review-title" className="label">Title</label>
        <input id="review-title" value={title} onChange={e => setTitle(e.target.value)} className="input" placeholder="Sum it up" maxLength={80} />
      </div>
      <div>
        <label htmlFor="review-body" className="label">Review</label>
        <textarea id="review-body" rows={4} value={body} onChange={e => setBody(e.target.value)} className="input resize-none" placeholder="What did you think?" maxLength={1000} />
      </div>
      <button type="submit" disabled={submitting} className="btn btn-primary w-full text-xs">
        {submitting ? 'Submitting…' : 'Submit Review'}
      </button>
    </form>
  )
}
