import { describe, it, expect } from 'vitest'
import {
  computeCartTotals,
  computeCouponDiscount,
  clampQuantity,
  effectiveStock,
  unitPrice,
  round2,
} from '../src/lib/pricing'
import type { CartItem, Product, ProductVariant, SiteSettings } from '../src/types'

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'Test Product',
    slug: 'test-product',
    description: '',
    short_description: '',
    price: 100,
    compare_at_price: null,
    product_type: 'physical',
    category_id: null,
    images: [],
    thumbnail: null,
    stock: 10,
    low_stock_threshold: 5,
    sku: null,
    status: 'active',
    featured: false,
    bestseller: false,
    tags: [],
    specifications: {},
    delivery_info: null,
    metadata: {},
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

function makeVariant(overrides: Partial<ProductVariant> = {}): ProductVariant {
  return {
    id: 'v1',
    product_id: 'p1',
    name: 'M / Black',
    sku: null,
    price: null,
    stock: 4,
    size: 'M',
    color: 'Black',
    image: null,
    created_at: '',
    ...overrides,
  }
}

const SETTINGS: Pick<SiteSettings, 'shipping_fee' | 'free_shipping_threshold'> = {
  shipping_fee: 75,
  free_shipping_threshold: 1500,
}

describe('computeCartTotals', () => {
  it('computes subtotal from product prices', () => {
    const items: CartItem[] = [
      { id: '1', product: makeProduct({ price: 250 }), variant: null, quantity: 2 },
      { id: '2', product: makeProduct({ id: 'p2', price: 100 }), variant: null, quantity: 1 },
    ]
    const totals = computeCartTotals(items, SETTINGS)
    expect(totals.subtotal).toBe(600)
  })

  it('uses variant price when present', () => {
    const items: CartItem[] = [
      { id: '1', product: makeProduct({ price: 250 }), variant: makeVariant({ price: 300 }), quantity: 2 },
    ]
    expect(computeCartTotals(items, SETTINGS).subtotal).toBe(600)
  })

  it('charges shipping for physical goods below the free threshold', () => {
    const items: CartItem[] = [{ id: '1', product: makeProduct({ price: 1000 }), variant: null, quantity: 1 }]
    const totals = computeCartTotals(items, SETTINGS)
    expect(totals.shipping).toBe(75)
    expect(totals.total).toBe(1075)
  })

  it('waives shipping at or above the free threshold', () => {
    const items: CartItem[] = [{ id: '1', product: makeProduct({ price: 1500 }), variant: null, quantity: 1 }]
    const totals = computeCartTotals(items, SETTINGS)
    expect(totals.shipping).toBe(0)
    expect(totals.total).toBe(1500)
    expect(totals.freeShippingRemaining).toBeNull()
  })

  it('never charges shipping for digital-only carts', () => {
    const items: CartItem[] = [
      { id: '1', product: makeProduct({ product_type: 'digital', price: 500 }), variant: null, quantity: 1 },
    ]
    const totals = computeCartTotals(items, SETTINGS)
    expect(totals.shipping).toBe(0)
    expect(totals.hasPhysical).toBe(false)
  })

  it('charges shipping when a physical item is mixed with digital ones', () => {
    const items: CartItem[] = [
      { id: '1', product: makeProduct({ product_type: 'digital' }), variant: null, quantity: 1 },
      { id: '2', product: makeProduct({ id: 'p2', price: 100 }), variant: null, quantity: 1 },
    ]
    expect(computeCartTotals(items, SETTINGS).shipping).toBe(75)
  })

  it('applies discount and caps it at the subtotal', () => {
    const items: CartItem[] = [{ id: '1', product: makeProduct({ price: 200 }), variant: null, quantity: 1 }]
    const totals = computeCartTotals(items, SETTINGS, 500)
    expect(totals.discount).toBe(200) // capped from 500
    expect(totals.total).toBe(75) // 200 - 200 + 75 shipping
  })

  it('shows remaining amount for free shipping', () => {
    const items: CartItem[] = [{ id: '1', product: makeProduct({ price: 1000 }), variant: null, quantity: 1 }]
    const totals = computeCartTotals(items, SETTINGS)
    expect(totals.freeShippingRemaining).toBe(500)
  })
})

describe('computeCouponDiscount', () => {
  it('computes percentage discounts', () => {
    expect(computeCouponDiscount(1000, { type: 'percentage', value: 20, max_discount_amount: null })).toBe(200)
  })

  it('caps percentage discounts at max_discount_amount', () => {
    expect(computeCouponDiscount(1000, { type: 'percentage', value: 30, max_discount_amount: 200 })).toBe(200)
  })

  it('caps fixed discounts at the subtotal', () => {
    expect(computeCouponDiscount(100, { type: 'fixed', value: 150, max_discount_amount: null })).toBe(100)
  })

  it('handles zero subtotal safely', () => {
    expect(computeCouponDiscount(0, { type: 'percentage', value: 20, max_discount_amount: null })).toBe(0)
  })
})

describe('stock helpers', () => {
  it('uses variant stock over product stock', () => {
    const item: CartItem = {
      id: '1',
      product: makeProduct({ stock: 50 }),
      variant: makeVariant({ stock: 3 }),
      quantity: 1,
    }
    expect(effectiveStock(item)).toBe(3)
  })

  it('falls back to product stock without a variant', () => {
    const item: CartItem = { id: '1', product: makeProduct({ stock: 50 }), variant: null, quantity: 1 }
    expect(effectiveStock(item)).toBe(50)
  })

  it('clamps quantity between 1 and availability', () => {
    expect(clampQuantity(5, 3)).toBe(3)
    expect(clampQuantity(0, 3)).toBe(1)
    expect(clampQuantity(2, 3)).toBe(2)
    expect(clampQuantity(-4, 0)).toBe(1)
  })

  it('unitPrice prefers the variant price', () => {
    expect(unitPrice({ product: makeProduct({ price: 100 }), variant: makeVariant({ price: 120 }) })).toBe(120)
    expect(unitPrice({ product: makeProduct({ price: 100 }), variant: null })).toBe(100)
    expect(unitPrice({ product: makeProduct({ price: 100 }), variant: makeVariant({ price: null }) })).toBe(100)
  })
})

describe('round2', () => {
  it('rounds to two decimals', () => {
    expect(round2(10.005)).toBe(10.01)
    expect(round2(0.1 + 0.2)).toBe(0.3)
  })
})
