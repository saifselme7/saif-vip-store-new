import Footer from '@/components/Footer'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useI18n } from '@/i18n'

export default function TermsPage() {
  const { t } = useI18n()
  usePageMeta({ title: `${t('pages.terms.title')} — SAIF STORE`, description: t('pages.terms.title') })
  return (
    <div className="animate-[pageIn_0.6s_ease] pt-28 px-6 lg:px-10 pb-20">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-[clamp(36px,6vw,72px)] font-display text-saif-text mb-10">{t('pages.terms.title')}</h1>
        <p className="text-sm text-saif-dim leading-relaxed">{t('pages.terms.text')}</p>
      </div>
      <Footer />
    </div>
  )
}
