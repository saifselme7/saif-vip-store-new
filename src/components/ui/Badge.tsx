import { cn } from '@/lib/utils'

interface Props {
  children: React.ReactNode
  className?: string
}

/** Outlined status badge (colors come from constants maps). */
export function StatusBadge({ children, className }: Props) {
  return (
    <span className={cn('inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-2 py-1 border whitespace-nowrap', className)}>
      {children}
    </span>
  )
}

export function Pill({ children, className }: Props) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1', className)}>
      {children}
    </span>
  )
}
