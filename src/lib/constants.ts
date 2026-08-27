import type { OrderStatus, PaymentMethod, PaymentStatus } from '@/types'

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending Payment',
  payment_review: 'Payment In Review',
  confirmed: 'Confirmed',
  processing: 'Processing',
  ready: 'Ready',
  shipped: 'Shipped',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
  refunded: 'Refunded',
}

/** Order timeline steps shown to customers (happy path). */
export const ORDER_TIMELINE: OrderStatus[] = [
  'pending',
  'payment_review',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
]

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'text-yellow-400 border-yellow-400/40',
  payment_review: 'text-amber-400 border-amber-400/40',
  confirmed: 'text-blue-400 border-blue-400/40',
  processing: 'text-purple-400 border-purple-400/40',
  ready: 'text-cyan-400 border-cyan-400/40',
  shipped: 'text-indigo-400 border-indigo-400/40',
  delivered: 'text-green-400 border-green-400/40',
  completed: 'text-emerald-400 border-emerald-400/40',
  cancelled: 'text-red-400 border-red-400/40',
  rejected: 'text-red-500 border-red-500/40',
  refunded: 'text-orange-400 border-orange-400/40',
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  awaiting_payment: 'Awaiting Payment',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  awaiting_payment: 'text-yellow-400 border-yellow-400/40',
  under_review: 'text-amber-400 border-amber-400/40',
  approved: 'text-green-400 border-green-400/40',
  rejected: 'text-red-400 border-red-400/40',
  cancelled: 'text-saif-dim border-saif-border',
}

export interface PaymentMethodMeta {
  id: PaymentMethod
  name: string
  short: string
  instructions: string[]
}

export const PAYMENT_METHODS: PaymentMethodMeta[] = [
  {
    id: 'instapay',
    name: 'InstaPay',
    short: 'InstaPay',
    instructions: [
      'Open your InstaPay app and choose "Send Money".',
      'Send the exact order total to the receiving number shown below.',
      'Add your order number in the transfer note if possible.',
      'Take a clear screenshot of the successful transfer receipt.',
      'Upload the screenshot and submit — we verify manually within a few hours.',
    ],
  },
  {
    id: 'vodafone_cash',
    name: 'Vodafone Cash',
    short: 'VF Cash',
    instructions: [
      'Dial *9# or open the Ana Vodafone app.',
      'Choose "Transfer Money" and send the exact order total to the number below.',
      'Keep the confirmation SMS or take a screenshot of the receipt.',
      'Upload the screenshot and submit — we verify manually within a few hours.',
    ],
  },
]

/** Fallback if site settings haven't loaded yet. The editable source of
 * truth is site_settings.payment_number (admin → settings). */
export const DEFAULT_PAYMENT_NUMBER = '01040324811'

export const EGYPT_GOVERNORATES = [
  'Cairo', 'Giza', 'Alexandria', 'Dakahlia', 'Red Sea', 'Beheira', 'Fayoum',
  'Gharbia', 'Ismailia', 'Menofia', 'Minya', 'Qalyubia', 'New Valley', 'Suez',
  'Aswan', 'Assiut', 'Beni Suef', 'Port Said', 'Damietta', 'Sharqia',
  'South Sinai', 'Kafr El Sheikh', 'Matrouh', 'Luxor', 'Qena', 'North Sinai', 'Sohag',
]

/** Allowed payment status transitions (client-side guidance only —
 * the database RPCs are the source of truth). */
export const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  awaiting_payment: ['under_review', 'cancelled'],
  under_review: ['approved', 'rejected', 'cancelled'],
  approved: [],
  rejected: [],
  cancelled: [],
}
