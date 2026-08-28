import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Minus, Plus, X, ShoppingBag, Trash2 } from 'lucide-react'
import { useCart } from '@/context/CartContext'
import { useToast } from '@/context/ToastContext'
import { useApp } from '@/context/AppContext'
import { useI18n } from '@/i18n'
import { usePageMeta } from '@/hooks/usePageMeta'
import { formatPrice, cn } from '@/lib/utils'
import { effectiveStock } from '@/lib/pricing'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Footer from '@/components/Footer'
import EmptyState, { ShopAction } from '@/components/EmptyState'
import type { CartItem } from '@/types'

export default function CartPage() {
  const { t, formatPrice } = useI18n()
  const {
    items,
    count,
    subtotal,
    discount,
    shipping,
    total,
    coupon,
    couponChecking,
    couponError,
    freeShippingRemaining,
    hasPhysical,
    updateQty,
    removeItem,
    clearCart,
    applyCoupon,
    removeCoupon,
  } = useCart()
  const { settings } = useApp()
  const { addToast } = useToast()
  const [couponCode, setCouponCode] = useState('')
  const [clearOpen, setClearOpen] = useState(false)
  usePageMeta({ title: 'Your Bag', description: 'Review the items in your SAIF STORE bag.' })

  const currency = settings?.currency ?? 'EGP'

  if (count === 0) {
    return (
      <div className="animate-[pageIn_0.6s_ease] pt-28 px-5 min-h-[60vh]">
        <EmptyState
          icon={ShoppingBag}
          title={t('cart.empty')}
          description="Items you add will stay here — even after you close the browser."
          action={<ShopAction />}
        />
        <Footer />
      </div>
    )
  }

  return (
    <div className="animate-[pageIn_0.6s_ease] pt-24 md:pt-28 px-5 lg:px-10 pb-20">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-10">
          <h1 className="text-[clamp(34px,6vw,72px)] font-black tracking-tighter text-saif-text">
            {t('cart.title')} <span className="text-saif-dim font-normal text-2xl md:text-4xl">({count})</span>
          </h1>
          <button
            onClick={() => setClearOpen(true)}
            className="text-xs text-saif-dim hover:text-saif-accent transition-colors flex items-center gap-1.5"
          >
            <Trash2 size={13} /> Clear Bag
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Items */}
          <div className="lg:col-span-2 space-y-6">
            {freeShippingRemaining !== null && freeShippingRemaining > 0 && (
              <div className="border border-saif-border p-4 rounded-sm">
                <p className="text-xs text-saif-accent mb-2">
                  {t('cart.freeShippingProgress', { amount: formatPrice(freeShippingRemaining) })}
                </p>
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-saif-accent transition-all duration-500"
                    style={{ width: `${Math.min(100, (subtotal / (subtotal + freeShippingRemaining)) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {items.map((item: CartItem) => {
              const stock = effectiveStock(item)
              const price = item.variant?.price ?? item.product.price
              const maxQty = item.product.product_type === 'digital' ? 99 : Math.max(1, stock)
              return (
                <div key={item.id} className="flex gap-4 sm:gap-5 pb-6 border-b border-saif-border">
                  <Link
                    to={`/products/${item.product.slug}`}
                    className="w-24 h-32 sm:w-28 bg-saif-panel flex-shrink-0 overflow-hidden rounded-sm"
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
                          className="text-sm font-semibold text-saif-text hover:text-saif-accent transition-colors"
                        >
                          {item.product.name}
                        </Link>
                        {item.variant && <p className="text-xs text-saif-dim mt-0.5">{item.variant.name}</p>}
                        {item.product.product_type === 'digital' && (
                          <p className="text-[10px] text-saif-accent uppercase tracking-wider mt-0.5">Digital</p>
                        )}
                        {item.product.product_type === 'physical' && item.quantity >= stock && (
                          <p className="text-[10px] text-yellow-400 mt-0.5">{t('cart.maxStock', { count: stock })}</p>
                        )}
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="w-11 h-11 -mr-2 flex items-center justify-center text-saif-dim hover:text-saif-accent transition-colors"
                        aria-label={t('a11y.removeItem', { name: item.product.name })}
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-4 gap-4 flex-wrap">
                      <div className="inline-flex items-center border border-saif-border rounded-sm" role="group" aria-label={t('a11y.quantityGroup')}>
                        <button
                          onClick={() => updateQty(item.id, item.quantity - 1)}
                          className="w-11 h-11 flex items-center justify-center text-saif-text hover:bg-white/5 active:bg-white/10 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                          disabled={item.quantity <= 1}
                          aria-label={t('a11y.decreaseQuantity')}
                        >
                          <Minus size={12} />
                        </button>
                        <span className="px-3 text-sm text-saif-text tabular-nums" aria-live="polite">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQty(item.id, item.quantity + 1)}
                          className="w-11 h-11 flex items-center justify-center text-saif-text hover:bg-white/5 active:bg-white/10 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                          disabled={item.quantity >= maxQty}
                          aria-label={t('a11y.increaseQuantity')}
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-saif-text">
                          {formatPrice(price * item.quantity)}
                        </p>
                        <p className="text-xs text-saif-dim">{formatPrice(price)} each</p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Summary */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <div className="border border-saif-border p-6 rounded-sm">
              <h2 className="text-sm font-bold uppercase tracking-wider text-saif-text mb-6">{t('cart.orderSummary')}</h2>

              {/* Coupon */}
              {coupon ? (
                <div className="flex items-center justify-between border border-green-500/30 bg-green-500/5 px-3 py-2.5 rounded-sm mb-5">
                  <div>
                    <span className="text-xs font-mono text-green-400">{coupon.code}</span>
                    <p className="text-[11px] text-saif-dim mt-0.5">
                      {coupon.coupon.type === 'percentage'
                        ? `${coupon.coupon.value}% off`
                        : `${formatPrice(coupon.coupon.value)} off`}
                    </p>
                  </div>
                  <button onClick={removeCoupon} className="text-saif-dim hover:text-saif-accent transition-colors" aria-label={t('cart.removeCoupon')}>
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <div className="mb-5">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="input text-xs font-mono uppercase"
                      placeholder={t('cart.coupon')}
                      value={couponCode}
                      onChange={e => setCouponCode(e.target.value.toUpperCase())}
                      aria-label={t('cart.coupon')}
                    />
                    <button
                      className="btn btn-sm"
                      disabled={couponChecking || !couponCode.trim()}
                      onClick={async () => {
                        const ok = await applyCoupon(couponCode)
                        if (ok) {
                          addToast(`Coupon ${couponCode} applied`)
                          setCouponCode('')
                        }
                      }}
                    >
                      {couponChecking ? '…' : 'Apply'}
                    </button>
                  </div>
                  {couponError && <p className="field-error">{couponError}</p>}
                </div>
              )}

              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-saif-dim">
                  <span>{t('common.subtotal')}</span>
                  <span className="text-saif-text">{formatPrice(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-saif-dim">
                    <span>{t('common.discount')}</span>
                    <span className="text-green-400">−{formatPrice(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-saif-dim">
                  <span>{t('common.shipping')}</span>
                  <span className={cn(!hasPhysical || shipping === 0 ? 'text-green-400' : 'text-saif-text')}>
                    {!hasPhysical ? '—' : shipping === 0 ? 'Free' : formatPrice(shipping)}
                  </span>
                </div>
                <div className="flex justify-between text-base font-bold text-saif-text pt-3 border-t border-saif-border">
                  <span>{t('common.total')}</span>
                  <span>{formatPrice(total)}</span>
                </div>
              </div>

              <Link to="/checkout" className="btn btn-primary w-full mt-6">
                Checkout
              </Link>
              <Link to="/products" className="btn btn-sm w-full mt-3">
                Continue Shopping
              </Link>
              <p className="text-[11px] text-saif-faint mt-4 leading-relaxed text-center">
                {t('cart.payNote')}
              </p>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={() => {
          clearCart()
          setClearOpen(false)
          addToast(t('cart.empty'))
        }}
        title={t('cart.clearConfirmTitle')}
        message="{t('cart.clearConfirmDesc')}"
        confirmLabel="Clear Bag"
        danger
      />

      <Footer />
    </div>
  )
}
