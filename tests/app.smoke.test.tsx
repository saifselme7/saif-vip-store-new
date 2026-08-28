// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import App from '../src/App'

/**
 * Smoke tests: the storefront mounts and renders its shell even when the
 * Supabase backend is unreachable (all data hooks degrade to empty states),
 * and the new homepage narrative composition is present in the DOM.
 */

let consoleErrors: string[] = []

beforeAll(() => {
  // Flag the React act() environment so React doesn't warn about bare act() usage
  ;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
  consoleErrors = []
  const originalError = console.error
  console.error = (...args: unknown[]) => {
    const message = args.map(a => (a instanceof Error ? a.message : String(a))).join(' ')
    if (/fetch|network|Failed to fetch|ERR_NAME|not configured to support act/i.test(message)) return
    consoleErrors.push(message)
    originalError(...args)
  }
})

function renderApp() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(<App />)
  })
  return () => {
    act(() => root.unmount())
    container.remove()
  }
}

async function settle(ms = 150) {
  await act(async () => {
    await new Promise(r => setTimeout(r, ms))
  })
}

describe('App smoke render', () => {
  it('renders the storefront shell without crashing', async () => {
    const cleanup = renderApp()
    await settle()
    const text = document.body.textContent || ''
    expect(text).toContain('SAIF')
    expect(consoleErrors.length).toBe(0)
    cleanup()
  })

  it('renders the main landmark and skip link for accessibility', async () => {
    const cleanup = renderApp()
    await settle(80)
    expect(document.getElementById('main')).toBeTruthy()
    expect(document.querySelector('a.skip-link')).toBeTruthy()
    cleanup()
  })
})

describe('Homepage narrative composition', () => {
  it('renders the hero with the line-mask wordmark and CTAs', async () => {
    const cleanup = renderApp()
    await settle()

    const hero = document.querySelector('section[aria-label^="SAIF STORE"]')
    expect(hero).toBeTruthy()
    // Both wordmark lines are present
    const heroText = hero?.textContent || ''
    expect(heroText).toContain('SAIF')
    expect(heroText).toContain('STORE')
    // Essential CTAs preserved
    const links = Array.from(hero?.querySelectorAll('a') ?? []).map(a => a.getAttribute('href'))
    expect(links).toContain('/products')
    expect(links).toContain('/products?type=digital')
    // Scroll cue is decorative
    expect(hero?.querySelector('[aria-hidden="true"]')).toBeTruthy()
    cleanup()
  })

  it('no longer renders the four-product image row under the hero', async () => {
    const cleanup = renderApp()
    await settle()
    const hero = document.querySelector('section[aria-label^="SAIF STORE"]')
    expect(hero).toBeTruthy()
    // The removed strip was a 2/4-column grid of product links inside the hero.
    const productLinksInHero = Array.from(hero?.querySelectorAll('a[href^="/products/"]') ?? [])
    expect(productLinksInHero.length).toBe(0)
    cleanup()
  })

  it('renders the storytelling sections in order', async () => {
    const cleanup = renderApp()
    await settle()
    const text = (document.body.textContent || '').replace(/\s+/g, ' ')

    // Narrative sections (copy-driven, data-independent)
    expect(text).toContain('The Brand')
    expect(text).toContain('Made to be worn')
    expect(text).toContain('Two worlds. One standard.')
    expect(text).toContain('Ordered. Transferred. Verified.')
    expect(text).toContain('Step into')

    // The marquee trust band derived from settings fallback
    expect(text).toContain('Payments verified by humans')
    cleanup()
  })

  it('renders reveal system nodes that resolve visible (reduced-motion safe)', async () => {
    const cleanup = renderApp()
    await settle()
    const reveals = document.querySelectorAll('.reveal')
    expect(reveals.length).toBeGreaterThan(4)
    // IO mock resolves immediately — content must not stay hidden
    const hidden = Array.from(reveals).filter(el => !el.classList.contains('is-visible'))
    // All reveals should have resolved given the immediate IO mock
    expect(hidden.length).toBe(0)
    cleanup()
  })
})
