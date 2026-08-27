import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  rating: number
  size?: number
  className?: string
  interactive?: boolean
  onChange?: (rating: number) => void
}

export default function RatingStars({ rating, size = 14, className, interactive, onChange }: Props) {
  return (
    <div className={cn('flex items-center gap-0.5', className)} role={interactive ? 'radiogroup' : undefined} aria-label={`Rating ${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          disabled={!interactive}
          onClick={() => onChange?.(n)}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          className={interactive ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'}
        >
          <Star
            size={size}
            className={n <= Math.round(rating) ? 'fill-saif-accent text-saif-accent' : 'text-saif-dim/40'}
          />
        </button>
      ))}
    </div>
  )
}
