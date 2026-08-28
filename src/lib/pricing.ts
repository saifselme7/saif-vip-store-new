import type { CartItem, SiteSettings } from '@/types'

export interface CartTotals {
  subtotal: number
  discount: number
  shipping: number
  total: number
  hasPhysical: boolean
  freeShippingRemaining: number | null
}

/**
 * Mirrors the server-side calculation in place_order() for display.
 * The database RPC remains the source of truth at checkout time.
 */
export function computeCartTotals(
  items: CartItem[],
  settings: Pick<SiteSettings, 'shipping_fee' | 'free_shipping_threshold'> | null,
  discount = 0,
): CartTotals {
  const subtotal = round2(items.reduce((sum, i) => sum + unitPrice(i) * i.quantity, 0))
  const hasPhysical = items.some(i => i.product.product_type === 'physical')
  const freeThreshold = settings?.free_shipping_threshold ?? null

  let shipping = 0
  if (hasPhysical && items.length > 0) {
    shipping = freeThreshold !== null && subtotal >= freeThreshold ? 0 : (settings?.shipping_fee ?? 0)
  }

  const cappedDiscount = Math.min(discount, subtotal)
  const total = round2(Math.max(0, subtotal - cappedDiscount + shipping))

  return {
    subtotal,
    discount: round2(cappedDiscount),
    shipping: round2(shipping),
    total,
    hasPhysical,
    freeShippingRemaining:
      hasPhysical && freeThreshold !== null && subtotal < freeThreshold
        ? round2(freeThreshold - subtotal)
        : null,
  }
}

export function unitPrice(item: Pick<CartItem, 'product' | 'variant'>): number {
  return item.variant?.price ?? item.product.price
}

/** Client-side mirror of coupon_discount() — preview only. */
export function computeCouponDiscount(
  subtotal: number,
  coupon: { type: 'percentage' | 'fixed'; value: number; max_discount_amount: number | null },
): number {
  let discount =
    coupon.type === 'percentage' ? round2((subtotal * coupon.value) / 100) : Math.min(coupon.value, subtotal)
  if (coupon.max_discount_amount !== null) {
    discount = Math.min(discount, coupon.max_discount_amount)
  }
  return round2(Math.min(discount, subtotal))
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function clampQuantity(qty: number, available: number): number {
  return Math.max(1, Math.min(qty, Math.max(1, available)))
}

/** Effective stock for a cart line (variant stock wins when a variant is selected). */
export function effectiveStock(item: Pick<CartItem, 'product' | 'variant'>): number {
  if (item.variant) return item.variant.stock
  return item.product.stock
}
