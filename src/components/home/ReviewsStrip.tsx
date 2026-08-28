import Reveal from '@/components/motion/Reveal'
import SectionHeader from '@/components/SectionHeader'
import RatingStars from '@/components/ui/RatingStars'
import { formatDate } from '@/lib/utils'
import { useI18n } from '@/i18n'
import type { Review } from '@/types'

type ReviewWithProduct = Review & { products?: { name: string } | null }

/**
 * Social proof — real, approved database reviews only. Renders nothing when
 * no reviews exist (never fabricates).
 */
export default function ReviewsStrip({
  reviews,
  title,
  description,
  config,
}: {
  reviews: ReviewWithProduct[]
  title?: string | null
  description?: string | null
  config?: unknown
}) {
  const { t } = useI18n()
  if (reviews.length === 0) return null

  return (
    <section className="px-5 lg:px-10 py-24 md:py-32 border-t border-saif-border" aria-labelledby="reviews-heading">
      <div className="max-w-7xl mx-auto">
        <SectionHeader
          index="09"
          eyebrow={t('reviews.eyebrow')}
          title={title ?? t('reviews.title')}
          description={description ?? t('reviews.description')}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {reviews.slice(0, 3).map((review, i) => (
            <Reveal
              key={review.id}
              variant="up"
              delay={i * 140}
              duration={900}
              className="group border border-saif-border rounded-sm p-7 md:p-8 bg-saif-surface/40 hover:border-saif-text/25 transition-colors duration-500 flex flex-col"
            >
              <span
                className="font-display italic text-6xl leading-[0.5] text-saif-accent select-none"
                aria-hidden="true"
              >
                &ldquo;
              </span>
              <blockquote className="mt-6 flex-1">
                <p className="font-display italic text-xl md:text-[22px] leading-snug text-saif-text line-clamp-4">
                  {review.title}
                </p>
                <p className="mt-4 text-sm text-saif-dim leading-relaxed line-clamp-4">{review.body}</p>
              </blockquote>
              <footer className="mt-7 pt-5 border-t border-saif-border flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-saif-text truncate">
                    {review.profiles?.full_name || 'Anonymous'}
                  </p>
                  <p className="text-xs text-saif-faint truncate mt-0.5">
                    {review.products?.name || 'SAIF STORE'} · {formatDate(review.created_at)}
                  </p>
                </div>
                <RatingStars value={review.rating} size={13} />
              </footer>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
