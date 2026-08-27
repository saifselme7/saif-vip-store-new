import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthContext'
import { useApp } from './AppContext'
import type { Product } from '@/types'

interface WishlistContextType {
  items: Product[]
  ids: Set<string>
  loading: boolean
  count: number
  has: (productId: string) => boolean
  toggle: (product: Product) => Promise<boolean>
  refresh: () => Promise<void>
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined)

/** Shared wishlist state — one query per session instead of one per
 * product card. */
export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { addToast } = useApp()
  const [items, setItems] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) {
      setItems([])
      setLoading(false)
      return
    }
    const { data } = await supabase
      .from('wishlists')
      .select('products(*)')
      .eq('user_id', user.id)
    const products = ((data || []) as unknown as { products: Product | Product[] | null }[])
      .map(row => (Array.isArray(row.products) ? row.products[0] : row.products))
      .filter((p): p is Product => Boolean(p))
    setItems(products)
    setLoading(false)
  }, [user])

  useEffect(() => {
    setLoading(true)
    refresh()
  }, [refresh])

  const toggle = useCallback(async (product: Product): Promise<boolean> => {
    if (!user) {
      addToast('Please sign in to use the wishlist', 'info')
      return false
    }
    const exists = items.some(p => p.id === product.id)
    if (exists) {
      const { error } = await supabase
        .from('wishlists')
        .delete()
        .eq('user_id', user.id)
        .eq('product_id', product.id)
      if (error) {
        addToast('Could not update wishlist', 'error')
        return false
      }
      setItems(prev => prev.filter(p => p.id !== product.id))
      addToast('Removed from wishlist')
      return false
    }
    // Optimistic insert for instant feedback.
    setItems(prev => [...prev, product])
    const { error } = await supabase
      .from('wishlists')
      .insert({ user_id: user.id, product_id: product.id })
    if (error) {
      setItems(prev => prev.filter(p => p.id !== product.id))
      addToast('Could not update wishlist', 'error')
      return false
    }
    addToast('Added to wishlist')
    return true
  }, [user, items, addToast])

  const ids = new Set(items.map(p => p.id))

  return (
    <WishlistContext.Provider value={{
      items,
      ids,
      loading,
      count: items.length,
      has: (id: string) => ids.has(id),
      toggle,
      refresh,
    }}>
      {children}
    </WishlistContext.Provider>
  )
}

export function useWishlist() {
  const ctx = useContext(WishlistContext)
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider')
  return ctx
}
