import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Review } from '@/types'

export function useReviews(productId?: string) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    let query = supabase
      .from('reviews')
      .select('*, profiles(full_name, avatar_url)')
      .eq('status', 'approved')
    if (productId) query = query.eq('product_id', productId)
    query
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (cancelled) return
        setReviews((data || []) as unknown as Review[])
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [productId])

  const stats = {
    count: reviews.length,
    average: reviews.length ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10 : 0,
    distribution: [5, 4, 3, 2, 1].map(rating => ({
      rating,
      count: reviews.filter(r => r.rating === rating).length,
    })),
  }

  return { reviews, stats, loading }
}

export interface ReviewDraft {
  productId: string
  rating: number
  title: string
  body: string
}

export async function submitReview(draft: ReviewDraft): Promise<{ error: string | null }> {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'Please sign in to write a review' }

  const { error } = await supabase.from('reviews').insert({
    product_id: draft.productId,
    user_id: userData.user.id,
    rating: draft.rating,
    title: draft.title,
    body: draft.body,
    status: 'pending',
  })
  if (error) {
    if (error.code === '23505') return { error: 'You have already reviewed this product' }
    return { error: error.message }
  }
  return { error: null }
}
