import { memo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, Plus, Eye, Zap } from 'lucide-react'
import type { Product } from '@/types'
import { useCart } from '@/context/CartContext'
import { useWishlist } from '@/context/WishlistContext'
import { useApp } from '@/context/AppContext'
import { discountPercent, isOutOfStock, isLowStock } from '@/lib/checkout'
import Price from './ui/Price'
import QuickView from './QuickView'

interface Props {
  product: Product
}

function ProductCard({ product }: Props) {
  const { addItem } = useCart()
  const { has, toggle } = useWishlist()
  const { addToast } = useApp()
  const [hovered, setHovered] = useState(false)
  const [quickView, setQuickView] = useState(false)
  const [adding, setAdding] = useState(false)

  const inWishlist = has(product.id)
  const outOfStock = isOutOfStock(product)
  const lowStock = isLowStock(product)
  const percent = discountPercent(product)
  const isDigital = product.product_type === 'digital'
  const categoryName = Array.isArray(product.categories)
    ? product.categories[0]?.name
    : product.categories?.name

  const image = hovered && product.images?.[1]
    ? product.images[1]
    : product.thumbnail || product.images?.[0] || ''

  function handleAdd(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (outOfStock) return
    setAdding(true)
    const ok = addItem(product, null, 1)
    setTimeout(() => setAdding(false), 350)
    if (ok) addToast(`${product.name} added to bag`)
  }

  async function handleWishlist(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    await toggle(product)
  }

  return (
    <>
      <Link
        to={`/products/${product.slug}`}
        className="group block relative"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="relative aspect-[3/4] overflow-hidden bg-[#111]">
          {image ? (
            <img
              src={image}
              alt={product.name}
              loading="lazy"
              className={`w-full h-full object-cover transition-all duration-700 ease-saif group-hover:scale-105 ${outOfStock ? 'opacity-40 grayscale' : ''}`}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-saif-dim text-xs">No image</div>
          )}

          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
            {percent !== null && (
              <span className="bg-saif-accent text-white text-[10px] font-bold px-2 py-1 uppercase tracking-wider">
                −{percent}%
              </span>
            )}
            {product.bestseller && (
              <span className="bg-saif-text text-black text-[10px] font-bold px-2 py-1 uppercase tracking-wider">
                Bestseller
              </span>
            )}
          </div>

          {/* Type indicator */}
          <span className="absolute bottom-3 left-3 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-saif-text bg-black/60 backdrop-blur-sm px-2 py-1">
            {isDigital ? <><Zap size={10} /> Digital</> : 'Physical'}
          </span>

          {/* Stock state */}
          {outOfStock ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="bg-black/80 border border-saif-border text-saif-text text-xs font-bold uppercase tracking-widest px-4 py-2">
                Sold Out
              </span>
            </div>
          ) : lowStock ? (
            <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider text-saif-accent">
              Low stock
            </span>
          ) : null}

          {/* Hover actions */}
          {!outOfStock && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-2 opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
              <button
                onClick={handleWishlist}
                aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
                className="w-9 h-9 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-black transition-colors"
              >
                <Heart size={15} className={inWishlist ? 'fill-saif-accent text-saif-accent' : 'text-saif-text'} />
              </button>
              <button
                onClick={e => { e.preventDefault(); setQuickView(true) }}
                aria-label="Quick view"
                className="w-9 h-9 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-black transition-colors"
              >
                <Eye size={15} className="text-saif-text" />
              </button>
              <button
                onClick={handleAdd}
                disabled={adding}
                aria-label="Add to bag"
                className="w-9 h-9 bg-saif-accent rounded-full flex items-center justify-center hover:bg-saif-accentDark transition-colors disabled:opacity-60"
              >
                <Plus size={15} className="text-white" />
              </button>
            </div>
          )}
        </div>

        <div className="mt-3">
          {categoryName && (
            <p className="text-[10px] uppercase tracking-widest text-saif-dim mb-1">{categoryName}</p>
          )}
          <h3 className="text-sm font-medium text-saif-text group-hover:opacity-70 transition-opacity leading-snug">
            {product.name}
          </h3>
          <div className="mt-1">
            <Price
              value={product.price}
              compareAt={product.compare_at_price}
              className="text-sm font-semibold text-saif-text"
              compareClassName="text-xs"
            />
          </div>
        </div>
      </Link>

      <QuickView product={product} open={quickView} onClose={() => setQuickView(false)} />
    </>
  )
}

export default memo(ProductCard)
