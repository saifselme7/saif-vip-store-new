import type { LucideIcon } from 'lucide-react'
import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface Props {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  /** Compact variant for inline panels (cards, modals) */
  compact?: boolean
}

/**
 * Premium empty state — answers "what happened?" and "what now?".
 * The ghost icon ring + red rule keep it on-brand without feeling broken.
 */
export default function EmptyState({ icon: Icon = ArrowRight, title, description, action, compact }: Props) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center px-6',
        compact ? 'py-12' : 'py-20 md:py-28',
      )}
    >
      <div className="relative mb-7" aria-hidden="true">
        <div
          className={cn(
            'rounded-full border border-saif-border flex items-center justify-center',
            compact ? 'w-14 h-14' : 'w-20 h-20',
          )}
        >
          <Icon size={compact ? 22 : 28} className="text-saif-dim" />
        </div>
        <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-saif-accent" />
      </div>
      <h3 className={cn('font-semibold text-saif-text text-balance', compact ? 'text-base' : 'text-lg md:text-xl')}>
        {title}
      </h3>
      {description && (
        <p className="mt-2.5 text-sm text-saif-dim leading-relaxed max-w-sm text-balance">{description}</p>
      )}
      {action && <div className="mt-8">{action}</div>}
    </div>
  )
}

/** Standard "continue shopping" action for cart/wishlist style empty states. */
export function ShopAction({ to = '/products', label = 'Start Shopping' }: { to?: string; label?: string }) {
  return (
    <Link to={to} className="btn btn-primary btn-sm">
      {label} <ArrowRight size={13} aria-hidden="true" />
    </Link>
  )
}
