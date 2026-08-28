import Reveal from '@/components/motion/Reveal'
import { useI18n } from '@/i18n'
import { configText, type BrandConfig } from '@/hooks/useHomepageSections'

interface Props {
  heading?: string | null
  description?: string | null
  config?: Record<string, unknown> | null
}

export default function BrandStatement({ heading, description, config }: Props) {
  const { t, lang } = useI18n()
  const cfg = (config ?? {}) as BrandConfig
  const FACTS = [
  {
    title: configText(cfg, 'fact1_title', lang) ?? t('brand.fact1Title'),
    text: configText(cfg, 'fact1_text', lang) ?? t('brand.fact1Text'),
  },
  {
    title: configText(cfg, 'fact2_title', lang) ?? t('brand.fact2Title'),
    text: configText(cfg, 'fact2_text', lang) ?? t('brand.fact2Text'),
  },
  {
    title: configText(cfg, 'fact3_title', lang) ?? t('brand.fact3Title'),
    text: configText(cfg, 'fact3_text', lang) ?? t('brand.fact3Text'),
  },
]

/**
 * Brand statement — the editorial pause after the hero. Serif italic accent
 * type against the grotesque wordmark is part of the signature language.
 */

  return (
    <section className="relative px-5 lg:px-10 py-24 md:py-36" aria-labelledby="brand-statement">
      <div className="max-w-4xl mx-auto text-center">
        <Reveal variant="fade" duration={700}>
          <p className="eyebrow justify-center mb-8">
            <span className="text-saif-accent tabular-nums">01</span>
            <span className="w-3 h-px bg-saif-border" aria-hidden="true" />
            {t('brand.eyebrow')}
          </p>
        </Reveal>

        <Reveal variant="up" duration={900}>
          <h2 id="brand-statement" className="text-[clamp(34px,6vw,76px)] leading-[1.04] tracking-tight text-balance">
            {heading ?? <><span className="font-display italic font-normal text-saif-text">{t('brand.seg1')}</span>{' '}
            <span className="font-black text-saif-text">{t('brand.seg2')}</span>{' '}
            <span className="font-display italic font-normal text-saif-accent">{t('brand.seg3')}</span></>}
          </h2>
        </Reveal>

        <Reveal variant="fade" delay={220} duration={1000}>
          <p className="mt-8 text-sm md:text-[15px] text-saif-dim leading-relaxed max-w-xl mx-auto text-balance">
            {description ?? t('brand.description')}
          </p>
        </Reveal>

        <div className="mt-16 md:mt-20 grid grid-cols-1 sm:grid-cols-3 gap-px bg-saif-border border border-saif-border rounded-sm overflow-hidden text-left">
          {FACTS.map((fact, i) => (
            <Reveal
              key={fact.title}
              variant="fade"
              delay={i * 140}
              duration={900}
              className="bg-black p-6 md:p-8 group hover:bg-saif-surface transition-colors duration-500"
            >
              <span className="block w-7 h-0.5 bg-saif-accent mb-5 transition-all duration-500 group-hover:w-12" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-saif-text uppercase tracking-wider">{fact.title}</h3>
              <p className="mt-2.5 text-sm text-saif-dim leading-relaxed">{fact.text}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
