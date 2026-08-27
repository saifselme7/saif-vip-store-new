import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Review } from '@/types'

export function useReviews(productId?: string, limit?: number) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function fetch() {
      let query = supabase
        .from('reviews')
        .select('*, user:profiles(full_name, avatar_url)')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
      if (productId) query = query.eq('product_id', productId)
      if (limit) query = query.limit(limit)
      const { data } = await query
      if (mounted) {
        setReviews((data || []) as unknown as Review[])
        setLoading(false)
      }
    }
    fetch()
    return () => { mounted = false }
  }, [productId, limit])

  return { reviews, loading }
}
