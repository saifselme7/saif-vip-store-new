import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import Reveal from '@/components/motion/Reveal'
import { cn } from '@/lib/utils'

interface SectionHeaderProps {
  /** Editorial index — "01", "02", … part of the signature numbering motif */
  index: string
  /** Micro caps label, e.g. "FEATURED" */
  eyebrow: string
  /** Display title */
  title: string
  description?: string
  viewAllTo?: string
  viewAllLabel?: string
  className?: string
  align?: 'left' | 'center'
}

/**
 * Signature section header: red rule + editorial index + micro caps label,
 * large tight title, optional view-all link with animated underline.
 */
export default function SectionHeader({
  index,
  eyebrow,
  title,
  description,
  viewAllTo,
  viewAllLabel = 'View All',
  className,
  align = 'left',
}: SectionHeaderProps) {
  const centered = align === 'center'

  if (centered) {
    return (
      <div className={cn('mb-10 md:mb-14 text-center flex flex-col items-center', className)}>
        <Reveal variant="fade" duration={700}>
          <p className="eyebrow justify-center">
            <span className="text-saif-accent tabular-nums">{index}</span>
            <span className="w-3 h-px bg-saif-border" aria-hidden="true" />
            {eyebrow}
          </p>
        </Reveal>
        <Reveal variant="up" delay={90}>
          <h2 className="mt-4 text-[clamp(28px,4.5vw,52px)] font-bold leading-[1.02] tracking-tight text-saif-text text-balance">
            {title}
          </h2>
        </Reveal>
        {description && (
          <Reveal variant="fade" delay={200} duration={900}>
            <p className="mt-4 text-sm md:text-[15px] text-saif-dim leading-relaxed max-w-lg mx-auto text-balance">
              {description}
            </p>
          </Reveal>
        )}
        {viewAllTo && (
          <Reveal variant="fade" delay={280} className="mt-6">
            <ViewAllLink to={viewAllTo} label={viewAllLabel} />
          </Reveal>
        )}
      </div>
    )
  }

  return (
    <div className={cn('mb-10 md:mb-14', className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
        <div className="min-w-0">
          <Reveal variant="fade" duration={700}>
            <p className="eyebrow">
              <span className="text-saif-accent tabular-nums">{index}</span>
              <span className="w-3 h-px bg-saif-border" aria-hidden="true" />
              {eyebrow}
            </p>
          </Reveal>
          <Reveal variant="up" delay={90}>
            <h2 className="mt-4 text-[clamp(26px,4vw,46px)] font-bold leading-[1.02] tracking-tight text-saif-text text-balance">
              {title}
            </h2>
          </Reveal>
          {description && (
            <Reveal variant="fade" delay={200} duration={900}>
              <p className="mt-4 text-sm md:text-[15px] text-saif-dim leading-relaxed max-w-lg text-balance">
                {description}
              </p>
            </Reveal>
          )}
        </div>
        {viewAllTo && (
          <Reveal variant="fade" delay={280} className="pb-2 flex-shrink-0">
            <ViewAllLink to={viewAllTo} label={viewAllLabel} />
          </Reveal>
        )}
      </div>
    </div>
  )
}

function ViewAllLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="link-underline inline-flex items-center gap-2 py-2 -m-2 px-2">
      {label}
      <ArrowRight size={13} className="text-saif-accent" aria-hidden="true" />
    </Link>
  )
}
