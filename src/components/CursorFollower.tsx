import { useEffect, useRef, useState } from 'react'

type CursorMode = 'idle' | 'magnetic'

/**
 * Signature cursor ring.
 * - Smooth interpolation toward the pointer (never on touch / reduced motion)
 * - Magnetic attraction toward elements marked `data-magnetic` (primary CTAs only)
 * - rAF loop idles when settled — no permanent CPU cost
 */
export default function CursorFollower() {
  const ringRef = useRef<HTMLDivElement>(null)
  const pos = useRef({ x: 0, y: 0 })
  const target = useRef({ x: 0, y: 0 })
  const magnet = useRef<{ el: Element; cx: number; cy: number; r: number } | null>(null)
  const mode = useRef<CursorMode>('idle')
  const running = useRef(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const onMove = (e: MouseEvent) => {
      target.current = { x: e.clientX, y: e.clientY }
      if (!visible) {
        pos.current = { x: e.clientX, y: e.clientY }
        setVisible(true)
      }
      updateMagnet(e.clientX, e.clientY)
      kick()
    }
    const onLeave = () => setVisible(false)

    // Magnetic targets are opt-in via [data-magnetic]
    const updateMagnet = (x: number, y: number) => {
      const el = (document.elementFromPoint(x, y) as Element | null)?.closest?.('[data-magnetic]')
      if (el) {
        const rect = el.getBoundingClientRect()
        magnet.current = {
          el,
          cx: rect.left + rect.width / 2,
          cy: rect.top + rect.height / 2,
          r: Math.max(rect.width, rect.height),
        }
        mode.current = 'magnetic'
      } else {
        magnet.current = null
        mode.current = 'idle'
      }
    }

    let raf = 0
    const animate = () => {
      let tx = target.current.x
      let ty = target.current.y
      let scale = 1

      if (mode.current === 'magnetic' && magnet.current) {
        // Blend 65% toward the magnetic element's center
        const { cx, cy, r } = magnet.current
        const pull = Math.min(1, 0.65)
        tx = target.current.x + (cx - target.current.x) * pull
        ty = target.current.y + (cy - target.current.y) * pull
        scale = Math.min(1.9, 1 + (r / 220) * 1.2)
        // Keep the ring's color tied to the element's hover intent.
        // Normal blending (no difference) so the brand red stays red on the
        // warm off-white sections instead of inverting to teal.
        const ring = ringRef.current
        if (ring) {
          ring.style.borderColor = 'rgba(230, 57, 70, 0.9)'
          ring.style.mixBlendMode = 'normal'
        }
      } else {
        const ring = ringRef.current
        if (ring) {
          ring.style.borderColor = ''
          ring.style.mixBlendMode = ''
        }
      }

      pos.current.x += (tx - pos.current.x) * 0.16
      pos.current.y += (ty - pos.current.y) * 0.16
      if (ringRef.current) {
        ringRef.current.style.transform = `translate(${pos.current.x}px, ${pos.current.y}px) translate(-50%, -50%) scale(${scale})`
      }

      // Idle stop: close enough to target and no magnet
      const settled =
        Math.abs(tx - pos.current.x) < 0.5 &&
        Math.abs(ty - pos.current.y) < 0.5 &&
        mode.current === 'idle'
      if (settled) {
        running.current = false
        return
      }
      raf = requestAnimationFrame(animate)
    }
    const kick = () => {
      if (!running.current) {
        running.current = true
        raf = requestAnimationFrame(animate)
      }
    }

    document.addEventListener('mousemove', onMove, { passive: true })
    document.addEventListener('mouseleave', onLeave)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseleave', onLeave)
      cancelAnimationFrame(raf)
    }
  }, [visible])

  return (
    <div
      ref={ringRef}
      className={`fixed w-5 h-5 border border-saif-text rounded-full pointer-events-none z-[9999] mix-blend-difference transition-opacity duration-150 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      aria-hidden="true"
    />
  )
}
