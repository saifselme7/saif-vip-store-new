import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Minus, Plus } from 'lucide-react'
import type { Product } from '@/types'
import { useCart } from '@/context/CartContext'
import { useApp } from '@/context/AppContext'
import { availableStock, isOutOfStock } from '@/lib/checkout'
import Modal from './ui/Modal'
import Price from './ui/Price'

interface Props {
  product: Product
  open: boolean
  onClose: () => void
}

export default function QuickView({ product, open, onClose }: Props) {
  const { addItem } = useCart()
  const { addToast } = useApp()
  const [qty, setQty] = useState(1)

  const outOfStock = isOutOfStock(product)
  const maxQty = availableStock(product, null)
  const image = product.thumbnail || product.images?.[0] || ''

  function handleAdd() {
    if (addItem(product, null, qty)) {
      addToast(`${product.name} added to bag`)
      onClose()
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Quick View" wide>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="aspect-[3/4] bg-[#111] overflow-hidden">
          {image && <img src={image} alt={product.name} className="w-full h-full object-cover" />}
        </div>
        <div className="flex flex-col">
          <h3 className="text-xl font-bold text-saif-text leading-tight">{product.name}</h3>
          <div className="mt-2">
            <Price value={product.price} compareAt={product.compare_at_price} className="text-lg font-bold text-saif-text" />
          </div>
          <p className="mt-3 text-sm text-saif-dim leading-relaxed line-clamp-5">
            {product.short_description || product.description}
          </p>

          {!outOfStock && (
            <div className="mt-5 flex items-center border border-saif-border w-fit">
              <button
                onClick={() => setQty(Math.max(1, qty - 1))}
                className="px-3 py-2 text-saif-text hover:bg-white/5"
                aria-label="Decrease quantity"
              >
                <Minus size={13} />
              </button>
              <span className="px-4 text-sm font-medium text-saif-text min-w-[2.5rem] text-center">{qty}</span>
              <button
                onClick={() => setQty(product.product_type === 'physical' ? Math.min(maxQty, qty + 1) : qty + 1)}
                className="px-3 py-2 text-saif-text hover:bg-white/5"
                aria-label="Increase quantity"
              >
                <Plus size={13} />
              </button>
            </div>
          )}

          <div className="mt-5 flex flex-col gap-2">
            <button onClick={handleAdd} disabled={outOfStock} className="btn btn-primary w-full text-xs">
              {outOfStock ? 'Sold Out' : 'Add to Bag'}
            </button>
            <Link to={`/products/${product.slug}`} onClick={onClose} className="btn w-full text-xs">
              Full Details
            </Link>
          </div>
        </div>
      </div>
    </Modal>
  )
}
