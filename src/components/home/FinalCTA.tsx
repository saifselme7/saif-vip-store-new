import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import Reveal, { RevealLine } from '@/components/motion/Reveal'
import { useI18n } from '@/i18n'
import { configText, type FinalCtaConfig } from '@/hooks/useHomepageSections'

/**
 * Closing brand moment — the visitor leaves with the wordmark burned in.
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
  const { t, lang } = useI18n()
  const cfg = (config ?? {}) as FinalCtaConfig
  return (
    <section className="relative px-5 lg:px-10 py-28 md:py-44 overflow-hidden grain" aria-labelledby="final-cta">
      {/* Ghost wordmark */}
      <span
        className="absolute inset-x-0 -bottom-6 md:-bottom-10 text-center text-outline-faint text-[clamp(90px,19vw,300px)] font-black leading-none tracking-tighter select-none pointer-events-none"
        aria-hidden="true"
      >
        SAIF®
      </span>
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] bg-saif-accent/[0.06] rounded-full blur-[140px] pointer-events-none" aria-hidden="true" />

      <div className="relative z-10 max-w-3xl mx-auto text-center">
        <Reveal variant="fade" duration={700}>
          <p className="eyebrow justify-center">
            <span className="text-saif-accent tabular-nums">11</span>
            <span className="w-3 h-px bg-saif-border" aria-hidden="true" />
            {t('finalCta.eyebrow')}
          </p>
        </Reveal>

        <h2
          id="final-cta"
          className="mt-8 text-[clamp(44px,9vw,120px)] leading-[0.9] tracking-tighter text-saif-text"
        >
          <RevealLine delay={80}>{heading ?? t('finalCta.line1')}</RevealLine>
          <RevealLine delay={240}>
            <span className="font-display italic font-normal">{t('finalCta.line2')}</span>
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
              {configText(cfg, 'cta_text', lang) ?? t('finalCta.cta')} <ArrowRight size={14} aria-hidden="true" />
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
