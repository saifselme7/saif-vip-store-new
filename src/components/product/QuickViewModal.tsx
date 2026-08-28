import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import QuantityStepper from '@/components/ui/QuantityStepper'
import VariantSelector from './VariantSelector'
import { useCart } from '@/context/CartContext'
import { useToast } from '@/context/ToastContext'
import { formatPrice } from '@/lib/utils'
import type { Product } from '@/types'
import { useI18n } from '@/i18n'

interface Props {
  product: Product
  open: boolean
  onClose: () => void
}

export default function QuickViewModal({ product, open, onClose }: Props) {
  const { t } = useI18n()
  const { addItem, setIsOpen } = useCart()
  const { addToast } = useToast()
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)

  const isDigital = product.product_type === 'digital'
  const variants = product.variants ?? []
  const selectedVariant = variants.find(v => v.id === selectedVariantId) ?? null

  const availableStock = selectedVariant ? selectedVariant.stock : product.stock
  const unitPrice = selectedVariant?.price ?? product.price

  const sizes = useMemo(() => [...new Set(variants.map(v => v.size).filter(Boolean))] as string[], [variants])
  const colors = useMemo(() => [...new Set(variants.map(v => v.color).filter(Boolean))] as string[], [variants])

  function handleAdd() {
    if (!isDigital && variants.length > 0 && !selectedVariant) {
      addToast(t('product.selectOptionFirst'), 'error')
      return
    }
    const result = addItem(product, selectedVariant, quantity)
    if (result.ok) {
      addToast(t('product.addedToBag', { name: product.name }))
      onClose()
      setIsOpen(true)
      setSelectedVariantId(null)
      setQuantity(1)
    } else {
      addToast(result.message || t('product.couldNotAdd'), 'error')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('product.quickView')} wide>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="aspect-[3/4] bg-saif-panel overflow-hidden rounded-sm">
          <img
            src={selectedVariant?.image || product.thumbnail || product.images?.[0] || ''}
            alt={product.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>

        <div className="flex flex-col">
          {product.categories?.name && (
            <p className="text-[10px] font-semibold uppercase tracking-wider text-saif-dim">
              {product.categories.name}
            </p>
          )}
          <h3 className="text-xl font-bold tracking-tight text-saif-text mt-1">{product.name}</h3>

          <div className="flex items-baseline gap-3 mt-3">
            <span className="text-xl font-bold text-saif-text">{formatPrice(unitPrice)}</span>
            {product.compare_at_price && (
              <span className="text-sm text-saif-dim line-through">{formatPrice(product.compare_at_price)}</span>
            )}
          </div>

          <p className="mt-4 text-sm text-saif-dim leading-relaxed line-clamp-4">
            {product.short_description || product.description}
          </p>

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
              className="mt-5"
            />
          )}

          <div className="mt-5">
            <span className="label">{t('product.quantity')}</span>
            <QuantityStepper
              value={quantity}
              onChange={setQuantity}
              max={Math.max(1, isDigital ? 99 : availableStock)}
              ariaLabel="Quantity"
            />
            {!isDigital && availableStock > 0 && availableStock <= product.low_stock_threshold && (
              <p className="text-xs text-yellow-400 mt-2">{t('product.lowStock', { count: availableStock })}</p>
            )}
          </div>

          <div className="mt-auto pt-6 space-y-3">
            <button
              onClick={handleAdd}
              disabled={!isDigital && availableStock <= 0}
              className="btn btn-primary w-full"
            >
              {!isDigital && availableStock <= 0 ? 'Sold Out' : 'Add to Bag'}
            </button>
            <Link
              to={`/products/${product.slug}`}
              onClick={onClose}
              className="btn w-full"
            >
              Full Details <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </div>
    </Modal>
  )
}
