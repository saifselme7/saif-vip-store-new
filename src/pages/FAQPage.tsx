import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import Footer from '@/components/Footer'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useI18n } from '@/i18n'
import { ar } from '@/i18n/ar'
import { en } from '@/i18n/en'

export default function FAQPage() {
  const { t, lang } = useI18n()
  const [open, setOpen] = useState<number | null>(0)
  usePageMeta({ title: `${t('pages.faq.title')} — SAIF STORE`, description: t('pages.faq.title') })

  // FAQ copy lives in the bilingual dictionary (see i18n/ar.ts & en.ts)
  const faqs = lang === 'ar' ? ar.pages.faq.items : en.pages.faq.items

  return (
    <div className="animate-[pageIn_0.6s_ease] pt-28 px-6 lg:px-10 pb-20">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-[clamp(36px,6vw,72px)] font-display text-saif-text mb-10">{t('pages.faq.title')}</h1>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div key={i} className="border border-saif-border">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between p-4 text-start"
                aria-expanded={open === i}
              >
                <span className="text-sm font-medium text-saif-text">{faq.q}</span>
                <ChevronDown size={16} className={`text-saif-dim transition-transform ${open === i ? 'rotate-180' : ''}`} />
              </button>
              {open === i && (
                <div className="px-4 pb-4 text-sm text-saif-dim leading-relaxed">{faq.a}</div>
              )}
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  )
}
