import { useEffect, useState } from 'react'
import { getProductRatingStats } from '@/lib/api'
import type { RatingStat } from '@/types'

/**
 * Shared product rating map (approved reviews only).
 * Cached at module level — every consumer shares one fetch.
 */
export function useProductRatings() {
  const [stats, setStats] = useState<Record<string, RatingStat>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getProductRatingStats().then(list => {
      if (cancelled) return
      const map: Record<string, RatingStat> = {}
      for (const s of list) map[s.product_id] = s
      setStats(map)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const getRating = (productId: string): RatingStat | null => stats[productId] ?? null

  return { stats, loading, getRating }
}
