import { useMemo, useState } from 'react'
import { Search, Trash2, RefreshCw } from 'lucide-react'
import { useAdminReviews } from '@/hooks/useAdmin'
import { useApp } from '@/context/AppContext'
import { usePageMeta } from '@/hooks/usePageMeta'
import { formatDate } from '@/lib/utils'
import Loading from '@/components/Loading'
import EmptyState from '@/components/EmptyState'
import RatingStars from '@/components/ui/RatingStars'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import type { Review } from '@/types'

type Tab = 'pending' | 'approved' | 'rejected' | 'all'

export default function AdminReviews() {
  const { reviews, loading, updateStatus, remove, refetch } = useAdminReviews()
  const { addToast } = useApp()
  const [tab, setTab] = useState<Tab>('pending')
  const [search, setSearch] = useState('')
  const [deleting, setDeleting] = useState<Review | null>(null)

  usePageMeta('Reviews', 'Moderate customer reviews.')

  const filtered = useMemo(() => reviews.filter(r => {
    if (tab !== 'all' && r.status !== tab) return false
    const q = search.trim().toLowerCase()
    if (q && !r.title.toLowerCase().includes(q) && !r.body.toLowerCase().includes(q) && !(r.products?.name || '').toLowerCase().includes(q)) return false
    return true
  }), [reviews, tab, search])

  async function moderate(r: Review, status: Review['status']) {
    const { error } = await updateStatus(r.id, status)
    if (error) addToast('Failed to update review', 'error')
    else addToast(status === 'approved' ? 'Review approved' : 'Review rejected')
  }

  async function handleDelete() {
    if (!deleting) return
    const { error } = await remove(deleting.id)
    if (error) addToast('Failed to delete', 'error')
    else addToast('Review deleted')
    setDeleting(null)
  }

  const tabs: Array<{ id: Tab; label: string; count: number }> = [
    { id: 'pending', label: 'Pending', count: reviews.filter(r => r.status === 'pending').length },
    { id: 'approved', label: 'Approved', count: reviews.filter(r => r.status === 'approved').length },
    { id: 'rejected', label: 'Rejected', count: reviews.filter(r => r.status === 'rejected').length },
    { id: 'all', label: 'All', count: reviews.length },
  ]

  return (
    <div className="animate-[pageIn_0.4s_ease]">
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-saif-text">Reviews</h1>
        <button onClick={refetch} className="text-xs text-saif-dim hover:text-saif-text flex items-center gap-1.5"><RefreshCw size={12} /> Refresh</button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex gap-2 overflow-x-auto pb-1">
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
        </div>
        <div className="relative sm:ml-auto sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-saif-dim" />
          <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reviews…" aria-label="Search reviews" className="input pl-9 text-xs py-2.5" />
        </div>
      </div>

      {loading ? <Loading /> : filtered.length === 0 ? (
        <EmptyState title="No reviews here" description="Reviews in this view will appear as customers submit them." />
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <div key={r.id} className="border border-saif-border p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <RatingStars rating={r.rating} />
                    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 border ${
                      r.status === 'approved' ? 'border-green-500/50 text-green-400' :
                      r.status === 'rejected' ? 'border-red-500/50 text-red-400' :
                      'border-yellow-500/50 text-yellow-400'
                    }`}>{r.status}</span>
                  </div>
                  <p className="text-sm font-semibold text-saif-text mt-2">{r.title}</p>
                  <p className="text-sm text-saif-dim mt-1 leading-relaxed">{r.body}</p>
                  <p className="text-xs text-saif-dim mt-2">
                    {r.user?.full_name || 'Customer'} · {r.products?.name || 'Unknown product'} · {formatDate(r.created_at)}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {r.status !== 'approved' && <button onClick={() => moderate(r, 'approved')} className="btn text-[10px] px-3 py-2">Approve</button>}
                  {r.status !== 'rejected' && <button onClick={() => moderate(r, 'rejected')} className="btn btn-danger text-[10px] px-3 py-2">Reject</button>}
                  <button onClick={() => setDeleting(r)} className="p-2 border border-saif-border text-saif-dim hover:text-saif-accent transition-colors" aria-label="Delete review"><Trash2 size={13} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Delete review?"
        message={`“${deleting?.title}” will be permanently removed.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
