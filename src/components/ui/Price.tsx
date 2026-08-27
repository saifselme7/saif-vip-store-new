import { useApp } from '@/context/AppContext'
import { formatPrice } from '@/lib/utils'

interface Props {
  value: number
  compareAt?: number | null
  className?: string
  compareClassName?: string
}

/** Money display in the store's configured currency. */
export default function Price({ value, compareAt, className, compareClassName }: Props) {
  const { settings } = useApp()
  const currency = settings?.currency || 'EGP'
  return (
    <span className="inline-flex items-baseline gap-2">
      <span className={className}>{formatPrice(value, currency)}</span>
      {compareAt != null && compareAt > value && (
        <span className={`line-through text-saif-dim ${compareClassName || 'text-sm'}`}>
          {formatPrice(compareAt, currency)}
        </span>
      )}
    </span>
  )
}
