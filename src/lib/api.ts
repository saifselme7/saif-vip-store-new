import { supabase } from './supabase'
import type {
  CheckoutCustomerPayload,
  CheckoutItemPayload,
  CouponValidation,
  PlaceOrderResult,
  RatingStat,
} from '@/types'

function parseRpcJson<T>(raw: unknown): T | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  }
  return raw as T
}

function errorMessage(error: { message?: string } | null | undefined): string {
  if (!error) return 'Something went wrong. Please try again.'
  // Postgres RAISE EXCEPTION messages arrive as "message" — surface them directly.
  return error.message || 'Something went wrong. Please try again.'
}

// ------------------------------------------------------------
// Coupons
// ------------------------------------------------------------

export async function validateCoupon(code: string, subtotal: number): Promise<CouponValidation> {
  const { data, error } = await supabase.rpc('validate_coupon', {
    p_code: code,
    p_subtotal: subtotal,
  })
  if (error) {
    return { valid: false, reason: errorMessage(error), discount: null, coupon: null }
  }
  const parsed = parseRpcJson<CouponValidation>(data)
  if (!parsed) return { valid: false, reason: 'Coupon could not be validated', discount: null, coupon: null }
  return parsed
}

// ------------------------------------------------------------
// Checkout
// ------------------------------------------------------------

export interface PlaceOrderArgs {
  customer: CheckoutCustomerPayload
  items: CheckoutItemPayload[]
  couponCode: string | null
  paymentMethod: 'instapay' | 'vodafone_cash'
  shipping: { address: string; governorate: string; city: string } | null
  notes: string | null
}

export async function placeOrder(args: PlaceOrderArgs): Promise<{ result: PlaceOrderResult | null; error: string | null }> {
  const { data, error } = await supabase.rpc('place_order', {
    p_customer: args.customer as unknown as import('./database.types').Json,
    p_items: args.items as unknown as import('./database.types').Json,
    p_coupon_code: args.couponCode,
    p_payment_method: args.paymentMethod,
    p_shipping: args.shipping as unknown as import('./database.types').Json,
    p_notes: args.notes,
  })
  if (error) return { result: null, error: errorMessage(error) }
  const parsed = parseRpcJson<PlaceOrderResult>(data)
  if (!parsed || !parsed.order_id) {
    return { result: null, error: 'The order could not be created. Please try again.' }
  }
  return { result: parsed, error: null }
}

export interface SubmitPaymentArgs {
  orderId: string
  payerIdentifier: string
  transferredAmount: number
  screenshotPath: string
  customerNote: string | null
}

export async function submitPayment(
  args: SubmitPaymentArgs,
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabase.rpc('submit_payment', {
    p_order_id: args.orderId,
    p_payer_identifier: args.payerIdentifier,
    p_transferred_amount: args.transferredAmount,
    p_screenshot_path: args.screenshotPath,
    p_customer_note: args.customerNote,
  })
  if (error) return { ok: false, error: errorMessage(error) }
  return { ok: true, error: null }
}

export async function customerCancelOrder(orderId: string): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabase.rpc('customer_cancel_order', { p_order_id: orderId })
  if (error) return { ok: false, error: errorMessage(error) }
  return { ok: true, error: null }
}

// ------------------------------------------------------------
// Admin RPCs
// ------------------------------------------------------------

export async function reviewPayment(
  paymentId: string,
  decision: 'approved' | 'rejected' | 'under_review' | 'cancelled',
  adminNote: string | null,
  rejectionReason: string | null,
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabase.rpc('review_payment', {
    p_payment_id: paymentId,
    p_decision: decision,
    p_admin_note: adminNote,
    p_rejection_reason: rejectionReason,
  })
  if (error) return { ok: false, error: errorMessage(error) }
  return { ok: true, error: null }
}

export async function adminUpdateOrderStatus(
  orderId: string,
  status: string,
  message: string | null,
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabase.rpc('admin_update_order_status', {
    p_order_id: orderId,
    p_status: status,
    p_message: message,
  })
  if (error) return { ok: false, error: errorMessage(error) }
  return { ok: true, error: null }
}

export async function adminAddOrderNote(
  orderId: string,
  note: string,
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabase.rpc('admin_add_order_note', { p_order_id: orderId, p_note: note })
  if (error) return { ok: false, error: errorMessage(error) }
  return { ok: true, error: null }
}

export async function adminSetFulfillment(
  orderItemId: string,
  fulfillmentNote: string,
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabase.rpc('admin_set_fulfillment', {
    p_order_item_id: orderItemId,
    p_fulfillment_note: fulfillmentNote,
  })
  if (error) return { ok: false, error: errorMessage(error) }
  return { ok: true, error: null }
}

export async function adminAdjustStock(
  productId: string,
  variantId: string | null,
  action: 'set' | 'increase' | 'decrease',
  value: number,
  note: string | null,
): Promise<{ ok: boolean; error: string | null; previous?: number; new?: number }> {
  const { data, error } = await supabase.rpc('admin_adjust_stock', {
    p_product_id: productId,
    p_variant_id: variantId,
    p_action: action,
    p_value: value,
    p_note: note,
  })
  if (error) return { ok: false, error: errorMessage(error) }
  const parsed = parseRpcJson<{ previous: number; new: number }>(data)
  return { ok: true, error: null, previous: parsed?.previous, new: parsed?.new }
}

export async function adminDashboardStats<T>(): Promise<{ data: T | null; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_dashboard_stats')
  if (error) return { data: null, error: errorMessage(error) }
  return { data: parseRpcJson<T>(data), error: null }
}

export async function adminSalesAnalytics<T>(days: number): Promise<{ data: T | null; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_sales_analytics', { p_days: days })
  if (error) return { data: null, error: errorMessage(error) }
  return { data: parseRpcJson<T>(data), error: null }
}

// ------------------------------------------------------------
// Public data helpers
// ------------------------------------------------------------

let ratingStatsCache: { at: number; data: RatingStat[] } | null = null
const RATING_CACHE_MS = 60_000

export async function getProductRatingStats(force = false): Promise<RatingStat[]> {
  if (!force && ratingStatsCache && Date.now() - ratingStatsCache.at < RATING_CACHE_MS) {
    return ratingStatsCache.data
  }
  const { data } = await supabase.rpc('get_product_rating_stats')
  const stats = (data ?? []) as RatingStat[]
  ratingStatsCache = { at: Date.now(), data: stats }
  return stats
}

export function invalidateRatingStatsCache() {
  ratingStatsCache = null
}
