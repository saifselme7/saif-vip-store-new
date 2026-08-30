import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import Reveal, { RevealLine } from '@/components/motion/Reveal'
import { useI18n } from '@/i18n'
import { configText, type FinalCtaConfig } from '@/hooks/useHomepageSections'

/**
 * Closing campaign — the visitor leaves with the statement burned in.
 */
export default function FinalCTA({
  heading,
  description,
  config,
}: {
  heading?: string | null
  description?: string | null
  config?: unknown
}) {
  const { t, lang, isRTL } = useI18n()
  const cfg = (config ?? {}) as FinalCtaConfig
  return (
    <section className="relative px-5 lg:px-10 py-28 md:py-44 overflow-hidden grain" aria-labelledby="final-cta">
      {/* Ghost wordmark */}
      <span
        className="ghost-index text-outline-faint inset-x-0 -bottom-6 md:-bottom-10 text-center text-[clamp(90px,19vw,300px)] font-display"
        aria-hidden="true"
      >
        SAIF®
      </span>

      <div className="relative z-10 max-w-3xl mx-auto text-center">
        <Reveal variant="fade" duration={700}>
          <p className="eyebrow justify-center">
            <span className="text-saif-accent tabular-nums">09</span>
            <span className="w-3 h-px bg-saif-border" aria-hidden="true" />
            {t('finalCta.eyebrow')}
          </p>
        </Reveal>

        <h2
          id="final-cta"
          className="mt-8 text-[clamp(48px,10vw,132px)] font-display text-saif-text leading-[0.92]"
        >
          <RevealLine delay={80}>{heading ?? t('finalCta.line1')}</RevealLine>
          <RevealLine delay={240}>
            <span className="font-serif italic font-normal">{t('finalCta.line2')}</span>
          </RevealLine>
        </h2>

        <Reveal variant="fade" delay={450} duration={900}>
          <p className="mt-8 text-sm md:text-base text-saif-dim max-w-md mx-auto leading-relaxed text-balance">
            {description ?? t('finalCta.description')}
          </p>
        </Reveal>

        <Reveal variant="scale" delay={580} duration={800}>
          <div className="mt-11 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link to={cfg.cta_dest || '/products'} data-magnetic className="btn btn-primary w-full sm:w-auto">
              {configText(cfg, 'cta_text', lang) ?? t('finalCta.cta')}{' '}
              <ArrowRight size={14} className={isRTL ? 'rotate-180' : ''} aria-hidden="true" />
            </Link>
            <Link to={cfg.secondary_dest || '/about'} className="btn w-full sm:w-auto">
              {configText(cfg, 'secondary_text', lang) ?? t('finalCta.secondary')}
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
