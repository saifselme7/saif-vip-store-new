import { useEffect, useRef } from 'react'

/** Subtle cursor ring — desktop pointers only, respects reduced motion,
 * and the rAF loop idles when the pointer leaves the window. */
export default function CursorFollower() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    // Skip on touch devices and for users who prefer reduced motion.
    if (!window.matchMedia('(pointer: fine)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const el = ref.current
    if (!el) return

    const pos = { x: -100, y: -100 }
    const target = { x: -100, y: -100 }
    let active = false
    let raf = 0
    let running = false

    const animate = () => {
      pos.x += (target.x - pos.x) * 0.18
      pos.y += (target.y - pos.y) * 0.18
      el.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%)`
      raf = requestAnimationFrame(animate)
    }
    const start = () => { if (!running) { running = true; raf = requestAnimationFrame(animate) } }
    const stop = () => { running = false; cancelAnimationFrame(raf) }

    const onMove = (e: MouseEvent) => {
      target.x = e.clientX
      target.y = e.clientY
      if (!active) { active = true; el.style.opacity = '1' }
      start()
    }
    const onLeave = () => { active = false; el.style.opacity = '0'; stop() }

    document.addEventListener('mousemove', onMove, { passive: true })
    document.documentElement.addEventListener('mouseleave', onLeave)

    return () => {
      document.removeEventListener('mousemove', onMove)
      document.documentElement.removeEventListener('mouseleave', onLeave)
      stop()
    }
  }, [])

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="fixed top-0 left-0 w-5 h-5 border border-saif-text/60 rounded-full pointer-events-none z-[9999] mix-blend-difference opacity-0 transition-opacity duration-300 hidden md:block"
    />
  )
}
