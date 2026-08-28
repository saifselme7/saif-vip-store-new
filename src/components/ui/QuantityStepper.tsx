import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  value: number
  onChange: (value: number) => void
  max?: number
  min?: number
  small?: boolean
  ariaLabel?: string
}

/** Quantity stepper — 44×44px touch targets on both sizes. */
export default function QuantityStepper({ value, onChange, max = 99, min = 1, small, ariaLabel }: Props) {
  const clamp = (n: number) => Math.max(min, Math.min(n, max))

  return (
    <div className="inline-flex items-center border border-saif-border rounded-sm" role="group" aria-label={ariaLabel || 'Quantity'}>
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        className={cn(
          'w-11 h-11 flex items-center justify-center text-saif-text hover:bg-white/5 active:bg-white/10 transition-colors disabled:opacity-30 disabled:pointer-events-none',
          small && 'w-9 h-9',
        )}
        disabled={value <= min}
        aria-label="Decrease quantity"
      >
        <Minus size={small ? 12 : 14} />
      </button>
      <span
        className={cn(
          'text-saif-text font-medium text-center tabular-nums select-none',
          small ? 'px-2 text-xs min-w-[2rem]' : 'px-4 text-sm min-w-[3rem]',
        )}
        aria-live="polite"
      >
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        className={cn(
          'w-11 h-11 flex items-center justify-center text-saif-text hover:bg-white/5 active:bg-white/10 transition-colors disabled:opacity-30 disabled:pointer-events-none',
          small && 'w-9 h-9',
        )}
        disabled={value >= max}
        aria-label="Increase quantity"
      >
        <Plus size={small ? 12 : 14} />
      </button>
    </div>
  )
}
