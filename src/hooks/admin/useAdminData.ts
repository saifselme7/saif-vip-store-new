import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import type {
  Category,
  Coupon,
  InventoryLog,
  Order,
  Payment,
  Product,
  Profile,
  Review,
} from '@/types'

type ProductInsert = Database['public']['Tables']['products']['Insert']
type ProductUpdate = Database['public']['Tables']['products']['Update']
type CategoryInsert = Database['public']['Tables']['categories']['Insert']
type CategoryUpdate = Database['public']['Tables']['categories']['Update']
type CouponInsert = Database['public']['Tables']['coupons']['Insert']
type CouponUpdate = Database['public']['Tables']['coupons']['Update']

type WithPayment = Order & { payment: Payment | null }

// ------------------------------------------------------------
// Products
// ------------------------------------------------------------

export function useAdminProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('products')
      .select('*, categories(name), variants:product_variants(*)')
      .order('created_at', { ascending: false })
    setProducts((data || []) as unknown as Product[])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetch()
  }, [fetch])

  const create = useCallback(
    async (product: ProductInsert) => {
      const { data, error } = await supabase.from('products').insert(product).select().single()
      if (!error) fetch()
      return { data, error }
    },
    [fetch],
  )

  const update = useCallback(
    async (id: string, patch: ProductUpdate) => {
      const { error } = await supabase.from('products').update(patch).eq('id', id)
      if (!error) fetch()
      return { error }
    },
    [fetch],
  )

  const remove = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('products').delete().eq('id', id)
      if (!error) fetch()
      return { error }
    },
    [fetch],
  )

  const duplicate = useCallback(
    async (product: Product) => {
      const { id: _id, created_at: _c, updated_at: _u, categories: _cat, variants: _v, ...rest } = product
      const copy: ProductInsert = {
        ...rest,
        name: `${product.name} (Copy)`,
        slug: `${product.slug}-copy-${Date.now().toString(36)}`,
        sku: product.sku ? `${product.sku}-C` : null,
        status: 'draft' as const,
        featured: false,
        bestseller: false,
      }
      const { data, error } = await supabase.from('products').insert(copy).select().single()
      if (!error && data) {
        // Copy variants
        if (product.variants?.length) {
          await supabase.from('product_variants').insert(
            product.variants.map(v => ({
              product_id: (data as { id: string }).id,
              name: v.name,
              sku: v.sku,
              price: v.price,
              stock: v.stock,
              size: v.size,
              color: v.color,
              image: v.image,
            })),
          )
        }
        fetch()
      }
      return { data, error }
    },
    [fetch],
  )

  return { products, loading, create, update, remove, duplicate, refetch: fetch }
}

// ------------------------------------------------------------
// Orders (with payment join)
// ------------------------------------------------------------

export function useAdminOrders() {
  const [orders, setOrders] = useState<WithPayment[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*), payments(*)')
      .order('created_at', { ascending: false })
      .limit(500)
    setOrders(
      (data || []).map((o: Record<string, unknown>) => ({
        ...(o as unknown as Order),
        payment: ((o as { payments?: Payment[] }).payments ?? [])[0] ?? null,
      })),
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { orders, loading, refetch: fetch }
}

export function useAdminOrder(orderId: string | undefined) {
  const [order, setOrder] = useState<(WithPayment & { events?: Order['events'] }) | null>(null)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!orderId) return
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*), payments(*), order_events(*)')
      .eq('id', orderId)
      .order('created_at', { ascending: true, referencedTable: 'order_events' })
      .maybeSingle()
    if (data) {
      const d = data as unknown as Record<string, unknown>
      setOrder({
        ...(d as unknown as WithPayment & { events?: Order['events'] }),
        payment: ((d as { payments?: Payment[] }).payments ?? [])[0] ?? null,
      })
    } else {
      setOrder(null)
    }
    setLoading(false)
  }, [orderId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { order, loading, refetch }
}

// ------------------------------------------------------------
// Payments queue
// ------------------------------------------------------------

export function useAdminPayments(status?: string) {
  const [payments, setPayments] = useState<(Payment & { order?: Order })[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('payments')
      .select('*, orders(*)')
      .order('created_at', { ascending: false })
      .limit(300)
    if (status) query = query.eq('payment_status', status as Database['public']['Enums']['payment_status'])
    const { data } = await query
    setPayments(
      (data || []).map((p: Record<string, unknown>) => ({
        ...(p as unknown as Payment),
        order: (p as { orders?: Order }).orders ?? undefined,
      })),
    )
    setLoading(false)
  }, [status])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { payments, loading, refetch: fetch }
}

// ------------------------------------------------------------
// Categories
// ------------------------------------------------------------

export function useAdminCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('categories').select('*').order('sort_order')
    setCategories((data || []) as Category[])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetch()
  }, [fetch])

  const create = useCallback(
    async (cat: CategoryInsert) => {
      const { error } = await supabase.from('categories').insert(cat)
      if (!error) fetch()
      return { error }
    },
    [fetch],
  )

  const update = useCallback(
    async (id: string, cat: CategoryUpdate) => {
      const { error } = await supabase.from('categories').update(cat).eq('id', id)
      if (!error) fetch()
      return { error }
    },
    [fetch],
  )

  const remove = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('categories').delete().eq('id', id)
      if (!error) fetch()
      return { error }
    },
    [fetch],
  )

  return { categories, loading, create, update, remove, refetch: fetch }
}

// ------------------------------------------------------------
// Coupons
// ------------------------------------------------------------

export function useAdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false })
    setCoupons((data || []) as Coupon[])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetch()
  }, [fetch])

  const create = useCallback(
    async (coupon: CouponInsert) => {
      const { error } = await supabase.from('coupons').insert(coupon)
      if (!error) fetch()
      return { error }
    },
    [fetch],
  )

  const update = useCallback(
    async (id: string, coupon: CouponUpdate) => {
      const { error } = await supabase.from('coupons').update(coupon).eq('id', id)
      if (!error) fetch()
      return { error }
    },
    [fetch],
  )

  const remove = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('coupons').delete().eq('id', id)
      if (!error) fetch()
      return { error }
    },
    [fetch],
  )

  return { coupons, loading, create, update, remove, refetch: fetch }
}

// ------------------------------------------------------------
// Reviews (moderation)
// ------------------------------------------------------------

export function useAdminReviews() {
  const [reviews, setReviews] = useState<(Review & { products?: { name: string } | null })[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('reviews')
      .select('*, profiles(full_name), products(name)')
      .order('created_at', { ascending: false })
      .limit(300)
    setReviews((data || []) as unknown as (Review & { products?: { name: string } | null })[])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetch()
  }, [fetch])

  const updateStatus = useCallback(
    async (id: string, status: Database['public']['Enums']['review_status']) => {
      const { error } = await supabase.from('reviews').update({ status }).eq('id', id)
      if (!error) fetch()
      return { error }
    },
    [fetch],
  )

  const remove = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('reviews').delete().eq('id', id)
      if (!error) fetch()
      return { error }
    },
    [fetch],
  )

  return { reviews, loading, updateStatus, remove, refetch: fetch }
}

// ------------------------------------------------------------
// Customers (with order statistics via RPC)
// ------------------------------------------------------------

export interface CustomerStats {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  created_at: string
  orders_count: number
  total_spent: number
  last_order_at: string | null
}

export function useAdminCustomers() {
  const [customers, setCustomers] = useState<CustomerStats[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc('admin_customer_stats')
    if (!error && data) {
      setCustomers(data as CustomerStats[])
    } else {
      // Fallback to plain profiles if the RPC is unavailable
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'customer')
        .order('created_at', { ascending: false })
      setCustomers(
        (profiles || []).map((p: Profile) => ({
          id: p.id,
          full_name: p.full_name,
          email: null,
          phone: p.phone,
          created_at: p.created_at,
          orders_count: 0,
          total_spent: 0,
          last_order_at: null,
        })),
      )
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { customers, loading, refetch: fetch }
}

// ------------------------------------------------------------
// Inventory logs
// ------------------------------------------------------------

export function useInventoryLogs(productId?: string) {
  const [logs, setLogs] = useState<InventoryLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!productId) {
      setLoading(false)
      return
    }
    let cancelled = false
    supabase
      .from('inventory_logs')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (cancelled) return
        setLogs((data || []) as InventoryLog[])
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [productId])

  return { logs, loading }
}
