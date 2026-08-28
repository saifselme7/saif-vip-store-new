import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Order, Payment } from '@/types'

export function useOrders() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setOrders([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)

    supabase
      .from('orders')
      .select('*, order_items(*), payments(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (cancelled) return
        setOrders((data || []) as unknown as Order[])
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user])

  return { orders, loading }
}

export function useOrder(orderId: string | undefined) {
  const { user } = useAuth()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!orderId || !user) {
      setLoading(false)
      return
    }
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*), payments(*), order_events(*)')
      .eq('id', orderId)
      .order('created_at', { ascending: true, referencedTable: 'order_events' })
      .maybeSingle()
    if (data) {
      const d = data as unknown as Order & { payments?: Payment[] }
      setOrder({ ...d, payment: (d.payments ?? [])[0] ?? null })
    } else {
      setOrder(null)
    }
    setLoading(false)
  }, [orderId, user])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { order, loading, refetch }
}

export function useOrderPayment(orderId: string | undefined) {
  const [payment, setPayment] = useState<Payment | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orderId) {
      setLoading(false)
      return
    }
    supabase
      .from('payments')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle()
      .then(({ data }) => {
        setPayment((data as Payment) ?? null)
        setLoading(false)
      })
  }, [orderId])

  return { payment, loading }
}
