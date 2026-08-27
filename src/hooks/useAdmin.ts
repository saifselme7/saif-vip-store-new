import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { invalidateCategoriesCache } from './useCategories'
import type { Database } from '@/lib/database.types'
import type { AnalyticsSummary, CustomerStat } from '@/lib/adminTypes'
import type { Category, Coupon, Payment, Product, ProductVariant, Review } from '@/types'

type ProductInsert = Database['public']['Tables']['products']['Insert']
type ProductUpdate = Database['public']['Tables']['products']['Update']
type CategoryInsert = Database['public']['Tables']['categories']['Insert']
type CategoryUpdate = Database['public']['Tables']['categories']['Update']
type CouponInsert = Database['public']['Tables']['coupons']['Insert']
type CouponUpdate = Database['public']['Tables']['coupons']['Update']
type SettingsUpdate = Database['public']['Tables']['site_settings']['Update']

/* ---------------- Dashboard / analytics ---------------- */

export function useAnalytics() {
  const [data, setData] = useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data: res, error: rpcError } = await supabase.rpc('get_analytics_summary')
    if (rpcError) setError(rpcError.message)
    else setData(res as unknown as AnalyticsSummary)
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])
  return { data, loading, error, refetch: fetch }
}

export function usePaymentQueue() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from('payments')
      .select('*, orders(order_number, customer_name, customer_phone, customer_email, total, status, created_at)')
      .order('created_at', { ascending: false })
      .limit(200)
    setPayments((data || []) as unknown as Payment[])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])
  return { payments, loading, refetch: fetch }
}

export function reviewPayment(
  paymentId: string,
  action: 'approve' | 'reject' | 'hold' | 'cancel',
  adminNote?: string,
  rejectionReason?: string,
) {
  return supabase.rpc('review_payment', {
    p_payment_id: paymentId,
    p_action: action,
    p_admin_note: adminNote || null,
    p_rejection_reason: rejectionReason || null,
  })
}

/* ---------------- Products ---------------- */

export function useAdminProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from('products')
      .select('*, categories(name), product_variants(*)')
      .order('created_at', { ascending: false })
    setProducts((data || []) as unknown as Product[])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const save = async (product: Partial<Product> & { name: string; slug: string }, variants?: Array<Partial<ProductVariant>> | null) => {
    const { variants: _v, categories: _c, ...fields } = product
    if (product.id) {
      const { error } = await supabase.from('products').update(fields as unknown as ProductUpdate).eq('id', product.id)
      if (error) return { error }
    } else {
      const { data: created, error } = await supabase.from('products').insert(fields as unknown as ProductInsert).select().single()
      if (error || !created) return { error: error ?? new Error('Failed to create product') }
      product.id = created.id as string
    }
    if (variants && product.id) {
      // Replace variant set: delete removed, upsert the rest.
      const { data: existing } = await supabase
        .from('product_variants')
        .select('id')
        .eq('product_id', product.id)
      const keepIds = variants.filter(v => v.id).map(v => v.id as string)
      const toDelete = (existing || []).map(e => e.id).filter(id => !keepIds.includes(id))
      if (toDelete.length > 0) {
        await supabase.from('product_variants').delete().in('id', toDelete)
      }
      for (const v of variants) {
        const payload = {
          product_id: product.id,
          name: v.name || 'Default',
          sku: v.sku ?? null,
          price: v.price ?? null,
          stock: v.stock ?? 0,
          size: v.size ?? null,
          color: v.color ?? null,
        }
        if (v.id) {
          await supabase.from('product_variants').update(payload).eq('id', v.id)
        } else {
          await supabase.from('product_variants').insert(payload)
        }
      }
    }
    await fetch()
    return { error: null }
  }

  const remove = async (id: string) => {
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (!error) await fetch()
    return { error }
  }

  const duplicate = async (p: Product) => {
    const copy = {
      name: `${p.name} (Copy)`,
      slug: `${p.slug}-copy-${Date.now().toString(36)}`,
      description: p.description,
      short_description: p.short_description,
      price: p.price,
      compare_at_price: p.compare_at_price,
      product_type: p.product_type,
      category_id: p.category_id,
      images: p.images,
      thumbnail: p.thumbnail,
      stock: p.stock,
      sku: p.sku ? `${p.sku}-COPY` : null,
      status: 'draft' as const,
      featured: false,
      bestseller: false,
      tags: p.tags,
      metadata: p.metadata,
    }
    const { error } = await supabase.from('products').insert(copy as unknown as ProductInsert)
    if (!error) await fetch()
    return { error }
  }

  return { products, loading, save, remove, duplicate, refetch: fetch }
}

/* ---------------- Categories ---------------- */

export function useAdminCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    const { data } = await supabase.from('categories').select('*').order('sort_order')
    setCategories((data || []) as Category[])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const save = async (cat: Partial<Category> & { name: string }) => {
    if (cat.id) {
      const { error } = await supabase.from('categories').update(cat as unknown as CategoryUpdate).eq('id', cat.id)
      if (!error) { invalidateCategoriesCache(); await fetch() }
      return { error }
    }
    const { error } = await supabase.from('categories').insert(cat as unknown as CategoryInsert)
    if (!error) { invalidateCategoriesCache(); await fetch() }
    return { error }
  }

  const remove = async (id: string) => {
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (!error) { invalidateCategoriesCache(); await fetch() }
    return { error }
  }

  return { categories, loading, save, remove, refetch: fetch }
}

/* ---------------- Coupons ---------------- */

export function useAdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false })
    setCoupons((data || []) as Coupon[])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const save = async (coupon: Partial<Coupon> & { code: string }) => {
    if (coupon.id) {
      const { error } = await supabase.from('coupons').update(coupon as unknown as CouponUpdate).eq('id', coupon.id)
      if (!error) await fetch()
      return { error }
    }
    const { error } = await supabase.from('coupons').insert(coupon as unknown as CouponInsert)
    if (!error) await fetch()
    return { error }
  }

  const remove = async (id: string) => {
    const { error } = await supabase.from('coupons').delete().eq('id', id)
    if (!error) await fetch()
    return { error }
  }

  return { coupons, loading, save, remove, refetch: fetch }
}

/* ---------------- Reviews ---------------- */

export function useAdminReviews() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from('reviews')
      .select('*, user:profiles(full_name, avatar_url), products(name)')
      .order('created_at', { ascending: false })
    setReviews((data || []) as unknown as Review[])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const updateStatus = async (id: string, status: Review['status']) => {
    const { error } = await supabase.from('reviews').update({ status }).eq('id', id)
    if (!error) await fetch()
    return { error }
  }

  const remove = async (id: string) => {
    const { error } = await supabase.from('reviews').delete().eq('id', id)
    if (!error) await fetch()
    return { error }
  }

  return { reviews, loading, updateStatus, remove, refetch: fetch }
}

/* ---------------- Customers ---------------- */

export function useAdminCustomers() {
  const [customers, setCustomers] = useState<CustomerStat[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    const [profilesRes, statsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'customer').order('created_at', { ascending: false }),
      supabase.rpc('get_customer_stats'),
    ])
    const statsRows = (statsRes.data || []) as Array<{ user_id: string; order_count: number; total_spent: number; last_order_at: string | null }>
    const stats = new Map(statsRows.map(s => [s.user_id, s]))
    const merged = ((profilesRes.data || []) as Array<Record<string, unknown>>).map(p => ({
      ...(p as unknown as CustomerStat),
      order_count: stats.get(p.id as string)?.order_count ?? 0,
      total_spent: stats.get(p.id as string)?.total_spent ?? 0,
      last_order_at: stats.get(p.id as string)?.last_order_at ?? null,
    }))
    setCustomers(merged)
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { customers, loading, refetch: fetch }
}

/* ---------------- Site settings ---------------- */

export function useAdminSettings() {
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    const { data } = await supabase.from('site_settings').select('*').limit(1).maybeSingle()
    setSettings((data as Record<string, unknown>) || null)
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const save = async (values: Record<string, unknown>) => {
    if (!settings) return { error: new Error('Settings not loaded') }
    const { id: _id, created_at: _c, updated_at: _u, ...payload } = values
    const { error } = await supabase
      .from('site_settings')
      .update(payload as unknown as SettingsUpdate)
      .eq('id', settings.id as string)
    return { error }
  }

  return { settings, loading, save, refetch: fetch }
}
