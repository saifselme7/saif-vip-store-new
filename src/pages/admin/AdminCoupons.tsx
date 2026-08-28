import { useState } from 'react'
import { Plus, Pencil, Trash2, Ticket, Copy } from 'lucide-react'
import { useAdminCoupons } from '@/hooks/admin/useAdminData'
import { useToast } from '@/context/ToastContext'
import { useApp } from '@/context/AppContext'
import { usePageMeta } from '@/hooks/usePageMeta'
import { formatPrice, formatDate, cn, copyToClipboard } from '@/lib/utils'
import { PageHeader, DataList, type Cell } from '@/components/admin/ui'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Loading from '@/components/Loading'

interface CouponForm {
  code: string
  type: 'percentage' | 'fixed'
  value: string
  min_order_value: string
  max_uses: string
  max_discount_amount: string
  expires_at: string
  is_active: boolean
}

const EMPTY: CouponForm = {
  code: '',
  type: 'percentage',
  value: '',
  min_order_value: '',
  max_uses: '',
  max_discount_amount: '',
  expires_at: '',
  is_active: true,
}

export default function AdminCoupons() {
  const { coupons, loading, create, update, remove } = useAdminCoupons()
  const { addToast } = useToast()
  const { settings } = useApp()
  const currency = settings?.currency ?? 'EGP'

  const [editing, setEditing] = useState<string | null | undefined>(undefined)
  const [form, setForm] = useState<CouponForm>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; code: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  usePageMeta({ title: 'Admin — Coupons' })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
  }

  function openEdit(c: typeof coupons[number]) {
    setEditing(c.id)
    setForm({
      code: c.code,
      type: c.type,
      value: String(c.value),
      min_order_value: c.min_order_value !== null ? String(c.min_order_value) : '',
      max_uses: c.max_uses !== null ? String(c.max_uses) : '',
      max_discount_amount: c.max_discount_amount !== null ? String(c.max_discount_amount) : '',
      expires_at: c.expires_at ? c.expires_at.split('T')[0] : '',
      is_active: c.is_active,
    })
  }

  async function handleSave() {
    if (!form.code.trim()) {
      addToast('Coupon code is required', 'error')
      return
    }
    const value = Number(form.value)
    if (Number.isNaN(value) || value <= 0) {
      addToast('Enter a valid discount value', 'error')
      return
    }
    if (form.type === 'percentage' && value > 100) {
      addToast('Percentage cannot exceed 100', 'error')
      return
    }

    const payload = {
      code: form.code.trim().toUpperCase(),
      type: form.type,
      value,
      min_order_value: form.min_order_value ? Number(form.min_order_value) : null,
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      max_discount_amount: form.max_discount_amount ? Number(form.max_discount_amount) : null,
      expires_at: form.expires_at ? new Date(`${form.expires_at}T23:59:59`).toISOString() : null,
      is_active: form.is_active,
    }

    setSaving(true)
    const { error } = editing ? await update(editing, payload) : await create(payload)
    setSaving(false)
    if (error) {
      addToast(error.message?.includes('duplicate') ? 'A coupon with this code already exists' : 'Failed to save coupon', 'error')
      return
    }
    addToast(editing ? 'Coupon updated' : 'Coupon created')
    setEditing(undefined)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await remove(deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
    if (error) addToast('Failed to delete coupon', 'error')
    else addToast('Coupon deleted')
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Coupons" />
        <Loading />
      </div>
    )
  }

  const rows: Cell[][] = coupons.map(c => {
    const exhausted = c.max_uses !== null && c.uses_count >= c.max_uses
    const expired = c.expires_at !== null && new Date(c.expires_at) < new Date()
    const usable = c.is_active && !exhausted && !expired
    return [
      {
        label: 'Code',
        primary: true,
        content: (
          <button
            className="font-mono text-xs font-semibold text-saif-text hover:text-saif-accent transition-colors flex items-center gap-1.5"
            onClick={async () => {
              const ok = await copyToClipboard(c.code)
              addToast(ok ? 'Code copied' : c.code, ok ? 'success' : 'info')
            }}
            title="Click to copy"
          >
            {c.code} <Copy size={11} className="text-saif-dim" />
          </button>
        ),
      },
      {
        label: 'Discount',
        content: (
          <span className="text-saif-text">
            {c.type === 'percentage' ? `${c.value}%` : formatPrice(c.value, currency)}
            {c.type === 'percentage' && c.max_discount_amount !== null && (
              <span className="text-[10px] text-saif-dim block">max {formatPrice(c.max_discount_amount, currency)}</span>
            )}
          </span>
        ),
      },
      {
        label: 'Min Order',
        hideOnMobile: true,
        content: <span className="text-saif-dim text-xs">{c.min_order_value !== null ? formatPrice(c.min_order_value, currency) : '—'}</span>,
      },
      {
        label: 'Usage',
        content: (
          <span className={cn('tabular-nums', exhausted ? 'text-red-400' : 'text-saif-dim')}>
            {c.uses_count}
            {c.max_uses !== null ? ` / ${c.max_uses}` : ''}
          </span>
        ),
      },
      {
        label: 'Expires',
        hideOnMobile: true,
        content: (
          <span className={cn('text-xs', expired ? 'text-red-400' : 'text-saif-dim')}>
            {c.expires_at ? formatDate(c.expires_at) : 'Never'}
          </span>
        ),
      },
      {
        label: 'Status',
        content: (
          <span
            className={cn(
              'badge',
              usable
                ? 'border-green-500/30 text-green-400'
                : exhausted
                  ? 'border-red-500/30 text-red-400'
                  : expired
                    ? 'border-red-500/30 text-red-400'
                    : 'border-saif-border text-saif-dim',
            )}
          >
            {!c.is_active ? 'disabled' : exhausted ? 'exhausted' : expired ? 'expired' : 'active'}
          </span>
        ),
      },
      {
        label: 'Actions',
        content: (
          <div className="flex gap-1">
            <button
              onClick={() => openEdit(c)}
              className="p-1.5 text-saif-dim hover:text-saif-text transition-colors"
              aria-label={`Edit ${c.code}`}
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={async () => {
                const { error } = await update(c.id, { is_active: !c.is_active })
                if (error) addToast('Failed to update', 'error')
                else addToast(c.is_active ? 'Coupon disabled' : 'Coupon enabled')
              }}
              className="btn btn-sm btn-ghost text-[10px]"
            >
              {c.is_active ? 'Disable' : 'Enable'}
            </button>
            <button
              onClick={() => setDeleteTarget({ id: c.id, code: c.code })}
              className="p-1.5 text-saif-dim hover:text-saif-accent transition-colors"
              aria-label={`Delete ${c.code}`}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ),
      },
    ]
  })

  return (
    <div className="animate-[pageIn_0.4s_ease]">
      <PageHeader
        title="Coupons"
        description="Validated server-side at checkout — codes are never listed publicly."
        actions={
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <Plus size={14} /> Add Coupon
          </button>
        }
      />

      <DataList
        columns={['Code', 'Discount', 'Min Order', 'Usage', 'Expires', 'Status', 'Actions']}
        rows={rows}
        empty={coupons.length === 0}
      />

      <Modal open={editing !== undefined} onClose={() => setEditing(undefined)} title={editing ? 'Edit Coupon' : 'New Coupon'}>
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="cp-code">Code *</label>
            <input
              id="cp-code"
              className="input font-mono uppercase"
              value={form.code}
              onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="WELCOME20"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="cp-type">Type</label>
              <select id="cp-type" className="input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value as 'percentage' | 'fixed' })}>
                <option value="percentage" className="bg-black">Percentage (%)</option>
                <option value="fixed" className="bg-black">Fixed amount</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="cp-value">Value *</label>
              <input id="cp-value" type="number" min="0" step="0.01" className="input" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} />
            </div>
          </div>
          {form.type === 'percentage' && (
            <div>
              <label className="label" htmlFor="cp-max">Max Discount Amount (optional)</label>
              <input id="cp-max" type="number" min="0" step="0.01" className="input" value={form.max_discount_amount} onChange={e => setForm({ ...form, max_discount_amount: e.target.value })} placeholder="Caps the discount" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="cp-min">Min Order (optional)</label>
              <input id="cp-min" type="number" min="0" step="0.01" className="input" value={form.min_order_value} onChange={e => setForm({ ...form, min_order_value: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="cp-uses">Max Uses (optional)</label>
              <input id="cp-uses" type="number" min="1" className="input" value={form.max_uses} onChange={e => setForm({ ...form, max_uses: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="cp-exp">Expiry Date (optional)</label>
            <input id="cp-exp" type="date" className="input" value={form.expires_at} onChange={e => setForm({ ...form, expires_at: e.target.value })} />
          </div>
          <label className="flex items-center gap-3 text-sm text-saif-text cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={e => setForm({ ...form, is_active: e.target.checked })}
              className="w-4 h-4 accent-[#E63946]"
            />
            Active
          </label>
          <div className="flex gap-3 pt-2">
            <button className="btn btn-primary flex-1" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Coupon'}
            </button>
            <button className="btn" onClick={() => setEditing(undefined)} disabled={saving}>
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={`Delete coupon ${deleteTarget?.code}?`}
        message="Existing orders keep their discount records, but the code can no longer be used."
        confirmLabel="Delete Coupon"
        danger
        busy={deleting}
      />
    </div>
  )
}
