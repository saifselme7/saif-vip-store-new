import { Mail, Phone, ShieldCheck } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { usePageMeta } from '@/hooks/usePageMeta'
import { DEFAULT_PAYMENT_NUMBER } from '@/lib/constants'

export default function ContactPage() {
  const { settings } = useApp()
  usePageMeta('Contact', 'Get in touch with SAIF STORE support.')

  return (
    <div className="animate-[pageIn_0.5s_ease] px-6 lg:px-10 pt-14 pb-20">
      <div className="max-w-xl mx-auto">
        <h1 className="text-4xl sm:text-6xl font-black tracking-tighter text-saif-text mb-4">Contact</h1>
        <p className="text-sm text-saif-dim mb-10 leading-relaxed">
          Questions about an order, a payment verification, or a digital delivery? Reach us through the
          channels below — include your order number for the fastest response.
        </p>

        <div className="space-y-4">
          <ContactRow
            icon={<Mail size={18} />}
            label="Email"
            value={settings?.contact_email || 'hello@saifstore.com'}
            href={`mailto:${settings?.contact_email || 'hello@saifstore.com'}`}
          />
          <ContactRow
            icon={<Phone size={18} />}
            label="Phone / WhatsApp"
            value={settings?.contact_phone || DEFAULT_PAYMENT_NUMBER}
            href={`tel:${settings?.contact_phone || DEFAULT_PAYMENT_NUMBER}`}
          />
          <div className="border border-saif-border p-5 flex gap-4 items-start">
            <span className="text-saif-accent mt-0.5"><ShieldCheck size={18} /></span>
            <p className="text-sm text-saif-dim leading-relaxed">
              Payment verifications are handled through your <span className="text-saif-text">order page</span> —
              submit or re-submit your transfer receipt there and track the review status live.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function ContactRow({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href: string }) {
  return (
    <a href={href} className="border border-saif-border p-5 flex items-center gap-4 hover:border-saif-text/40 hover:bg-white/[0.02] transition-colors">
      <span className="text-saif-accent">{icon}</span>
      <span>
        <span className="block text-[10px] uppercase tracking-widest text-saif-dim">{label}</span>
        <span className="block text-sm font-semibold text-saif-text mt-0.5" dir="ltr">{value}</span>
      </span>
    </a>
  )
}
