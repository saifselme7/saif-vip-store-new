import { Link, useNavigate } from 'react-router-dom'
import { Minus, Plus, X, ShoppingBag } from 'lucide-react'
import { useCart } from '@/context/CartContext'
import Price from './ui/Price'

export default function CartDrawer() {
  const { items, isOpen, setIsOpen, updateQty, removeItem, subtotal, count } = useCart()
  const navigate = useNavigate()

  return (
    <>
      {/* Backdrop */}
      <button
        tabIndex={-1}
        aria-label="Close cart"
        onClick={() => setIsOpen(false)}
        className={`fixed inset-0 bg-black/70 z-[110] transition-opacity duration-300 cursor-default ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Panel */}
      <aside
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-[#0A0A0A] border-l border-saif-border z-[115] flex flex-col transition-transform duration-300 ease-saif ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-label="Shopping bag"
        aria-hidden={!isOpen}
      >
        <div className="flex items-center justify-between p-5 border-b border-saif-border">
          <h2 className="text-sm font-bold uppercase tracking-widest text-saif-text">
            Your Bag {count > 0 && `(${count})`}
          </h2>
          <button onClick={() => setIsOpen(false)} className="text-saif-dim hover:text-saif-text transition-colors" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <ShoppingBag size={36} className="text-saif-dim" />
            <p className="text-sm text-saif-dim">Your bag is empty.</p>
            <button onClick={() => { setIsOpen(false); navigate('/products') }} className="btn text-xs">
              Start Shopping
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {items.map(item => (
                <div key={item.id} className="flex gap-4">
                  <Link to={`/products/${item.product.slug}`} onClick={() => setIsOpen(false)} className="w-16 h-20 bg-[#111] flex-shrink-0 overflow-hidden">
                    <img
                      src={item.product.thumbnail || item.product.images?.[0]}
                      alt={item.product.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-saif-text truncate">{item.product.name}</p>
                        {item.variant && <p className="text-xs text-saif-dim mt-0.5">{item.variant.name}</p>}
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-saif-dim hover:text-saif-accent transition-colors"
                        aria-label={`Remove ${item.product.name}`}
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center border border-saif-border">
                        <button onClick={() => updateQty(item.id, item.quantity - 1)} className="px-2 py-1 text-saif-text hover:bg-white/5" aria-label="Decrease">
                          <Minus size={11} />
                        </button>
                        <span className="px-2 text-xs text-saif-text min-w-[1.75rem] text-center">{item.quantity}</span>
                        <button onClick={() => updateQty(item.id, item.quantity + 1)} className="px-2 py-1 text-saif-text hover:bg-white/5" aria-label="Increase">
                          <Plus size={11} />
                        </button>
                      </div>
                      <Price value={(item.variant?.price ?? item.product.price) * item.quantity} className="text-sm font-semibold text-saif-text" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-saif-border p-5 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-saif-dim">Subtotal</span>
                <Price value={subtotal} className="font-semibold text-saif-text" />
              </div>
              <p className="text-xs text-saif-dim">Shipping and discounts are calculated at checkout.</p>
              <button onClick={() => { setIsOpen(false); navigate('/checkout') }} className="btn btn-primary w-full text-xs">
                Checkout
              </button>
              <Link to="/cart" onClick={() => setIsOpen(false)} className="btn w-full text-xs">
                View Bag
              </Link>
            </div>
          </>
        )}
      </aside>
    </>
  )
}
