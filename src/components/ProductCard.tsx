import { memo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, Eye, ShoppingBag, Zap, Package } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useWishlist } from '@/hooks/useWishlist'
import { useToast } from '@/context/ToastContext'
import { useCart } from '@/context/CartContext'
import { useProductRatings } from '@/hooks/useProductRatings'
import { formatPrice, discountPercent, cn } from '@/lib/utils'
import type { Product } from '@/types'
import QuickViewModal from './product/QuickViewModal'
import RatingStars from './ui/RatingStars'
import { useI18n } from '@/i18n'
import { localizeProduct } from '@/lib/bilingual'

interface Props {
  product: Product
  priorityImage?: boolean
}

function ProductCard({ product, priorityImage }: Props) {
  const { user } = useAuth()
  const { t, lang, formatPrice } = useI18n()
  const loc = localizeProduct(product, lang)
  const { add, remove, isInWishlist } = useWishlist()
  const { addToast } = useToast()
  const { addItem, setIsOpen } = useCart()
  const { getRating } = useProductRatings()
  const [quickViewOpen, setQuickViewOpen] = useState(false)
  const [heartAnimating, setHeartAnimating] = useState(false)

  const inWishlist = isInWishlist(product.id)
  const rating = getRating(product.id)
  const isDigital = product.product_type === 'digital'
  const discount = discountPercent(product.price, product.compare_at_price)
  const soldOut = !isDigital && product.stock <= 0
  const lowStock = !isDigital && !soldOut && product.stock <= product.low_stock_threshold
  const primaryImage = product.thumbnail || product.images?.[0] || ''
  const secondaryImage = product.images?.[1] || ''

  async function toggleWishlist(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!user) {
      addToast(t('product.signInForWishlist'), 'info')
      return
    }
    setHeartAnimating(true)
    setTimeout(() => setHeartAnimating(false), 450)
    if (inWishlist) {
      const ok = await remove(product.id)
      if (ok) addToast(t('product.removedFromWishlist'))
    } else {
      const ok = await add(product.id)
      if (ok) addToast(t('product.addedToWishlist'))
    }
  }

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const defaultVariant = product.variants?.find(v => v.stock > 0) ?? null
    if (!isDigital && product.variants?.length && !defaultVariant) {
      setQuickViewOpen(true)
      return
    }
    const result = addItem(product, defaultVariant, 1)
    if (result.ok) {
      addToast(t('product.addedToBag', { name: loc.name }))
      setIsOpen(true)
    } else {
      addToast(result.message || t('product.couldNotAdd'), 'error')
    }
  }

  function openQuickView(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setQuickViewOpen(true)
  }

  return (
    <>
      <Link
        to={`/products/${product.slug}`}
        className="group block relative"
        aria-label={`${loc.name}${soldOut ? ` — ${t('product.soldOut')}` : ''}`}
      >
        {/* ---------- Image ---------- */}
        <div className="relative aspect-[3/4] overflow-hidden bg-saif-panel rounded-sm">
          <img
            src={primaryImage}
            alt={loc.name}
            loading={priorityImage ? 'eager' : 'lazy'}
            decoding="async"
            className={cn(
              'absolute inset-0 w-full h-full object-cover transition-all duration-[900ms] ease-saif group-hover:scale-[1.045]',
              secondaryImage && 'group-hover:opacity-0',
              soldOut && 'opacity-40 grayscale',
            )}
          />
          {secondaryImage && (
            <img
              src={secondaryImage}
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-[900ms] ease-saif group-hover:scale-[1.045]"
            />
          )}

          {/* Badges — top left */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start pointer-events-none">
            {discount > 0 && (
              <span className="badge bg-saif-accent text-black border-saif-accent">−{discount}%</span>
            )}
            {product.bestseller && <span className="badge bg-saif-text text-black border-saif-text">Bestseller</span>}
            {soldOut && <span className="badge bg-black/85 backdrop-blur-sm text-saif-text border-saif-text/40">Sold out</span>}
            {lowStock && (
              <span className="badge bg-black/80 backdrop-blur-sm text-yellow-400 border-yellow-500/40">
                {t('product.onlyLeft', { count: product.stock })}
              </span>
            )}
          </div>

          {/* Quick actions — 44px targets, visible on touch, revealed on hover on pointer devices */}
          <div className="absolute top-2.5 right-2.5 flex flex-col gap-2">
            <button
              onClick={toggleWishlist}
              aria-label={inWishlist ? t('a11y.removeItem', { name: loc.name }) : `${t('product.addToBag')} — ${loc.name}`}
              aria-pressed={inWishlist}
              className={cn(
                'w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300',
                inWishlist
                  ? 'bg-saif-accent text-black'
                  : 'bg-black/60 backdrop-blur-sm text-saif-text hover:bg-black',
                'max-lg:opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100',
              )}
            >
              <Heart
                size={17}
                className={cn(
                  inWishlist ? 'fill-black' : '',
                  heartAnimating && 'animate-heart-pop',
                )}
              />
            </button>
            <button
              onClick={openQuickView}
              aria-label={`${t('product.quickView')} — ${loc.name}`}
              className="w-11 h-11 rounded-full bg-black/60 backdrop-blur-sm text-saif-text hover:bg-black flex items-center justify-center max-lg:hidden lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100 transition-all duration-300"
            >
              <Eye size={17} />
            </button>
          </div>

          {/* Add to bag — slides up on hover (pointer), always visible bar on touch */}
          {!soldOut && (
            <>
              <button
                onClick={handleAddToCart}
                aria-label={`${t('product.addToBag')} — ${loc.name}`}
                className="hidden lg:flex absolute bottom-0 inset-x-0 items-center justify-center gap-2 bg-saif-text text-black text-[11px] font-bold uppercase tracking-[0.14em] h-12 translate-y-full group-hover:translate-y-0 group:focus-within:translate-y-0 transition-transform duration-500 ease-saif hover:bg-saif-accent"
              >
                <ShoppingBag size={14} aria-hidden="true" />
                {product.variants?.length ? t('product.quickAdd') : t('product.addToBag')}
              </button>
              {/* Touch: persistent compact add button */}
              <button
                onClick={handleAddToCart}
                aria-label={`${t('product.addToBag')} — ${loc.name}`}
                className="lg:hidden absolute bottom-3 right-3 w-11 h-11 rounded-full bg-saif-text text-black flex items-center justify-center active:scale-90 active:bg-saif-accent transition-transform duration-200 shadow-lg"
              >
                <ShoppingBag size={17} aria-hidden="true" />
              </button>
            </>
          )}

          {/* Type marker */}
          <span
            className={cn(
              'absolute bottom-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] rounded-full bg-black/60 backdrop-blur-sm',
              isDigital ? 'text-saif-accent' : 'text-saif-dim',
            )}
          >
            {isDigital ? <Zap size={10} aria-hidden="true" /> : <Package size={10} aria-hidden="true" />}
            {isDigital ? t('product.digital') : t('product.physical')}
          </span>
        </div>

        {/* ---------- Info ---------- */}
        <div className="mt-4">
          {product.categories && (
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-saif-faint">
              {(lang === 'ar' && (product.categories as { name_ar?: string | null }).name_ar?.trim()
                ? (product.categories as { name_ar?: string | null }).name_ar
                : product.categories.name) || ''}
            </p>
          )}
          <h3 className="mt-1.5 text-sm font-medium text-saif-text group-hover:text-saif-accent transition-colors duration-300 line-clamp-1">
            {loc.name}
          </h3>
          <div className="mt-2 flex items-baseline justify-between gap-3 flex-wrap">
            <div className="flex items-baseline gap-2.5 min-w-0">
              <span className="text-[15px] font-semibold text-saif-text tabular-nums ltr-iso">
                {formatPrice(product.price)}
              </span>
              {product.compare_at_price && product.compare_at_price > product.price && (
                <span className="text-xs text-saif-faint line-through tabular-nums ltr-iso">
                  {formatPrice(product.compare_at_price)}
                </span>
              )}
            </div>
            {rating && rating.review_count > 0 && (
              <RatingStars value={rating.avg_rating ?? 0} size={11} showValue />
            )}
          </div>
        </div>
      </Link>

      <QuickViewModal open={quickViewOpen} onClose={() => setQuickViewOpen(false)} product={product} />
    </>
  )
}

export default memo(ProductCard)
