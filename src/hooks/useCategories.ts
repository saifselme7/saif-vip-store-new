import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Category } from '@/types'

// Module-level cache: categories change rarely and are requested by
// many components — avoid re-fetching on every mount.
let cache: Category[] | null = null
let inflight: Promise<Category[]> | null = null
const listeners = new Set<(c: Category[]) => void>()

function notify() {
  if (cache) listeners.forEach(l => l(cache!))
}

async function loadCategories(): Promise<Category[]> {
  if (cache) return cache
  if (!inflight) {
    inflight = (async () => {
      const { data } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
      cache = (data || []) as Category[]
      notify()
      return cache
    })()
    inflight.finally(() => { inflight = null })
  }
  return inflight
}

export function useCategories(includeInactive = false) {
  const [categories, setCategories] = useState<Category[]>(cache ?? [])
  const [loading, setLoading] = useState(!cache)

  useEffect(() => {
    let mounted = true
    if (includeInactive) {
      // Admin view: bypass the active-only cache.
      supabase
        .from('categories')
        .select('*')
        .order('sort_order')
        .then(({ data }) => {
          if (mounted) {
            setCategories((data || []) as Category[])
            setLoading(false)
          }
        })
      return () => { mounted = false }
    }
    if (cache) {
      setCategories(cache)
      setLoading(false)
      return
    }
    const listener = (c: Category[]) => { if (mounted) { setCategories(c); setLoading(false) } }
    listeners.add(listener)
    loadCategories()
    return () => { mounted = false; listeners.delete(listener) }
  }, [includeInactive])

  return { categories, loading }
}

export function invalidateCategoriesCache() {
  cache = null
}
