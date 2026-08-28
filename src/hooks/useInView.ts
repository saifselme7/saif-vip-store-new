import { useEffect, useRef, useState } from 'react'

interface UseInViewOptions {
  /** 0–1 portion of the element that must be visible. Default 0.15 */
  threshold?: number
  /** Extra viewport margin, e.g. '0px 0px -8% 0px' (reveal slightly before fully on screen) */
  rootMargin?: string
  /** Fire again when leaving the viewport. Default: fire once. */
  once?: boolean
}

/**
 * IntersectionObserver-backed visibility hook used by the scroll-reveal
 * system. Resolves to `true` immediately when IO is unavailable so content
 * is never permanently hidden.
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(options?: UseInViewOptions) {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const once = options?.once !== false
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          if (once) observer.disconnect()
        } else if (!once) {
          setInView(false)
        }
      },
      {
        threshold: options?.threshold ?? 0.15,
        rootMargin: options?.rootMargin ?? '0px 0px -6% 0px',
      },
    )
    observer.observe(el)
    return () => observer.disconnect()
    // Re-run only when the "once" strategy changes; options are read once on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options?.once])

  return { ref, inView }
}
