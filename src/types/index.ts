import type { Database } from '@/lib/database.types'

type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]

export type Product = Tables<'products'> & {
  categories?: Category | null
  variants?: ProductVariant[]
}

export type ProductVariant = Tables<'product_variants'>

export type Category = Tables<'categories'>

export interface CartItem {
  id: string
  product: Product
  variant: ProductVariant | null
  quantity: number
}

export type WishlistItem = {
  id: string
  product: Product
  created_at: string
}

export type OrderStatus = Enums<'order_status'>
export type PaymentStatus = Enums<'payment_status'>
export type PaymentMethod = Enums<'payment_method'>

export interface ShippingAddress {
  address?: string
  governorate?: string
  city?: string
}

export type Order = Tables<'orders'> & {
  items?: OrderItem[]
  payment?: Payment | null
  events?: OrderEvent[]
}

export type OrderItem = Tables<'order_items'>

export type Payment = Tables<'payments'>

export type OrderEvent = Tables<'order_events'>

export type InventoryLog = Tables<'inventory_logs'>

export type Coupon = Tables<'coupons'>

export type Review = Tables<'reviews'> & {
  profiles?: { full_name: string | null; avatar_url: string | null } | null
}

export type SiteSettings = Tables<'site_settings'>

export type Profile = Tables<'profiles'>

// ---- Checkout RPC payload shapes ----

export interface CheckoutItemPayload {
  product_id: string
  variant_id: string | null
  quantity: number
}

export interface CheckoutCustomerPayload {
  name: string
  email: string
  phone: string
}

export interface PlaceOrderResult {
  order_id: string
  order_number: string
  subtotal: number
  discount: number
  shipping_fee: number
  total: number
}

export interface CouponValidation {
  valid: boolean
  reason: string | null
  discount: number | null
  coupon: {
    code: string
    type: 'percentage' | 'fixed'
    value: number
    min_order_value: number | null
    max_discount_amount: number | null
  } | null
}

export interface RatingStat {
  product_id: string
  avg_rating: number | null
  review_count: number
}
