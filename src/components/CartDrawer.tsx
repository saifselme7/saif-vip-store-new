import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { X, ShoppingBag, Trash2 } from 'lucide-react'
import { useCart } from '@/context/CartContext'
import { useApp } from '@/context/AppContext'
import { formatPrice, cn } from '@/lib/utils'
import { effectiveStock } from '@/lib/pricing'
import QuantityStepper from './ui/QuantityStepper'

export default function CartDrawer() {
  const closeRef = useRef<HTMLButtonElement>(null)
  const {
    items,
    count,
    subtotal,
    discount,
    shipping,
    total,
    coupon,
    freeShippingRemaining,
    isOpen,
    setIsOpen,
    updateQty,
    removeItem,
  } = useCart()
  const { settings } = useApp()
  const currency = settings?.currency ?? 'EGP'

  // Esc closes; focus lands on the close button when opened
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const t = setTimeout(() => closeRef.current?.focus(), 80)
    return () => {
      document.removeEventListener('keydown', onKey)
      clearTimeout(t)
    }
  }, [isOpen, setIsOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[150]" role="dialog" aria-modal="true" aria-label="Shopping bag">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsOpen(false)} aria-hidden="true" />
      <aside className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-black border-l border-saif-border flex flex-col animate-drawerIn shadow-2xl">
        <header className="flex items-center justify-between px-6 py-5 border-b border-saif-border">
          <h2 className="text-base font-bold tracking-tight text-saif-text flex items-center gap-2.5">
            <ShoppingBag size={16} />
            Your Bag {count > 0 && <span className="text-saif-dim font-normal">({count})</span>}
          </h2>
          <button
            ref={closeRef}
            onClick={() => setIsOpen(false)}
            className="w-11 h-11 flex items-center justify-center text-saif-dim hover:text-saif-text transition-colors -mr-2"
            aria-label="Close cart"
          >
            <X size={20} />
          </button>
        </header>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
            <ShoppingBag size={40} className="text-saif-faint" />
            <p className="text-sm text-saif-dim">Your bag is empty.</p>
            <button className="btn btn-sm" onClick={() => setIsOpen(false)}>
              Continue Shopping
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {freeShippingRemaining !== null && freeShippingRemaining > 0 && (
                <p className="text-xs text-saif-accent">
                  Add {formatPrice(freeShippingRemaining, currency)} more for free shipping
                </p>
              )}
              {items.map(item => {
                const stock = effectiveStock(item)
                const price = item.variant?.price ?? item.product.price
                return (
                  <div key={item.id} className="flex gap-4 pb-5 border-b border-saif-border last:border-0">
                    <Link
                      to={`/products/${item.product.slug}`}
                      onClick={() => setIsOpen(false)}
                      className="w-20 h-24 bg-saif-panel flex-shrink-0 overflow-hidden rounded-sm"
                    >
                      <img
                        src={item.variant?.image || item.product.thumbnail || item.product.images?.[0] || ''}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link
                            to={`/products/${item.product.slug}`}
                            onClick={() => setIsOpen(false)}
                            className="text-sm font-semibold text-saif-text hover:text-saif-accent transition-colors line-clamp-1"
                          >
                            {item.product.name}
                          </Link>
                          {item.variant && <p className="text-xs text-saif-dim mt-0.5">{item.variant.name}</p>}
                          {item.product.product_type === 'digital' && (
                            <p className="text-[10px] text-saif-accent uppercase tracking-wider mt-0.5">Digital</p>
                          )}
                          {item.quantity >= stock && stock > 0 && (
                            <p className="text-[10px] text-yellow-400 mt-0.5">Max stock ({stock})</p>
                          )}
                        </div>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="w-9 h-9 flex items-center justify-center text-saif-dim hover:text-saif-accent transition-colors"
                          aria-label={`Remove ${item.product.name} from bag`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <QuantityStepper
                          value={item.quantity}
                          onChange={qty => updateQty(item.id, qty)}
                          max={Math.max(1, item.product.product_type === 'digital' ? 99 : stock)}
                          ariaLabel={`Quantity for ${item.product.name}`}
                        />
                        <span className="text-sm font-semibold text-saif-text">
                          {formatPrice(price * item.quantity, currency)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <footer className="border-t border-saif-border px-6 py-5 space-y-3">
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-saif-dim">
                  <span>Subtotal</span>
                  <span className="text-saif-text">{formatPrice(subtotal, currency)}</span>
                </div>
                {discount > 0 && coupon && (
                  <div className="flex justify-between text-saif-dim">
                    <span>
                      Discount <span className="text-green-400 font-mono text-xs">{coupon.code}</span>
                    </span>
                    <span className="text-green-400">−{formatPrice(discount, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-saif-dim">
                  <span>Shipping</span>
                  <span className={cn(shipping === 0 && 'text-green-400')}>
                    {shipping === 0 ? 'Free' : formatPrice(shipping, currency)}
                  </span>
                </div>
                <div className="flex justify-between text-base font-bold text-saif-text pt-2 border-t border-saif-border">
                  <span>Total</span>
                  <span>{formatPrice(total, currency)}</span>
                </div>
              </div>
              <Link
                to="/checkout"
                onClick={() => setIsOpen(false)}
                className="btn btn-primary w-full"
              >
                Checkout
              </Link>
              <Link to="/cart" onClick={() => setIsOpen(false)} className="btn btn-sm w-full">
                View Full Bag
              </Link>
            </footer>
          </>
        )}
      </aside>
    </div>
  )
}
