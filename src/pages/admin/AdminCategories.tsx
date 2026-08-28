import { useState } from 'react'
import { Plus, Pencil, Trash2, Layers } from 'lucide-react'
import { useAdminCategories } from '@/hooks/admin/useAdminData'
import { useAdminProducts } from '@/hooks/admin/useAdminData'
import { useToast } from '@/context/ToastContext'
import { usePageMeta } from '@/hooks/usePageMeta'
import { generateSlug } from '@/lib/utils'
import { PageHeader, DataList, type Cell } from '@/components/admin/ui'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Loading from '@/components/Loading'

interface CategoryForm {
  name: string
  name_ar: string
  slug: string
  description: string
  description_ar: string
  image: string
  sort_order: string
  is_active: boolean
}

const EMPTY: CategoryForm = { name: '', name_ar: '', slug: '', description: '', description_ar: '', image: '', sort_order: '0', is_active: true }

export default function AdminCategories() {
  const { categories, loading, create, update, remove } = useAdminCategories()
  const { products } = useAdminProducts()
  const { addToast } = useToast()
  const [editing, setEditing] = useState<string | null | undefined>(undefined)
  const [form, setForm] = useState<CategoryForm>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; productCount: number } | null>(null)
  const [deleting, setDeleting] = useState(false)
  usePageMeta({ title: 'Admin — Categories' })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
  }

  function openEdit(c: typeof categories[number]) {
    setEditing(c.id)
    setForm({
      name: c.name,
      name_ar: (c as { name_ar?: string | null }).name_ar ?? '',
      slug: c.slug,
      description: c.description || '',
      description_ar: (c as { description_ar?: string | null }).description_ar ?? '',
      image: c.image || '',
      sort_order: String(c.sort_order),
      is_active: c.is_active,
    })
  }

  async function handleSave() {
    if (!form.name.trim()) {
      addToast('Category name is required', 'error')
      return
    }
    const payload = {
      name: form.name.trim(),
      name_ar: form.name_ar.trim() || null,
      slug: (form.slug.trim() || generateSlug(form.name)).toLowerCase(),
      description: form.description.trim() || null,
      description_ar: form.description_ar.trim() || null,
      image: form.image.trim() || null,
      sort_order: Number(form.sort_order || 0),
      is_active: form.is_active,
    }
    setSaving(true)
    const { error } = editing ? await update(editing, payload) : await create(payload)
    setSaving(false)
    if (error) {
      addToast(error.message?.includes('duplicate') ? 'A category with this slug already exists' : 'Failed to save category', 'error')
      return
    }
    addToast(editing ? 'Category updated' : 'Category created')
    setEditing(undefined)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await remove(deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
    if (error) addToast('Failed to delete category', 'error')
    else addToast('Category deleted — its products are now uncategorised')
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Categories" />
        <Loading />
      </div>
    )
  }

  const productCount = (categoryId: string) => products.filter(p => p.category_id === categoryId).length

  const rows: Cell[][] = categories.map(c => [
    {
      label: 'Category',
      primary: true,
      content: (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-saif-panel rounded-sm overflow-hidden flex-shrink-0">
            {c.image ? (
              <img src={c.image} alt="" className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Layers size={14} className="text-saif-faint" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-saif-text truncate">{c.name}</p>
            <p className="text-xs text-saif-dim font-mono">{c.slug}</p>
          </div>
        </div>
      ),
    },
    { label: 'Description', hideOnMobile: true, content: <span className="text-xs text-saif-dim line-clamp-1">{c.description || '—'}</span> },
    { label: 'Products', content: <span className="text-saif-text font-semibold tabular-nums">{productCount(c.id)}</span> },
    { label: 'Order', hideOnMobile: true, content: <span className="text-saif-dim tabular-nums">{c.sort_order}</span> },
    {
      label: 'Status',
      content: (
        <span className={`badge ${c.is_active ? 'border-green-500/30 text-green-400' : 'border-saif-border text-saif-dim'}`}>
          {c.is_active ? 'active' : 'hidden'}
        </span>
      ),
    },
    {
      label: 'Actions',
      content: (
        <div className="flex gap-1">
          <button onClick={() => openEdit(c)} className="p-1.5 text-saif-dim hover:text-saif-text transition-colors" aria-label={`Edit ${c.name}`}>
            <Pencil size={14} />
          </button>
          <button
            onClick={() => setDeleteTarget({ id: c.id, name: c.name, productCount: productCount(c.id) })}
            className="p-1.5 text-saif-dim hover:text-saif-accent transition-colors"
            aria-label={`Delete ${c.name}`}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ])

  return (
    <div className="animate-[pageIn_0.4s_ease]">
      <PageHeader
        title="Categories"
        description={`${categories.length} categories`}
        actions={
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <Plus size={14} /> Add Category
          </button>
        }
      />

      <DataList columns={['Category', 'Description', 'Products', 'Order', 'Status', 'Actions']} rows={rows} empty={categories.length === 0} />

      <Modal open={editing !== undefined} onClose={() => setEditing(undefined)} title={editing ? 'Edit Category' : 'New Category'}>
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="ct-name">Name (English) *</label>
            <input
              id="ct-name"
              className="input"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value, slug: editing ? form.slug : generateSlug(e.target.value) })}
            />
          </div>
          <div>
            <label className="label" htmlFor="ct-name-ar" dir="rtl">Name (Arabic)</label>
            <input
              id="ct-name-ar"
              className="input"
              dir="rtl"
              value={form.name_ar}
              onChange={e => setForm({ ...form, name_ar: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="ct-slug">Slug</label>
            <input id="ct-slug" className="input font-mono text-xs" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="ct-desc">Description (English)</label>
            <textarea id="ct-desc" className="input resize-none" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="ct-desc-ar" dir="rtl">Description (Arabic)</label>
            <textarea id="ct-desc-ar" className="input resize-none" dir="rtl" rows={2} value={form.description_ar} onChange={e => setForm({ ...form, description_ar: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="ct-img">Image URL</label>
            <input id="ct-img" className="input text-xs" value={form.image} onChange={e => setForm({ ...form, image: e.target.value })} placeholder="https://…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="ct-order">Sort Order</label>
              <input id="ct-order" type="number" className="input" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: e.target.value })} />
            </div>
            <label className="flex items-center gap-3 text-sm text-saif-text cursor-pointer pb-1">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={e => setForm({ ...form, is_active: e.target.checked })}
                className="w-4 h-4 accent-[#E63946]"
              />
              Visible in store
            </label>
          </div>
          <div className="flex gap-3 pt-2">
            <button className="btn btn-primary flex-1" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Category'}
            </button>
            <button className="btn" onClick={() => setEditing(undefined)} disabled={saving}>
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={`Delete "${deleteTarget?.name}"?`}
        message={
          deleteTarget?.productCount
            ? `${deleteTarget.productCount} product(s) will become uncategorised but are not deleted.`
            : 'No products use this category.'
        }
        confirmLabel="Delete Category"
        danger
        busy={deleting}
      />
    </div>
  )
}
