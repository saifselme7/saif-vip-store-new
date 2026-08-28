import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  CreditCard,
  ShieldCheck,
  X,
  Eye,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Undo2,
  ExternalLink,
} from 'lucide-react'
import { useAdminPayments } from '@/hooks/admin/useAdminData'
import { useApp } from '@/context/AppContext'
import { useToast } from '@/context/ToastContext'
import { useDebounce } from '@/hooks/useDebounce'
import { usePageMeta } from '@/hooks/usePageMeta'
import { reviewPayment } from '@/lib/api'
import { createScreenshotSignedUrl, paymentMethodLabel } from '@/lib/payments'
import { formatPrice, formatDate, cn, copyToClipboard } from '@/lib/utils'
import { PAYMENT_STATUSES, PAYMENT_STATUS_LABELS } from '@/lib/constants'
import { PaymentStatusBadge } from '@/components/ui/StatusBadge'
import { PageHeader, SearchInput, FilterTabs, EmptyPanel } from '@/components/admin/ui'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Loading from '@/components/Loading'
import type { Payment } from '@/types'

export default function AdminPayments() {
  const [searchParams, setSearchParams] = useSearchParams()
  const focusId = searchParams.get('focus')
  const { settings } = useApp()
  const { addToast } = useToast()
  const currency = settings?.currency ?? 'EGP'

  const [statusFilter, setStatusFilter] = useState<string>('under_review')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 250)
  const [selectedId, setSelectedId] = useState<string | null>(focusId)
  const [zoomOpen, setZoomOpen] = useState(false)
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'approve' | 'cancel' | 'under_review' | null>(null)

  usePageMeta({ title: 'Admin — Payment Verification' })

  const { payments, loading, refetch } = useAdminPayments()

  // Default to the under-review queue; "all" shows everything.
  const filtered = useMemo(() => {
    let list = [...payments]
    if (statusFilter && statusFilter !== 'all') list = list.filter(p => p.payment_status === statusFilter)
    const q = debouncedSearch.trim().toLowerCase()
    if (q) {
      list = list.filter(
        p =>
          p.order?.order_number?.toLowerCase().includes(q) ||
          p.order?.customer_name?.toLowerCase().includes(q) ||
          p.order?.customer_phone?.includes(q) ||
          (p.payer_identifier || '').includes(q),
      )
    }
    return list
  }, [payments, statusFilter, debouncedSearch])

  const selected = useMemo(
    () => payments.find(p => p.id === selectedId) ?? null,
    [payments, selectedId],
  )

  useEffect(() => {
    if (focusId) setSelectedId(focusId)
  }, [focusId])

  useEffect(() => {
    if (!selected?.screenshot_path) {
      setScreenshotUrl(null)
      return
    }
    createScreenshotSignedUrl(selected.screenshot_path, 600).then(setScreenshotUrl)
  }, [selected?.screenshot_path])

  function selectPayment(id: string) {
    setSelectedId(id)
    if (focusId) {
      searchParams.delete('focus')
      setSearchParams(searchParams, { replace: true })
    }
  }

  async function act(
    decision: 'approved' | 'rejected' | 'under_review' | 'cancelled',
    rejectionReason?: string,
  ) {
    if (!selected) return
    setBusy(true)
    const { error } = await reviewPayment(
      selected.id,
      decision,
      null,
      rejectionReason?.trim() || null,
    )
    setBusy(false)
    if (error) {
      addToast(error, 'error')
      return
    }
    const label = PAYMENT_STATUS_LABELS[decision]
    addToast(`Payment marked as ${label}`)
    setRejectOpen(false)
    setRejectionReason('')
    setConfirmAction(null)
    refetch()
  }

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: payments.length }
    for (const s of PAYMENT_STATUSES) map[s] = payments.filter(p => p.payment_status === s).length
    return map
  }, [payments])

  return (
    <div className="animate-[pageIn_0.4s_ease]">
      <PageHeader
        title="Payment Verification"
        description="Review InstaPay / Vodafone Cash transfers before confirming orders."
        actions={
          <button className="btn btn-sm" onClick={refetch}>
            Refresh
          </button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Order #, customer, phone, payer…"
          className="flex-1"
        />
      </div>

      <div className="mb-6">
        <FilterTabs
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'under_review', label: 'Under Review', count: counts.under_review ?? 0 },
            { value: 'awaiting_payment', label: 'Awaiting Customer', count: counts.awaiting_payment ?? 0 },
            { value: 'rejected', label: 'Rejected', count: counts.rejected ?? 0 },
            { value: 'approved', label: 'Approved', count: counts.approved ?? 0 },
            { value: 'cancelled', label: 'Cancelled', count: counts.cancelled ?? 0 },
            { value: 'all', label: 'All', count: counts.all ?? 0 },
          ]}
          ariaLabel="Payment status filter"
        />
      </div>

      {loading ? (
        <Loading />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6">
          {/* Queue */}
          <div className="space-y-2 max-h-[calc(100vh-14rem)] overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <EmptyPanel
                title="Nothing in this queue"
                description={statusFilter === 'under_review' ? 'No payments are waiting for review.' : undefined}
              />
            ) : (
              filtered.map(p => (
                <PaymentQueueCard
                  key={p.id}
                  payment={p}
                  selected={p.id === selectedId}
                  onSelect={() => selectPayment(p.id)}
                  currency={currency}
                />
              ))
            )}
          </div>

          {/* Detail panel */}
          <div>
            {selected ? (
              <section className="card p-6">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
                  <div>
                    <div className="flex items-center gap-3 flex-wrap mb-1">
                      <h2 className="text-lg font-bold text-saif-text">
                        {selected.order?.order_number || 'Order'}
                      </h2>
                      <PaymentStatusBadge status={selected.payment_status} />
                    </div>
                    <p className="text-xs text-saif-dim">
                      Submitted {formatDate(selected.created_at, true)}
                    </p>
                  </div>
                  <Link
                    to={`/admin/orders/${selected.order_id}`}
                    className="btn btn-sm btn-ghost"
                  >
                    <ExternalLink size={12} /> Open Order
                  </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left: amounts & customer */}
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-[10px] font-bold uppercase tracking-wider text-saif-dim mb-2.5">Transfer</h3>
                      <dl className="space-y-2 text-xs border border-saif-border rounded-sm p-4">
                        <div className="flex justify-between gap-3">
                          <dt className="text-saif-dim">Method</dt>
                          <dd className="text-saif-text font-semibold">{paymentMethodLabel(selected.payment_method)}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-saif-dim">Expected amount</dt>
                          <dd className="text-saif-text font-semibold">{formatPrice(selected.expected_amount, currency)}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-saif-dim">Transferred</dt>
                          <dd
                            className={cn(
                              'font-semibold',
                              selected.transferred_amount === null
                                ? 'text-saif-dim'
                                : Number(selected.transferred_amount) < Number(selected.expected_amount)
                                  ? 'text-yellow-400'
                                  : Number(selected.transferred_amount) > Number(selected.expected_amount)
                                    ? 'text-blue-400'
                                    : 'text-green-400',
                            )}
                          >
                            {selected.transferred_amount === null
                              ? '— not submitted —'
                              : formatPrice(selected.transferred_amount, currency)}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-saif-dim">Payer</dt>
                          <dd className="text-saif-text font-mono">{selected.payer_identifier || '—'}</dd>
                        </div>
                      </dl>
                      {selected.transferred_amount !== null &&
                        Number(selected.transferred_amount) !== Number(selected.expected_amount) && (
                          <p className="text-xs text-yellow-400 mt-2 flex items-center gap-1.5">
                            <AlertTriangle size={12} />
                            Amount {Number(selected.transferred_amount) < Number(selected.expected_amount) ? 'below' : 'above'} the
                            expected total — verify carefully before approving.
                          </p>
                        )}
                    </div>

                    <div>
                      <h3 className="text-[10px] font-bold uppercase tracking-wider text-saif-dim mb-2.5">Customer</h3>
                      <div className="text-xs border border-saif-border rounded-sm p-4 space-y-1">
                        <p className="text-sm text-saif-text">{selected.order?.customer_name}</p>
                        {selected.order?.customer_phone && (
                          <button
                            className="text-saif-dim hover:text-saif-text transition-colors font-mono"
                            onClick={async () => {
                              const ok = await copyToClipboard(selected.order?.customer_phone || '')
                              addToast(ok ? 'Phone copied' : 'Copy failed', ok ? 'success' : 'error')
                            }}
                            title="Click to copy"
                          >
                            {selected.order.customer_phone}
                          </button>
                        )}
                        <p className="text-saif-dim">{selected.order?.customer_email}</p>
                        {selected.customer_note && (
                          <p className="text-saif-dim pt-2 border-t border-saif-border mt-2">
                            Note: {selected.customer_note}
                          </p>
                        )}
                      </div>
                    </div>

                    {selected.rejection_reason && (
                      <p className="text-xs text-red-400 border border-red-500/30 bg-red-500/5 p-3 rounded-sm">
                        Previously rejected: {selected.rejection_reason}
                      </p>
                    )}
                    {selected.admin_note && (
                      <p className="text-xs text-saif-dim border border-saif-border p-3 rounded-sm">
                        Admin note: {selected.admin_note}
                      </p>
                    )}
                  </div>

                  {/* Right: screenshot */}
                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-saif-dim mb-2.5">
                      Transfer Screenshot
                    </h3>
                    {selected.screenshot_path ? (
                      screenshotUrl ? (
                        <button
                          onClick={() => setZoomOpen(true)}
                          className="block w-full border border-saif-border rounded-sm overflow-hidden group hover:border-saif-text transition-colors"
                          aria-label="Enlarge screenshot"
                        >
                          <img
                            src={screenshotUrl}
                            alt="Payment transfer screenshot"
                            className="w-full max-h-80 object-contain bg-saif-panel"
                          />
                          <span className="flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-wider text-saif-dim group-hover:text-saif-text transition-colors py-2 border-t border-saif-border">
                            <Eye size={11} /> Click to enlarge
                          </span>
                        </button>
                      ) : (
                        <div className="h-64 skeleton rounded-sm" />
                      )
                    ) : (
                      <div className="border border-dashed border-saif-border rounded-sm p-8 text-center">
                        <p className="text-xs text-saif-dim">
                          No screenshot submitted yet — the customer hasn&apos;t completed the payment step.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 mt-6 pt-5 border-t border-saif-border">
                  {selected.payment_status !== 'approved' && selected.payment_status !== 'cancelled' && (
                    <>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => setConfirmAction('approve')}
                        disabled={busy}
                      >
                        <ShieldCheck size={13} /> Approve Payment
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => setRejectOpen(true)}
                        disabled={busy}
                      >
                        <X size={13} /> Reject Payment
                      </button>
                      {selected.payment_status !== 'under_review' && (
                        <button
                          className="btn btn-sm"
                          onClick={() => setConfirmAction('under_review')}
                          disabled={busy}
                        >
                          <Clock size={13} /> Mark Under Review
                        </button>
                      )}
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => setConfirmAction('cancel')}
                        disabled={busy}
                      >
                        <Undo2 size={13} /> Cancel Payment
                      </button>
                    </>
                  )}
                  {selected.payment_status === 'approved' && (
                    <p className="text-xs text-green-400 flex items-center gap-2">
                      <CheckCircle2 size={14} />
                      Approved {selected.verified_at ? formatDate(selected.verified_at, true) : ''}
                    </p>
                  )}
                </div>
              </section>
            ) : (
              <EmptyPanel
                title="Select a payment"
                description="Choose a submission from the queue to review the transfer details and screenshot."
              />
            )}
          </div>
        </div>
      )}

      {/* Screenshot zoom */}
      {zoomOpen && screenshotUrl && (
        <div
          className="fixed inset-0 z-[250] bg-black/95 flex items-center justify-center p-4 md:p-10"
          role="dialog"
          aria-modal="true"
          aria-label="Payment screenshot"
          onClick={() => setZoomOpen(false)}
        >
          <button className="absolute top-5 right-5 text-saif-dim hover:text-saif-text p-2" aria-label="Close">
            <X size={26} />
          </button>
          <img src={screenshotUrl} alt="Payment screenshot (full size)" className="max-w-full max-h-full object-contain" />
        </div>
      )}

      {/* Reject dialog with required reason */}
      <ConfirmDialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        onConfirm={() => act('rejected', rejectionReason)}
        title="Reject this payment?"
        confirmLabel="Reject Payment"
        danger
        busy={busy}
        message={
          <div>
            <p className="mb-3">The customer will see the reason and can resubmit correct proof.</p>
            <label className="label" htmlFor="rej-reason">
              Rejection reason (required)
            </label>
            <textarea
              id="rej-reason"
              className="input text-xs resize-none"
              rows={3}
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              placeholder="e.g. transferred amount doesn't match the order total"
              autoFocus
            />
          </div>
        }
      />

      {/* Approve confirmation */}
      <ConfirmDialog
        open={confirmAction === 'approve'}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => act('approved')}
        title="Approve this payment?"
        confirmLabel="Approve & Confirm Order"
        busy={busy}
        message={
          <div>
            <p className="mb-2">
              Approving marks the payment as verified, records you as the verifier and moves the order to{' '}
              <span className="text-saif-text font-semibold">Confirmed</span>.
            </p>
            {selected?.transferred_amount !== null &&
              selected?.transferred_amount !== undefined &&
              Number(selected.transferred_amount) !== Number(selected.expected_amount) && (
                <p className="text-xs text-yellow-400">
                  Warning: the transferred amount does not match the expected total.
                </p>
              )}
          </div>
        }
      />

      {/* Cancel confirmation */}
      <ConfirmDialog
        open={confirmAction === 'cancel'}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => act('cancelled')}
        title="Cancel this payment?"
        confirmLabel="Cancel Payment & Order"
        danger
        busy={busy}
        message="The payment is cancelled, the order is cancelled and the reserved stock is returned."
      />

      {/* Under review confirmation */}
      <ConfirmDialog
        open={confirmAction === 'under_review'}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => act('under_review')}
        title="Mark as under review?"
        confirmLabel="Mark Under Review"
        busy={busy}
        message="The payment returns to the review queue. Any rejection reason is cleared."
      />
    </div>
  )
}

function PaymentQueueCard({
  payment,
  selected,
  onSelect,
  currency,
}: {
  payment: Payment & { order?: { order_number: string; customer_name: string; customer_phone: string | null } }
  selected: boolean
  onSelect: () => void
  currency: string
}) {
  const amountMismatch =
    payment.transferred_amount !== null &&
    Number(payment.transferred_amount) !== Number(payment.expected_amount)

  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'w-full text-left border p-4 rounded-sm transition-all',
        selected ? 'border-saif-accent/60 bg-saif-accent/[0.04]' : 'border-saif-border hover:border-saif-dim',
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="font-mono text-xs font-semibold text-saif-text">{payment.order?.order_number}</span>
        <PaymentStatusBadge status={payment.payment_status} />
      </div>
      <p className="text-xs text-saif-dim truncate mb-1">
        {payment.order?.customer_name}
        {payment.order?.customer_phone ? ` · ${payment.order.customer_phone}` : ''}
      </p>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-saif-dim">
          {paymentMethodLabel(payment.payment_method)} ·{' '}
          <span className={amountMismatch ? 'text-yellow-400' : 'text-saif-text'}>
            {payment.transferred_amount === null
              ? formatPrice(payment.expected_amount, currency)
              : formatPrice(payment.transferred_amount, currency)}
          </span>
        </span>
        <span className="text-[10px] text-saif-faint">{formatDate(payment.created_at)}</span>
      </div>
      {amountMismatch && (
        <p className="text-[10px] text-yellow-400 mt-1.5 flex items-center gap-1">
          <AlertTriangle size={10} /> amount differs from expected {formatPrice(payment.expected_amount, currency)}
        </p>
      )}
    </button>
  )
}
