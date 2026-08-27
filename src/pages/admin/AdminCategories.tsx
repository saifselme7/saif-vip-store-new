import { useState } from 'react'
import { Pencil, Trash2, Plus, ArrowUp, ArrowDown } from 'lucide-react'
import { useAdminCategories } from '@/hooks/useAdmin'
import { useApp } from '@/context/AppContext'
import { usePageMeta } from '@/hooks/usePageMeta'
import { generateSlug } from '@/lib/utils'
import type { Category } from '@/types'
import Loading from '@/components/Loading'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

interface CatDraft {
  id?: string
  name: string
  slug: string
  description: string
  image: string
  sort_order: number
  is_active: boolean
}

const EMPTY: CatDraft = { name: '', slug: '', description: '', image: '', sort_order: 0, is_active: true }

export default function AdminCategories() {
  const { categories, loading, save, remove } = useAdminCategories()
  const { addToast } = useApp()
  const [draft, setDraft] = useState<CatDraft | null>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)
  const [saving, setSaving] = useState(false)

  usePageMeta('Categories', 'Manage catalog categories.')

  async function handleSave() {
    if (!draft) return
    if (!draft.name.trim()) { addToast('Name is required', 'error'); return }
    setSaving(true)
    const { error } = await save({
      id: draft.id,
      name: draft.name.trim(),
      slug: draft.slug.trim() || generateSlug(draft.name),
      description: draft.description.trim() || null,
      image: draft.image.trim() || null,
      sort_order: draft.sort_order,
      is_active: draft.is_active,
    })
    setSaving(false)
    if (error) addToast(error.message || 'Failed to save category', 'error')
    else { addToast(draft.id ? 'Category updated' : 'Category created'); setDraft(null) }
  }

  async function handleDelete() {
    if (!deleting) return
    const { error } = await remove(deleting.id)
    if (error) addToast(error.message || 'Failed to delete', 'error')
    else addToast('Category deleted')
    setDeleting(null)
  }

  async function move(cat: Category, dir: -1 | 1) {
    const { error } = await save({ id: cat.id, name: cat.name, sort_order: cat.sort_order + dir })
    if (error) addToast('Could not reorder', 'error')
  }

  return (
    <div className="animate-[pageIn_0.4s_ease]">
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-saif-text">Categories</h1>
        <button onClick={() => setDraft({ ...EMPTY })} className="btn btn-primary btn-sm"><Plus size={14} className="mr-1" /> Add</button>
      </div>

      {loading ? <Loading /> : (
        <div className="border border-saif-border overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="border-b border-saif-border text-left">
                {['Order', 'Name', 'Slug', 'Active', 'Actions'].map(h => (
                  <th key={h} className="p-4 text-[10px] uppercase tracking-wider text-saif-dim font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map(cat => (
                <tr key={cat.id} className="border-b border-saif-border hover:bg-white/[0.03] transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-1">
                      <span className="text-saif-dim w-6">{cat.sort_order}</span>
                      <button onClick={() => move(cat, -1)} className="p-1 text-saif-dim hover:text-saif-text" aria-label="Move up"><ArrowUp size={12} /></button>
                      <button onClick={() => move(cat, 1)} className="p-1 text-saif-dim hover:text-saif-text" aria-label="Move down"><ArrowDown size={12} /></button>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {cat.image && <img src={cat.image} alt="" className="w-9 h-9 object-cover bg-[#111]" loading="lazy" />}
                      <span className="font-medium text-saif-text">{cat.name}</span>
                    </div>
                  </td>
                  <td className="p-4 text-saif-dim text-xs">{cat.slug}</td>
                  <td className="p-4"><span className={`text-xs ${cat.is_active ? 'text-green-400' : 'text-saif-dim'}`}>{cat.is_active ? 'Yes' : 'No'}</span></td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <button onClick={() => setDraft({ id: cat.id, name: cat.name, slug: cat.slug, description: cat.description || '', image: cat.image || '', sort_order: cat.sort_order, is_active: cat.is_active })} className="p-1.5 text-saif-dim hover:text-saif-text transition-colors" aria-label="Edit"><Pencil size={14} /></button>
                      <button onClick={() => setDeleting(cat)} className="p-1.5 text-saif-dim hover:text-saif-accent transition-colors" aria-label="Delete"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? 'Edit Category' : 'New Category'}>
        {draft && (
          <div className="space-y-3">
            <div>
              <label className="label">Name *</label>
              <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} className="input" onBlur={() => { if (!draft.slug) setDraft(d => d ? { ...d, slug: generateSlug(d.name) } : d) }} />
            </div>
            <div>
              <label className="label">Slug</label>
              <input value={draft.slug} onChange={e => setDraft({ ...draft, slug: e.target.value })} className="input" placeholder="auto-generated" />
            </div>
            <div>
              <label className="label">Description</label>
              <input value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">Image URL</label>
              <input value={draft.image} onChange={e => setDraft({ ...draft, image: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">Sort Order</label>
              <input type="number" value={draft.sort_order} onChange={e => setDraft({ ...draft, sort_order: Number(e.target.value) })} className="input" />
            </div>
            <label className="flex items-center gap-2 text-sm text-saif-text">
              <input type="checkbox" checked={draft.is_active} onChange={e => setDraft({ ...draft, is_active: e.target.checked })} /> Active (visible in store)
            </label>
            <div className="flex gap-3 pt-2">
              <button onClick={handleSave} disabled={saving} className="btn btn-primary flex-1 text-xs">{saving ? 'Saving…' : 'Save'}</button>
              <button onClick={() => setDraft(null)} className="btn flex-1 text-xs">Cancel</button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Delete category?"
        message={`“${deleting?.name}” will be removed. Products in it become uncategorized.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
