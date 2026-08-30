import { ClipboardList, Send, ShieldCheck } from 'lucide-react'
import Reveal from '@/components/motion/Reveal'
import SectionHeader from '@/components/SectionHeader'
import { useI18n } from '@/i18n'
import type { HowItWorksConfig } from '@/hooks/useHomepageSections'

/**
 * Trust through transparency — the manual payment flow explained honestly,
 * matching the real verification workflow.
 */
export default function HowItWorks({
  title,
  description,
  config,
}: {
  title?: string | null
  description?: string | null
  config?: unknown
}) {
  const { t, lang } = useI18n()
  const cfg = (config ?? {}) as HowItWorksConfig
  const fallbackSteps: { title: string; text: string }[] = [
    { title: t('howItWorks.steps.0.title'), text: t('howItWorks.steps.0.text') },
    { title: t('howItWorks.steps.1.title'), text: t('howItWorks.steps.1.text') },
    { title: t('howItWorks.steps.2.title'), text: t('howItWorks.steps.2.text') },
  ]
  const ICONS = [ClipboardList, Send, ShieldCheck]
  const steps: { title: string; text: string; icon: typeof ClipboardList }[] =
    cfg.steps && cfg.steps.length > 0
      ? cfg.steps.map((s, i) => ({ title: (lang === 'ar' && s.title_ar ? s.title_ar : s.title_en) || '', text: (lang === 'ar' && s.text_ar ? s.text_ar : s.text_en) || '', icon: ICONS[i % ICONS.length] }))
      : fallbackSteps.map((s, i) => ({ ...s, icon: ICONS[i % ICONS.length] }))
  return (
    <section className="px-5 lg:px-10 py-24 md:py-32" aria-labelledby="how-it-works">
      <div className="max-w-7xl mx-auto">
        <SectionHeader
          index="10"
          eyebrow={t('howItWorks.eyebrow')}
          title={title ?? t('howItWorks.title')}
          description={description ?? t('howItWorks.description')}
          align="center"
        />

        <ol className="relative grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-6">
          {/* Connecting rule on desktop */}
          <span
            className="hidden md:block absolute top-[3.4rem] left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-saif-border to-transparent"
            aria-hidden="true"
          />
          {steps.map((step, i) => (
            <Reveal key={step.title} as="li" variant="up" delay={i * 160} duration={900} className="relative text-center">
              <div className="relative z-10 mx-auto w-[6.8rem] h-[6.8rem] rounded-full border border-saif-border bg-saif-bg flex items-center justify-center">
                <step.icon size={26} className="text-saif-accent" aria-hidden="true" />
                <span className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-saif-accent text-black text-xs font-bold flex items-center justify-center tabular-nums">
                  {i + 1}
                </span>
              </div>
              <h3 className="mt-6 text-base font-semibold text-saif-text">{step.title}</h3>
              <p className="mt-2.5 text-sm text-saif-dim leading-relaxed max-w-xs mx-auto text-balance">{step.text}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  )
}
