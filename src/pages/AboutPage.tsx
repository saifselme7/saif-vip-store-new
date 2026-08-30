import Footer from '@/components/Footer'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useI18n } from '@/i18n'
import Reveal from '@/components/motion/Reveal'

export default function AboutPage() {
  const { t } = useI18n()
  usePageMeta({ title: `${t('pages.about.title')} — SAIF STORE`, description: t('meta.description') })

  return (
    <div className="animate-[pageIn_0.6s_ease] pt-24 md:pt-32 px-5 lg:px-10 pb-24">
      <div className="max-w-2xl mx-auto">
        <Reveal variant="fade" duration={700}>
          <p className="eyebrow mb-6">
            <span className="text-saif-accent tabular-nums">01</span>
            <span className="w-3 h-px bg-saif-border" aria-hidden="true" />
            SAIF STORE
          </p>
        </Reveal>
        <Reveal variant="up" duration={900}>
          <h1 className="text-[clamp(36px,6vw,72px)] font-display text-saif-text mb-10 leading-[1.05]">
            {t('pages.about.title')}
          </h1>
        </Reveal>
        <Reveal variant="fade" delay={150} duration={900}>
          <p className="text-base text-saif-dim leading-relaxed mb-6 text-balance">{t('pages.about.p1')}</p>
        </Reveal>
        <Reveal variant="fade" delay={250} duration={900}>
          <p className="text-base text-saif-dim leading-relaxed mb-6 text-balance">{t('pages.about.p2')}</p>
        </Reveal>
        <Reveal variant="fade" delay={350} duration={900}>
          <p className="text-base text-saif-dim leading-relaxed text-balance">{t('pages.about.p3')}</p>
        </Reveal>
      </div>
      <Footer />
    </div>
  )
}
