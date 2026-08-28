import { useState } from 'react'
import { Star } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useReviews, submitReview } from '@/hooks/useReviews'
import RatingStars from '@/components/ui/RatingStars'
import Modal from '@/components/ui/Modal'
import { cn, formatDate } from '@/lib/utils'
import type { Product } from '@/types'

export default function ProductReviews({ product }: { product: Product }) {
  const { user } = useAuth()
  const { addToast } = useToast()
  const { reviews, stats, loading } = useReviews(product.id)
  const [formOpen, setFormOpen] = useState(false)
  const [rating, setRating] = useState(5)
  const [hoverRating, setHoverRating] = useState(0)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !body.trim()) {
      addToast('Please add a title and review text', 'error')
      return
    }
    setSubmitting(true)
    const { error } = await submitReview({
      productId: product.id,
      rating,
      title: title.trim(),
      body: body.trim(),
    })
    setSubmitting(false)
    if (error) {
      addToast(error, 'error')
      return
    }
    setFormOpen(false)
    setTitle('')
    setBody('')
    setRating(5)
    addToast('Review submitted — it will appear after moderation')
  }

  return (
    <section className="mt-14 pt-10 border-t border-saif-border" aria-labelledby="reviews-heading">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <h2 id="reviews-heading" className="text-xl font-bold tracking-tight text-saif-text">
          Reviews {stats.count > 0 && <span className="text-saif-dim font-normal">({stats.count})</span>}
        </h2>
        <button
          className="btn btn-sm"
          onClick={() => {
            if (!user) {
              addToast('Sign in to write a review', 'info')
              return
            }
            setFormOpen(true)
          }}
        >
          Write a Review
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 skeleton rounded-sm" />
          ))}
        </div>
      ) : stats.count === 0 ? (
        <p className="text-sm text-saif-dim">
          No reviews yet. Be the first to share your experience with this product.
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-10">
          {/* Summary */}
          <div className="card p-6 h-fit">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-4xl font-black tracking-tighter text-saif-text">{stats.average}</span>
              <div>
                <RatingStars value={stats.average} size={15} />
                <p className="text-xs text-saif-dim mt-1">{stats.count} reviews</p>
              </div>
            </div>
            <div className="space-y-1.5">
              {stats.distribution.map(d => {
                const pct = stats.count ? (d.count / stats.count) * 100 : 0
                return (
                  <div key={d.rating} className="flex items-center gap-2 text-xs text-saif-dim">
                    <span className="w-3 text-right">{d.rating}</span>
                    <Star size={10} className="fill-saif-dim text-saif-dim" />
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-saif-accent rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-6 text-right tabular-nums">{d.count}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Review list */}
          <div className="space-y-6">
            {reviews.map(r => (
              <article key={r.id} className="pb-6 border-b border-saif-border last:border-0">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center text-xs font-bold text-saif-dim">
                    {(r.profiles?.full_name || 'A').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-saif-text">{r.profiles?.full_name || 'Anonymous'}</p>
                    <p className="text-xs text-saif-dim">{formatDate(r.created_at)}</p>
                  </div>
                  <RatingStars value={r.rating} size={12} className="ml-auto" />
                </div>
                <h3 className="text-sm font-semibold text-saif-text mb-1.5">{r.title}</h3>
                <p className="text-sm text-saif-dim leading-relaxed">{r.body}</p>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* Review form */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={`Review ${product.name}`}>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <span className="label">Your Rating</span>
            <div className="flex gap-1.5" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map(value => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  onMouseEnter={() => setHoverRating(value)}
                  onMouseLeave={() => setHoverRating(0)}
                  role="radio"
                  aria-checked={rating === value}
                  aria-label={`${value} star${value > 1 ? 's' : ''}`}
                  className="p-1"
                >
                  <Star
                    size={26}
                    className={cn(
                      'transition-colors',
                      value <= (hoverRating || rating)
                        ? 'fill-saif-accent text-saif-accent'
                        : 'text-saif-faint',
                    )}
                  />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label" htmlFor="review-title">
              Title
            </label>
            <input
              id="review-title"
              className="input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Sum up your experience"
              maxLength={80}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="review-body">
              Review
            </label>
            <textarea
              id="review-body"
              className="input resize-none"
              rows={4}
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="What did you like or dislike?"
              maxLength={1000}
              required
            />
          </div>
          <p className="text-xs text-saif-dim">
            Reviews are moderated — yours will appear once approved.
          </p>
          <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit Review'}
          </button>
        </form>
      </Modal>
    </section>
  )
}
