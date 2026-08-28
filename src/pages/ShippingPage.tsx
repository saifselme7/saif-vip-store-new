import Footer from '@/components/Footer'
import { useApp } from '@/context/AppContext'
import { usePageMeta } from '@/hooks/usePageMeta'
import { formatPrice } from '@/lib/utils'

export default function ShippingPage() {
  const { settings } = useApp()
  usePageMeta({ title: 'Shipping & Returns', description: 'SAIF STORE shipping and return policies.' })
  const currency = settings?.currency ?? 'EGP'

  return (
    <div className="animate-[pageIn_0.6s_ease] pt-24 md:pt-28 px-5 lg:px-10 pb-20">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-[clamp(36px,6vw,72px)] font-black tracking-tighter text-saif-text mb-10">Shipping & Returns</h1>
        <div className="space-y-8">
          <section>
            <h2 className="text-lg font-bold text-saif-text mb-3">Shipping</h2>
            <p className="text-sm text-saif-dim leading-relaxed">
              Orders are processed within 1-2 business days after your payment is approved.
              {settings?.shipping_fee ? ` A flat shipping fee of ${formatPrice(settings.shipping_fee, currency)} applies across Egypt.` : ' Shipping is free across Egypt.'}
              {settings?.free_shipping_threshold ? ` Orders over ${formatPrice(settings.free_shipping_threshold, currency)} ship for free.` : ''}
              {' '}Digital products are delivered electronically after payment verification — nothing is shipped.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-saif-text mb-3">Returns</h2>
            <p className="text-sm text-saif-dim leading-relaxed">Physical items may be returned within 30 days of delivery. Items must be unused and in original packaging. Digital products are non-refundable.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-saif-text mb-3">Need Help?</h2>
            <p className="text-sm text-saif-dim leading-relaxed">
              Contact us at <a href={`mailto:${settings?.contact_email || 'hello@saifstore.com'}`} className="text-saif-accent underline">{settings?.contact_email || 'hello@saifstore.com'}</a> for any shipping or return inquiries.
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  )
}
