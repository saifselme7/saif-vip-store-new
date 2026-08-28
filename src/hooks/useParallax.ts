import { useEffect, useRef } from 'react'

/**
 * Scroll parallax driven by a CSS custom property (`--parallax`, in px).
 *
 * - rAF-throttled and passive: no scroll jank
 * - writes only `transform: translate3d(...)` via the `.parallax` utility
 * - disabled for touch devices and reduced-motion users
 *
 * `strength` = max pixels the element travels across a full viewport pass.
 */
export function useParallax<T extends HTMLElement = HTMLDivElement>(strength = 60) {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const coarse = window.matchMedia('(pointer: coarse)').matches
    if (reduced || coarse) return

    let raf = 0
    const update = () => {
      raf = 0
      const rect = el.getBoundingClientRect()
      const vh = window.innerHeight || 1
      // -1 when entering from the bottom → 1 when leaving through the top
      const center = rect.top + rect.height / 2
      const span = vh / 2 + rect.height / 2
      const progress = Math.max(-1, Math.min(1, (center - vh / 2) / (span || 1)))
      el.style.setProperty('--parallax', (progress * strength).toFixed(1))
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [strength])

  return ref
}
