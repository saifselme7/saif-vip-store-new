import Footer from '@/components/Footer'
import { useApp } from '@/context/AppContext'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useI18n } from '@/i18n'

export default function ShippingPage() {
  const { t, formatPrice } = useI18n()
  const { settings } = useApp()
  usePageMeta({ title: `${t('pages.shipping.title')} — SAIF STORE`, description: t('pages.shipping.title') })
  const currency = settings?.currency ?? 'EGP'
  const contactEmail = settings?.contact_email || 'hello@saifstore.com'

  return (
    <div className="animate-[pageIn_0.6s_ease] pt-24 md:pt-28 px-5 lg:px-10 pb-20">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-[clamp(36px,6vw,72px)] font-display text-saif-text mb-10">{t('pages.shipping.title')}</h1>
        <div className="space-y-8">
          <section>
            <h2 className="text-lg font-bold text-saif-text mb-3">{t('pages.shipping.shippingTitle')}</h2>
            <p className="text-sm text-saif-dim leading-relaxed">
              {settings?.shipping_fee
                ? t('product.flatShipping', { amount: formatPrice(settings.shipping_fee, currency) })
                : t('home.trustShippingEgypt')}{' '}
              {settings?.free_shipping_threshold
                ? t('product.freeShippingOver', { amount: formatPrice(settings.free_shipping_threshold, currency) })
                : ''}
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-saif-text mb-3">{t('pages.shipping.returnsTitle')}</h2>
            <p className="text-sm text-saif-dim leading-relaxed">{t('pages.shipping.returnsText')}</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-saif-text mb-3">{t('pages.shipping.helpTitle')}</h2>
            <p className="text-sm text-saif-dim leading-relaxed">
              {t('pages.shipping.helpText', { email: contactEmail })}{' '}
              <a href={`mailto:${contactEmail}`} className="text-saif-accent underline">{contactEmail}</a>
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  )
}
