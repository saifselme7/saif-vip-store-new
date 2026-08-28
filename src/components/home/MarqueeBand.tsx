import { useApp } from '@/context/AppContext'
import { formatPrice } from '@/lib/utils'
import { useI18n } from '@/i18n'

/**
 * The hero's bottom boundary — a moving trust band that transitions the
 * visitor into the story. Content is derived from real store settings.
 */
export default function MarqueeBand() {
  const { t } = useI18n()
  const { settings } = useApp()
  const currency = settings?.currency ?? 'EGP'

  const items = [
    settings?.free_shipping_threshold
      ? t('home.trustFreeShipping', { amount: formatPrice(settings.free_shipping_threshold) })
      : t('home.trustShippingEgypt'),
    t('home.trustVerified'),
    t('home.trustMethods'),
    t('home.trustDigital'),
    t('home.trustEgypt'),
  ]

  return (
    <section className="relative border-y border-saif-border bg-saif-surface/50 py-5 overflow-hidden" aria-label={t('a11y.storeHighlights')}>
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
