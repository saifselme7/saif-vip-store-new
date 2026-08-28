import { useApp } from '@/context/AppContext'
import { formatPrice } from '@/lib/utils'

/**
 * The hero's bottom boundary — a moving trust band that transitions the
 * visitor into the story. Content is derived from real store settings.
 */
export default function MarqueeBand() {
  const { settings } = useApp()
  const currency = settings?.currency ?? 'EGP'

  const items = [
    settings?.free_shipping_threshold
      ? `Free shipping over ${formatPrice(settings.free_shipping_threshold, currency)}`
      : 'Shipping across Egypt',
    'Payments verified by humans',
    'InstaPay & Vodafone Cash',
    'Digital delivery after confirmation',
    'Curated in Egypt',
  ]

  return (
    <section className="relative border-y border-saif-border bg-saif-surface/50 py-5 overflow-hidden" aria-label="Store highlights">
      <div className="marquee-track flex gap-14 whitespace-nowrap w-max">
        {[0, 1].map(dup => (
          <div key={dup} className="flex gap-14 items-center" aria-hidden={dup === 1}>
            {items.map(item => (
              <span
                key={item}
                className="text-[11px] font-semibold uppercase tracking-[0.25em] text-saif-dim flex items-center gap-14"
              >
                {item}
                <span className="w-1.5 h-1.5 rotate-45 bg-saif-accent flex-shrink-0" aria-hidden="true" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}
