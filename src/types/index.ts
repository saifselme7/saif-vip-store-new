export type OrderStatus =
  | 'pending'
  | 'payment_review'
  | 'confirmed'
  | 'processing'
  | 'ready'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'rejected'
  | 'refunded'

export type PaymentStatus = 'awaiting_payment' | 'under_review' | 'approved' | 'rejected' | 'cancelled'
export type PaymentMethod = 'instapay' | 'vodafone_cash'

export interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  image: string | null
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface ProductVariant {
  id: string
  product_id: string
  name: string
  sku: string | null
  price: number | null
  stock: number
  size: string | null
  color: string | null
  image: string | null
  created_at: string
}

export interface Product {
  id: string
  name: string
  slug: string
  description: string
  short_description: string
  price: number
  compare_at_price: number | null
  product_type: 'physical' | 'digital'
  category_id: string | null
  images: string[]
  thumbnail: string | null
  stock: number
  low_stock_threshold: number
  sku: string | null
  status: 'active' | 'draft' | 'archived'
  featured: boolean
  bestseller: boolean
  tags: string[]
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  categories?: Category | Category[] | null
  variants?: ProductVariant[]
}

export interface CartItem {
  /** Stable line id: productId or productId:variantId */
  id: string
  product: Product
  variant: ProductVariant | null
  quantity: number
}

export interface AppliedCoupon {
  code: string
  type: 'percentage' | 'fixed'
  value: number
  discount: number
}

export interface Order {
  id: string
  order_number: string
  user_id: string
  status: OrderStatus
  subtotal: number
  discount: number
  shipping_fee: number
  total: number
  coupon_code: string | null
  payment_method: PaymentMethod | null
  customer_name: string
  customer_email: string
  customer_phone: string | null
  shipping_address: Record<string, string> | null
  notes: string | null
  digital_delivery: Record<string, unknown>
  stock_released: boolean
  created_at: string
  updated_at: string
  items?: OrderItem[]
  payments?: Payment[]
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  variant_id: string | null
  product_name: string
  variant_name: string | null
  product_type: 'physical' | 'digital'
  price: number
  quantity: number
  total: number
  product?: Product | null
}

export interface Payment {
  id: string
  order_id: string
  user_id: string
  payment_method: PaymentMethod
  status: PaymentStatus
  expected_amount: number
  transferred_amount: number | null
  payer_identifier: string | null
  screenshot_path: string | null
  customer_note: string | null
  admin_note: string | null
  rejection_reason: string | null
  verified_by: string | null
  verified_at: string | null
  created_at: string
  updated_at: string
  orders?: Pick<Order, 'order_number' | 'customer_name' | 'customer_phone' | 'total' | 'status'> | null
}

export interface Review {
  id: string
  product_id: string
  user_id: string
  rating: number
  title: string
  body: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  user?: { full_name: string | null; avatar_url: string | null } | null
  products?: { name: string } | null
}

export interface Coupon {
  id: string
  code: string
  type: 'percentage' | 'fixed'
  value: number
  min_order_value: number | null
  max_discount: number | null
  max_uses: number | null
  uses_count: number
  expires_at: string | null
  is_active: boolean
  created_at: string
}

export interface SiteSettings {
  id: string
  store_name: string
  store_description: string
  logo_url: string | null
  favicon_url: string | null
  contact_email: string
  contact_phone: string | null
  social_links: Record<string, string>
  announcement: string | null
  maintenance_mode: boolean
  currency: string
  shipping_fee: number
  free_shipping_threshold: number | null
  minimum_order_amount: number | null
  payment_number: string
  hero_title: string | null
  hero_subtitle: string | null
  hero_image: string | null
  footer_text: string | null
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  full_name: string | null
  avatar_url: string | null
  phone: string | null
  address: Record<string, unknown> | null
  role: 'customer' | 'admin'
  created_at: string
  updated_at: string
}

export interface CheckoutCustomerInfo {
  name: string
  email: string
  phone: string
  governorate: string
  city: string
  address: string
  notes: string
}
