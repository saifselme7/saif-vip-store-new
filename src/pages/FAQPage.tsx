import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { usePageMeta } from '@/hooks/usePageMeta'

const faqs = [
  {
    q: 'How does payment work?',
    a: 'We use manual verification. You transfer the exact order total to our receiving number via InstaPay or Vodafone Cash, upload the transfer screenshot at checkout, and our team reviews it — usually within a few hours. Your order is confirmed once the payment is approved.',
  },
  {
    q: 'What happens after I submit my payment screenshot?',
    a: 'Your payment enters the “Under Review” state. You can follow its status from your order page. Once approved, the order moves to Confirmed and fulfillment starts. If anything looks off, we reject with a reason and you can re-submit.',
  },
  {
    q: 'How do digital products work?',
    a: 'Digital packages (like social media services) are fulfilled by our team after your payment is approved. Delivery details appear on your order page — they stay locked until the payment is verified. No passwords are ever required.',
  },
  {
    q: 'How long does shipping take?',
    a: 'Physical orders are prepared as soon as payment is approved, then shipped across Egypt. Delivery time depends on your governorate — typically 2–5 business days.',
  },
  {
    q: 'What is your return policy?',
    a: 'Physical items can be returned within 30 days of delivery if unused and in original packaging. Digital products are non-refundable once fulfilled.',
  },
  {
    q: 'Is my payment proof private?',
    a: 'Yes. Screenshots are stored in a private bucket and are visible only to you and our verification team — never public, never shared.',
  },
  {
    q: 'Can I pay from a different phone number?',
    a: 'Yes — just enter the number/account you paid from in the payment form. That is how we match your transfer to your order.',
  },
]

export default function FAQPage() {
  const [open, setOpen] = useState<number | null>(0)
  usePageMeta('FAQ', 'Answers about payments, shipping and digital delivery.')

  return (
    <div className="animate-[pageIn_0.5s_ease] px-6 lg:px-10 pt-14 pb-20">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl sm:text-6xl font-black tracking-tighter text-saif-text mb-10">FAQ</h1>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div key={i} className="border border-saif-border">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between gap-4 p-4 text-left"
                aria-expanded={open === i}
              >
                <span className="text-sm font-medium text-saif-text">{faq.q}</span>
                <ChevronDown size={16} className={`text-saif-dim transition-transform flex-shrink-0 ${open === i ? 'rotate-180' : ''}`} />
              </button>
              {open === i && (
                <div className="px-4 pb-4 text-sm text-saif-dim leading-relaxed">{faq.a}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
