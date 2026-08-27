import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, XCircle, Eye, RefreshCw, Phone, Ban } from 'lucide-react'
import { usePaymentQueue, reviewPayment } from '@/hooks/useAdmin'
import { useApp } from '@/context/AppContext'
import { usePageMeta } from '@/hooks/usePageMeta'
import { PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS } from '@/lib/constants'
import { formatPrice, formatDateTime } from '@/lib/utils'
import { getScreenshotUrl } from '@/lib/storage'
import Loading from '@/components/Loading'
import EmptyState from '@/components/EmptyState'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { StatusBadge } from '@/components/ui/Badge'
import type { Payment } from '@/types'

type TabId = 'review' | 'approved' | 'rejected' | 'all'

export default function AdminPayments() {
  const { payments, loading, refetch } = usePaymentQueue()
  const { addToast } = useApp()
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<TabId>('review')
  const [openId, setOpenId] = useState<string | null>(searchParams.get('open'))
  const [busy, setBusy] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [confirmAction, setConfirmAction] = useState<'approve' | 'cancel' | null>(null)
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null)
  const [screenshotLoading, setScreenshotLoading] = useState(false)

  usePageMeta('Payment Verification', 'Admin payment queue.')

  const selected: Payment | undefined = payments.find(p => p.id === openId)

  // Load the signed screenshot URL whenever the selected payment changes.
  useEffect(() => {
    setScreenshotUrl(null)
    if (!selected?.screenshot_path) return
    let cancelled = false
    setScreenshotLoading(true)
    getScreenshotUrl(selected.screenshot_path).then(url => {
      if (!cancelled) {
        setScreenshotUrl(url)
        setScreenshotLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [selected?.id, selected?.screenshot_path])

  const filtered = useMemo(() => {
    switch (tab) {
      case 'review': return payments.filter(p => p.status === 'under_review')
      case 'approved': return payments.filter(p => p.status === 'approved')
      case 'rejected': return payments.filter(p => p.status === 'rejected')
      default: return payments
    }
  }, [payments, tab])

  async function runAction(action: 'approve' | 'reject' | 'hold' | 'cancel') {
    if (!selected) return
    if (action === 'reject' && !rejecting) {
      setRejecting(true)
      return
    }
    setBusy(true)
    const { error } = await reviewPayment(selected.id, action, undefined, action === 'reject' ? rejectReason : undefined)
    setBusy(false)
    if (error) {
      addToast(error.message || 'Action failed', 'error')
    } else {
      addToast(
        action === 'approve' ? 'Payment approved — order confirmed' :
        action === 'reject' ? 'Payment rejected' :
        action === 'cancel' ? 'Payment cancelled — order cancelled & stock released' :
        'Marked as under review',
      )
      setRejecting(false)
      setRejectReason('')
      setConfirmAction(null)
      if (action !== 'hold') setOpenId(null)
      await refetch()
    }
  }

  const tabs: Array<{ id: TabId; label: string; count: number }> = [
    { id: 'review', label: 'Needs Review', count: payments.filter(p => p.status === 'under_review').length },
    { id: 'approved', label: 'Approved', count: payments.filter(p => p.status === 'approved').length },
    { id: 'rejected', label: 'Rejected', count: payments.filter(p => p.status === 'rejected').length },
    { id: 'all', label: 'All', count: payments.length },
  ]

  return (
    <div className="animate-[pageIn_0.4s_ease]">
      <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-saif-text mb-2">Payment Verification</h1>
      <p className="text-sm text-saif-dim mb-6">Manual verification queue — approve only after matching the screenshot to the receiving number and amount.</p>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className={`px-3.5 py-2 text-xs border whitespace-nowrap transition-colors ${
              tab === t.id ? 'border-saif-text text-saif-text font-semibold' : 'border-saif-border text-saif-dim hover:text-saif-text'
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
        <button onClick={refetch} className="ml-auto px-3 py-2 text-xs text-saif-dim hover:text-saif-text flex items-center gap-1.5" aria-label="Refresh queue">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {loading ? <Loading /> : filtered.length === 0 ? (
        <EmptyState title="Queue is clear" description="No payment submissions in this view." />
      ) : (
        <div className="space-y-3">
          {filtered.map(p => {
            const amountMatch = p.transferred_amount != null && Math.abs(Number(p.transferred_amount) - Number(p.expected_amount)) <= 0.01
            return (
              <button
                key={p.id}
                onClick={() => setOpenId(p.id)}
                className="w-full text-left border border-saif-border p-4 sm:p-5 hover:border-saif-text/40 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-saif-text">{p.orders?.order_number || '—'}</p>
                      <StatusBadge className={PAYMENT_STATUS_COLORS[p.status]}>{PAYMENT_STATUS_LABELS[p.status]}</StatusBadge>
                      <span className="text-[10px] uppercase tracking-wider text-saif-dim border border-saif-border px-1.5 py-0.5">
                        {p.payment_method === 'instapay' ? 'InstaPay' : 'Vodafone Cash'}
                      </span>
                    </div>
                    <p className="text-xs text-saif-dim mt-1.5">
                      {p.orders?.customer_name || 'Customer'} · <span dir="ltr">{p.payer_identifier || '—'}</span>
                      {p.orders?.customer_phone ? <> · <span dir="ltr">{p.orders.customer_phone}</span></> : null}
                    </p>
                    <p className="text-xs text-saif-dim mt-0.5">Submitted {formatDateTime(p.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0 text-sm">
                    <div className="text-right">
                      <p className="text-xs text-saif-dim">Expected</p>
                      <p className="font-bold text-saif-text">{formatPrice(p.expected_amount)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-saif-dim">Transferred</p>
                      <p className={`font-bold ${amountMatch ? 'text-green-400' : 'text-saif-accent'}`}>
                        {p.transferred_amount != null ? formatPrice(p.transferred_amount) : '—'}
                      </p>
                    </div>
                    <Eye size={16} className="text-saif-dim" />
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* ---------- Verification panel ---------- */}
      <Modal open={!!selected} onClose={() => { setOpenId(null); setRejecting(false); setRejectReason('') }} title="Payment Verification" wide>
        {selected && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Screenshot */}
            <div>
              <p className="label">Transfer Screenshot</p>
              <div className="border border-saif-border bg-[#111] min-h-[240px] flex items-center justify-center">
                {screenshotLoading ? (
                  <p className="text-xs text-saif-dim p-6">Loading screenshot…</p>
                ) : screenshotUrl ? (
                  <a href={screenshotUrl} target="_blank" rel="noreferrer" className="block">
                    <img src={screenshotUrl} alt="Payment transfer screenshot" className="max-h-[420px] w-auto object-contain" />
                  </a>
                ) : (
                  <p className="text-xs text-saif-dim p-6 text-center">Screenshot unavailable.<br />It may have been removed from storage.</p>
                )}
              </div>
              <p className="text-[10px] text-saif-dim mt-2">Link expires in 5 minutes. Click to open full size.</p>
            </div>

            {/* Details */}
            <div className="space-y-4">
              <div className="border border-saif-border divide-y divide-[rgba(245,240,232,0.08)] text-sm">
                <DetailRow label="Order">{selected.orders?.order_number || '—'}</DetailRow>
                <DetailRow label="Order Status">{selected.orders?.status || '—'}</DetailRow>
                <DetailRow label="Customer">{selected.orders?.customer_name || '—'}</DetailRow>
                <DetailRow label="Phone"><span dir="ltr">{selected.orders?.customer_phone || '—'}</span></DetailRow>
                <DetailRow label="Method">{selected.payment_method === 'instapay' ? 'InstaPay' : 'Vodafone Cash'}</DetailRow>
                <DetailRow label="Expected">
                  <span className="font-bold">{formatPrice(selected.expected_amount)}</span>
                </DetailRow>
                <DetailRow label="Transferred">
                  <span className={`font-bold ${selected.transferred_amount != null && Math.abs(Number(selected.transferred_amount) - Number(selected.expected_amount)) <= 0.01 ? 'text-green-400' : 'text-saif-accent'}`}>
                    {selected.transferred_amount != null ? formatPrice(selected.transferred_amount) : '—'}
                  </span>
                </DetailRow>
                <DetailRow label="Payer Number"><span dir="ltr" className="flex items-center gap-1.5"><Phone size={11} /> {selected.payer_identifier || '—'}</span></DetailRow>
                <DetailRow label="Submitted">{formatDateTime(selected.created_at)}</DetailRow>
                {selected.customer_note && <DetailRow label="Customer Note">{selected.customer_note}</DetailRow>}
                {selected.rejection_reason && <DetailRow label="Rejection Reason"><span className="text-red-400">{selected.rejection_reason}</span></DetailRow>}
                {selected.admin_note && <DetailRow label="Admin Note">{selected.admin_note}</DetailRow>}
                {selected.verified_at && <DetailRow label="Reviewed At">{formatDateTime(selected.verified_at)}</DetailRow>}
              </div>

              {/* Actions */}
              {selected.status === 'under_review' && (
                <div className="space-y-3">
                  {rejecting ? (
                    <div className="border border-red-500/30 p-4 space-y-3">
                      <p className="label">Rejection Reason <span className="text-saif-accent">*</span></p>
                      <textarea
                        rows={2}
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                        className="input resize-none"
                        placeholder="Shown to the customer — e.g. amount mismatch, unreadable screenshot…"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => setRejecting(false)} className="btn text-[10px] flex-1" disabled={busy}>Back</button>
                        <button
                          onClick={() => runAction('reject')}
                          disabled={busy || rejectReason.trim().length < 5}
                          className="btn btn-danger text-[10px] flex-1"
                        >
                          {busy ? 'Working…' : 'Confirm Rejection'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => setConfirmAction('approve')} className="btn btn-primary text-[10px]">
                        <CheckCircle2 size={13} className="mr-1.5" /> Approve
                      </button>
                      <button onClick={() => setRejecting(true)} className="btn btn-danger text-[10px]">
                        <XCircle size={13} className="mr-1.5" /> Reject
                      </button>
                      <button onClick={() => runAction('hold')} disabled={busy} className="btn text-[10px] col-span-2">
                        Keep Under Review
                      </button>
                    </div>
                  )}
                  <button onClick={() => setConfirmAction('cancel')} disabled={busy} className="w-full text-[10px] text-saif-dim hover:text-saif-accent transition-colors flex items-center justify-center gap-1.5 py-1">
                    <Ban size={11} /> Cancel payment & order (restocks items)
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Confirmation for irreversible actions */}
      <ConfirmDialog
        open={confirmAction === 'approve'}
        title="Approve this payment?"
        message={`This confirms the order ${selected?.orders?.order_number || ''} and records you as the verifier. Only approve after checking the screenshot against the expected amount ${selected ? formatPrice(selected.expected_amount) : ''}.`}
        confirmLabel="Approve Payment"
        busy={busy}
        onConfirm={() => runAction('approve')}
        onCancel={() => setConfirmAction(null)}
      />
      <ConfirmDialog
        open={confirmAction === 'cancel'}
        title="Cancel payment and order?"
        message="The order will be cancelled and its reserved stock released. The customer can no longer pay for it."
        confirmLabel="Cancel Order"
        danger
        busy={busy}
        onConfirm={() => runAction('cancel')}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  )
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5">
      <span className="text-xs uppercase tracking-wider text-saif-dim flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-saif-text text-right min-w-0">{children}</span>
    </div>
  )
}
