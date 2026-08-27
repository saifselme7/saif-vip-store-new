import { describe, it, expect } from 'vitest'
import {
  cartSubtotal, computeShipping, computeTotals, couponDiscount,
  availableStock, clampQuantity, isOutOfStock, isLowStock, discountPercent,
  validateCustomerInfo, validatePaymentForm, amountMismatch,
  canTransitionPayment, orderStatusAfterPaymentAction, isValidEgyptianPhone,
} from '../checkout'
import type { CartItem, Product } from '@/types'

const SHIPPING = { shipping_fee: 50, free_shipping_threshold: 1500, minimum_order_amount: null }

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1', name: 'Tee', slug: 'tee', description: '', short_description: '',
    price: 450, compare_at_price: null, product_type: 'physical', category_id: null,
    images: [], thumbnail: null, stock: 10, low_stock_threshold: 5, sku: null,
    status: 'active', featured: false, bestseller: false, tags: [], metadata: {},
    created_at: '', updated_at: '', ...overrides,
  }
}

function makeItem(product: Product, quantity = 1, variant: CartItem['variant'] = null): CartItem {
  return { id: `${product.id}:${variant?.id ?? ''}`, product, variant, quantity }
}

describe('cart totals', () => {
  it('computes subtotal with variant price overrides', () => {
    const p = makeProduct()
    const item = makeItem(p, 2, { id: 'v1', product_id: 'p1', name: 'M', sku: null, price: 500, stock: 5, size: 'M', color: null, image: null, created_at: '' })
    expect(cartSubtotal([item])).toBe(1000)
  })

  it('computes subtotal with base price when variant has none', () => {
    const p = makeProduct({ price: 300 })
    expect(cartSubtotal([makeItem(p, 3)])).toBe(900)
  })

  it('rounds money to 2 decimals', () => {
    const p = makeProduct({ price: 10.005 })
    expect(cartSubtotal([makeItem(p, 3)])).toBe(30.02)
  })
})

describe('shipping', () => {
  it('charges shipping below the free threshold', () => {
    expect(computeShipping(1000, [makeItem(makeProduct())], SHIPPING)).toBe(50)
  })

  it('is free at/above the threshold', () => {
    expect(computeShipping(1500, [makeItem(makeProduct())], SHIPPING)).toBe(0)
  })

  it('is always free for digital-only carts', () => {
    const digital = makeProduct({ product_type: 'digital' })
    expect(computeShipping(100, [makeItem(digital)], SHIPPING)).toBe(0)
  })
})

describe('coupon discount (mirrors the database formula)', () => {
  it('percentage discount', () => {
    expect(couponDiscount({ type: 'percentage', value: 20 }, 1000)).toBe(200)
  })

  it('percentage discount capped by max_discount', () => {
    expect(couponDiscount({ type: 'percentage', value: 50, max_discount: 300 }, 1000)).toBe(300)
  })

  it('fixed discount never exceeds subtotal', () => {
    expect(couponDiscount({ type: 'fixed', value: 500 }, 200)).toBe(200)
  })

  it('never goes negative', () => {
    expect(couponDiscount({ type: 'fixed', value: -50 }, 100)).toBe(0)
  })
})

describe('computeTotals', () => {
  it('combines subtotal, discount and shipping', () => {
    const items = [makeItem(makeProduct({ price: 450 }), 2)]
    const totals = computeTotals(items, { code: 'W20', type: 'percentage', value: 20, discount: 180 }, SHIPPING)
    expect(totals.subtotal).toBe(900)
    expect(totals.discount).toBe(180)
    expect(totals.shipping).toBe(50)
    expect(totals.total).toBe(770)
  })

  it('no coupon → discount 0', () => {
    const totals = computeTotals([makeItem(makeProduct({ price: 2000 }))], null, SHIPPING)
    expect(totals.discount).toBe(0)
    expect(totals.shipping).toBe(0)
    expect(totals.total).toBe(2000)
  })
})

describe('stock rules', () => {
  it('available stock respects variant selection', () => {
    const p = makeProduct({
      stock: 24,
      variants: [
        { id: 'v1', product_id: 'p1', name: 'S', sku: null, price: null, stock: 0, size: 'S', color: null, image: null, created_at: '' },
        { id: 'v2', product_id: 'p1', name: 'M', sku: null, price: null, stock: 3, size: 'M', color: null, image: null, created_at: '' },
      ],
    })
    expect(availableStock(p, 'v1')).toBe(0)
    expect(availableStock(p, 'v2')).toBe(3)
    expect(availableStock(p)).toBe(24)
  })

  it('digital products are effectively unlimited', () => {
    const d = makeProduct({ product_type: 'digital', stock: 999 })
    expect(availableStock(d)).toBe(Number.MAX_SAFE_INTEGER)
  })

  it('clampQuantity caps at available stock', () => {
    const p = makeProduct({ stock: 3 })
    expect(clampQuantity(p, null, 10)).toBe(3)
    expect(clampQuantity(p, null, 0)).toBe(1)
  })

  it('out-of-stock and low-stock detection', () => {
    expect(isOutOfStock(makeProduct({ stock: 0 }))).toBe(true)
    expect(isLowStock(makeProduct({ stock: 3, low_stock_threshold: 5 }))).toBe(true)
    expect(isLowStock(makeProduct({ stock: 9, low_stock_threshold: 5 }))).toBe(false)
    expect(isOutOfStock(makeProduct({ product_type: 'digital', stock: 0 }))).toBe(false)
  })

  it('discount percent', () => {
    expect(discountPercent(makeProduct({ price: 450, compare_at_price: 550 }))).toBe(18)
    expect(discountPercent(makeProduct({ price: 550, compare_at_price: 450 }))).toBeNull()
  })
})

describe('validation', () => {
  it('validates Egyptian phone numbers', () => {
    expect(isValidEgyptianPhone('01040324811')).toBe(true)
    expect(isValidEgyptianPhone('01234567890')).toBe(true)
    expect(isValidEgyptianPhone('0223456789')).toBe(false)
    expect(isValidEgyptianPhone('123')).toBe(false)
  })

  it('requires shipping fields only for physical orders', () => {
    const base = { name: 'Saif', email: 'a@b.co', phone: '01040324811', governorate: '', city: '', address: '', notes: '' }
    expect(Object.keys(validateCustomerInfo(base, false))).toEqual([])
    const errs = validateCustomerInfo(base, true)
    expect(errs.governorate).toBeTruthy()
    expect(errs.city).toBeTruthy()
    expect(errs.address).toBeTruthy()
  })

  it('payment form requires amount, payer and screenshot', () => {
    const errs = validatePaymentForm({ transferred_amount: '', payer_identifier: '', screenshot_path: null })
    expect(errs.transferred_amount).toBeTruthy()
    expect(errs.payer_identifier).toBeTruthy()
    expect(errs.screenshot_path).toBeTruthy()

    const ok = validatePaymentForm({ transferred_amount: 770, payer_identifier: '01040324811', screenshot_path: 'u/x.jpg' })
    expect(Object.keys(ok)).toEqual([])
  })

  it('flags mismatched amounts without blocking', () => {
    expect(amountMismatch(700, 770)).toBe(true)
    expect(amountMismatch(770, 770)).toBe(false)
    expect(amountMismatch('', 770)).toBe(false)
  })
})

describe('payment status transitions', () => {
  it('under review can move to approved/rejected/cancelled', () => {
    expect(canTransitionPayment('under_review', 'approved')).toBe(true)
    expect(canTransitionPayment('under_review', 'rejected')).toBe(true)
    expect(canTransitionPayment('under_review', 'cancelled')).toBe(true)
  })

  it('terminal states cannot move', () => {
    expect(canTransitionPayment('approved', 'rejected')).toBe(false)
    expect(canTransitionPayment('rejected', 'approved')).toBe(false)
    expect(canTransitionPayment('cancelled', 'under_review')).toBe(false)
  })

  it('maps admin actions to order statuses', () => {
    expect(orderStatusAfterPaymentAction('approve')).toBe('confirmed')
    expect(orderStatusAfterPaymentAction('reject')).toBe('payment_review')
    expect(orderStatusAfterPaymentAction('cancel')).toBe('cancelled')
  })
})
