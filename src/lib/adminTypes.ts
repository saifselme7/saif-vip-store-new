export interface AnalyticsTotals {
  revenue: number
  orders: number
  avg_order_value: number
  customers: number
  products: number
  low_stock: number
  out_of_stock: number
  awaiting_payments: number
  pending_orders: number
}

export interface DailySales { day: string; revenue: number; orders: number }
export interface TopProduct { name: string; units: number; revenue: number }
export interface PaymentMethodStat { method: string; count: number; total: number }
export interface OrderStatusStat { status: string; count: number }
export interface ProductTypeStat { type: 'physical' | 'digital'; revenue: number }

export interface AnalyticsSummary {
  totals: AnalyticsTotals
  daily: DailySales[]
  top_products: TopProduct[]
  payment_methods: PaymentMethodStat[]
  order_statuses: OrderStatusStat[]
  product_types: ProductTypeStat[]
}

export interface CustomerStat {
  id: string
  full_name: string | null
  phone: string | null
  created_at: string
  order_count: number
  total_spent: number
  last_order_at: string | null
}
