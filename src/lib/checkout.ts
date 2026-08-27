/**
 * Pure, dependency-free checkout/payment business logic.
 * Mirrors the server-side rules in supabase/functions.sql so the UI
 * can show instant feedback; the database always re-validates and
 * re-computes everything, so the client is never trusted.
 */
import type { AppliedCoupon, CartItem, CheckoutCustomerInfo, PaymentStatus, Product } from '@/types'
import { PAYMENT_TRANSITIONS } from './constants'

export interface ShippingSettings {
  shipping_fee: number
  free_shipping_threshold: number | null
  minimum_order_amount: number | null
}

export interface Totals {
  subtotal: number
  discount: number
  shipping: number
  total: number
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function linePrice(item: CartItem): number {
  const unit = item.variant?.price ?? item.product.price
  return round2(unit * item.quantity)
}

export function cartSubtotal(items: CartItem[]): number {
  return round2(items.reduce((sum, i) => sum + linePrice(i), 0))
}

export function hasPhysicalItem(items: CartItem[]): boolean {
  return items.some(i => i.product.product_type === 'physical')
}

/** Same formula the place_order RPC uses. */
export function computeShipping(subtotal: number, items: CartItem[], s: ShippingSettings): number {
  if (!hasPhysicalItem(items)) return 0
  if (s.free_shipping_threshold !== null && subtotal >= s.free_shipping_threshold) return 0
  return round2(Math.max(0, s.shipping_fee || 0))
}

/** Same discount formula the database applies for a validated coupon. */
export function couponDiscount(coupon: Pick<AppliedCoupon, 'type' | 'value'> & { max_discount?: number | null }, subtotal: number): number {
  let discount = coupon.type === 'percentage'
    ? round2((subtotal * coupon.value) / 100)
    : Math.min(coupon.value, subtotal)
  if (coupon.max_discount !== undefined && coupon.max_discount !== null) {
    discount = Math.min(discount, coupon.max_discount)
  }
  return round2(Math.max(0, Math.min(discount, subtotal)))
}

export function computeTotals(items: CartItem[], coupon: AppliedCoupon | null, s: ShippingSettings): Totals {
  const subtotal = cartSubtotal(items)
  const discount = coupon ? couponDiscount(coupon, subtotal) : 0
  const shipping = computeShipping(subtotal, items, s)
  return {
    subtotal,
    discount,
    shipping,
    total: round2(subtotal - discount + shipping),
  }
}

/** Max quantity a customer may add, based on live stock. */
export function availableStock(product: Product, variantId?: string | null): number {
  if (product.product_type === 'digital') return Number.MAX_SAFE_INTEGER
  if (variantId) {
    const v = product.variants?.find(x => x.id === variantId)
    return Math.max(0, v ? v.stock : 0)
  }
  return Math.max(0, product.stock)
}

export function clampQuantity(product: Product, variantId: string | null, qty: number): number {
  return Math.min(Math.max(1, Math.floor(qty)), Math.max(1, availableStock(product, variantId)))
}

export function isOutOfStock(product: Product): boolean {
  if (product.product_type === 'digital') return false
  if (product.variants && product.variants.length > 0) {
    return product.variants.every(v => v.stock <= 0)
  }
  return product.stock <= 0
}

export function isLowStock(product: Product): boolean {
  if (product.product_type === 'digital') return false
  return !isOutOfStock(product) && product.stock <= (product.low_stock_threshold ?? 5)
}

export function discountPercent(product: Product): number | null {
  if (!product.compare_at_price || product.compare_at_price <= product.price) return null
  return Math.round((1 - product.price / product.compare_at_price) * 100)
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export interface FieldErrors {
  [field: string]: string | undefined
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PHONE_RE = /^01[0-9]{9}$/

export function isValidEmail(v: string): boolean {
  return EMAIL_RE.test(v.trim())
}

/** Egyptian mobile numbers: 010/011/012/015 + 8 digits. */
export function isValidEgyptianPhone(v: string): boolean {
  return PHONE_RE.test(v.trim())
}

export function validateCustomerInfo(info: CheckoutCustomerInfo, needsShipping: boolean): FieldErrors {
  const errors: FieldErrors = {}
  if (!info.name.trim() || info.name.trim().length < 3) errors.name = 'Please enter your full name.'
  if (!isValidEmail(info.email)) errors.email = 'Please enter a valid email address.'
  if (!isValidEgyptianPhone(info.phone)) errors.phone = 'Enter a valid Egyptian mobile number (01xxxxxxxxx).'
  if (needsShipping) {
    if (!info.governorate) errors.governorate = 'Select your governorate.'
    if (!info.city.trim()) errors.city = 'Enter your city / area.'
    if (!info.address.trim() || info.address.trim().length < 8) errors.address = 'Enter your full street address.'
  }
  return errors
}

export interface PaymentFormInput {
  transferred_amount: number | ''
  payer_identifier: string
  screenshot_path: string | null
}

export function validatePaymentForm(input: PaymentFormInput): FieldErrors {
  const errors: FieldErrors = {}
  const amount = Number(input.transferred_amount)
  if (input.transferred_amount === '' || Number.isNaN(amount) || amount <= 0) {
    errors.transferred_amount = 'Enter the amount you transferred.'
  }
  if (!input.payer_identifier.trim() || input.payer_identifier.trim().length < 6) {
    errors.payer_identifier = 'Enter the phone/account number you paid from.'
  }
  if (!input.screenshot_path) {
    errors.screenshot_path = 'Please upload the transfer screenshot.'
  }
  return errors
}

/** Non-blocking warning when the entered amount differs from the total —
 * admins verify the real amount against the screenshot. */
export function amountMismatch(amount: number | '', expected: number): boolean {
  if (amount === '') return false
  const n = Number(amount)
  return !Number.isNaN(n) && Math.abs(n - expected) > 0.01
}

/* ------------------------------------------------------------------ */
/* Payment status transitions                                          */
/* ------------------------------------------------------------------ */

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from]?.includes(to) ?? false
}

/** The status an order moves to when a payment action happens. */
export function orderStatusAfterPaymentAction(
  action: 'approve' | 'reject' | 'cancel',
): 'confirmed' | 'payment_review' | 'cancelled' {
  switch (action) {
    case 'approve':
      return 'confirmed'
    case 'reject':
      return 'payment_review' // customer may re-submit evidence
    case 'cancel':
      return 'cancelled'
  }
}
