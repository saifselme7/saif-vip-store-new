import { useApp } from '@/context/AppContext'
import { usePageMeta } from '@/hooks/usePageMeta'
import { formatPrice } from '@/lib/utils'

export default function ShippingPage() {
  const { settings } = useApp()
  usePageMeta('Shipping & Payments', 'Shipping, payments and returns at SAIF STORE.')

  const currency = settings?.currency || 'EGP'

  return (
    <div className="animate-[pageIn_0.5s_ease] px-6 lg:px-10 pt-14 pb-20">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl sm:text-6xl font-black tracking-tighter text-saif-text mb-10">Shipping & Payments</h1>
        <div className="space-y-10">
          <section>
            <h2 className="text-lg font-bold text-saif-text mb-3">Payments</h2>
            <p className="text-sm text-saif-dim leading-relaxed mb-2">
              We accept <span className="text-saif-text font-medium">InstaPay</span> and{' '}
              <span className="text-saif-text font-medium">Vodafone Cash</span>. Every payment is verified
              manually by our team — we never claim an automatic bank integration.
            </p>
            <ol className="text-sm text-saif-dim leading-relaxed list-decimal list-inside space-y-1">
              <li>Place your order and choose a payment method.</li>
              <li>Transfer the exact total to the displayed receiving number.</li>
              <li>Upload the receipt screenshot with the payer number.</li>
              <li>We verify and confirm — you can track each step on your order page.</li>
            </ol>
          </section>
          <section>
            <h2 className="text-lg font-bold text-saif-text mb-3">Shipping</h2>
            <p className="text-sm text-saif-dim leading-relaxed">
              Physical orders are prepared after payment approval and shipped across Egypt
              {settings?.shipping_fee != null ? <> — delivery costs {formatPrice(settings.shipping_fee, currency)}</> : null}
              {settings?.free_shipping_threshold != null ? <>, free on orders over {formatPrice(settings.free_shipping_threshold, currency)}</> : null}.
              Typical delivery is 2–5 business days depending on your governorate.
            </p>
            <p className="text-sm text-saif-dim leading-relaxed mt-2">
              Digital products require no shipping — delivery details appear on your order page once payment is approved.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-saif-text mb-3">Returns</h2>
            <p className="text-sm text-saif-dim leading-relaxed">
              Physical items may be returned within 30 days of delivery, unused and in original packaging.
              Digital products are non-refundable once fulfilled.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
