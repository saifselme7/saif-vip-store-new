import { createContext, useContext, useEffect, useMemo, useState, useCallback, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useApp } from './AppContext'
import { availableStock, cartSubtotal, computeShipping, couponDiscount } from '@/lib/checkout'
import type { AppliedCoupon, CartItem, Product, ProductVariant } from '@/types'

interface CartContextType {
  items: CartItem[]
  count: number
  subtotal: number
  discount: number
  shipping: number
  total: number
  coupon: AppliedCoupon | null
  couponBusy: boolean
  addItem: (product: Product, variant: ProductVariant | null, qty?: number) => boolean
  removeItem: (itemId: string) => void
  updateQty: (itemId: string, qty: number) => void
  clearCart: () => void
  applyCoupon: (code: string) => Promise<{ ok: boolean; message: string }>
  removeCoupon: () => void
  isOpen: boolean
  setIsOpen: (v: boolean) => void
}

const CartContext = createContext<CartContextType | undefined>(undefined)
const STORAGE_KEY = 'saif-cart-v2'
const COUPON_KEY = 'saif-cart-coupon'

function lineId(productId: string, variantId?: string | null) {
  return variantId ? `${productId}:${variantId}` : productId
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { settings, addToast } = useApp()
  const [items, setItems] = useState<CartItem[]>([])
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null)
  const [couponBusy, setCouponBusy] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setItems(JSON.parse(raw))
      const c = localStorage.getItem(COUPON_KEY)
      if (c) setCoupon(JSON.parse(c))
    } catch {
      /* corrupted storage — start fresh */
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items, hydrated])

  useEffect(() => {
    if (!hydrated) return
    if (coupon) localStorage.setItem(COUPON_KEY, JSON.stringify(coupon))
    else localStorage.removeItem(COUPON_KEY)
  }, [coupon, hydrated])

  const addItem = useCallback((product: Product, variant: ProductVariant | null, qty = 1): boolean => {
    const max = availableStock(product, variant?.id)
    if (product.product_type === 'physical' && max <= 0) {
      addToast('This product is out of stock', 'error')
      return false
    }
    let capped = false
    setItems(prev => {
      const id = lineId(product.id, variant?.id)
      const existing = prev.find(i => i.id === id)
      const current = existing?.quantity ?? 0
      let nextQty = current + qty
      if (product.product_type === 'physical' && nextQty > max) {
        nextQty = max
        capped = true
      }
      if (existing) {
        return prev.map(i => (i.id === id ? { ...i, product, variant, quantity: nextQty } : i))
      }
      return [...prev, { id, product, variant, quantity: nextQty }]
    })
    if (capped) addToast(`Only ${max} in stock — quantity adjusted`, 'info')
    setIsOpen(true)
    return true
  }, [addToast])

  const updateQty = useCallback((itemId: string, qty: number) => {
    setItems(prev => prev.flatMap(i => {
      if (i.id !== itemId) return [i]
      if (qty < 1) return []
      const max = availableStock(i.product, i.variant?.id)
      const clamped = i.product.product_type === 'physical' ? Math.min(qty, Math.max(1, max)) : qty
      if (clamped !== qty && qty > clamped) {
        // Notify outside the reducer on next tick to avoid setState-in-render warnings.
        setTimeout(() => addToast(`Only ${max} in stock`, 'info'), 0)
      }
      return [{ ...i, quantity: clamped }]
    }))
  }, [addToast])

  const removeItem = useCallback((itemId: string) => {
    setItems(prev => prev.filter(i => i.id !== itemId))
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
    setCoupon(null)
  }, [])

  const subtotal = useMemo(() => cartSubtotal(items), [items])

  const shippingSettings = useMemo(() => ({
    shipping_fee: settings?.shipping_fee ?? 0,
    free_shipping_threshold: settings?.free_shipping_threshold ?? null,
    minimum_order_amount: settings?.minimum_order_amount ?? null,
  }), [settings])

  const shipping = useMemo(
    () => computeShipping(subtotal, items, shippingSettings),
    [subtotal, items, shippingSettings],
  )

  // Re-validate the stored coupon amount whenever the subtotal changes
  // (the final discount is always recomputed server-side at checkout).
  const effectiveCoupon = useMemo<AppliedCoupon | null>(() => {
    if (!coupon) return null
    return { ...coupon, discount: couponDiscount(coupon, subtotal) }
  }, [coupon, subtotal])

  const discount = effectiveCoupon?.discount ?? 0
  const total = Math.max(0, subtotal - discount + shipping)
  const count = items.reduce((s, i) => s + i.quantity, 0)

  const applyCoupon = useCallback(async (code: string): Promise<{ ok: boolean; message: string }> => {
    if (!code.trim()) return { ok: false, message: 'Enter a coupon code.' }
    if (items.length === 0) return { ok: false, message: 'Add items to your bag first.' }
    setCouponBusy(true)
    const { data, error } = await supabase.rpc('validate_coupon', { p_code: code.trim(), p_subtotal: subtotal })
    setCouponBusy(false)
    if (error) return { ok: false, message: 'Could not validate the coupon. Try again.' }
    const res = data as { valid: boolean; message: string; discount?: number; type?: 'percentage' | 'fixed'; value?: number; code?: string }
    if (!res?.valid) return { ok: false, message: res?.message || 'Invalid coupon.' }
    setCoupon({
      code: res.code || code.trim().toUpperCase(),
      type: res.type || 'fixed',
      value: res.value || 0,
      discount: res.discount || 0,
    })
    return { ok: true, message: res.message || 'Coupon applied.' }
  }, [items.length, subtotal])

  const removeCoupon = useCallback(() => setCoupon(null), [])

  return (
    <CartContext.Provider value={{
      items, count, subtotal, discount, shipping, total,
      coupon: effectiveCoupon, couponBusy,
      addItem, removeItem, updateQty, clearCart,
      applyCoupon, removeCoupon,
      isOpen, setIsOpen,
    }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
