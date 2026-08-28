import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Product } from '@/types'

export function useWishlist() {
  const { user } = useAuth()
  const [items, setItems] = useState<Product[]>([])
  const [ids, setIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setItems([])
      setIds(new Set())
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)

    async function fetch() {
      const { data } = await supabase
        .from('wishlists')
        .select('product_id, products(*)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })

      if (cancelled) return
      const rows = (data || []) as unknown as { product_id: string; products: Product | null }[]
      const products = rows.map(r => r.products).filter((p): p is Product => !!p)
      setItems(products)
      setIds(new Set(products.map(p => p.id)))
      setLoading(false)
    }
    fetch()

    return () => {
      cancelled = true
    }
  }, [user])

  const add = useCallback(
    async (productId: string) => {
      if (!user) return false
      const { error } = await supabase
        .from('wishlists')
        .upsert({ user_id: user.id, product_id: productId }, { onConflict: 'user_id,product_id' })
      if (error) return false
      setIds(prev => new Set(prev).add(productId))
      return true
    },
    [user],
  )

  const remove = useCallback(
    async (productId: string) => {
      if (!user) return false
      const { error } = await supabase.from('wishlists').delete().eq('user_id', user.id).eq('product_id', productId)
      if (error) return false
      setIds(prev => {
        const next = new Set(prev)
        next.delete(productId)
        return next
      })
      setItems(prev => prev.filter(p => p.id !== productId))
      return true
    },
    [user],
  )

  const isInWishlist = useCallback((productId: string) => ids.has(productId), [ids])

  return { items, ids, loading, add, remove, isInWishlist }
}
