import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowUp, ArrowDown, Eye, EyeOff, Pencil, ExternalLink, GripVertical, Plus, Trash2, Check,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/context/ToastContext'
import { useI18n } from '@/i18n'
import { RETIRED_SECTION_KEYS } from '@/hooks/useHomepageSections'
import { useAdminProducts } from '@/hooks/admin/useAdminData'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { PageHeader } from '@/components/admin/ui'
import { cn, formatDate } from '@/lib/utils'
import type { HomepageSection, Product } from '@/types'

/**
 * SITE BUILDER — the storefront control center.
 * Section order (drag-free arrows, accessible), visibility toggles,
 * and bilingual content editing. Changes go live on save.
 */
export default function AdminSiteBuilder() {
  const { t } = useI18n()
  const { addToast } = useToast()
  const { products } = useAdminProducts()
  const [sections, setSections] = useState<HomepageSection[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<HomepageSection | null>(null)
  const [disableTarget, setDisableTarget] = useState<HomepageSection | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const fetchSections = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('homepage_sections')
      .select('*')
      .order('position', { ascending: true })
    setSections((data || []) as HomepageSection[])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchSections()
  }, [fetchSections])

  const maxPosition = useMemo(
    () => sections.reduce((max, s) => Math.max(max, s.position), 0),
    [sections],
  )

  async function moveSection(id: string, direction: 'up' | 'down') {
    const idx = sections.findIndex(s => s.id === id)
    if (idx < 0) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sections.length) return
    const next = [...sections]
    ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
    const reordered = next.map((s, i) => ({ ...s, position: i + 1 }))
    setSections(reordered)
    setBusy(true)
    for (const s of reordered) {
      await supabase.from('homepage_sections').update({ position: s.position }).eq('id', s.id)
    }
    setBusy(false)
    addToast(t('admin.siteBuilder.orderUpdated'))
  }

  async function toggleVisibility(section: HomepageSection) {
    setSavingId(section.id)
    const next = !section.is_enabled
    const { error } = await supabase
      .from('homepage_sections')
      .update({ is_enabled: next })
      .eq('id', section.id)
    setSavingId(null)
    if (error) {
      addToast(t('admin.siteBuilder.saveFailed'), 'error')
      return
    }
    setSections(prev => prev.map(s => (s.id === section.id ? { ...s, is_enabled: next } : s)))
    addToast(t('admin.siteBuilder.statusUpdated'))
  }

  async function saveSection(updated: HomepageSection) {
    setBusy(true)
    const { error } = await supabase
      .from('homepage_sections')
      .update({
        title_en: updated.title_en,
        title_ar: updated.title_ar,
        subtitle_en: updated.subtitle_en,
        subtitle_ar: updated.subtitle_ar,
        config: updated.config,
      })
      .eq('id', updated.id)
    setBusy(false)
    if (error) {
      addToast(t('admin.siteBuilder.saveFailed'), 'error')
      return false
    }
    setSections(prev => prev.map(s => (s.id === updated.id ? updated : s)))
    addToast(t('admin.siteBuilder.saved'))
    return true
  }

  const sectionName = (key: string) =>
    (t(`admin.siteBuilder.sectionsNames.${key}`) !== `admin.siteBuilder.sectionsNames.${key}`
      ? t(`admin.siteBuilder.sectionsNames.${key}`)
      : key)

  if (loading) {
    return (
      <div>
        <PageHeader title={t('admin.siteBuilder.title')} description={t('admin.siteBuilder.subtitle')} />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 border border-saif-border rounded-sm skeleton" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="animate-[pageIn_0.4s_ease]">
      <PageHeader
        title={t('admin.siteBuilder.title')}
        description={t('admin.siteBuilder.subtitle')}
        actions={
          <a href="/" target="_blank" rel="noopener noreferrer" className="btn btn-sm">
            <ExternalLink size={13} /> {t('admin.siteBuilder.preview')}
          </a>
        }
      />

      {/* Legend */}
      <div className="flex items-center justify-between gap-4 mb-4 text-xs text-saif-faint">
        <span>{t('admin.siteBuilder.reorderHint')}</span>
        <span className="flex items-center gap-2 flex-shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" aria-hidden="true" />{' '}
          {t('admin.siteBuilder.enabled')}
          <span className="w-2.5 h-2.5 rounded-full bg-neutral-600 ms-3" aria-hidden="true" />{' '}
          {t('admin.siteBuilder.disabled')}
        </span>
      </div>

      {/* Section list — retired sections (legacy digital rail) stay in the
          database but are hidden here because the storefront no longer
          renders them. */}
      <ol className="space-y-2">
        {sections
          .filter(s => s.section_key !== 'announcement')
          .filter(s => !RETIRED_SECTION_KEYS.has(s.section_key))
          .map((section, i, arr) => (
            <li
              key={section.id}
              className={cn(
                'border rounded-sm p-4 flex items-center gap-3 transition-colors',
                section.is_enabled
                  ? 'border-saif-border bg-saif-surface/40'
                  : 'border-saif-border/50 bg-transparent opacity-60',
              )}
            >
              {/* Position + reorder */}
              <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                <button
                  onClick={() => moveSection(section.id, 'up')}
                  disabled={i === 0 || busy}
                  className="w-9 h-9 flex items-center justify-center text-saif-dim hover:text-saif-text disabled:opacity-20 disabled:pointer-events-none rounded-sm hover:bg-white/5 transition-colors"
                  aria-label={t('admin.common.moveUp')}
                >
                  <ArrowUp size={15} />
                </button>
                <span className="text-[10px] font-bold tabular-nums text-saif-faint flex items-center gap-0.5">
                  <GripVertical size={10} aria-hidden="true" />
                  {String(section.position).padStart(2, '0')}
                </span>
                <button
                  onClick={() => moveSection(section.id, 'down')}
                  disabled={i === arr.length - 1 || busy}
                  className="w-9 h-9 flex items-center justify-center text-saif-dim hover:text-saif-text disabled:opacity-20 disabled:pointer-events-none rounded-sm hover:bg-white/5 transition-colors"
                  aria-label={t('admin.common.moveDown')}
                >
                  <ArrowDown size={15} />
                </button>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-sm font-semibold text-saif-text">{sectionName(section.section_key)}</h3>
                  <span className="font-mono text-[10px] text-saif-faint">{section.section_key}</span>
                  {section.is_enabled ? (
                    <span className="badge border-green-500/30 text-green-400">{t('admin.siteBuilder.enabled')}</span>
                  ) : (
                    <span className="badge border-saif-border text-saif-faint">{t('admin.siteBuilder.disabled')}</span>
                  )}
                </div>
                <p className="text-xs text-saif-dim mt-1 truncate">
                  {section.title_en || section.title_ar || '—'}
                  {section.title_ar && section.title_en ? ` · ${section.title_ar}` : ''}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => setEditing(section)}
                  className="w-11 h-11 flex items-center justify-center text-saif-dim hover:text-saif-text transition-colors rounded-sm hover:bg-white/5"
                  aria-label={`${t('admin.siteBuilder.editSection')} — ${sectionName(section.section_key)}`}
                  title={t('admin.siteBuilder.editSection')}
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => (section.is_enabled ? setDisableTarget(section) : toggleVisibility(section))}
                  disabled={savingId === section.id}
                  className={cn(
                    'w-11 h-11 flex items-center justify-center transition-colors rounded-sm hover:bg-white/5',
                    section.is_enabled ? 'text-saif-dim hover:text-saif-accent' : 'text-green-400 hover:text-green-300',
                  )}
                  aria-label={
                    section.is_enabled
                      ? `${t('admin.common.disable')} — ${sectionName(section.section_key)}`
                      : `${t('admin.common.enable')} — ${sectionName(section.section_key)}`
                  }
                  title={section.is_enabled ? t('admin.common.disable') : t('admin.common.enable')}
                >
                  {section.is_enabled ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </li>
          ))}
      </ol>

      {/* Announcement section — separate card (renders at page top) */}
      {sections.find(s => s.section_key === 'announcement') && (
        <div className="mt-10">
          <h2 className="text-sm font-bold uppercase tracking-wider text-saif-text mb-3">
            {sectionName('announcement')}
          </h2>
          <button
            onClick={() => setEditing(sections.find(s => s.section_key === 'announcement')!)}
            className="w-full text-start border border-saif-border rounded-sm p-4 hover:border-saif-dim transition-colors flex items-center justify-between gap-4"
          >
            <div className="min-w-0">
              <p className="text-sm text-saif-text truncate">
                {sections.find(s => s.section_key === 'announcement')?.title_en ||
                  sections.find(s => s.section_key === 'announcement')?.title_ar ||
                  '—'}
              </p>
              <p className="text-xs text-saif-faint mt-0.5">{t('admin.siteBuilder.fields.announcementTextEn')} / AR</p>
            </div>
            <Pencil size={16} className="text-saif-dim flex-shrink-0" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Editor modal */}
      {editing && (
        <SectionEditor
          key={editing.id}
          section={editing}
          products={products}
          busy={busy}
          onClose={() => setEditing(null)}
          onSave={async updated => {
            const ok = await saveSection(updated)
            if (ok) setEditing(null)
          }}
        />
      )}

      {/* Disable confirmation */}
      <ConfirmDialog
        open={!!disableTarget}
        onClose={() => setDisableTarget(null)}
        onConfirm={async () => {
          if (disableTarget) await toggleVisibility(disableTarget)
          setDisableTarget(null)
        }}
        title={t('admin.siteBuilder.confirmDisable')}
        message={t('admin.siteBuilder.confirmDisableDesc', {
          section: sectionName(disableTarget?.section_key ?? ''),
        })}
        confirmLabel={t('admin.common.disable')}
        danger
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section editor — bilingual titles/subtitles + per-section config fields
// ---------------------------------------------------------------------------

function SectionEditor({
  section,
  products,
  busy,
  onClose,
  onSave,
}: {
  section: HomepageSection
  products: Product[]
  busy: boolean
  onClose: () => void
  onSave: (updated: HomepageSection) => Promise<void>
}) {
  const { t } = useI18n()
  const [draft, setDraft] = useState<HomepageSection>({ ...section })
  const config = (draft.config ?? {}) as Record<string, unknown>
  const isRail = draft.section_key.startsWith('rail_')

  function setField<K extends keyof HomepageSection>(key: K, value: HomepageSection[K]) {
    setDraft(prev => ({ ...prev, [key]: value }))
  }

  function setConfig(key: string, value: unknown) {
    setDraft(prev => ({ ...prev, config: { ...(prev.config as Record<string, unknown>), [key]: value } as HomepageSection['config'] }))
  }

  const selectedIds = (config.product_ids as string[]) ?? []
  const [productSearch, setProductSearch] = useState('')

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase()
    return products.filter(p => !q || p.name.toLowerCase().includes(q) || (p.name_ar || '').includes(q))
  }, [products, productSearch])

  function toggleProduct(id: string) {
    const next = selectedIds.includes(id)
      ? selectedIds.filter(x => x !== id)
      : [...selectedIds, id]
    setConfig('product_ids', next)
  }

  return (
    <Modal open onClose={onClose} title={`${t('admin.siteBuilder.editSection')} — ${draft.section_key}`} wide>
      <div className="space-y-6">
        {/* Bilingual titles */}
        {draft.section_key !== 'hero' && draft.section_key !== 'announcement' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="sb-title-en">{t('admin.siteBuilder.titles.en')}</label>
                <input
                  id="sb-title-en"
                  className="input"
                  value={draft.title_en ?? ''}
                  onChange={e => setField('title_en', e.target.value || null)}
                  disabled={busy}
                />
              </div>
              <div>
                <label className="label" htmlFor="sb-title-ar" dir="rtl">{t('admin.siteBuilder.titles.ar')}</label>
                <input
                  id="sb-title-ar"
                  className="input"
                  dir="rtl"
                  value={draft.title_ar ?? ''}
                  onChange={e => setField('title_ar', e.target.value || null)}
                  disabled={busy}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="sb-sub-en">{t('admin.siteBuilder.subtitles.en')}</label>
                <textarea
                  id="sb-sub-en"
                  className="input resize-none"
                  rows={2}
                  value={draft.subtitle_en ?? ''}
                  onChange={e => setField('subtitle_en', e.target.value || null)}
                  disabled={busy}
                />
              </div>
              <div>
                <label className="label" htmlFor="sb-sub-ar" dir="rtl">{t('admin.siteBuilder.subtitles.ar')}</label>
                <textarea
                  id="sb-sub-ar"
                  className="input resize-none"
                  dir="rtl"
                  rows={2}
                  value={draft.subtitle_ar ?? ''}
                  onChange={e => setField('subtitle_ar', e.target.value || null)}
                  disabled={busy}
                />
              </div>
            </div>
          </>
        )}

        {/* Hero config */}
        {draft.section_key === 'hero' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ConfigInput label={`${t('admin.siteBuilder.fields.cta1Text')} (EN)`} value={config.cta1_text_en} onChange={v => setConfig('cta1_text_en', v)} busy={busy} />
              <ConfigInput label={`${t('admin.siteBuilder.fields.cta1Text')} (AR)`} dir="rtl" value={config.cta1_text_ar} onChange={v => setConfig('cta1_text_ar', v)} busy={busy} />
              <ConfigInput label={t('admin.siteBuilder.fields.cta1Dest')} value={config.cta1_dest} onChange={v => setConfig('cta1_dest', v)} busy={busy} />
              <div />
              <ConfigInput label={`${t('admin.siteBuilder.fields.cta2Text')} (EN)`} value={config.cta2_text_en} onChange={v => setConfig('cta2_text_en', v)} busy={busy} />
              <ConfigInput label={`${t('admin.siteBuilder.fields.cta2Text')} (AR)`} dir="rtl" value={config.cta2_text_ar} onChange={v => setConfig('cta2_text_ar', v)} busy={busy} />
              <ConfigInput label={t('admin.siteBuilder.fields.cta2Dest')} value={config.cta2_dest} onChange={v => setConfig('cta2_dest', v)} busy={busy} />
              <div />
              <div className="md:col-span-2">
                <label className="label" htmlFor="sb-overlay">
                  {t('admin.siteBuilder.fields.overlay')}: {Number(config.overlay ?? 20)}%
                </label>
                <input
                  id="sb-overlay"
                  type="range"
                  min={0}
                  max={90}
                  step={5}
                  value={Number(config.overlay ?? 20)}
                  onChange={e => setConfig('overlay', Number(e.target.value))}
                  className="w-full accent-[#E63946]"
                  disabled={busy}
                />
              </div>
            </div>
          </div>
        )}

        {/* Announcement config */}
        {draft.section_key === 'announcement' && (
          <div className="space-y-4">
            <ConfigInput label={t('admin.siteBuilder.fields.announcementTextEn')} value={draft.title_en} onChange={v => setField('title_en', v)} busy={busy} />
            <ConfigInput label={t('admin.siteBuilder.fields.announcementTextAr')} dir="rtl" value={draft.title_ar} onChange={v => setField('title_ar', v)} busy={busy} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ConfigInput label={t('admin.siteBuilder.fields.announcementLink')} value={config.link} onChange={v => setConfig('link', v)} busy={busy} placeholder="/products" />
              <ConfigInput label={t('admin.siteBuilder.fields.announcementLinkText')} value={config.link_text} onChange={v => setConfig('link_text', v)} busy={busy} />
            </div>
          </div>
        )}

        {/* Spotlight config */}
        {draft.section_key === 'spotlight' && (
          <div>
            <label className="label" htmlFor="sb-product">{t('admin.siteBuilder.fields.product')}</label>
            <select
              id="sb-product"
              className="input"
              value={(config.product_id as string) ?? ''}
              onChange={e => setConfig('product_id', e.target.value || null)}
              disabled={busy}
            >
              <option value="">{t('admin.siteBuilder.fields.productHint')}</option>
              {products.map(p => (
                <option key={p.id} value={p.id} className="bg-black">
                  {p.name}{p.name_ar ? ` — ${p.name_ar}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Rail config */}
        {isRail && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="sb-source">{t('admin.siteBuilder.fields.source')}</label>
                <select
                  id="sb-source"
                  className="input"
                  value={(config.source as string) ?? 'auto'}
                  onChange={e => setConfig('source', e.target.value)}
                  disabled={busy}
                >
                  <option value="auto" className="bg-black">{t('admin.siteBuilder.fields.sourceAuto')} — {t('admin.siteBuilder.fields.sourceBestsellers')}</option>
                  <option value="newest" className="bg-black">{t('admin.siteBuilder.fields.sourceNewest')}</option>
                  <option value="offers" className="bg-black">{t('admin.siteBuilder.fields.sourceOffers')}</option>
                  <option value="digital" className="bg-black">{t('admin.siteBuilder.fields.sourceDigital')}</option>
                  <option value="bestsellers" className="bg-black">{t('admin.siteBuilder.fields.sourceBestsellers')}</option>
                  <option value="manual" className="bg-black">{t('admin.siteBuilder.fields.sourceManual')}</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="sb-limit">{t('admin.siteBuilder.fields.limit')}</label>
                <input
                  id="sb-limit"
                  type="number"
                  min={1}
                  max={24}
                  className="input"
                  value={Number(config.limit ?? 8)}
                  onChange={e => setConfig('limit', Math.max(1, Math.min(24, Number(e.target.value) || 8)))}
                  disabled={busy}
                />
              </div>
              <ConfigInput label={t('admin.siteBuilder.fields.viewAll')} value={config.view_all} onChange={v => setConfig('view_all', v)} busy={busy} placeholder="/products" />
            </div>

            {/* Manual product picker */}
            {(config.source as string) === 'manual' && (
              <div className="border border-saif-border rounded-sm p-4">
                <label className="label" htmlFor="sb-product-search">{t('admin.common.selectProducts')}</label>
                <input
                  id="sb-product-search"
                  className="input mb-3"
                  placeholder={t('admin.common.searchProducts')}
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                />
                <p className="text-xs text-saif-faint mb-3">{t('admin.common.selectedCount', { count: selectedIds.length })}</p>
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {filteredProducts.map(p => {
                    const selected = selectedIds.includes(p.id)
                    return (
                      <button
                        key={p.id}
                        onClick={() => toggleProduct(p.id)}
                        aria-pressed={selected}
                        className={cn(
                          'w-full flex items-center gap-3 p-2 rounded-sm text-start transition-colors min-h-[44px]',
                          selected ? 'bg-saif-accent/10 border border-saif-accent/40' : 'hover:bg-white/5 border border-transparent',
                        )}
                      >
                        <span
                          className={cn(
                            'w-5 h-5 rounded-sm border flex items-center justify-center flex-shrink-0',
                            selected ? 'bg-saif-accent border-saif-accent' : 'border-saif-border',
                          )}
                        >
                          {selected && <Check size={12} className="text-black" aria-hidden="true" />}
                        </span>
                        <span className="text-sm text-saif-text truncate">{p.name}</span>
                        {p.name_ar && <span className="text-xs text-saif-faint truncate" dir="rtl">{p.name_ar}</span>}
                      </button>
                    )
                  })}
                  {filteredProducts.length === 0 && (
                    <p className="text-sm text-saif-faint py-3 text-center">{t('admin.common.noProductsFound')}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 pt-4 border-t border-saif-border">
          <p className="text-xs text-saif-faint">
            {t('common.date')}: {formatDate(draft.updated_at, true)}
          </p>
          <div className="flex gap-3">
            <button className="btn btn-sm" onClick={onClose} disabled={busy}>
              {t('admin.common.cancel')}
            </button>
            <button className="btn btn-sm btn-primary" onClick={() => onSave(draft)} disabled={busy}>
              {busy ? t('admin.siteBuilder.saving') : t('admin.siteBuilder.saveSection')}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function ConfigInput({
  label,
  value,
  onChange,
  busy,
  dir,
  placeholder,
}: {
  label: string
  value: unknown
  onChange: (v: string) => void
  busy?: boolean
  dir?: 'rtl'
  placeholder?: string
}) {
  const id = `cfg-${label.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <div>
      <label className="label" htmlFor={id} dir={dir}>
        {label}
      </label>
      <input
        id={id}
        className="input"
        dir={dir}
        value={typeof value === 'string' ? value : ''}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        disabled={busy}
      />
    </div>
  )
}
