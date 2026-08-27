import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Minus, Plus, Trash2, Ticket, X } from 'lucide-react'
import { useCart } from '@/context/CartContext'
import { useApp } from '@/context/AppContext'
import { usePageMeta } from '@/hooks/usePageMeta'
import { formatPrice } from '@/lib/utils'
import EmptyState from '@/components/EmptyState'
import Price from '@/components/ui/Price'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

export default function CartPage() {
  const navigate = useNavigate()
  const {
    items, count, subtotal, discount, shipping, total,
    updateQty, removeItem, clearCart,
    coupon, applyCoupon, removeCoupon, couponBusy,
  } = useCart()
  const { settings, addToast } = useApp()
  const [code, setCode] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)

  usePageMeta('Your Bag', 'Review your SAIF STORE bag.')

  const currency = settings?.currency || 'EGP'
  const hasPhysical = items.some(i => i.product.product_type === 'physical')
  const minOrder = settings?.minimum_order_amount ?? null

  async function handleApply(e: React.FormEvent) {
    e.preventDefault()
    const res = await applyCoupon(code)
    if (res.ok) {
      addToast(res.message)
      setCode('')
    } else {
      addToast(res.message, 'error')
    }
  }

  if (count === 0) {
    return (
      <div className="animate-[pageIn_0.5s_ease] px-6 pt-20 min-h-[55vh]">
        <EmptyState title="Your bag is empty" description="Add some products and they will appear here." />
        <div className="text-center mt-6">
          <Link to="/products" className="btn">Continue Shopping</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-[pageIn_0.5s_ease] px-4 sm:px-6 lg:px-10 pt-10 pb-20">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-end justify-between mb-10">
          <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-saif-text">
            Your Bag ({count})
          </h1>
          <button onClick={() => setConfirmClear(true)} className="text-xs text-saif-dim hover:text-saif-accent transition-colors flex items-center gap-1.5">
            <Trash2 size={13} /> Clear Bag
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Items */}
          <div className="lg:col-span-2 space-y-6">
            {items.map(item => (
              <div key={item.id} className="flex gap-4 pb-6 border-b border-saif-border">
                <Link to={`/products/${item.product.slug}`} className="w-20 sm:w-24 aspect-[3/4] bg-[#111] flex-shrink-0 overflow-hidden">
                  <img src={item.product.thumbnail || item.product.images?.[0]} alt={item.product.name} className="w-full h-full object-cover" loading="lazy" />
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link to={`/products/${item.product.slug}`} className="text-sm font-semibold text-saif-text hover:opacity-70 transition-opacity">
                        {item.product.name}
                      </Link>
                      <p className="text-xs text-saif-dim mt-0.5">
                        {item.variant ? `${item.variant.name} · ` : ''}{item.product.product_type === 'digital' ? 'Digital' : 'Physical'}
                      </p>
                    </div>
                    <button onClick={() => removeItem(item.id)} className="text-saif-dim hover:text-saif-accent transition-colors p-1" aria-label={`Remove ${item.product.name}`}>
                      <X size={16} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center border border-saif-border">
                      <button onClick={() => updateQty(item.id, item.quantity - 1)} className="px-3 py-2 text-saif-text hover:bg-white/5" aria-label="Decrease quantity">
                        <Minus size={12} />
                      </button>
                      <span className="px-3 text-sm text-saif-text min-w-[2.5rem] text-center">{item.quantity}</span>
                      <button onClick={() => updateQty(item.id, item.quantity + 1)} className="px-3 py-2 text-saif-text hover:bg-white/5" aria-label="Increase quantity">
                        <Plus size={12} />
                      </button>
                    </div>
                    <Price value={(item.variant?.price ?? item.product.price) * item.quantity} className="text-sm font-bold text-saif-text" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="border border-saif-border p-6">
              <h2 className="text-sm font-bold uppercase tracking-widest text-saif-text mb-5">Order Summary</h2>

              {/* Coupon */}
              {coupon ? (
                <div className="flex items-center justify-between bg-green-500/10 border border-green-500/30 px-3 py-2.5 mb-4">
                  <span className="text-xs font-semibold text-green-400 flex items-center gap-1.5">
                    <Ticket size={13} /> {coupon.code} applied
                  </span>
                  <button onClick={removeCoupon} className="text-xs text-saif-dim hover:text-saif-accent transition-colors" aria-label="Remove coupon">
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApply} className="flex gap-2 mb-4">
                  <input
                    value={code}
                    onChange={e => setCode(e.target.value.toUpperCase())}
                    placeholder="Coupon code"
                    aria-label="Coupon code"
                    className="input text-xs px-3 py-2.5 flex-1"
                  />
                  <button type="submit" disabled={couponBusy || !code.trim()} className="btn text-[10px] px-4 py-2.5">
                    {couponBusy ? '…' : 'Apply'}
                  </button>
                </form>
              )}

              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between text-saif-dim">
                  <span>Subtotal</span>
                  <Price value={subtotal} className="text-saif-text" />
                </div>
                {coupon && (
                  <div className="flex justify-between text-green-400">
                    <span>Discount</span>
                    <span>−{formatPrice(discount, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-saif-dim">
                  <span>Shipping</span>
                  <span>{hasPhysical ? (shipping === 0 ? 'Free' : formatPrice(shipping, currency)) : '—'}</span>
                </div>
                {hasPhysical && settings?.free_shipping_threshold != null && subtotal < settings.free_shipping_threshold && (
                  <p className="text-xs text-saif-accent">
                    Add {formatPrice(settings.free_shipping_threshold - subtotal, currency)} more for free shipping.
                  </p>
                )}
                <div className="border-t border-saif-border pt-3 flex justify-between text-base font-bold text-saif-text">
                  <span>Total</span>
                  <Price value={total} className="text-saif-text" />
                </div>
              </div>

              {minOrder != null && subtotal < minOrder && (
                <p className="mt-4 text-xs text-red-400" role="alert">
                  Minimum order amount is {formatPrice(minOrder, currency)}.
                </p>
              )}

              <button
                onClick={() => navigate('/checkout')}
                disabled={minOrder != null && subtotal < minOrder}
                className="btn btn-primary w-full mt-6 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Checkout
              </button>
              <Link to="/products" className="btn w-full mt-3 text-xs">Continue Shopping</Link>
              <p className="mt-4 text-xs text-saif-dim leading-relaxed">
                Pay with InstaPay or Vodafone Cash — verified manually by our team.
              </p>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Clear your bag?"
        message="All items and any applied coupon will be removed."
        confirmLabel="Clear Bag"
        danger
        onConfirm={() => { clearCart(); setConfirmClear(false); addToast('Bag cleared') }}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  )
}
