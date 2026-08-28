import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import Footer from '@/components/Footer'

const faqs = [
  { q: 'What is SAIF STORE?', a: 'SAIF STORE is a premium e-commerce platform offering fashion apparel and digital products, based in Egypt.' },
  { q: 'How do I pay?', a: 'We accept two manual payment methods: InstaPay and Vodafone Cash. After placing your order you transfer the exact total to the receiving number shown at checkout and upload a screenshot of the confirmation. Our team verifies the transfer manually, usually within a few hours.' },
  { q: 'Why is my payment under review?', a: 'All InstaPay / Vodafone Cash transfers are verified manually by our team to prevent fraud. Your order is reserved as soon as it is placed, and it moves to Confirmed once the payment is approved.' },
  { q: 'How do digital products work?', a: 'Digital products (such as social media packages) are delivered after your payment is verified. Delivery time depends on the package and is listed on each product page. No shipping is required.' },
  { q: 'What is your return policy?', a: 'Physical items can be returned within 30 days. Digital products are non-refundable once delivered.' },
  { q: 'How long does shipping take?', a: 'Orders are processed within 1-2 business days after payment approval. Delivery across Egypt varies by governorate.' },
  { q: 'Is my data secure?', a: 'Yes. We use industry-standard encryption and never store payment details. Your transfer screenshots are stored privately and visible only to you and our verification team.' },
]

export default function FAQPage() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div className="animate-[pageIn_0.6s_ease] pt-28 px-6 lg:px-10 pb-20">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-[clamp(36px,6vw,72px)] font-black tracking-tighter text-saif-text mb-10">FAQ</h1>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div key={i} className="border border-saif-border">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <span className="text-sm font-medium text-saif-text">{faq.q}</span>
                <ChevronDown size={16} className={`text-saif-dim transition-transform ${open === i ? 'rotate-180' : ''}`} />
              </button>
              {open === i && (
                <div className="px-4 pb-4 text-sm text-saif-dim leading-relaxed">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  )
}
