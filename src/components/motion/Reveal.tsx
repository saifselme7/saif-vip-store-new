import type { CSSProperties, ElementType, ReactNode } from 'react'
import { useInView } from '@/hooks/useInView'
import { cn } from '@/lib/utils'

export type RevealVariant = 'up' | 'fade' | 'scale' | 'left' | 'right' | 'mask' | 'mask-left'

interface RevealProps {
  children: ReactNode
  /** Motion behavior — pick per content type (see the reveal system). */
  variant?: RevealVariant
  /** Stagger delay in ms */
  delay?: number
  /** Duration in ms — longer for calmer, section-level motion */
  duration?: number
  className?: string
  as?: ElementType
  /** Extra IntersectionObserver tuning */
  threshold?: number
  style?: CSSProperties
}

/**
 * Scroll-reveal wrapper — the site-wide motion language.
 *
 * Variant guidance:
 *  - headings / cards   → `up`      (subtle rise + fade, ~700ms)
 *  - body copy          → `fade`    (slight delay, no movement)
 *  - product grids      → `up` with `delay={i * 90}` stagger
 *  - editorial imagery  → `mask`    (clip-path wipe + settle scale, ~1100ms)
 *  - key CTAs           → `scale`   (gentle emphasis)
 *  - section frames     → `fade` with duration 1000+
 *
 * All motion is transform/opacity/clip-path only and collapses to the
 * final state under `prefers-reduced-motion` (handled in CSS).
 */
export default function Reveal({
  children,
  variant = 'up',
  delay = 0,
  duration,
  className,
  as: Tag = 'div',
  threshold,
  style,
}: RevealProps) {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold })

  const durationMs = duration ?? (variant === 'mask' || variant === 'mask-left' ? 1100 : 800)

  return (
    <Tag
      ref={ref}
      className={cn('reveal', `reveal-${variant}`, inView && 'is-visible', className)}
      style={{
        ...(delay ? ({ '--reveal-delay': `${delay}ms` } as CSSProperties) : {}),
        ...(duration ? ({ '--reveal-duration': `${duration}ms` } as CSSProperties) : {}),
        ...style,
      }}
    >
      {children}
    </Tag>
  )
}

/**
 * Masked headline line — each child line slides up out of an overflow
 * mask with a stagger. Use for hero/editorial typography.
 */
export function RevealLine({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const { ref, inView } = useInView<HTMLSpanElement>({ threshold: 0.2 })
  return (
    <span
      ref={ref}
      className={cn('line-mask', inView && 'is-visible', className)}
      style={delay ? ({ '--reveal-delay': `${delay}ms` } as CSSProperties) : undefined}
    >
      <span>{children}</span>
    </span>
  )
}
