// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import App from '../src/App'

/**
 * Route sweep — every public storefront route must mount without React
 * warnings/errors (Supabase is unreachable in the test environment, so each
 * page renders its designed degraded/empty state) and produce real content
 * inside the #main landmark. This guards the redesign against crashes on
 * secondary pages (about/faq/shipping/…).
 */

let consoleErrors: string[] = []

beforeAll(() => {
  ;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
  consoleErrors = []
  const originalError = console.error
  console.error = (...args: unknown[]) => {
    const message = args.map(a => (a instanceof Error ? a.message : String(a))).join(' ')
    // Test-environment noise, not app defects:
    //  - network failures (Supabase unreachable)
    //  - act() environment flag
    if (/fetch|network|Failed to fetch|ERR_NAME|not configured to support act/i.test(message)) return
    consoleErrors.push(message)
    originalError(...args)
  }
})

let root: Root | null = null
let container: HTMLDivElement | null = null

function mount() {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root!.render(<App />)
  })
}

async function settle(ms = 120) {
  await act(async () => {
    await new Promise(r => setTimeout(r, ms))
  })
}

function unmount() {
  if (root) act(() => root.unmount())
  container?.remove()
  root = null
  container = null
}

afterEach(unmount)

/** Routes that are publicly reachable without authentication.
 * `loaderOnly` routes legitimately sit in the minimal brand loader while the
 * product fetch is in flight (the sandbox firewall silently drops Supabase
 * connections, so it never resolves here) — the page mounting without errors
 * is what this sweep asserts for them. */
const ROUTES: { path: string; expectText?: RegExp | string; loaderOnly?: boolean }[] = [
  { path: '/', expectText: /SAIF/ },
  { path: '/products', expectText: /تسوق|SHOP|Shop/i },
  { path: '/cart' },
  { path: '/login' },
  { path: '/register' },
  { path: '/search' },
  { path: '/about' },
  { path: '/contact' },
  { path: '/faq' },
  { path: '/shipping' },
  { path: '/privacy' },
  { path: '/terms' },
  { path: '/products/definitely-not-a-real-slug', loaderOnly: true },
  { path: '/this-route-does-not-exist' },
]

describe('Route sweep — every public route mounts cleanly', () => {
  for (const route of ROUTES) {
    it(`renders ${route.path} without errors`, async () => {
      window.history.pushState({}, '', route.path)
      mount()
      await settle()
      const main = document.getElementById('main')
      expect(main).toBeTruthy()
      const text = (main?.textContent || '').trim()
      if (route.loaderOnly) {
        // Mounted and in its designed loading state (brand hairline loader)
        expect(main?.querySelector('[role="status"]') || text.length > 0).toBeTruthy()
      } else {
        expect(text.length).toBeGreaterThan(0)
      }
      if (route.expectText) {
        expect(
          typeof route.expectText === 'string' ? text.includes(route.expectText) : route.expectText.test(text),
        ).toBe(true)
      }
      expect(consoleErrors).toEqual([])
    })
  }
})
