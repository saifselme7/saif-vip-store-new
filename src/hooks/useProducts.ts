import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Product } from '@/types'

export type ProductSort = 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'popular'

export interface ProductFilters {
  category?: string
  type?: 'physical' | 'digital'
  featured?: boolean
  bestseller?: boolean
  onSale?: boolean
  inStock?: boolean
  search?: string
  minPrice?: number
  maxPrice?: number
  sort?: ProductSort
  limit?: number
}

const SORTS: Record<ProductSort, { column: string; ascending: boolean }> = {
  newest: { column: 'created_at', ascending: false },
  oldest: { column: 'created_at', ascending: true },
  price_asc: { column: 'price', ascending: true },
  price_desc: { column: 'price', ascending: false },
  popular: { column: 'created_at', ascending: false },
}

function buildQuery(filters: ProductFilters) {
  let query = supabase
    .from('products')
    .select('*, categories(*), variants:product_variants(*)')
    .eq('status', 'active')

  if (filters.category) query = query.eq('category_id', filters.category)
  if (filters.type) query = query.eq('product_type', filters.type)
  if (filters.featured) query = query.eq('featured', true)
  if (filters.bestseller) query = query.eq('bestseller', true)
  if (filters.onSale) query = query.not('compare_at_price', 'is', null)
  if (filters.inStock) query = query.gt('stock', 0)
  if (filters.search) {
    const term = filters.search.replace(/[%,()]/g, ' ').trim()
    if (term) {
      query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%,short_description.ilike.%${term}%`)
    }
  }
  if (filters.minPrice !== undefined) query = query.gte('price', filters.minPrice)
  if (filters.maxPrice !== undefined) query = query.lte('price', filters.maxPrice)
  if (filters.limit) query = query.limit(filters.limit)

  const sort = SORTS[filters.sort ?? 'newest']
  return query.order(sort.column, { ascending: sort.ascending })
}

export function useProducts(filters: ProductFilters = {}) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const filterKey = JSON.stringify(filters)
  const filtersRef = useRef(filters)
  filtersRef.current = useMemo(() => JSON.parse(filterKey) as ProductFilters, [filterKey])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const { data, error: err } = await buildQuery(filtersRef.current)
      if (cancelled) return
      if (err) setError(err.message)
      else {
        setProducts((data || []) as Product[])
        setError(null)
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [filterKey])

  return { products, loading, error }
}

export function useProduct(slug: string) {
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    async function fetch() {
      const { data, error: err } = await supabase
        .from('products')
        .select('*, categories(*), variants:product_variants(*)')
        .eq('slug', slug)
        .maybeSingle()
      if (cancelled) return
      if (err) setError(err.message)
      else setProduct((data as Product) ?? null)
      setLoading(false)
    }
    if (slug) fetch()
    else {
      setProduct(null)
      setLoading(false)
    }
    return () => {
      cancelled = true
    }
  }, [slug])

  return { product, loading, error }
}

/** Related products from the same category (excluding the current product). */
export function useRelatedProducts(product: Product | null, limit = 4) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!product) return
    let cancelled = false
    setLoading(true)
    let query = supabase
      .from('products')
      .select('*, categories(*), variants:product_variants(*)')
      .eq('status', 'active')
      .neq('id', product.id)
      .limit(limit)
    if (product.category_id) query = query.eq('category_id', product.category_id)
    query
      .order('bestseller', { ascending: false })
      .then(({ data }) => {
        if (cancelled) return
        setProducts((data || []) as Product[])
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [product?.id, product?.category_id, limit])

  return { products, loading }
}
