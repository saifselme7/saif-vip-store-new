import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { Product } from '@/types'

export type ProductSort = 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'name'

export interface ProductFilters {
  category?: string
  type?: 'physical' | 'digital'
  featured?: boolean
  bestseller?: boolean
  onSale?: boolean
  search?: string
  minPrice?: number
  maxPrice?: number
  inStock?: boolean
  sort?: ProductSort
  limit?: number
}

function sortColumn(sort?: ProductSort): { column: string; ascending: boolean } {
  switch (sort) {
    case 'oldest': return { column: 'created_at', ascending: true }
    case 'price_asc': return { column: 'price', ascending: true }
    case 'price_desc': return { column: 'price', ascending: false }
    case 'name': return { column: 'name', ascending: true }
    default: return { column: 'created_at', ascending: false }
  }
}

export function useProducts(filters?: ProductFilters) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Stable dependency key instead of object identity.
  const key = useMemo(() => JSON.stringify(filters ?? {}), [filters])

  const fetchProducts = useCallback(async () => {
    const f: ProductFilters = key === '{}' ? {} : JSON.parse(key)
    setLoading(true)
    setError(null)
    const { column, ascending } = sortColumn(f.sort)
    let query = supabase
      .from('products')
      .select('*, categories(*)')
      .eq('status', 'active')
      .order(column, { ascending })

    if (f.category) query = query.eq('category_id', f.category)
    if (f.type) query = query.eq('product_type', f.type)
    if (f.featured) query = query.eq('featured', true)
    if (f.bestseller) query = query.eq('bestseller', true)
    if (f.onSale) query = query.not('compare_at_price', 'is', null)
    if (f.search) {
      const term = f.search.replace(/[%,(){}"]/g, ' ').trim()
      const simple = term.length > 0 && /^[a-zA-Z0-9 -]+$/.test(term)
      query = query.or(
        simple && !term.includes(' ')
          ? `name.ilike.%${term}%,description.ilike.%${term}%,tags.cs.{${term}}`
          : `name.ilike.%${term}%,description.ilike.%${term}%`,
      )
    }
    if (f.minPrice !== undefined) query = query.gte('price', f.minPrice)
    if (f.maxPrice !== undefined) query = query.lte('price', f.maxPrice)
    if (f.inStock) query = query.gt('stock', 0)
    if (f.limit) query = query.limit(f.limit)

    const { data, error: qError } = await query
    if (qError) setError(qError.message)
    else setProducts((data || []) as unknown as Product[])
    setLoading(false)
  }, [key])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  return { products, loading, error, refetch: fetchProducts }
}

export function useProduct(slug: string) {
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    let mounted = true
    setLoading(true)
    supabase
      .from('products')
      .select('*, categories(*), product_variants(*)')
      .eq('slug', slug)
      .maybeSingle()
      .then(({ data, error: qError }) => {
        if (!mounted) return
        if (qError) setError(qError.message)
        else setProduct((data as Product) || null)
        setLoading(false)
      })
    return () => { mounted = false }
  }, [slug])

  return { product, loading, error }
}

/** Related products: same category first, then recent. */
export function useRelatedProducts(product: Product | null, limit = 4) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!product) return
    let mounted = true
    setLoading(true)
    async function run() {
      const results: Product[] = []
      if (product!.category_id) {
        const { data } = await supabase
          .from('products')
          .select('*, categories(*)')
          .eq('status', 'active')
          .eq('category_id', product!.category_id)
          .neq('id', product!.id)
          .limit(limit)
        results.push(...((data || []) as unknown as Product[]))
      }
      if (results.length < limit) {
        const { data } = await supabase
          .from('products')
          .select('*, categories(*)')
          .eq('status', 'active')
          .neq('id', product!.id)
          .order('created_at', { ascending: false })
          .limit(limit)
        for (const p of (data || []) as unknown as Product[]) {
          if (results.length >= limit) break
          if (!results.some(r => r.id === p.id)) results.push(p)
        }
      }
      if (mounted) {
        setProducts(results)
        setLoading(false)
      }
    }
    run()
    return () => { mounted = false }
  }, [product?.id, product?.category_id, limit]) // eslint-disable-line react-hooks/exhaustive-deps

  return { products, loading }
}
