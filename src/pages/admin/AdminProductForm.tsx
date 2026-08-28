import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Upload, GripVertical, ArrowUp, ArrowDown, Star, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useCategories } from '@/hooks/useCategories'
import { useToast } from '@/context/ToastContext'
import { useApp } from '@/context/AppContext'
import { usePageMeta } from '@/hooks/usePageMeta'
import { generateSlug, cn } from '@/lib/utils'
import { validateScreenshotFile } from '@/lib/validation'
import { PRODUCT_IMAGES_BUCKET } from '@/lib/payments'
import { PageHeader } from '@/components/admin/ui'
import Loading from '@/components/Loading'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import type { Product, ProductVariant } from '@/types'

interface VariantDraft {
  id?: string
  name: string
  sku: string
  price: string
  stock: string
  size: string
  color: string
}

interface FormState {
  name: string
  slug: string
  category_id: string
  product_type: 'physical' | 'digital'
  status: 'active' | 'draft' | 'archived'
  featured: boolean
  bestseller: boolean
  price: string
  compare_at_price: string
  stock: string
  low_stock_threshold: string
  sku: string
  short_description: string
  description: string
  delivery_info: string
  tags: string
}

const EMPTY_FORM: FormState = {
  name: '',
  slug: '',
  category_id: '',
  product_type: 'physical',
  status: 'draft',
  featured: false,
  bestseller: false,
  price: '',
  compare_at_price: '',
  stock: '0',
  low_stock_threshold: '5',
  sku: '',
  short_description: '',
  description: '',
  delivery_info: '',
  tags: '',
}

export default function AdminProductForm() {
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const navigate = useNavigate()
  const { categories } = useCategories()
  const { addToast } = useToast()
  const { settings } = useApp()

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [images, setImages] = useState<string[]>([])
  const [thumbnail, setThumbnail] = useState('')
  const [specEntries, setSpecEntries] = useState<{ key: string; value: string }[]>([])
  const [variants, setVariants] = useState<VariantDraft[]>([])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [slugTouched, setSlugTouched] = useState(isEdit)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  usePageMeta({ title: isEdit ? 'Edit Product' : 'New Product' })

  useEffect(() => {
    if (!id) return
    let cancelled = false
    supabase
      .from('products')
      .select('*, variants:product_variants(*)')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        if (!data) {
          addToast('Product not found', 'error')
          navigate('/admin/products')
          return
        }
        const p = data as Product
        setForm({
          name: p.name,
          slug: p.slug,
          category_id: p.category_id || '',
          product_type: p.product_type,
          status: p.status,
          featured: p.featured,
          bestseller: p.bestseller,
          price: String(p.price),
          compare_at_price: p.compare_at_price !== null ? String(p.compare_at_price) : '',
          stock: String(p.stock),
          low_stock_threshold: String(p.low_stock_threshold),
          sku: p.sku || '',
          short_description: p.short_description || '',
          description: p.description || '',
          delivery_info: p.delivery_info || '',
          tags: (p.tags || []).join(', '),
        })
        setImages(p.images || [])
        setThumbnail(p.thumbnail || '')
        const specs = (p.specifications ?? {}) as Record<string, string>
        setSpecEntries(Object.entries(specs).map(([key, value]) => ({ key, value: String(value) })))
        setVariants(
          (p.variants || []).map(v => ({
            id: v.id,
            name: v.name,
            sku: v.sku || '',
            price: v.price !== null ? String(v.price) : '',
            stock: String(v.stock),
            size: v.size || '',
            color: v.color || '',
          })),
        )
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, addToast, navigate])

  const effectiveThumbnail = thumbnail || images[0] || ''

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => {
      const next = { ...prev, [key]: value }
      if (key === 'name' && !slugTouched) {
        next.slug = generateSlug(String(value))
      }
      return next
    })
  }

  function addImageUrl() {
    const url = imageUrl.trim()
    if (!url) return
    if (!/^https?:\/\//.test(url)) {
      addToast('Enter a full image URL (https://…)', 'error')
      return
    }
    setImages(prev => [...prev, url])
    setImageUrl('')
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const err = validateScreenshotFile(file)
    if (err) {
      addToast(err, 'error')
      e.target.value = ''
      return
    }
    setUploading(true)
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
    const path = `products/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`
    const { error } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).upload(path, file, { contentType: file.type })
    setUploading(false)
    if (error) {
      addToast(`Upload failed: ${error.message}`, 'error')
    } else {
      const { data } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path)
      setImages(prev => [...prev, data.publicUrl])
      addToast('Image uploaded')
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function moveImage(index: number, dir: -1 | 1) {
    setImages(prev => {
      const next = [...prev]
      const target = index + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function removeImage(index: number) {
    const url = images[index]
    setImages(prev => prev.filter((_, i) => i !== index))
    if (thumbnail === url) setThumbnail('')
  }

  function updateVariant(index: number, patch: Partial<VariantDraft>) {
    setVariants(prev => prev.map((v, i) => (i === index ? { ...v, ...patch } : v)))
  }

  function addVariant() {
    setVariants(prev => [...prev, { name: '', sku: '', price: '', stock: '0', size: '', color: '' }])
  }

  function removeVariant(index: number) {
    setVariants(prev => prev.filter((_, i) => i !== index))
  }

  function validate(): string | null {
    if (!form.name.trim()) return 'Product name is required'
    if (!form.slug.trim()) return 'Slug is required'
    if (form.price === '' || Number.isNaN(Number(form.price)) || Number(form.price) < 0) return 'Enter a valid price'
    if (form.compare_at_price && (Number.isNaN(Number(form.compare_at_price)) || Number(form.compare_at_price) <= Number(form.price))) {
      return 'Compare-at price must be higher than the price'
    }
    if (form.product_type === 'physical' && form.stock !== '' && Number(form.stock) < 0) return 'Stock cannot be negative'
    if (variants.some(v => !v.name.trim())) return 'Every variant needs a name'
    if (variants.some(v => v.stock !== '' && Number(v.stock) < 0)) return 'Variant stock cannot be negative'
    return null
  }

  async function handleSave(publish?: boolean) {
    const err = validate()
    if (err) {
      addToast(err, 'error')
      return
    }

    setSaving(true)
    const specs: Record<string, string> = {}
    for (const entry of specEntries) {
      if (entry.key.trim() && entry.value.trim()) specs[entry.key.trim()] = entry.value.trim()
    }

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      category_id: form.category_id || null,
      product_type: form.product_type,
      status: publish ? 'active' : form.status,
      featured: form.featured,
      bestseller: form.bestseller,
      price: Number(form.price),
      compare_at_price: form.compare_at_price ? Number(form.compare_at_price) : null,
      stock: Number(form.stock || 0),
      low_stock_threshold: Number(form.low_stock_threshold || 0),
      sku: form.sku.trim() || null,
      short_description: form.short_description.trim(),
      description: form.description.trim(),
      delivery_info: form.product_type === 'digital' ? form.delivery_info.trim() || null : null,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      specifications: specs,
      images,
      thumbnail: effectiveThumbnail || null,
    }

    try {
      let productId = id
      if (isEdit) {
        const { error } = await supabase.from('products').update(payload).eq('id', id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('products').insert(payload).select('id').single()
        if (error) throw error
        productId = (data as { id: string }).id
      }

      // Sync variants
      if (productId) {
        const existingIds = new Set(variants.map(v => v.id).filter(Boolean))
        const dbVariants = await supabase
          .from('product_variants')
          .select('id')
          .eq('product_id', productId)
        const dbIds = (dbVariants.data || []).map((v: { id: string }) => v.id)
        const toDelete = dbIds.filter(vid => !existingIds.has(vid))
        if (toDelete.length) {
          await supabase.from('product_variants').delete().in('id', toDelete)
        }
        for (const v of variants) {
          const vPayload = {
            product_id: productId,
            name: v.name.trim(),
            sku: v.sku.trim() || null,
            price: v.price ? Number(v.price) : null,
            stock: Number(v.stock || 0),
            size: v.size.trim() || null,
            color: v.color.trim() || null,
          }
          if (v.id) {
            await supabase.from('product_variants').update(vPayload).eq('id', v.id)
          } else {
            await supabase.from('product_variants').insert(vPayload)
          }
        }
      }

      addToast(isEdit ? 'Product updated' : 'Product created')
      navigate('/admin/products')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save product'
      addToast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!id) return
    setDeleting(true)
    const { error } = await supabase.from('products').delete().eq('id', id)
    setDeleting(false)
    setDeleteOpen(false)
    if (error) addToast('Failed to delete product', 'error')
    else {
      addToast('Product deleted')
      navigate('/admin/products')
    }
  }

  if (loading) {
    return <Loading />
  }

  return (
    <div className="animate-[pageIn_0.4s_ease] max-w-4xl">
      <Link to="/admin/products" className="text-xs text-saif-dim hover:text-saif-text transition-colors inline-flex items-center gap-1 mb-4">
        <ArrowLeft size={12} /> All Products
      </Link>
      <PageHeader
        title={isEdit ? `Edit: ${form.name}` : 'New Product'}
        actions={
          <>
            {isEdit && (
              <button className="btn btn-sm btn-danger" onClick={() => setDeleteOpen(true)} disabled={saving}>
                <Trash2 size={13} /> Delete
              </button>
            )}
            <button className="btn btn-sm" onClick={() => handleSave(false)} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button className="btn btn-sm btn-primary" onClick={() => handleSave(true)} disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save & Publish' : 'Create & Publish'}
            </button>
          </>
        }
      />

      <div className="space-y-8">
        {/* Basic info */}
        <section className="card p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-saif-text mb-5">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label" htmlFor="pf-name">Product Name *</label>
              <input id="pf-name" className="input" value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="pf-slug">Slug *</label>
              <input
                id="pf-slug"
                className="input font-mono text-xs"
                value={form.slug}
                onChange={e => {
                  setSlugTouched(true)
                  set('slug', e.target.value)
                }}
              />
            </div>
            <div>
              <label className="label" htmlFor="pf-sku">SKU</label>
              <input id="pf-sku" className="input font-mono text-xs" value={form.sku} onChange={e => set('sku', e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="pf-category">Category</label>
              <select id="pf-category" className="input" value={form.category_id} onChange={e => set('category_id', e.target.value)}>
                <option value="">No category</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id} className="bg-black">{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="pf-type">Product Type</label>
              <select
                id="pf-type"
                className="input"
                value={form.product_type}
                onChange={e => set('product_type', e.target.value as 'physical' | 'digital')}
              >
                <option value="physical" className="bg-black">Physical (shipped)</option>
                <option value="digital" className="bg-black">Digital (delivered online)</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="pf-status">Status</label>
              <select
                id="pf-status"
                className="input"
                value={form.status}
                onChange={e => set('status', e.target.value as FormState['status'])}
              >
                <option value="draft" className="bg-black">Draft (hidden)</option>
                <option value="active" className="bg-black">Active (visible)</option>
                <option value="archived" className="bg-black">Archived</option>
              </select>
            </div>
            <div className="flex items-end gap-6 pb-1">
              <label className="flex items-center gap-2.5 text-sm text-saif-text cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={e => set('featured', e.target.checked)}
                  className="w-4 h-4 accent-[#E63946]"
                />
                Featured
              </label>
              <label className="flex items-center gap-2.5 text-sm text-saif-text cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.bestseller}
                  onChange={e => set('bestseller', e.target.checked)}
                  className="w-4 h-4 accent-[#E63946]"
                />
                Best Seller
              </label>
            </div>
            <div className="md:col-span-2">
              <label className="label" htmlFor="pf-short">Short Description</label>
              <input
                id="pf-short"
                className="input"
                value={form.short_description}
                onChange={e => set('short_description', e.target.value)}
                placeholder="One-line summary shown on cards"
              />
            </div>
            <div className="md:col-span-2">
              <label className="label" htmlFor="pf-desc">Full Description</label>
              <textarea
                id="pf-desc"
                className="input resize-none"
                rows={5}
                value={form.description}
                onChange={e => set('description', e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className="label" htmlFor="pf-tags">Tags (comma separated)</label>
              <input
                id="pf-tags"
                className="input"
                value={form.tags}
                onChange={e => set('tags', e.target.value)}
                placeholder="tee, cotton, minimal"
              />
            </div>
          </div>
        </section>

        {/* Pricing & inventory */}
        <section className="card p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-saif-text mb-5">Pricing & Inventory</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="label" htmlFor="pf-price">Price ({settings?.currency ?? 'EGP'}) *</label>
              <input id="pf-price" type="number" step="0.01" min="0" className="input" value={form.price} onChange={e => set('price', e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="pf-compare">Compare-at Price</label>
              <input id="pf-compare" type="number" step="0.01" min="0" className="input" value={form.compare_at_price} onChange={e => set('compare_at_price', e.target.value)} placeholder="Optional — shows a sale badge" />
            </div>
            <div>
              <label className="label" htmlFor="pf-stock">Stock</label>
              <input
                id="pf-stock"
                type="number"
                min="0"
                className="input"
                value={form.stock}
                onChange={e => set('stock', e.target.value)}
                disabled={form.product_type === 'digital'}
              />
            </div>
            <div>
              <label className="label" htmlFor="pf-low">Low-stock Threshold</label>
              <input id="pf-low" type="number" min="0" className="input" value={form.low_stock_threshold} onChange={e => set('low_stock_threshold', e.target.value)} />
            </div>
          </div>
          {form.product_type === 'digital' && (
            <div className="mt-4">
              <label className="label" htmlFor="pf-delivery">Digital Delivery Information</label>
              <textarea
                id="pf-delivery"
                className="input resize-none"
                rows={3}
                value={form.delivery_info}
                onChange={e => set('delivery_info', e.target.value)}
                placeholder="Shown to the customer after payment approval — e.g. how and when the item is delivered."
              />
              <p className="text-xs text-saif-dim mt-1.5">
                Delivery details are only revealed after the payment is approved.
              </p>
            </div>
          )}
        </section>

        {/* Images */}
        <section className="card p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-saif-text mb-5">Images</h2>
          <div className="flex flex-col sm:flex-row gap-2 mb-5">
            <input
              className="input text-xs"
              placeholder="Paste an image URL (https://…)"
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              aria-label="Image URL"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addImageUrl()
                }
              }}
            />
            <button type="button" className="btn btn-sm flex-shrink-0" onClick={addImageUrl}>
              <Plus size={13} /> Add URL
            </button>
            <button type="button" className="btn btn-sm flex-shrink-0" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <Upload size={13} /> {uploading ? 'Uploading…' : 'Upload File'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleImageUpload}
              className="sr-only"
              aria-label="Upload image file"
            />
          </div>

          {images.length === 0 ? (
            <p className="text-sm text-saif-dim py-6 text-center border border-dashed border-saif-border rounded-sm">
              No images yet. The first image is used as the primary image.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {images.map((img, i) => (
                <div key={img + i} className={cn('border rounded-sm overflow-hidden group relative', thumbnail === img ? 'border-saif-accent' : 'border-saif-border')}>
                  <div className="aspect-[3/4] bg-saif-panel">
                    <img src={img} alt={`Product image ${i + 1}`} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex items-center justify-between gap-1 p-1.5 bg-black/60">
                    <div className="flex gap-0.5">
                      <button onClick={() => moveImage(i, -1)} disabled={i === 0} className="p-1 text-saif-dim hover:text-saif-text disabled:opacity-30" aria-label="Move image up" title="Move earlier">
                        <ArrowUp size={12} />
                      </button>
                      <button onClick={() => moveImage(i, 1)} disabled={i === images.length - 1} className="p-1 text-saif-dim hover:text-saif-text disabled:opacity-30" aria-label="Move image down" title="Move later">
                        <ArrowDown size={12} />
                      </button>
                    </div>
                    <button
                      onClick={() => setThumbnail(img)}
                      className={cn('p-1', thumbnail === img ? 'text-saif-accent' : 'text-saif-dim hover:text-yellow-400')}
                      aria-label="Set as primary image"
                      title={thumbnail === img ? 'Primary image' : 'Set as primary'}
                    >
                      <Star size={12} className={thumbnail === img ? 'fill-saif-accent' : ''} />
                    </button>
                    <button onClick={() => removeImage(i)} className="p-1 text-saif-dim hover:text-saif-accent" aria-label="Remove image">
                      <X size={12} />
                    </button>
                  </div>
                  {thumbnail === img && (
                    <span className="absolute top-1.5 left-1.5 badge bg-saif-accent text-black border-saif-accent text-[8px]">Primary</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Specifications */}
        <section className="card p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-saif-text mb-5">Specifications</h2>
          {specEntries.length === 0 && (
            <p className="text-sm text-saif-dim mb-4">No specifications yet.</p>
          )}
          <div className="space-y-2 mb-4">
            {specEntries.map((entry, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="input text-xs"
                  placeholder="Label (e.g. Material)"
                  value={entry.key}
                  onChange={e => setSpecEntries(prev => prev.map((s, j) => (j === i ? { ...s, key: e.target.value } : s)))}
                  aria-label={`Specification ${i + 1} label`}
                />
                <input
                  className="input text-xs"
                  placeholder="Value (e.g. 100% cotton)"
                  value={entry.value}
                  onChange={e => setSpecEntries(prev => prev.map((s, j) => (j === i ? { ...s, value: e.target.value } : s)))}
                  aria-label={`Specification ${i + 1} value`}
                />
                <button
                  onClick={() => setSpecEntries(prev => prev.filter((_, j) => j !== i))}
                  className="p-2 text-saif-dim hover:text-saif-accent flex-shrink-0"
                  aria-label={`Remove specification ${i + 1}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <button className="btn btn-sm" onClick={() => setSpecEntries(prev => [...prev, { key: '', value: '' }])}>
            <Plus size={13} /> Add Specification
          </button>
        </section>

        {/* Variants */}
        {form.product_type === 'physical' && (
          <section className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-saif-text">Variants (Sizes / Colors)</h2>
              <button className="btn btn-sm" onClick={addVariant}>
                <Plus size={13} /> Add Variant
              </button>
            </div>
            {variants.length === 0 ? (
              <p className="text-sm text-saif-dim">
                No variants. The product is sold as a single item using the stock above. Add variants to sell specific
                sizes/colors with their own stock.
              </p>
            ) : (
              <div className="space-y-3">
                  <div className="hidden md:grid grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_0.8fr_0.9fr_auto] gap-2 text-[10px] uppercase tracking-wider text-saif-dim px-1">
                    <span>Name *</span>
                    <span>Size</span>
                    <span>Color</span>
                    <span>Price</span>
                    <span>SKU</span>
                    <span>Stock</span>
                    <span />
                  </div>
                  {variants.map((v, i) => (
                    <div key={i} className="grid grid-cols-2 md:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_0.8fr_0.9fr_auto] gap-2">
                      <input
                        className="input text-xs"
                        placeholder="e.g. Medium / Black"
                        value={v.name}
                        onChange={e => updateVariant(i, { name: e.target.value })}
                        aria-label={`Variant ${i + 1} name`}
                      />
                      <input
                        className="input text-xs"
                        placeholder="Size"
                        value={v.size}
                        onChange={e => updateVariant(i, { size: e.target.value })}
                        aria-label={`Variant ${i + 1} size`}
                      />
                      <input
                        className="input text-xs"
                        placeholder="Color"
                        value={v.color}
                        onChange={e => updateVariant(i, { color: e.target.value })}
                        aria-label={`Variant ${i + 1} color`}
                      />
                      <input
                        className="input text-xs"
                        placeholder="Price"
                        type="number"
                        step="0.01"
                        value={v.price}
                        onChange={e => updateVariant(i, { price: e.target.value })}
                        aria-label={`Variant ${i + 1} price`}
                      />
                      <input
                        className="input text-xs"
                        placeholder="SKU"
                        value={v.sku}
                        onChange={e => updateVariant(i, { sku: e.target.value })}
                        aria-label={`Variant ${i + 1} SKU`}
                      />
                      <input
                        className="input text-xs"
                        placeholder="Stock"
                        type="number"
                        value={v.stock}
                        onChange={e => updateVariant(i, { stock: e.target.value })}
                        aria-label={`Variant ${i + 1} stock`}
                      />
                      <button
                        onClick={() => removeVariant(i)}
                        className="p-2 text-saif-dim hover:text-saif-accent col-span-2 md:col-span-1 justify-self-end"
                        aria-label={`Remove variant ${i + 1}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </section>
        )}

        {/* Actions footer */}
        <div className="flex flex-col sm:flex-row gap-3 sm:justify-end pb-8">
          <button className="btn btn-sm" onClick={() => navigate('/admin/products')} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-sm" onClick={() => handleSave(false)} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button className="btn btn-sm btn-primary" onClick={() => handleSave(true)} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save & Publish' : 'Create & Publish'}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title={`Delete "${form.name}"?`}
        message="This permanently removes the product and its variants. Past orders keep their snapshot."
        confirmLabel="Delete Product"
        danger
        busy={deleting}
      />
    </div>
  )
}
