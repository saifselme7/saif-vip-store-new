import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Order } from '@/types'

const ORDER_SELECT = '*, order_items(*, product:products(id, slug, name, thumbnail, images, product_type)), payments(*)'

/** Current customer's orders (with items + payment history). */
export function useOrders() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!user) { setLoading(false); return }
    const { data } = await supabase
      .from('orders')
      .select(ORDER_SELECT)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setOrders((data || []) as unknown as Order[])
    setLoading(false)
  }, [user])

  useEffect(() => { fetch() }, [fetch])

  return { orders, loading, refetch: fetch }
}

/** Single order for the current customer. */
export function useOrder(id: string | undefined) {
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select(ORDER_SELECT)
      .eq('id', id)
      .maybeSingle()
    setOrder((data as unknown as Order) || null)
    setLoading(false)
  }, [id])

  useEffect(() => { fetch() }, [fetch])

  return { order, loading, refetch: fetch }
}

/** All orders (admin — protected route + RLS enforce admin-only). */
export function useAllOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select(ORDER_SELECT)
      .order('created_at', { ascending: false })
      .limit(200)
    setOrders((data || []) as unknown as Order[])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { orders, loading, refetch: fetch }
}

/** The latest payment record attached to an order, if any. */
export function latestPayment(order: Order | null) {
  if (!order?.payments?.length) return null
  return [...order.payments].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0]
}
