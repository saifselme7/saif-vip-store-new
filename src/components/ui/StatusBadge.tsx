import { cn } from '@/lib/utils'
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_STYLES,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_STYLES,
} from '@/lib/constants'
import type { OrderStatus, PaymentStatus } from '@/types'

export function OrderStatusBadge({ status }: { status: OrderStatus | string | null | undefined }) {
  if (!status) return <span className="badge border-saif-border text-saif-dim">—</span>
  const label = ORDER_STATUS_LABELS[status as OrderStatus] ?? status
  const style = ORDER_STATUS_STYLES[status as OrderStatus] ?? 'border-saif-border text-saif-dim'
  return <span className={cn('badge', style)}>{label}</span>
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus | string | null | undefined }) {
  if (!status) return <span className="badge border-saif-border text-saif-dim">No payment</span>
  const label = PAYMENT_STATUS_LABELS[status as PaymentStatus] ?? status
  const style = PAYMENT_STATUS_STYLES[status as PaymentStatus] ?? 'border-saif-border text-saif-dim'
  return <span className={cn('badge', style)}>{label}</span>
}
