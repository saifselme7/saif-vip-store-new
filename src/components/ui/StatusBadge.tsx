import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_STYLES,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_STYLES,
} from '@/lib/constants'
import type { OrderStatus, PaymentStatus } from '@/types'

export function OrderStatusBadge({ status }: { status: OrderStatus | string | null | undefined }) {
  const { t } = useI18n()
  if (!status) return <span className="badge border-saif-border text-saif-dim">—</span>
  const known = status in ORDER_STATUS_LABELS
  const label = known ? t(`orders.status.${status}`) : status
  const style = ORDER_STATUS_STYLES[status as OrderStatus] ?? 'border-saif-border text-saif-dim'
  return <span className={cn('badge', style)}>{label}</span>
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus | string | null | undefined }) {
  const { t } = useI18n()
  if (!status) return <span className="badge border-saif-border text-saif-dim">{t('payment.noPayment')}</span>
  const known = status in PAYMENT_STATUS_LABELS
  const label = known ? t(`payment.status.${status}`) : status
  const style = PAYMENT_STATUS_STYLES[status as PaymentStatus] ?? 'border-saif-border text-saif-dim'
  return <span className={cn('badge', style)}>{label}</span>
}
