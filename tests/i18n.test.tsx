// @vitest-environment jsdom
/**
 * Localization integration tests:
 *  - English renders by default; Arabic renders after switching
 *  - <html lang/dir> update correctly (RTL activates)
 *  - switching persists to localStorage
 *  - the route is preserved when switching
 *  - the cart is preserved when switching
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

vi.mock('@/lib/supabase', () => {
  const makeChain = () => {
    const chain: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'neq', 'order', 'limit', 'or', 'gt', 'lt', 'gte', 'lte', 'in', 'not']) {
      chain[m] = () => makeChain()
    }
    chain.maybeSingle = () => Promise.resolve({ data: null, error: null })
    chain.then = (res: (r: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(res, rej)
    return chain
  }
  const settings = {
    id: 's1',
    store_name: 'SAIF STORE',
    currency: 'EGP',
    payment_number: '01040324811',
    announcement: 'Free shipping over EGP 1,500',
    announcement_ar: 'شحن مجاني على الطلبات أكتر من 1,500 جنيه',
    announcement_enabled: true,
    store_description: 'Premium streetwear.',
    store_description_ar: 'ستريت وير بريميوم.',
    default_language: 'en',
  }
  return {
    supabase: {
      auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        getUser: () => Promise.resolve({ data: { user: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signInWithPassword: async () => ({ error: null }),
        signOut: async () => ({}),
        signUp: async () => ({ data: { user: null, session: null }, error: null }),
      },
      from: (table: string) => {
        const chain = makeChain()
        if (table === 'site_settings') chain.maybeSingle = () => Promise.resolve({ data: settings, error: null })
        if (table === 'homepage_sections') {
          chain.then = (res: (r: unknown) => unknown) =>
            Promise.resolve({ data: [], error: null }).then(res)
        }
        return chain
      },
      rpc: () => Promise.resolve({ data: [], error: null }),
    },
  }
})

import App from '../src/App'
import { LANGUAGES } from '../src/i18n'

let root: Root | null = null
let container: HTMLDivElement | null = null

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.clear()
  window.history.pushState({}, '', '/')
})
afterEach(() => {
  if (root) {
    act(() => root!.unmount())
    root = null
  }
  container?.remove()
  container = null
  localStorage.clear()
})

async function renderApp() {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root!.render(<App />)
  })
  await act(async () => {
    await new Promise(r => setTimeout(r, 250))
  })
}

async function switchLanguage(target: 'en' | 'ar') {
  // Click the language button in the header
  const langBtn = document.querySelector('button[aria-haspopup="listbox"]') as HTMLButtonElement | null
  expect(langBtn).toBeTruthy()
  await act(async () => {
    langBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await act(async () => {
    await new Promise(r => setTimeout(r, 50))
  })
  const option = document.querySelector(`[role="option"][aria-selected="false"]`) as HTMLButtonElement | null
  expect(option).toBeTruthy()
  await act(async () => {
    option!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await act(async () => {
    await new Promise(r => setTimeout(r, 100))
  })
}

describe('Localization', () => {
  it('renders English by default with LTR', async () => {
    await renderApp()
    expect(document.documentElement.lang).toBe('en')
    expect(document.documentElement.dir).toBe('ltr')
    const text = document.body.textContent || ''
    expect(text).toContain('Shop')
  })

  it('switches to Arabic: RTL activates, Arabic copy renders', async () => {
    await renderApp()
    await switchLanguage('ar')
    expect(document.documentElement.lang).toBe('ar')
    expect(document.documentElement.dir).toBe('rtl')
    const text = document.body.textContent || ''
    expect(text).toContain('اكتشف المجموعة')
    expect(text).toContain('كلامك')
  })

  it('persists the language choice to localStorage', async () => {
    await renderApp()
    await switchLanguage('ar')
    expect(localStorage.getItem('saif-lang')).toBe('ar')
  })

  it('restores Arabic on a fresh render (persistence across sessions)', async () => {
    localStorage.setItem('saif-lang', 'ar')
    await renderApp()
    expect(document.documentElement.dir).toBe('rtl')
    expect(document.body.textContent).toContain('اكتشف المجموعة')
  })

  it('preserves the current route when switching languages', async () => {
    window.history.pushState({}, '', '/products?type=digital')
    await renderApp()
    await switchLanguage('ar')
    expect(window.location.pathname + window.location.search).toBe('/products?type=digital')
    expect(document.documentElement.dir).toBe('rtl')
  })

  it('preserves the cart when switching languages', async () => {
    // Seed a cart item via localStorage BEFORE mounting (the cart reads this on mount)
    const product = {
      id: 'p1', name: 'Test', slug: 'test', description: '', short_description: '',
      price: 100, compare_at_price: null, product_type: 'physical', category_id: null,
      images: [], thumbnail: null, stock: 10, low_stock_threshold: 5, sku: null,
      status: 'active', featured: false, bestseller: false, tags: [],
      specifications: {}, specifications_ar: {}, delivery_info: null, delivery_info_ar: null,
      name_ar: null, short_description_ar: null, description_ar: null,
      seo_title: null, seo_title_ar: null, seo_description: null, seo_description_ar: null,
      metadata: {}, created_at: '', updated_at: '',
    }
    localStorage.setItem(
      'saif-cart-v2',
      JSON.stringify([{ id: 'c1', product, variant: null, quantity: 2 }]),
    )
    await renderApp()
    // Cart survives the language switch (never reset)
    await switchLanguage('ar')
    const stored = JSON.parse(localStorage.getItem('saif-cart-v2') || '[]')
    expect(stored).toHaveLength(1)
    expect(stored[0].quantity).toBe(2)
    // Cart badge still shows the item count (Arabic label: "السلة، 2 منتج")
    const bagBtn = Array.from(document.querySelectorAll('button')).find(
      b => (b.getAttribute('aria-label') || '').includes('2'),
    )
    expect(bagBtn).toBeTruthy()
    expect((bagBtn?.textContent || '').trim()).toBe('2')
  })

  it('exposes exactly two languages (EN + العربية)', () => {
    expect(LANGUAGES.map(l => l.code)).toEqual(['en', 'ar'])
    expect(LANGUAGES.find(l => l.code === 'ar')?.dir).toBe('rtl')
  })
})
