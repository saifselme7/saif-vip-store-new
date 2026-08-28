// @vitest-environment jsdom
/**
 * ProductDetailPage render regression test.
 *
 * Regression this guards against: `Rendered more hooks than during the
 * previous render` — the loading -> loaded transition must never change the
 * hook count. Renders the REAL app (router + all providers) at
 * /products/:slug with a mocked Supabase transport.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

// ---------------------------------------------------------------------------
// Supabase transport mock (chainable + thenable, like PostgrestBuilder)
// ---------------------------------------------------------------------------
type QueryResult = { data: unknown; error: { message: string; code?: string } | null }

const db = {
  productsBySlug: [] as Record<string, unknown>[],
  productsList: [] as Record<string, unknown>[],
  reviews: [] as Record<string, unknown>[],
  categories: [] as Record<string, unknown>[],
  settings: null as Record<string, unknown> | null,
  session: null as { user: { id: string } } | null,
  rpcResults: {} as Record<string, QueryResult>,
}

/** Products chain: every level keeps the slug lookup; maybeSingle resolves
 *  a single row (object | null) like the real PostgREST client. */
function productsChain(): Record<string, unknown> {
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'in', 'not', 'order', 'limit', 'or', 'upsert']) {
    chain[m] = (col?: string, value?: unknown) => {
      if (m === 'eq' && col === 'slug') {
        const single = productsChain()
        single.maybeSingle = () =>
          Promise.resolve({ data: db.productsBySlug.find(p => p.slug === value) ?? null, error: null })
        return single
      }
      return productsChain()
    }
  }
  chain.maybeSingle = () => Promise.resolve({ data: db.productsList[0] ?? null, error: null })
  chain.single = () => Promise.resolve({ data: db.productsList[0] ?? null, error: null })
  chain.then = (onFulfilled: (r: QueryResult) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve({ data: db.productsList, error: null }).then(onFulfilled, onRejected)
  return chain
}

function makeChain(table: string): Record<string, unknown> {
  const chain: Record<string, unknown> = {}
  const resolve = (): QueryResult => {
    switch (table) {
      case 'products':
        return { data: db.productsList, error: null }
      case 'reviews':
        return { data: db.reviews, error: null }
      case 'categories':
        return { data: db.categories, error: null }
      case 'site_settings':
        return { data: db.settings, error: null }
      default:
        return { data: [], error: null }
    }
  }
  for (const m of ['select', 'eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'in', 'not', 'order', 'limit', 'or', 'upsert']) {
    chain[m] = () => makeChain(table)
  }
  chain.maybeSingle = () => Promise.resolve(resolve())
  chain.single = () => Promise.resolve(resolve())
  chain.then = (onFulfilled: (r: QueryResult) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(resolve()).then(onFulfilled, onRejected)
  return chain
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: db.session }, error: null }),
      getUser: () => Promise.resolve({ data: { user: db.session?.user ?? null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: async () => ({ error: null }),
      signOut: async () => ({}),
      signUp: async () => ({ data: { user: null, session: null }, error: null }),
    },
    from: (table: string) => table === 'products' ? productsChain() : makeChain(table),
    rpc: (name: string) =>
      Promise.resolve(db.rpcResults[name] ?? { data: [], error: null }) as unknown,
  },
}))

import App from '../src/App'
import ErrorBoundary from '../src/components/ErrorBoundary'

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------
let consoleErrors: string[] = []
let root: Root | null = null
let container: HTMLDivElement | null = null

beforeEach(() => {
  consoleErrors = []
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const origError = console.error
  console.error = (...args: unknown[]) => {
    consoleErrors.push(args.map(a => (a instanceof Error ? a.message : String(a))).join(' '))
  }
  vi.stubGlobal('__origConsoleError', origError)
})

afterEach(() => {
  console.error = vi.stubGlobal('__origConsoleError') as typeof console.error
  vi.unstubAllGlobals()
  if (root) {
    act(() => root!.unmount())
    root = null
  }
  container?.remove()
  container = null
  localStorage.clear()
})

async function renderAtPath(path: string) {
  window.history.pushState({}, '', path)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root!.render(<App />)
  })
  // Let the product fetch resolve: loading -> loaded transition happens here.
  await act(async () => {
    await new Promise(r => setTimeout(r, 200))
  })
}

const PRODUCT = {
  id: 'p1',
  name: 'Off by Design Tee',
  slug: 'off-by-design-tee',
  description: 'A premium heavyweight cotton tee.',
  short_description: 'Heavyweight cotton tee.',
  price: 850,
  compare_at_price: 1050,
  product_type: 'physical',
  category_id: 'c1',
  images: ['https://img/1.jpg', 'https://img/2.jpg'],
  thumbnail: 'https://img/1.jpg',
  stock: 24,
  low_stock_threshold: 5,
  sku: 'SAIF-TS-001',
  status: 'active',
  featured: true,
  bestseller: true,
  tags: ['tee'],
  specifications: { Material: '100% cotton' },
  delivery_info: null,
  metadata: {},
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
  categories: { id: 'c1', name: 'T-Shirts' },
  variants: [
    { id: 'v1', product_id: 'p1', name: 'S / Black', sku: null, price: null, stock: 6, size: 'S', color: 'Black', image: null, created_at: '' },
    { id: 'v2', product_id: 'p1', name: 'M / Black', sku: null, price: null, stock: 10, size: 'M', color: 'Black', image: null, created_at: '' },
    { id: 'v3', product_id: 'p1', name: 'L / Black', sku: null, price: null, stock: 8, size: 'L', color: 'Black', image: null, created_at: '' },
  ],
}

function seedDb() {
  db.productsBySlug = [PRODUCT]
  db.productsList = [] // no related products needed
  db.reviews = [
    {
      id: 'r1',
      product_id: 'p1',
      user_id: 'u1',
      rating: 5,
      title: 'Perfect fit',
      body: 'Loved the quality.',
      status: 'approved',
      created_at: '2026-01-02',
      profiles: { full_name: 'Sarah', avatar_url: null },
    },
  ]
  db.categories = [{ id: 'c1', name: 'T-Shirts', slug: 't-shirts', sort_order: 1, is_active: true, description: null, image: null, created_at: '' }]
  db.settings = { id: 's1', store_name: 'SAIF STORE', currency: 'EGP', payment_number: '01040324811', shipping_fee: 75 }
  db.session = null
  db.rpcResults = { get_product_rating_stats: { data: [], error: null } }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('ProductDetailPage — loading → loaded transition', () => {
  it('does NOT crash with a hook-order error and renders the product', async () => {
    seedDb()
    await renderAtPath('/products/off-by-design-tee')

    // The exact regression this guards against
    const hookErrors = consoleErrors.filter(e =>
      /Rendered more hooks|Rendered fewer hooks|Minified React error/i.test(e),
    )
    expect(hookErrors).toEqual([])

    // Root must stay mounted (black screen = unmounted root)
    expect(container?.children.length).toBeGreaterThan(0)

    // Real content
    const text = (document.body.textContent || '').replace(/\u00a0/g, ' ')
    expect(text).toContain('Off by Design Tee')
    expect(text).toContain('A premium heavyweight cotton tee.') // description
    expect(text).toContain('EGP 850') // price hierarchy
  })

  it('renders variant chips from the (previously crashing) size/color memos', async () => {
    seedDb()
    await renderAtPath('/products/off-by-design-tee')

    const sizeButtons = Array.from(document.querySelectorAll('button')).filter(
      b => ['S', 'M', 'L'].includes((b.textContent || '').trim()),
    )
    expect(sizeButtons.length).toBeGreaterThanOrEqual(3)
  })

  it('supports the full add-to-cart interaction from the product page', async () => {
    seedDb()
    await renderAtPath('/products/off-by-design-tee')

    // Select the M size
    const sizeM = Array.from(document.querySelectorAll('button')).find(
      b => (b.textContent || '').trim() === 'M',
    )
    expect(sizeM).toBeTruthy()
    await act(async () => {
      sizeM!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    // Add to bag
    const addBtn = Array.from(document.querySelectorAll('button')).find(
      b => (b.textContent || '').toLowerCase().includes('add to bag'),
    )
    expect(addBtn).toBeTruthy()
    await act(async () => {
      addBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await act(async () => {
      await new Promise(r => setTimeout(r, 100))
    })

    // Cart drawer opens with the item
    const dialog = document.querySelector('[role="dialog"][aria-label="Shopping bag"]')
    expect(dialog).toBeTruthy()
    expect(dialog?.textContent).toContain('Off by Design Tee')
  })

  it('renders digital products and products without variants without crashing', async () => {
    seedDb()
    db.productsBySlug = [
      {
        ...PRODUCT,
        id: 'p2',
        slug: 'digital-pack',
        name: 'SAIF Wallpaper Pack',
        product_type: 'digital',
        variants: [],
        specifications: {},
        images: ['https://img/d1.jpg'],
        delivery_info: 'Delivered by email',
      },
    ]
    await renderAtPath('/products/digital-pack')

    const hookErrors = consoleErrors.filter(e => /Rendered (more|fewer) hooks/i.test(e))
    expect(hookErrors).toEqual([])
    expect(container?.children.length).toBeGreaterThan(0)
    expect(document.body.textContent).toContain('SAIF Wallpaper Pack')
  })
})

describe('ErrorBoundary hardening', () => {
  it('shows a recovery UI instead of unmounting when a page crashes', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    function Thrower(): never {
      throw new Error('Simulated page crash')
    }
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root!.render(
        <ErrorBoundary label="product page">
          <Thrower />
        </ErrorBoundary>,
      )
    })

    const alert = document.querySelector('[role="alert"]')
    expect(alert).toBeTruthy()
    expect(alert?.textContent).toContain('Something went wrong')
    expect(alert?.textContent).toContain('product page')
    expect(alert?.textContent).toContain('Simulated page crash')
    // Recovery actions present
    const buttons = Array.from(alert?.querySelectorAll('button') ?? [])
    expect(buttons.some(b => (b.textContent || '').includes('Try Again'))).toBe(true)
    expect(alert?.textContent).toContain('Back to Shop')
  })
})
