import type { OrderStatus, PaymentStatus, PaymentMethod } from '@/types'

export const STORE_NAME = 'SAIF STORE'

/** Fallback receiving number; the live value comes from site_settings. */
export const DEFAULT_PAYMENT_NUMBER = '01040324811'

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  payment_review: 'Payment Review',
  confirmed: 'Confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
}

export const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  payment_review: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  confirmed: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  processing: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  shipped: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
  delivered: 'bg-green-500/10 text-green-400 border-green-500/30',
  completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  cancelled: 'bg-red-500/10 text-red-400 border-red-500/30',
  refunded: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
}

export const ORDER_STATUSES = Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  awaiting_payment: 'Awaiting Payment',
  payment_submitted: 'Payment Submitted',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

export const PAYMENT_STATUS_STYLES: Record<PaymentStatus, string> = {
  awaiting_payment: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  payment_submitted: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  under_review: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  approved: 'bg-green-500/10 text-green-400 border-green-500/30',
  rejected: 'bg-red-500/10 text-red-400 border-red-500/30',
  cancelled: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/30',
}

export const PAYMENT_STATUSES = Object.keys(PAYMENT_STATUS_LABELS) as PaymentStatus[]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  instapay: 'InstaPay',
  vodafone_cash: 'Vodafone Cash',
}

export const PAYMENT_METHODS: PaymentMethod[] = ['instapay', 'vodafone_cash']

export const PRODUCT_TYPE_LABELS: Record<string, string> = {
  physical: 'Physical',
  digital: 'Digital',
}

/** Egyptian governorates for the delivery step. */
export const EGYPT_GOVERNORATES = [
  'Cairo',
  'Giza',
  'Alexandria',
  'Qalyubia',
  'Port Said',
  'Suez',
  'Damietta',
  'Dakahlia',
  'Sharqia',
  'Monufia',
  'Gharbia',
  'Beheira',
  'Kafr El Sheikh',
  'Ismailia',
  'Fayoum',
  'Beni Suef',
  'Minya',
  'Asyut',
  'Sohag',
  'Qena',
  'Luxor',
  'Aswan',
  'Red Sea',
  'New Valley',
  'Matrouh',
  'North Sinai',
  'South Sinai',
]

export const MAX_SCREENSHOT_SIZE_MB = 5
export const ACCEPTED_SCREENSHOT_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
