import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Copy, Search, ArrowUp, ArrowDown, Star, ImageIcon, X } from 'lucide-react'
import { useAdminProducts } from '@/hooks/useAdmin'
import { useCategories } from '@/hooks/useCategories'
import { useApp } from '@/context/AppContext'
import { usePageMeta } from '@/hooks/usePageMeta'
import { formatPrice, generateSlug } from '@/lib/utils'
import type { Product, ProductVariant } from '@/types'
import Loading from '@/components/Loading'
import EmptyState from '@/components/EmptyState'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

interface VariantDraft {
  id?: string
  name: string
  sku: string
  price: string
  stock: string
  size: string
  color: string
}

interface ProductDraft {
  id?: string
  name: string
  slug: string
  description: string
  short_description: string
  price: string
  compare_at_price: string
  product_type: 'physical' | 'digital'
  category_id: string
  stock: string
  low_stock_threshold: string
  sku: string
  status: 'active' | 'draft' | 'archived'
  featured: boolean
  bestseller: boolean
  tags: string
  images: string[]
  variants: VariantDraft[]
}

const EMPTY: ProductDraft = {
  name: '', slug: '', description: '', short_description: '', price: '', compare_at_price: '',
  product_type: 'physical', category_id: '', stock: '0', low_stock_threshold: '5', sku: '',
  status: 'draft', featured: false, bestseller: false, tags: '', images: [], variants: [],
}

export default function AdminProducts() {
  const { products, loading, save, remove, duplicate } = useAdminProducts()
  const { categories } = useCategories(true)
  const { addToast } = useApp()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [draft, setDraft] = useState<ProductDraft | null>(null)
  const [deleting, setDeleting] = useState<Product | null>(null)
  const [saving, setSaving] = useState(false)
  const [imageUrl, setImageUrl] = useState('')

  usePageMeta('Products', 'Manage the catalog.')

  const filtered = useMemo(() => products.filter(p => {
    if (statusFilter && p.status !== statusFilter) return false
    if (categoryFilter && p.category_id !== categoryFilter) return false
    const q = search.trim().toLowerCase()
    if (q && !p.name.toLowerCase().includes(q) && !(p.sku || '').toLowerCase().includes(q)) return false
    return true
  }), [products, search, statusFilter, categoryFilter])

  function openCreate() { setDraft({ ...EMPTY }) }

  function openEdit(p: Product) {
    setDraft({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      short_description: p.short_description,
      price: String(p.price),
      compare_at_price: p.compare_at_price != null ? String(p.compare_at_price) : '',
      product_type: p.product_type,
      category_id: p.category_id || '',
      stock: String(p.stock),
      low_stock_threshold: String(p.low_stock_threshold ?? 5),
      sku: p.sku || '',
      status: p.status,
      featured: p.featured,
      bestseller: p.bestseller,
      tags: (p.tags || []).join(', '),
      images: [...(p.images || [])],
      variants: (p.variants || []).map(v => ({
        id: v.id, name: v.name, sku: v.sku || '', price: v.price != null ? String(v.price) : '',
        stock: String(v.stock), size: v.size || '', color: v.color || '',
      })),
    })
  }

  function update<K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) {
    setDraft(d => (d ? { ...d, [key]: value } : d))
  }

  async function handleSave() {
    if (!draft) return
    if (!draft.name.trim()) { addToast('Product name is required', 'error'); return }
    if (draft.price === '' || Number.isNaN(Number(draft.price))) { addToast('Enter a valid price', 'error'); return }

    const slug = draft.slug.trim() || generateSlug(draft.name)
    const payload: Partial<Product> & { name: string; slug: string } = {
      id: draft.id,
      name: draft.name.trim(),
      slug,
      description: draft.description,
      short_description: draft.short_description,
      price: Number(draft.price),
      compare_at_price: draft.compare_at_price ? Number(draft.compare_at_price) : null,
      product_type: draft.product_type,
      category_id: draft.category_id || null,
      stock: Number(draft.stock) || 0,
      low_stock_threshold: Number(draft.low_stock_threshold) || 5,
      sku: draft.sku.trim() || null,
      status: draft.status,
      featured: draft.featured,
      bestseller: draft.bestseller,
      tags: draft.tags.split(',').map(t => t.trim()).filter(Boolean),
      images: draft.images,
      thumbnail: draft.images[0] || null,
    }

    const variants = draft.variants.map(v => ({
      id: v.id,
      name: v.name.trim() || [v.size, v.color].filter(Boolean).join(' / ') || 'Default',
      sku: v.sku.trim() || null,
      price: v.price ? Number(v.price) : null,
      stock: Number(v.stock) || 0,
      size: v.size.trim() || null,
      color: v.color.trim() || null,
    }))

    setSaving(true)
    const { error } = await save(payload, variants.length > 0 ? variants : null)
    setSaving(false)
    if (error) addToast(error.message || 'Failed to save product', 'error')
    else {
      addToast(draft.id ? 'Product updated' : 'Product created')
      setDraft(null)
    }
  }

  async function handleDelete() {
    if (!deleting) return
    const { error } = await remove(deleting.id)
    if (error) addToast(error.message || 'Failed to delete', 'error')
    else addToast('Product deleted')
    setDeleting(null)
  }

  async function handleDuplicate(p: Product) {
    const { error } = await duplicate(p)
    if (error) addToast(error.message || 'Failed to duplicate', 'error')
    else addToast('Duplicated as draft')
  }

  return (
    <div className="animate-[pageIn_0.4s_ease]">
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-saif-text">Products</h1>
        <button onClick={openCreate} className="btn btn-primary btn-sm"><Plus size={14} className="mr-1" /> Add Product</button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-saif-dim" />
          <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or SKU…" aria-label="Search products" className="input pl-10 text-sm" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input bg-[#0A0A0A] text-sm w-auto" aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="input bg-[#0A0A0A] text-sm w-auto" aria-label="Filter by category">
          <option value="">All categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {loading ? <Loading /> : filtered.length === 0 ? (
        <EmptyState title="No products" description="Create your first product or adjust filters." />
      ) : (
        <div className="border border-saif-border overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="border-b border-saif-border text-left">
                {['Product', 'Price', 'Stock', 'Flags', 'Status', 'Actions'].map(h => (
                  <th key={h} className="p-4 text-[10px] uppercase tracking-wider text-saif-dim font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(product => {
                const catName = Array.isArray(product.categories) ? product.categories[0]?.name : product.categories?.name
                return (
                  <tr key={product.id} className="border-b border-saif-border hover:bg-white/[0.03] transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {product.thumbnail
                          ? <img src={product.thumbnail} alt="" className="w-10 h-12 object-cover bg-[#111]" loading="lazy" />
                          : <div className="w-10 h-12 bg-[#111] flex items-center justify-center"><ImageIcon size={14} className="text-saif-dim" /></div>}
                        <div className="min-w-0">
                          <p className="font-medium text-saif-text truncate max-w-[220px]">{product.name}</p>
                          <p className="text-xs text-saif-dim">{catName || '—'} · {product.product_type}{product.sku ? ` · ${product.sku}` : ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-saif-text whitespace-nowrap">
                      {formatPrice(product.price)}
                      {product.compare_at_price != null && <span className="text-xs text-saif-dim line-through ml-1.5">{formatPrice(product.compare_at_price)}</span>}
                    </td>
                    <td className="p-4">
                      <span className={product.product_type === 'digital' ? 'text-saif-dim' : product.stock <= 0 ? 'text-red-400 font-semibold' : product.stock <= (product.low_stock_threshold ?? 5) ? 'text-saif-accent font-semibold' : 'text-saif-text'}>
                        {product.product_type === 'digital' ? '∞' : product.stock}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-1">
                        {product.featured && <span title="Featured" className="text-saif-accent"><Star size={13} className="fill-saif-accent" /></span>}
                        {product.bestseller && <span className="text-[9px] border border-saif-border px-1 py-0.5 uppercase text-saif-dim">Best</span>}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`text-xs uppercase px-2 py-0.5 border ${
                        product.status === 'active' ? 'border-green-500/50 text-green-400' :
                        product.status === 'draft' ? 'border-yellow-500/50 text-yellow-400' :
                        'border-saif-border text-saif-dim'
                      }`}>{product.status}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-1.5">
                        <IconBtn label="Edit" onClick={() => openEdit(product)}><Pencil size={14} /></IconBtn>
                        <IconBtn label="Duplicate" onClick={() => handleDuplicate(product)}><Copy size={14} /></IconBtn>
                        <IconBtn label="Delete" danger onClick={() => setDeleting(product)}><Trash2 size={14} /></IconBtn>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------- Product form ---------- */}
      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? 'Edit Product' : 'New Product'} wide>
        {draft && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="label">Name *</label>
                <input value={draft.name} onChange={e => update('name', e.target.value)} className="input" onBlur={() => { if (!draft.slug) update('slug', generateSlug(draft.name)) }} />
              </div>
              <div>
                <label className="label">Slug</label>
                <input value={draft.slug} onChange={e => update('slug', e.target.value)} className="input" placeholder="auto-generated" />
              </div>
              <div>
                <label className="label">Category</label>
                <select value={draft.category_id} onChange={e => update('category_id', e.target.value)} className="input bg-[#0A0A0A]">
                  <option value="">None</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Price *</label>
                <input type="number" step="0.01" min="0" value={draft.price} onChange={e => update('price', e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">Compare-at Price</label>
                <input type="number" step="0.01" min="0" value={draft.compare_at_price} onChange={e => update('compare_at_price', e.target.value)} className="input" placeholder="for sale badge" />
              </div>
              <div>
                <label className="label">Stock</label>
                <input type="number" min="0" value={draft.stock} onChange={e => update('stock', e.target.value)} className="input" disabled={draft.product_type === 'digital'} />
              </div>
              <div>
                <label className="label">Low-stock Threshold</label>
                <input type="number" min="0" value={draft.low_stock_threshold} onChange={e => update('low_stock_threshold', e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">SKU</label>
                <input value={draft.sku} onChange={e => update('sku', e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">Type</label>
                <select value={draft.product_type} onChange={e => update('product_type', e.target.value as 'physical' | 'digital')} className="input bg-[#0A0A0A]">
                  <option value="physical">Physical</option>
                  <option value="digital">Digital</option>
                </select>
              </div>
              <div>
                <label className="label">Status</label>
                <select value={draft.status} onChange={e => update('status', e.target.value as ProductDraft['status'])} className="input bg-[#0A0A0A]">
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div className="md:col-span-2 flex flex-wrap gap-6 pt-1">
                <label className="flex items-center gap-2 text-sm text-saif-text">
                  <input type="checkbox" checked={draft.featured} onChange={e => update('featured', e.target.checked)} /> Featured
                </label>
                <label className="flex items-center gap-2 text-sm text-saif-text">
                  <input type="checkbox" checked={draft.bestseller} onChange={e => update('bestseller', e.target.checked)} /> Bestseller
                </label>
              </div>
              <div className="md:col-span-2">
                <label className="label">Tags (comma separated)</label>
                <input value={draft.tags} onChange={e => update('tags', e.target.value)} className="input" placeholder="tee, cotton, minimal" />
              </div>
              <div className="md:col-span-2">
                <label className="label">Short Description</label>
                <input value={draft.short_description} onChange={e => update('short_description', e.target.value)} className="input" />
              </div>
              <div className="md:col-span-2">
                <label className="label">Description</label>
                <textarea rows={3} value={draft.description} onChange={e => update('description', e.target.value)} className="input resize-none" />
              </div>
            </div>

            {/* Images */}
            <div>
              <p className="label">Images (first image = primary/thumbnail)</p>
              <div className="space-y-2">
                {draft.images.map((img, i) => (
                  <div key={`${img}-${i}`} className="flex items-center gap-2 border border-saif-border p-2">
                    <img src={img} alt="" className="w-10 h-12 object-cover bg-[#111]" loading="lazy" />
                    <span className="text-xs text-saif-dim flex-1 truncate">{img}</span>
                    {i === 0 && <span className="text-[9px] uppercase border border-saif-accent/40 text-saif-accent px-1.5 py-0.5">Primary</span>}
                    <button type="button" disabled={i === 0} onClick={() => moveImage(i, -1)} className="p-1.5 text-saif-dim hover:text-saif-text disabled:opacity-30" aria-label="Move up"><ArrowUp size={13} /></button>
                    <button type="button" disabled={i === draft.images.length - 1} onClick={() => moveImage(i, 1)} className="p-1.5 text-saif-dim hover:text-saif-text disabled:opacity-30" aria-label="Move down"><ArrowDown size={13} /></button>
                    <button type="button" onClick={() => update('images', draft.images.filter((_, x) => x !== i))} className="p-1.5 text-saif-dim hover:text-saif-accent" aria-label="Remove image"><X size={13} /></button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="Paste image URL…" className="input text-xs flex-1" />
                  <button
                    type="button"
                    onClick={() => {
                      const u = imageUrl.trim()
                      if (!u) return
                      if (!/^https?:\/\//.test(u)) { addToast('Enter a valid http(s) image URL', 'error'); return }
                      update('images', [...draft.images, u])
                      setImageUrl('')
                    }}
                    className="btn text-[10px] px-4"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Variants */}
            {draft.product_type === 'physical' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="label mb-0">Variants (size / color / stock)</p>
                  <button
                    type="button"
                    onClick={() => update('variants', [...draft.variants, { name: '', sku: '', price: '', stock: '0', size: '', color: '' }])}
                    className="text-xs text-saif-accent hover:underline"
                  >
                    + Add variant
                  </button>
                </div>
                {draft.variants.length === 0 ? (
                  <p className="text-xs text-saif-dim">No variants — the base stock applies.</p>
                ) : (
                  <div className="space-y-2">
                    {draft.variants.map((v, i) => (
                      <div key={i} className="grid grid-cols-2 sm:grid-cols-[1fr_70px_70px_80px_70px_32px] gap-2 items-center border border-saif-border p-2">
                        <input value={v.size} onChange={e => changeVariant(i, 'size', e.target.value)} placeholder="Size (M)" className="input text-xs px-2 py-1.5" />
                        <input value={v.color} onChange={e => changeVariant(i, 'color', e.target.value)} placeholder="Color" className="input text-xs px-2 py-1.5" />
                        <input value={v.stock} onChange={e => changeVariant(i, 'stock', e.target.value)} placeholder="Stock" type="number" className="input text-xs px-2 py-1.5" />
                        <input value={v.price} onChange={e => changeVariant(i, 'price', e.target.value)} placeholder="+Price" type="number" step="0.01" className="input text-xs px-2 py-1.5" />
                        <input value={v.sku} onChange={e => changeVariant(i, 'sku', e.target.value)} placeholder="SKU" className="input text-xs px-2 py-1.5" />
                        <button type="button" onClick={() => update('variants', draft.variants.filter((_, x) => x !== i))} className="p-1.5 text-saif-dim hover:text-saif-accent" aria-label="Remove variant"><X size={13} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-2 border-t border-saif-border">
              <button onClick={handleSave} disabled={saving} className="btn btn-primary flex-1 text-xs">
                {saving ? 'Saving…' : draft.id ? 'Save Changes' : 'Create Product'}
              </button>
              <button onClick={() => setDraft(null)} className="btn flex-1 text-xs">Cancel</button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Delete this product?"
        message={`“${deleting?.name}” and its variants will be permanently removed. Orders that reference it keep their snapshots.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )

  function moveImage(index: number, dir: -1 | 1) {
    if (!draft) return
    const next = [...draft.images]
    const [img] = next.splice(index, 1)
    next.splice(index + dir, 0, img)
    update('images', next)
  }

  function changeVariant(index: number, key: keyof VariantDraft, value: string) {
    if (!draft) return
    update('variants', draft.variants.map((v, i) => (i === index ? { ...v, [key]: value } : v)))
  }
}

function IconBtn({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`p-2 border border-saif-border transition-colors ${danger ? 'text-saif-dim hover:text-saif-accent hover:border-saif-accent/50' : 'text-saif-dim hover:text-saif-text hover:border-saif-text/50'}`}
    >
      {children}
    </button>
  )
}
