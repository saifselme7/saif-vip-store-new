import { useState } from 'react'
import { Plus, Pencil, Trash2, Power } from 'lucide-react'
import { useAdminCoupons } from '@/hooks/useAdmin'
import { useApp } from '@/context/AppContext'
import { usePageMeta } from '@/hooks/usePageMeta'
import { formatDate } from '@/lib/utils'
import type { Coupon } from '@/types'
import Loading from '@/components/Loading'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

interface CouponDraft {
  id?: string
  code: string
  type: 'percentage' | 'fixed'
  value: string
  min_order_value: string
  max_discount: string
  max_uses: string
  expires_at: string
  is_active: boolean
}

const EMPTY: CouponDraft = { code: '', type: 'percentage', value: '', min_order_value: '', max_discount: '', max_uses: '', expires_at: '', is_active: true }

export default function AdminCoupons() {
  const { coupons, loading, save, remove } = useAdminCoupons()
  const { addToast } = useApp()
  const [draft, setDraft] = useState<CouponDraft | null>(null)
  const [deleting, setDeleting] = useState<Coupon | null>(null)
  const [saving, setSaving] = useState(false)

  usePageMeta('Coupons', 'Manage discount codes.')

  async function handleSave() {
    if (!draft) return
    if (!draft.code.trim()) { addToast('Coupon code is required', 'error'); return }
    const value = Number(draft.value)
    if (!value || value <= 0) { addToast('Enter a valid discount value', 'error'); return }
    if (draft.type === 'percentage' && value > 100) { addToast('Percentage cannot exceed 100', 'error'); return }

    setSaving(true)
    const { error } = await save({
      id: draft.id,
      code: draft.code.trim().toUpperCase(),
      type: draft.type,
      value,
      min_order_value: draft.min_order_value ? Number(draft.min_order_value) : null,
      max_discount: draft.max_discount ? Number(draft.max_discount) : null,
      max_uses: draft.max_uses ? Number(draft.max_uses) : null,
      expires_at: draft.expires_at ? new Date(draft.expires_at).toISOString() : null,
      is_active: draft.is_active,
    })
    setSaving(false)
    if (error) addToast(error.message || 'Failed to save coupon', 'error')
    else { addToast(draft.id ? 'Coupon updated' : 'Coupon created'); setDraft(null) }
  }

  async function handleDelete() {
    if (!deleting) return
    const { error } = await remove(deleting.id)
    if (error) addToast(error.message || 'Failed to delete', 'error')
    else addToast('Coupon deleted')
    setDeleting(null)
  }

  async function toggleActive(c: Coupon) {
    const { error } = await save({ id: c.id, code: c.code, is_active: !c.is_active })
    if (error) addToast('Failed to update', 'error')
    else addToast(c.is_active ? 'Coupon disabled' : 'Coupon enabled')
  }

  function expired(c: Coupon) {
    return c.expires_at != null && new Date(c.expires_at) < new Date()
  }
  function usedUp(c: Coupon) {
    return c.max_uses != null && c.uses_count >= c.max_uses
  }

  return (
    <div className="animate-[pageIn_0.4s_ease]">
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-saif-text">Coupons</h1>
        <button onClick={() => setDraft({ ...EMPTY })} className="btn btn-primary btn-sm"><Plus size={14} className="mr-1" /> Add Coupon</button>
      </div>
      <p className="text-xs text-saif-dim mb-6">Codes are never listed publicly — customers must enter them; validation runs server-side.</p>

      {loading ? <Loading /> : (
        <div className="border border-saif-border overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-saif-border text-left">
                {['Code', 'Discount', 'Usage', 'Limits', 'State', 'Actions'].map(h => (
                  <th key={h} className="p-4 text-[10px] uppercase tracking-wider text-saif-dim font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coupons.map(c => (
                <tr key={c.id} className="border-b border-saif-border hover:bg-white/[0.03] transition-colors">
                  <td className="p-4 font-mono font-bold text-saif-text">{c.code}</td>
                  <td className="p-4 text-saif-text">{c.type === 'percentage' ? `${c.value}%` : `${c.value} off`}{c.max_discount != null ? <span className="text-xs text-saif-dim block">max {c.max_discount}</span> : null}</td>
                  <td className="p-4 text-saif-dim">{c.uses_count}{c.max_uses != null ? ` / ${c.max_uses}` : ''}</td>
                  <td className="p-4 text-xs text-saif-dim">
                    {c.min_order_value != null ? `min order ${c.min_order_value}` : 'no minimum'}
                    {c.expires_at ? ` · until ${formatDate(c.expires_at)}` : ' · no expiry'}
                  </td>
                  <td className="p-4">
                    {expired(c) ? <State text="Expired" tone="text-red-400" /> :
                      usedUp(c) ? <State text="Used Up" tone="text-yellow-400" /> :
                      c.is_active ? <State text="Active" tone="text-green-400" /> :
                      <State text="Disabled" tone="text-saif-dim" />}
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <button onClick={() => toggleActive(c)} className="p-1.5 text-saif-dim hover:text-saif-text transition-colors" aria-label={c.is_active ? 'Disable' : 'Enable'} title={c.is_active ? 'Disable' : 'Enable'}><Power size={14} /></button>
                      <button onClick={() => setDraft({ id: c.id, code: c.code, type: c.type, value: String(c.value), min_order_value: c.min_order_value != null ? String(c.min_order_value) : '', max_discount: c.max_discount != null ? String(c.max_discount) : '', max_uses: c.max_uses != null ? String(c.max_uses) : '', expires_at: c.expires_at ? c.expires_at.split('T')[0] : '', is_active: c.is_active })} className="p-1.5 text-saif-dim hover:text-saif-text transition-colors" aria-label="Edit"><Pencil size={14} /></button>
                      <button onClick={() => setDeleting(c)} className="p-1.5 text-saif-dim hover:text-saif-accent transition-colors" aria-label="Delete"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? 'Edit Coupon' : 'New Coupon'}>
        {draft && (
          <div className="space-y-3">
            <div>
              <label className="label">Code *</label>
              <input value={draft.code} onChange={e => setDraft({ ...draft, code: e.target.value.toUpperCase() })} className="input font-mono" placeholder="WELCOME20" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Type</label>
                <select value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value as 'percentage' | 'fixed' })} className="input bg-[#0A0A0A]">
                  <option value="percentage">Percentage %</option>
                  <option value="fixed">Fixed amount</option>
                </select>
              </div>
              <div>
                <label className="label">{draft.type === 'percentage' ? 'Percent' : 'Amount'} *</label>
                <input type="number" min="0" step="0.01" value={draft.value} onChange={e => setDraft({ ...draft, value: e.target.value })} className="input" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Min Order</label>
                <input type="number" min="0" value={draft.min_order_value} onChange={e => setDraft({ ...draft, min_order_value: e.target.value })} className="input" />
              </div>
              <div>
                <label className="label">Max Discount</label>
                <input type="number" min="0" value={draft.max_discount} onChange={e => setDraft({ ...draft, max_discount: e.target.value })} className="input" placeholder="cap" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Max Uses</label>
                <input type="number" min="0" value={draft.max_uses} onChange={e => setDraft({ ...draft, max_uses: e.target.value })} className="input" />
              </div>
              <div>
                <label className="label">Expires</label>
                <input type="date" value={draft.expires_at} onChange={e => setDraft({ ...draft, expires_at: e.target.value })} className="input" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-saif-text">
              <input type="checkbox" checked={draft.is_active} onChange={e => setDraft({ ...draft, is_active: e.target.checked })} /> Active
            </label>
            <div className="flex gap-3 pt-2">
              <button onClick={handleSave} disabled={saving} className="btn btn-primary flex-1 text-xs">{saving ? 'Saving…' : 'Save'}</button>
              <button onClick={() => setDraft(null)} className="btn flex-1 text-xs">Cancel</button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Delete coupon?"
        message={`“${deleting?.code}” will be permanently removed.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}

function State({ text, tone }: { text: string; tone: string }) {
  return <span className={`text-xs font-semibold uppercase ${tone}`}>{text}</span>
}
