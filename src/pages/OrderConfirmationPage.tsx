import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { CheckCircle2, Clock, Copy, ArrowRight, ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/context/AppContext'
import { useToast } from '@/context/ToastContext'
import { usePageMeta } from '@/hooks/usePageMeta'
import { formatPrice, formatDate, copyToClipboard, cn } from '@/lib/utils'
import { PAYMENT_METHOD_LABELS } from '@/lib/constants'
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/ui/StatusBadge'
import Footer from '@/components/Footer'
import Loading from '@/components/Loading'
import EmptyState from '@/components/EmptyState'
import type { Order } from '@/types'
import { useI18n } from '@/i18n'

export default function OrderConfirmationPage() {
  const { t, lang, formatPrice } = useI18n()
  const { id } = useParams<{ id: string }>()
  const { settings } = useApp()
  const { addToast } = useToast()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  usePageMeta({ title: 'Order Confirmation', description: 'Your SAIF STORE order has been placed.' })

  useEffect(() => {
    async function fetch() {
      if (!id) return
      const { data } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', id)
        .maybeSingle()
      setOrder((data as unknown as Order) ?? null)
      setLoading(false)
    }
    fetch()
  }, [id])

  const currency = settings?.currency ?? 'EGP'
  const payment = order?.payment

  async function handleCopy() {
    if (!order) return
    const ok = await copyToClipboard(order.order_number)
    addToast(ok ? t('orders.copied') : t('errors.generic'), ok ? 'success' : 'error')
  }

  if (loading) {
    return (
      <div className="pt-28">
        <Loading />
        <Footer />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="pt-28 px-5">
        <EmptyState
          title={t('orders.notFound')}
          description="This order does not exist or belongs to another account."
          action={
            <Link to="/orders" className="btn btn-sm">
              My Orders
            </Link>
          }
        />
        <Footer />
      </div>
    )
  }

  const underReview = order.payment_status === 'under_review' || order.payment_status === 'awaiting_payment'

  return (
    <div className="animate-[pageIn_0.6s_ease] pt-24 md:pt-28 px-5 lg:px-10 pb-20">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={30} className="text-green-400" />
          </div>
          <h1 className="text-3xl md:text-4xl font-display text-saif-text mb-3">
            {t('orders.confirmation.title')}
          </h1>
          <p className="text-sm text-saif-dim max-w-md mx-auto leading-relaxed">
            {underReview
              ? t('orders.confirmation.desc')
              : 'Your order has been received.'}
          </p>
        </div>

        <div className="border border-saif-border rounded-sm p-6 mb-6">
          <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 text-sm font-bold text-saif-text hover:text-saif-accent transition-colors"
              title={t('common.copy')}
            >
              {order.order_number}
              <Copy size={13} className="text-saif-dim" />
            </button>
            <div className="flex gap-2 flex-wrap">
              <OrderStatusBadge status={order.status} />
              <PaymentStatusBadge status={order.payment_status} />
            </div>
          </div>

          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-saif-dim">{t('common.date')}</dt>
              <dd className="text-saif-text">{formatDate(order.created_at, true)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-saif-dim">{t('orders.confirmation.paymentMethod')}</dt>
              <dd className="text-saif-text">{PAYMENT_METHOD_LABELS[order.payment_method!] ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-saif-dim">{t('orders.confirmation.deliverTo')}</dt>
              <dd className="text-saif-text text-right">
                {order.customer_name}
                {order.shipping_address && (order.shipping_address as { city?: string }).city
                  ? `, ${(order.shipping_address as { city?: string }).city}`
                  : ` (${t('orders.confirmation.digitalNote')})`}
              </dd>
            </div>
          </dl>

          <div className="border-t border-saif-border mt-5 pt-5 space-y-2.5">
            {order.items?.map(item => (
              <div key={item.id} className="flex justify-between gap-4 text-sm">
                <span className="text-saif-dim min-w-0 truncate">
                  {item.product_name}
                  {item.variant_name ? ` · ${item.variant_name}` : ''} × {item.quantity}
                </span>
                <span className="text-saif-text flex-shrink-0">{formatPrice(item.total)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-saif-border mt-5 pt-5 space-y-2 text-sm">
            <div className="flex justify-between text-saif-dim">
              <span>{t('common.subtotal')}</span>
              <span className="text-saif-text">{formatPrice(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-saif-dim">
                <span>Discount {order.coupon_code ? <span className="font-mono text-green-400 text-xs">({order.coupon_code})</span> : null}</span>
                <span className="text-green-400">−{formatPrice(order.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-saif-dim">
              <span>{t('common.shipping')}</span>
              <span className="text-saif-text">
                {order.shipping_fee === 0 ? 'Free' : formatPrice(order.shipping_fee)}
              </span>
            </div>
            <div className="flex justify-between text-base font-bold text-saif-text pt-2 border-t border-saif-border">
              <span>{t('common.total')}</span>
              <span>{formatPrice(order.total)}</span>
            </div>
          </div>
        </div>

        {/* What happens next */}
        <div className={cn('border rounded-sm p-6 mb-8', underReview ? 'border-yellow-500/30 bg-yellow-500/[0.03]' : 'border-saif-border')}>
          <h2 className="text-sm font-bold uppercase tracking-wider text-saif-text flex items-center gap-2 mb-4">
            {underReview ? <Clock size={15} className="text-yellow-400" /> : <ShieldCheck size={15} className="text-green-400" />}
            What happens next
          </h2>
          <ol className="space-y-2.5 text-sm text-saif-dim">
            <li>1. {t('orders.confirmation.next1', { method: PAYMENT_METHOD_LABELS[order.payment_method!] ?? '' })}</li>
            <li>2. Once approved, your order moves to <span className="text-saif-text">Confirmed</span> and we start preparing it.</li>
            <li>3. {t('orders.confirmation.next3')}</li>
          </ol>
          <p className="text-xs text-saif-faint mt-4">
            Your payment has <span className="text-saif-text font-semibold">not</span> been approved yet — this page will
            update once verification is complete.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to={`/orders/${order.id}`} className="btn btn-primary">
            View Order Details <ArrowRight size={14} />
          </Link>
          <Link to="/products" className="btn">
            Continue Shopping
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  )
}
