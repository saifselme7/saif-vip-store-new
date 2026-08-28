import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { CartItem, CouponValidation, Product, ProductVariant } from '@/types'
import { computeCartTotals, effectiveStock, unitPrice } from '@/lib/pricing'
import { validateCoupon } from '@/lib/api'
import { useApp } from './AppContext'

interface AppliedCoupon {
  code: string
  discount: number
  coupon: NonNullable<CouponValidation['coupon']>
}

interface CartContextType {
  items: CartItem[]
  count: number
  subtotal: number
  discount: number
  shipping: number
  total: number
  hasPhysical: boolean
  freeShippingRemaining: number | null
  coupon: AppliedCoupon | null
  couponChecking: boolean
  couponError: string | null
  isOpen: boolean
  setIsOpen: (v: boolean) => void
  addItem: (product: Product, variant: ProductVariant | null, qty?: number) => { ok: boolean; message?: string }
  removeItem: (itemId: string) => void
  updateQty: (itemId: string, qty: number) => void
  clearCart: () => void
  applyCoupon: (code: string) => Promise<boolean>
  removeCoupon: () => void
  clearCartSilently: () => void
}

const CartContext = createContext<CartContextType | undefined>(undefined)
const STORAGE_KEY = 'saif-cart-v2'
const COUPON_KEY = 'saif-coupon-v2'

export function CartProvider({ children }: { children: ReactNode }) {
  const { settings } = useApp()
  const [items, setItems] = useState<CartItem[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null)
  const [couponChecking, setCouponChecking] = useState(false)
  const [couponError, setCouponError] = useState<string | null>(null)
  const hydrated = useRef(false)

  // Hydrate from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as CartItem[]
        if (Array.isArray(parsed)) setItems(parsed.filter(i => i?.product?.id))
      }
      const rawCoupon = localStorage.getItem(COUPON_KEY)
      if (rawCoupon) {
        const parsedCoupon = JSON.parse(rawCoupon) as AppliedCoupon
        if (parsedCoupon?.code && parsedCoupon?.coupon) setCoupon(parsedCoupon)
      }
    } catch {
      // corrupted storage — start fresh
    }
    hydrated.current = true
  }, [])

  // Persist
  useEffect(() => {
    if (!hydrated.current) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
      /* storage full — ignore */
    }
  }, [items])

  useEffect(() => {
    if (!hydrated.current) return
    if (coupon) localStorage.setItem(COUPON_KEY, JSON.stringify(coupon))
    else localStorage.removeItem(COUPON_KEY)
  }, [coupon])

  // Lock body scroll while the drawer is open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const addItem = useCallback((product: Product, variant: ProductVariant | null, qty = 1) => {
    const available = variant ? variant.stock : product.stock
    if (product.status !== 'active') {
      return { ok: false, message: 'This product is not available right now.' }
    }
    if (available <= 0) {
      return { ok: false, message: 'This item is sold out.' }
    }
    if (qty > available) {
      return { ok: false, message: `Only ${available} left in stock.` }
    }

    let outcome: { ok: boolean; message?: string } = { ok: true }
    setItems(prev => {
      const existing = prev.find(i => i.product.id === product.id && i.variant?.id === variant?.id)
      if (existing) {
        const newQty = Math.min(existing.quantity + qty, available)
        if (newQty === existing.quantity) {
          outcome = { ok: false, message: `Only ${available} left in stock.` }
          return prev
        }
        return prev.map(i => (i.id === existing.id ? { ...i, quantity: newQty } : i))
      }
      return [...prev, { id: crypto.randomUUID(), product, variant, quantity: Math.min(qty, available) }]
    })
    return outcome
  }, [])

  const removeItem = useCallback((itemId: string) => {
    setItems(prev => prev.filter(i => i.id !== itemId))
  }, [])

  const updateQty = useCallback((itemId: string, qty: number) => {
    setItems(prev => {
      const item = prev.find(i => i.id === itemId)
      if (!item) return prev
      const available = effectiveStock(item)
      const clamped = Math.max(1, Math.min(qty, Math.max(1, available)))
      return prev.map(i => (i.id === itemId ? { ...i, quantity: clamped } : i))
    })
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
    setCoupon(null)
    setCouponError(null)
    setIsOpen(false)
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(COUPON_KEY)
  }, [])

  const clearCartSilently = useCallback(() => {
    setItems([])
    setCoupon(null)
    setIsOpen(false)
  }, [])

  const subtotal = useMemo(
    () => items.reduce((s, i) => s + unitPrice(i) * i.quantity, 0),
    [items],
  )

  // Keep subtotal in a ref for the coupon validation callback
  const subtotalRef = useRef(subtotal)
  useEffect(() => {
    subtotalRef.current = subtotal
  }, [subtotal])

  const applyCoupon = useCallback(async (code: string) => {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) {
      setCouponError('Enter a coupon code')
      return false
    }
    setCouponChecking(true)
    setCouponError(null)
    const result = await validateCoupon(trimmed, subtotalRef.current)
    setCouponChecking(false)
    if (!result.valid || result.discount === null || !result.coupon) {
      setCouponError(result.reason || 'This coupon cannot be applied')
      return false
    }
    setCoupon({ code: result.coupon.code, discount: result.discount, coupon: result.coupon })
    return true
  }, [])

  const removeCoupon = useCallback(() => {
    setCoupon(null)
    setCouponError(null)
  }, [])

  // Re-validate the applied coupon whenever the subtotal changes
  // (minimum order / threshold rules may no longer hold).
  useEffect(() => {
    if (!coupon || subtotalRef.current === 0) return
    let cancelled = false
    ;(async () => {
      const result = await validateCoupon(coupon.code, subtotalRef.current)
      if (cancelled) return
      if (!result.valid) {
        setCoupon(null)
        setCouponError(result.reason || 'Coupon removed — cart no longer qualifies')
      } else if (result.discount !== null && result.discount !== coupon.discount && result.coupon) {
        setCoupon({ code: result.coupon.code, discount: result.discount, coupon: result.coupon })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [subtotal, coupon])

  const totals = useMemo(
    () => computeCartTotals(items, settings, coupon?.discount ?? 0),
    [items, settings, coupon],
  )

  const value = useMemo(
    () => ({
      items,
      count: items.reduce((s, i) => s + i.quantity, 0),
      subtotal: totals.subtotal,
      discount: totals.discount,
      coupon,
      couponChecking,
      couponError,
      shipping: totals.shipping,
      total: totals.total,
      hasPhysical: totals.hasPhysical,
      freeShippingRemaining: totals.freeShippingRemaining,
      isOpen,
      setIsOpen,
      addItem,
      removeItem,
      updateQty,
      clearCart,
      applyCoupon,
      removeCoupon,
      clearCartSilently,
    }),
    [items, totals, coupon, couponChecking, couponError, isOpen, addItem, removeItem, updateQty, clearCart, applyCoupon, removeCoupon, clearCartSilently],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
