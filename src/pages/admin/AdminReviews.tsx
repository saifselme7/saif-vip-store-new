import { useMemo, useState } from 'react'
import { Star, Check, X, Trash2 } from 'lucide-react'
import { useAdminReviews } from '@/hooks/admin/useAdminData'
import { useToast } from '@/context/ToastContext'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useDebounce } from '@/hooks/useDebounce'
import { formatDate, cn } from '@/lib/utils'
import { PageHeader, SearchInput, FilterTabs, EmptyPanel } from '@/components/admin/ui'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Loading from '@/components/Loading'
import RatingStars from '@/components/ui/RatingStars'

export default function AdminReviews() {
  const { reviews, loading, updateStatus, remove } = useAdminReviews()
  const { addToast } = useToast()
  const [statusFilter, setStatusFilter] = useState('pending')
  const [search, setSearch] = useState('')
  const [ratingFilter, setRatingFilter] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const debouncedSearch = useDebounce(search, 250)
  usePageMeta({ title: 'Admin — Reviews' })

  const filtered = useMemo(() => {
    let list = [...reviews]
    if (statusFilter) list = list.filter(r => r.status === statusFilter)
    if (ratingFilter) list = list.filter(r => r.rating === Number(ratingFilter))
    const q = debouncedSearch.trim().toLowerCase()
    if (q) {
      list = list.filter(
        r =>
          r.title.toLowerCase().includes(q) ||
          r.body.toLowerCase().includes(q) ||
          (r.products?.name || '').toLowerCase().includes(q) ||
          (r.profiles?.full_name || '').toLowerCase().includes(q),
      )
    }
    return list
  }, [reviews, statusFilter, ratingFilter, debouncedSearch])

  async function handleStatus(id: string, status: 'approved' | 'rejected') {
    const { error } = await updateStatus(id, status)
    if (error) addToast('Failed to update review', 'error')
    else addToast(status === 'approved' ? 'Review approved — now visible in the store' : 'Review rejected')
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await remove(deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
    if (error) addToast('Failed to delete review', 'error')
    else addToast('Review deleted')
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Reviews" />
        <Loading />
      </div>
    )
  }

  const counts = {
    pending: reviews.filter(r => r.status === 'pending').length,
    approved: reviews.filter(r => r.status === 'approved').length,
    rejected: reviews.filter(r => r.status === 'rejected').length,
  }

  return (
    <div className="animate-[pageIn_0.4s_ease]">
      <PageHeader title="Reviews" description="Moderate customer reviews before they appear in the store." />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search title, product, author…" className="flex-1" />
        <select
          value={ratingFilter}
          onChange={e => setRatingFilter(e.target.value)}
          className="input py-2.5 text-xs w-full sm:w-36"
          aria-label="Filter by rating"
        >
          <option value="">All ratings</option>
          {[5, 4, 3, 2, 1].map(r => (
            <option key={r} value={r} className="bg-black">
              {r} stars
            </option>
          ))}
        </select>
      </div>

      <div className="mb-6">
        <FilterTabs
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'pending', label: 'Pending', count: counts.pending },
            { value: 'approved', label: 'Approved', count: counts.approved },
            { value: 'rejected', label: 'Rejected', count: counts.rejected },
            { value: '', label: 'All', count: reviews.length },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyPanel
          title="No reviews here"
          description={statusFilter === 'pending' ? 'No reviews waiting for moderation.' : undefined}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <article key={r.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <RatingStars value={r.rating} size={13} />
                    <h3 className="text-sm font-semibold text-saif-text truncate">{r.title}</h3>
                    <span
                      className={cn(
                        'badge',
                        r.status === 'approved'
                          ? 'border-green-500/30 text-green-400'
                          : r.status === 'rejected'
                            ? 'border-red-500/30 text-red-400'
                            : 'border-yellow-500/30 text-yellow-400',
                      )}
                    >
                      {r.status}
                    </span>
                  </div>
                  <p className="text-xs text-saif-dim mt-1">
                    {r.profiles?.full_name || 'Anonymous'} · {r.products?.name || 'Unknown product'} ·{' '}
                    {formatDate(r.created_at)}
                  </p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  {r.status !== 'approved' && (
                    <button
                      className="btn btn-sm"
                      onClick={() => handleStatus(r.id, 'approved')}
                      aria-label={`Approve review ${r.title}`}
                    >
                      <Check size={13} className="text-green-400" /> Approve
                    </button>
                  )}
                  {r.status !== 'rejected' && (
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => handleStatus(r.id, 'rejected')}
                      aria-label={`Reject review ${r.title}`}
                    >
                      <X size={13} className="text-red-400" /> Reject
                    </button>
                  )}
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => setDeleteTarget({ id: r.id, title: r.title })}
                    aria-label={`Delete review ${r.title}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <p className="text-sm text-saif-dim leading-relaxed">{r.body}</p>
            </article>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={`Delete "${deleteTarget?.title}"?`}
        message="The review is permanently removed."
        confirmLabel="Delete Review"
        danger
        busy={deleting}
      />
    </div>
  )
}
