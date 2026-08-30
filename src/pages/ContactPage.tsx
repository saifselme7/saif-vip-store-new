import { useState } from 'react'
import { useApp } from '@/context/AppContext'
import { usePageMeta } from '@/hooks/usePageMeta'
import { validateFullName, validateEmail, type FieldErrors } from '@/lib/validation'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'
import Footer from '@/components/Footer'
import { Mail, Phone } from 'lucide-react'

export default function ContactPage() {
  const { t } = useI18n()
  const { settings } = useApp()
  const [form, setForm] = useState({ name: '', email: '', message: '' })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [sent, setSent] = useState(false)
  usePageMeta({ title: `${t('pages.contact.title')} — SAIF STORE`, description: t('meta.description') })

  const contactEmail = settings?.contact_email || 'hello@saifstore.com'

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs: FieldErrors = {
      name: validateFullName(form.name),
      email: validateEmail(form.email),
      message: form.message.trim().length < 10 ? 'Please write at least a short message' : undefined,
    }
    const next = Object.fromEntries(Object.entries(errs).filter(([, v]) => v)) as FieldErrors
    setErrors(next)
    if (Object.keys(next).length > 0) return

    // No email backend is configured, so we open the customer's mail client
    // with a pre-filled message — a real, working channel.
    const subject = encodeURIComponent(`SAIF STORE contact — ${form.name}`)
    const body = encodeURIComponent(`${form.message}\n\n— ${form.name} (${form.email})`)
    window.location.href = `mailto:${contactEmail}?subject=${subject}&body=${body}`
    setSent(true)
  }

  return (
    <div className="animate-[pageIn_0.6s_ease] pt-24 md:pt-28 px-5 lg:px-10 pb-20">
      <div className="max-w-xl mx-auto">
        <h1 className="text-[clamp(36px,6vw,72px)] font-display text-saif-text mb-10">{t('pages.contact.title')}</h1>

        <div className="space-y-3 mb-10">
          <a
            href={`mailto:${contactEmail}`}
            className="flex items-center gap-3 border border-saif-border p-4 hover:border-saif-dim transition-colors rounded-sm"
          >
            <Mail size={16} className="text-saif-accent" />
            <span className="text-sm text-saif-text">{contactEmail}</span>
          </a>
          {settings?.contact_phone && (
            <a
              href={`tel:${settings.contact_phone}`}
              className="flex items-center gap-3 border border-saif-border p-4 hover:border-saif-dim transition-colors rounded-sm"
            >
              <Phone size={16} className="text-saif-accent" />
              <span className="text-sm text-saif-text" dir="ltr">{settings.contact_phone}</span>
            </a>
          )}
        </div>

        {sent ? (
          <div className="border border-saif-border p-6 rounded-sm">
            <p className="text-sm text-saif-text font-semibold mb-2">Your email app should have opened.</p>
            <p className="text-sm text-saif-dim leading-relaxed">
              If it didn&apos;t, send your message directly to{' '}
              <a href={`mailto:${contactEmail}`} className="text-saif-accent underline">
                {contactEmail}
              </a>
              . For order questions, include your order number (it starts with SAIF-).
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label className="label" htmlFor="ct-name">{t('contact.name')}</label>
              <input
                id="ct-name"
                required
                type="text"
                className={cn('input', errors.name && 'input-error')}
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                autoComplete="name"
              />
              {errors.name && <p className="field-error">{errors.name}</p>}
            </div>
            <div>
              <label className="label" htmlFor="ct-email">{t('contact.email')}</label>
              <input
                id="ct-email"
                required
                type="email"
                className={cn('input', errors.email && 'input-error')}
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                autoComplete="email"
              />
              {errors.email && <p className="field-error">{errors.email}</p>}
            </div>
            <div>
              <label className="label" htmlFor="ct-message">{t('contact.message')}</label>
              <textarea
                id="ct-message"
                required
                rows={5}
                className={cn('input resize-none', errors.message && 'input-error')}
                value={form.message}
                onChange={e => setForm({ ...form, message: e.target.value })}
              />
              {errors.message && <p className="field-error">{errors.message}</p>}
            </div>
            <button type="submit" className="btn btn-primary w-full">
              Open Email App
            </button>
            <p className="text-xs text-saif-dim text-center">
              This opens your email client with the message pre-filled — nothing is sent behind your back.
            </p>
          </form>
        )}
      </div>
      <Footer />
    </div>
  )
}
