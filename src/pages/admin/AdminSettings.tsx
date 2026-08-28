import { useEffect, useState } from 'react'
import { Save, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/context/ToastContext'
import { useApp } from '@/context/AppContext'
import { usePageMeta } from '@/hooks/usePageMeta'
import { formatPrice } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/admin/ui'
import Loading from '@/components/Loading'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useI18n } from '@/i18n'
import type { SiteSettings } from '@/types'

type Tab = 'general' | 'localization' | 'shipping' | 'payment' | 'homepage' | 'social' | 'advanced'

const TABS: { id: Tab; labelKey: string }[] = [
  { id: 'general', labelKey: 'admin.settings.tabs.general' },
  { id: 'localization', labelKey: 'admin.settings.tabs.localization' },
  { id: 'shipping', labelKey: 'admin.settings.tabs.shipping' },
  { id: 'payment', labelKey: 'admin.settings.tabs.payments' },
  { id: 'homepage', labelKey: 'admin.settings.tabs.storefront' },
  { id: 'social', labelKey: 'admin.settings.tabs.footer' },
  { id: 'advanced', labelKey: 'admin.settings.tabs.advanced' },
]

export default function AdminSettings() {
  const { refreshSettings } = useApp()
  const { addToast } = useToast()
  const { t } = useI18n()
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [social, setSocial] = useState({ instagram: '', twitter: '', youtube: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<Tab>('general')
  const [maintenanceOpen, setMaintenanceOpen] = useState(false)
  usePageMeta({ title: 'Admin — Settings' })

  useEffect(() => {
    supabase
      .from('site_settings')
      .select('*')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSettings(data as SiteSettings)
          setForm(data as unknown as Record<string, unknown>)
          const links = (data.social_links ?? {}) as Record<string, string>
          setSocial({
            instagram: links.instagram || '',
            twitter: links.twitter || '',
            youtube: links.youtube || '',
          })
        }
        setLoading(false)
      })
  }, [])

  function set(key: string, value: unknown) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    if (!settings) return
    setSaving(true)
    const { error } = await supabase
      .from('site_settings')
      .update({
        ...form,
        shipping_fee: Number(form.shipping_fee ?? 0),
        free_shipping_threshold: form.free_shipping_threshold ? Number(form.free_shipping_threshold) : null,
        min_order_amount: form.min_order_amount ? Number(form.min_order_amount) : null,
        social_links: social,
      })
      .eq('id', settings.id)
    setSaving(false)
    if (error) {
      addToast('Failed to save settings', 'error')
      return
    }
    addToast('Settings saved')
    refreshSettings()
  }

  async function toggleMaintenance() {
    set('maintenance_mode', !form.maintenance_mode)
    setMaintenanceOpen(false)
    // Save immediately — this affects the whole storefront.
    if (settings) {
      const next = !form.maintenance_mode
      const { error } = await supabase.from('site_settings').update({ maintenance_mode: next }).eq('id', settings.id)
      if (error) addToast('Failed to toggle maintenance mode', 'error')
      else {
        addToast(next ? 'Maintenance mode enabled' : 'Maintenance mode disabled')
        refreshSettings()
        setForm(prev => ({ ...prev, maintenance_mode: next }))
      }
    }
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Settings" />
        <Loading />
      </div>
    )
  }

  if (!settings) {
    return (
      <div>
        <PageHeader title="Settings" />
        <div className="border border-saif-accent/40 bg-saif-accent/5 p-6 rounded-sm">
          <p className="text-sm text-saif-text">No settings row found. Run the seed SQL to create one.</p>
        </div>
      </div>
    )
  }

  const currency = (form.currency as string) || 'EGP'

  return (
    <div className="animate-[pageIn_0.4s_ease] max-w-3xl">
      <PageHeader
        title="Settings"
        actions={
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
            <Save size={13} /> {saving ? 'Saving…' : 'Save Settings'}
          </button>
        }
      />

      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-6" role="group" aria-label="Settings sections">
        {TABS.map(tabDef => (
          <button
            key={tabDef.id}
            onClick={() => setTab(tabDef.id)}
            aria-pressed={tab === tabDef.id}
            className={cn(
              'px-3 py-1.5 text-xs border rounded-full transition-colors whitespace-nowrap',
              tab === tabDef.id ? 'border-saif-text bg-saif-text text-black font-semibold' : 'border-saif-border text-saif-dim hover:text-saif-text',
            )}
          >
            {t(tabDef.labelKey)}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <section className="card p-6 space-y-4">
          <div>
            <label className="label" htmlFor="st-name">Store Name</label>
            <input id="st-name" className="input" value={String(form.store_name ?? '')} onChange={e => set('store_name', e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="st-desc">Store Description</label>
            <textarea id="st-desc" className="input resize-none" rows={2} value={String(form.store_description ?? '')} onChange={e => set('store_description', e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="st-email">Support Email</label>
              <input id="st-email" type="email" className="input" value={String(form.contact_email ?? '')} onChange={e => set('contact_email', e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="st-phone">Support Phone</label>
              <input id="st-phone" className="input" value={String(form.contact_phone ?? '')} onChange={e => set('contact_phone', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="st-logo">Logo URL</label>
              <input id="st-logo" className="input text-xs" value={String(form.logo_url ?? '')} onChange={e => set('logo_url', e.target.value)} placeholder="https://…" />
            </div>
            <div>
              <label className="label" htmlFor="st-currency">Currency</label>
              <select id="st-currency" className="input" value={currency} onChange={e => set('currency', e.target.value)}>
                <option value="EGP" className="bg-black">EGP — Egyptian Pound</option>
                <option value="USD" className="bg-black">USD — US Dollar</option>
                <option value="EUR" className="bg-black">EUR — Euro</option>
                <option value="SAR" className="bg-black">SAR — Saudi Riyal</option>
                <option value="AED" className="bg-black">AED — UAE Dirham</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="st-announce">Announcement Bar</label>
            <input
              id="st-announce"
              className="input"
              value={String(form.announcement ?? '')}
              onChange={e => set('announcement', e.target.value)}
              placeholder="e.g. Free shipping on orders over EGP 1,500"
            />
            <p className="text-xs text-saif-dim mt-1.5">Leave empty to hide the announcement bar.</p>
          </div>
          <div>
            <label className="label" htmlFor="st-footer">Footer Text</label>
            <input id="st-footer" className="input" value={String(form.footer_text ?? '')} onChange={e => set('footer_text', e.target.value)} />
          </div>
        </section>
      )}

      {tab === 'localization' && (
        <section className="card p-6 space-y-5">
          <div>
            <label className="label" htmlFor="st-lang">{t('admin.settings.defaultLanguage')}</label>
            <select
              id="st-lang"
              className="input"
              value={String(form.default_language ?? 'en')}
              onChange={e => set('default_language', e.target.value)}
            >
              <option value="en" className="bg-black">English</option>
              <option value="ar" className="bg-black">العربية (Egyptian Arabic)</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="st-currency">{t('admin.settings.currency')}</label>
            <select
              id="st-currency"
              className="input"
              value={String(form.currency ?? 'EGP')}
              onChange={e => set('currency', e.target.value)}
            >
              <option value="EGP" className="bg-black">EGP — Egyptian Pound</option>
              <option value="USD" className="bg-black">USD — US Dollar</option>
              <option value="EUR" className="bg-black">EUR — Euro</option>
              <option value="SAR" className="bg-black">SAR — Saudi Riyal</option>
              <option value="AED" className="bg-black">AED — UAE Dirham</option>
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="st-desc-ar" dir="rtl">{t('admin.settings.descriptionAr')}</label>
              <textarea
                id="st-desc-ar"
                className="input resize-none"
                dir="rtl"
                rows={2}
                value={String(form.store_description_ar ?? '')}
                onChange={e => set('store_description_ar', e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="st-hero-ar" dir="rtl">{t('admin.settings.heroAr')}</label>
              <textarea
                id="st-hero-ar"
                className="input resize-none"
                dir="rtl"
                rows={2}
                value={String(form.hero_subtitle_ar ?? '')}
                onChange={e => set('hero_subtitle_ar', e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-saif-faint border border-saif-border p-3 rounded-sm leading-relaxed">
            {t('admin.settings.availableLanguagesHint')}
          </p>
        </section>
      )}

      {tab === 'shipping' && (
        <section className="card p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label" htmlFor="sh-fee">Shipping Fee</label>
              <input id="sh-fee" type="number" step="0.01" min="0" className="input" value={String(form.shipping_fee ?? 0)} onChange={e => set('shipping_fee', e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="sh-free">Free Shipping Above</label>
              <input id="sh-free" type="number" step="0.01" min="0" className="input" value={String(form.free_shipping_threshold ?? '')} onChange={e => set('free_shipping_threshold', e.target.value)} placeholder="Leave empty to disable" />
            </div>
            <div>
              <label className="label" htmlFor="sh-min">Minimum Order</label>
              <input id="sh-min" type="number" step="0.01" min="0" className="input" value={String(form.min_order_amount ?? '')} onChange={e => set('min_order_amount', e.target.value)} placeholder="Leave empty to disable" />
            </div>
          </div>
          <p className="text-xs text-saif-dim leading-relaxed">
            Current effective setup: {Number(form.shipping_fee ?? 0) === 0 ? 'Free shipping' : `${formatPrice(Number(form.shipping_fee ?? 0), currency)} flat fee`}
            {form.free_shipping_threshold ? `, free above ${formatPrice(Number(form.free_shipping_threshold), currency)}` : ''}
            {form.min_order_amount ? `, minimum order ${formatPrice(Number(form.min_order_amount), currency)}` : ''}.
            {' '}Shipping only applies to orders containing physical products — digital-only orders never pay shipping.
          </p>
        </section>
      )}

      {tab === 'payment' && (
        <section className="card p-6 space-y-5">
          <div>
            <label className="label" htmlFor="pm-number">Payment Receiving Number</label>
            <input
              id="pm-number"
              className="input font-mono text-lg tracking-wider"
              value={String(form.payment_number ?? '')}
              onChange={e => set('payment_number', e.target.value)}
              placeholder="01xxxxxxxxx"
            />
            <p className="text-xs text-saif-dim mt-1.5">
              This number is shown to customers for both InstaPay and Vodafone Cash transfers.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex items-center gap-3 border border-saif-border p-4 cursor-pointer rounded-sm">
              <input
                type="checkbox"
                checked={Boolean(form.instapay_enabled)}
                onChange={e => set('instapay_enabled', e.target.checked)}
                className="w-4 h-4 accent-[#E63946]"
              />
              <span className="text-sm text-saif-text">Offer InstaPay at checkout</span>
            </label>
            <label className="flex items-center gap-3 border border-saif-border p-4 cursor-pointer rounded-sm">
              <input
                type="checkbox"
                checked={Boolean(form.vodafone_cash_enabled)}
                onChange={e => set('vodafone_cash_enabled', e.target.checked)}
                className="w-4 h-4 accent-[#E63946]"
              />
              <span className="text-sm text-saif-text">Offer Vodafone Cash at checkout</span>
            </label>
          </div>
          <div>
            <label className="label" htmlFor="pm-instructions">Extra Payment Instructions (optional)</label>
            <textarea
              id="pm-instructions"
              className="input resize-none"
              rows={3}
              value={String(form.payment_instructions ?? '')}
              onChange={e => set('payment_instructions', e.target.value)}
              placeholder="Shown below the transfer instructions during checkout."
            />
          </div>
          <p className="text-xs text-saif-dim border border-saif-border p-3 rounded-sm leading-relaxed">
            All payments are verified manually by admins. Screenshots are stored in a private storage bucket and are
            visible only to the customer and admins.
          </p>
        </section>
      )}

      {tab === 'homepage' && (
        <section className="card p-6 space-y-4">
          <div>
            <label className="label" htmlFor="hp-title">Hero Title</label>
            <input id="hp-title" className="input" value={String(form.hero_title ?? '')} onChange={e => set('hero_title', e.target.value)} placeholder="SAIF STORE" />
          </div>
          <div>
            <label className="label" htmlFor="hp-sub">Hero Subtitle</label>
            <textarea id="hp-sub" className="input resize-none" rows={2} value={String(form.hero_subtitle ?? '')} onChange={e => set('hero_subtitle', e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="hp-image">Hero Image URL (optional)</label>
            <input id="hp-image" className="input text-xs" value={String(form.hero_image ?? '')} onChange={e => set('hero_image', e.target.value)} placeholder="https://…" />
          </div>
        </section>
      )}

      {tab === 'social' && (
        <section className="card p-6 space-y-4">
          {(['instagram', 'twitter', 'youtube'] as const).map(key => (
            <div key={key}>
              <label className="label" htmlFor={`so-${key}`}>{key.charAt(0).toUpperCase() + key.slice(1)}</label>
              <input
                id={`so-${key}`}
                className="input text-xs"
                value={social[key]}
                onChange={e => setSocial(prev => ({ ...prev, [key]: e.target.value }))}
                placeholder={`https://${key}.com/…`}
              />
            </div>
          ))}
          <p className="text-xs text-saif-dim">Leave empty to hide an icon from the footer.</p>
        </section>
      )}

      {tab === 'advanced' && (
        <section className="card p-6 space-y-5">
          <div className="flex items-center justify-between gap-4 border border-saif-border p-4 rounded-sm">
            <div>
              <p className="text-sm font-semibold text-saif-text">Maintenance Mode</p>
              <p className="text-xs text-saif-dim mt-1">
                Hides the storefront from everyone except admins. The admin dashboard stays accessible.
              </p>
            </div>
            <button
              className={cn('btn btn-sm', form.maintenance_mode ? 'btn-danger' : '')}
              onClick={() => setMaintenanceOpen(true)}
            >
              {form.maintenance_mode ? 'Disable' : 'Enable'}
            </button>
          </div>
          {Boolean(form.maintenance_mode) && (
            <p className="text-xs text-yellow-400 flex items-center gap-2 border border-yellow-500/30 bg-yellow-500/5 p-3 rounded-sm">
              <AlertTriangle size={13} /> Maintenance mode is currently ACTIVE — customers see a maintenance screen.
            </p>
          )}
          <p className="text-xs text-saif-dim leading-relaxed">
            Security note: admin roles can only be changed from the database by an existing admin (or via the Supabase
            SQL editor). User role changes through the API are blocked at the database level.
          </p>
        </section>
      )}

      <div className="flex justify-end mt-6 pb-6">
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          <Save size={13} /> {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>

      <ConfirmDialog
        open={maintenanceOpen}
        onClose={() => setMaintenanceOpen(false)}
        onConfirm={toggleMaintenance}
        title={form.maintenance_mode ? 'Disable maintenance mode?' : 'Enable maintenance mode?'}
        confirmLabel={form.maintenance_mode ? 'Disable' : 'Enable'}
        danger={!form.maintenance_mode}
        message={
          form.maintenance_mode
            ? 'The storefront becomes visible to customers again.'
            : 'Customers will see a maintenance screen until you disable it. Admins keep full access.'
        }
      />
    </div>
  )
}
