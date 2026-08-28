import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  value: number
  size?: number
  className?: string
  showValue?: boolean
  count?: number
}

export default function RatingStars({ value, size = 14, className, showValue = false, count }: Props) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)} aria-label={`Rating: ${value} out of 5`}>
      <span className="inline-flex" role="img">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            size={size}
            className={i < Math.round(value) ? 'fill-saif-accent text-saif-accent' : 'text-saif-faint'}
            aria-hidden="true"
          />
        ))}
      </span>
      {showValue && <span className="text-xs text-saif-dim ml-1">{value.toFixed(1)}</span>}
      {count !== undefined && <span className="text-xs text-saif-dim">({count})</span>}
    </span>
  )
}
