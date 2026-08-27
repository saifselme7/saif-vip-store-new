import { useState } from 'react'
import { useAdminSettings } from '@/hooks/useAdmin'
import { useApp } from '@/context/AppContext'
import { usePageMeta } from '@/hooks/usePageMeta'
import Loading from '@/components/Loading'

export default function AdminSettings() {
  const { settings, loading, save } = useAdminSettings()
  const { addToast, refreshSettings } = useApp()
  const [form, setForm] = useState<Record<string, unknown> | null>(null)
  const [saving, setSaving] = useState(false)

  usePageMeta('Settings', 'Store configuration.')

  // Local editable copy initialized from the fetched settings row.
  const current = form ?? settings
  const [social, setSocial] = useState<Record<string, string> | null>(null)

  function set(key: string, value: unknown) {
    setForm({ ...(form ?? settings ?? {}), [key]: value })
  }

  async function handleSave() {
    if (!current) return
    setSaving(true)
    const socialLinks = social ?? (current.social_links as Record<string, string>) ?? {}
    const { error } = await save({ ...current, social_links: socialLinks })
    setSaving(false)
    if (error) addToast(error.message || 'Failed to save settings', 'error')
    else {
      addToast('Settings saved')
      await refreshSettings()
    }
  }

  if (loading || !current) return <Loading />

  const socials = social ?? ((current.social_links as Record<string, string>) || {})

  return (
    <div className="animate-[pageIn_0.4s_ease]">
      <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-saif-text mb-8">Settings</h1>

      <div className="max-w-2xl space-y-10">
        {/* Store identity */}
        <Section title="Store Identity">
          <Field label="Store Name"><input className="input" value={String(current.store_name || '')} onChange={e => set('store_name', e.target.value)} /></Field>
          <Field label="Store Description"><textarea rows={2} className="input resize-none" value={String(current.store_description || '')} onChange={e => set('store_description', e.target.value)} /></Field>
          <Field label="Announcement Bar" hint="Shown at the very top of the storefront. Leave empty to hide.">
            <input className="input" value={String(current.announcement || '')} onChange={e => set('announcement', e.target.value)} />
          </Field>
          <Field label="Footer Text"><input className="input" value={String(current.footer_text || '')} onChange={e => set('footer_text', e.target.value)} /></Field>
        </Section>

        {/* Contact */}
        <Section title="Contact">
          <Field label="Support Email"><input className="input" value={String(current.contact_email || '')} onChange={e => set('contact_email', e.target.value)} /></Field>
          <Field label="Support Phone"><input className="input" dir="ltr" value={String(current.contact_phone || '')} onChange={e => set('contact_phone', e.target.value)} /></Field>
        </Section>

        {/* Payments */}
        <Section title="Payments">
          <Field label="Payment Receiving Number" hint="Shown to customers for InstaPay & Vodafone Cash transfers.">
            <input className="input" dir="ltr" value={String(current.payment_number || '')} onChange={e => set('payment_number', e.target.value)} />
          </Field>
        </Section>

        {/* Commerce */}
        <Section title="Commerce">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Currency"><input className="input" value={String(current.currency || 'EGP')} onChange={e => set('currency', e.target.value)} /></Field>
            <Field label="Shipping Fee"><input type="number" step="0.01" min="0" className="input" value={Number(current.shipping_fee ?? 0)} onChange={e => set('shipping_fee', Number(e.target.value))} /></Field>
            <Field label="Free Shipping Threshold"><input type="number" step="0.01" min="0" className="input" value={current.free_shipping_threshold == null ? '' : Number(current.free_shipping_threshold)} onChange={e => set('free_shipping_threshold', e.target.value === '' ? null : Number(e.target.value))} /></Field>
            <Field label="Minimum Order Amount"><input type="number" step="0.01" min="0" className="input" value={current.minimum_order_amount == null ? '' : Number(current.minimum_order_amount)} onChange={e => set('minimum_order_amount', e.target.value === '' ? null : Number(e.target.value))} /></Field>
          </div>
        </Section>

        {/* Homepage */}
        <Section title="Homepage">
          <Field label="Hero Title"><input className="input" value={String(current.hero_title || '')} onChange={e => set('hero_title', e.target.value)} /></Field>
          <Field label="Hero Subtitle"><textarea rows={2} className="input resize-none" value={String(current.hero_subtitle || '')} onChange={e => set('hero_subtitle', e.target.value)} /></Field>
        </Section>

        {/* Social */}
        <Section title="Social Links">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {['instagram', 'tiktok', 'facebook', 'whatsapp'].map(key => (
              <Field key={key} label={key[0].toUpperCase() + key.slice(1)}>
                <input className="input" value={socials[key] || ''} onChange={e => setSocial({ ...socials, [key]: e.target.value })} placeholder="https://…" />
              </Field>
            ))}
          </div>
        </Section>

        {/* Flags */}
        <Section title="Store Status">
          <label className="flex items-center gap-3 text-sm text-saif-text border border-saif-border p-4">
            <input type="checkbox" checked={Boolean(current.maintenance_mode)} onChange={e => set('maintenance_mode', e.target.checked)} />
            <span>
              <span className="block font-semibold">Maintenance Mode</span>
              <span className="block text-xs text-saif-dim mt-0.5">Displays a maintenance banner on the storefront.</span>
            </span>
          </label>
        </Section>

        <button onClick={handleSave} disabled={saving} className="btn btn-primary w-full">
          {saving ? 'Saving…' : 'Save All Settings'}
        </button>
        <p className="text-xs text-saif-dim text-center -mt-6">Only admins can modify settings. Secrets are never stored here.</p>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xs font-bold uppercase tracking-widest text-saif-text mb-4 pb-2 border-b border-saif-border">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="text-xs text-saif-dim mt-1.5">{hint}</p>}
    </div>
  )
}
