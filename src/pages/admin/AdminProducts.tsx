import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, Copy, ExternalLink } from 'lucide-react'
import { useAdminProducts } from '@/hooks/admin/useAdminData'
import { useCategories } from '@/hooks/useCategories'
import { useToast } from '@/context/ToastContext'
import { useApp } from '@/context/AppContext'
import { formatPrice, formatDate } from '@/lib/utils'
import { PageHeader, SearchInput, FilterTabs, DataList, type Cell } from '@/components/admin/ui'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Loading from '@/components/Loading'
import { useI18n } from '@/i18n'

type StatusFilter = '' | 'active' | 'draft' | 'archived'
type SortKey = 'newest' | 'name' | 'price_asc' | 'price_desc' | 'stock_asc'

export default function AdminProducts() {
  const { t } = useI18n()
  const { products, loading, update, remove, duplicate } = useAdminProducts()
  const { categories } = useCategories()
  const { addToast } = useToast()
  const { settings } = useApp()
  const currency = settings?.currency ?? 'EGP'

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [sort, setSort] = useState<SortKey>('newest')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)

  const filtered = useMemo(() => {
    let list = [...products]
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.slug.toLowerCase().includes(q),
      )
    }
    if (statusFilter) list = list.filter(p => p.status === statusFilter)
    if (categoryFilter) list = list.filter(p => p.category_id === categoryFilter)
    switch (sort) {
      case 'name':
        list.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'price_asc':
        list.sort((a, b) => a.price - b.price)
        break
      case 'price_desc':
        list.sort((a, b) => b.price - a.price)
        break
      case 'stock_asc':
        list.sort((a, b) => a.stock - b.stock)
        break
      default:
        break
    }
    return list
  }, [products, search, statusFilter, categoryFilter, sort])

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(p => p.id)))
  }

  async function handleBulk(action: 'active' | 'draft' | 'feature' | 'unfeature' | 'delete') {
    if (selected.size === 0) return
    setBulkBusy(true)
    const ids = [...selected]
    try {
      if (action === 'delete') {
        let failed = 0
        for (const id of ids) {
          const { error } = await remove(id)
          if (error) failed++
        }
        addToast(failed ? `${failed} products could not be deleted` : `${ids.length} products deleted`, failed ? 'error' : 'success')
      } else {
        const patch =
          action === 'active'
            ? { status: 'active' as const }
            : action === 'draft'
              ? { status: 'draft' as const }
              : action === 'feature'
                ? { featured: true as const }
                : { featured: false as const }
        const { error } = await updateBulk(ids, patch)
        if (error) addToast(t('errors.saveFailed'), 'error')
        else addToast(`${ids.length} products updated`)
      }
    } finally {
      setBulkBusy(false)
      setSelected(new Set())
    }
  }

  async function updateBulk(
    ids: string[],
    patch: { status?: 'active' | 'draft' | 'archived'; featured?: boolean },
  ) {
    const { supabase } = await import('@/lib/supabase')
    const { error } = await supabase.from('products').update(patch).in('id', ids)
    return { error }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await remove(deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
    if (error) addToast(t('errors.saveFailed'), 'error')
    else addToast(t('admin.products.deleted'))
  }

  async function handleDuplicate(id: string) {
    const product = products.find(p => p.id === id)
    if (!product) return
    const { error } = await duplicate(product)
    if (error) addToast(t('errors.saveFailed'), 'error')
    else addToast(t('admin.products.duplicated'))
  }

  if (loading) {
    return (
      <div>
        <PageHeader title={t('admin.products.title')} />
        <Loading />
      </div>
    )
  }

  const rows: Cell[][] = filtered.map(p => [
    {
      label: '',
      primary: true,
      content: (
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={selected.has(p.id)}
            onChange={() => toggleSelect(p.id)}
            aria-label={`Select ${p.name}`}
            className="w-4 h-4 accent-[#E63946] flex-shrink-0"
          />
          <div className="w-10 h-12 bg-saif-panel overflow-hidden rounded-sm flex-shrink-0">
            {(p.thumbnail || p.images?.[0]) && (
              <img src={p.thumbnail || p.images[0]} alt="" className="w-full h-full object-cover" loading="lazy" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-saif-text truncate">{p.name}</p>
            <p className="text-xs text-saif-dim">
              {p.categories?.name || 'No category'}
              {p.product_type === 'digital' && <span className="text-saif-accent"> · digital</span>}
              {p.featured && <span className="text-yellow-400"> · featured</span>}
              {p.bestseller && <span className="text-saif-text"> · bestseller</span>}
            </p>
          </div>
        </div>
      ),
    },
    {
      label: 'Price',
      content: (
        <div>
          <span className="text-saif-text font-medium">{formatPrice(p.price, currency)}</span>
          {p.compare_at_price && (
            <span className="text-xs text-saif-dim line-through ml-1.5">{formatPrice(p.compare_at_price, currency)}</span>
          )}
        </div>
      ),
    },
    {
      label: 'Stock',
      content: (
        <span className={p.stock === 0 ? 'text-red-400' : p.stock <= p.low_stock_threshold ? 'text-yellow-400' : 'text-saif-dim'}>
          {p.product_type === 'digital' ? '∞' : p.stock}
          {p.variants?.length ? <span className="text-xs text-saif-dim"> ({p.variants.length} var.)</span> : ''}
        </span>
      ),
    },
    {
      label: 'Status',
      content: (
        <span
          className={`badge ${
            p.status === 'active'
              ? 'border-green-500/30 text-green-400'
              : p.status === 'draft'
                ? 'border-yellow-500/30 text-yellow-400'
                : 'border-saif-border text-saif-dim'
          }`}
        >
          {p.status}
        </span>
      ),
    },
    { label: 'Created', hideOnMobile: true, content: <span className="text-xs text-saif-dim">{formatDate(p.created_at)}</span> },
    {
      label: 'Actions',
      content: (
        <div className="flex gap-1">
          <Link
            to={`/admin/products/${p.id}/edit`}
            className="p-1.5 text-saif-dim hover:text-saif-text transition-colors"
            aria-label={`Edit ${p.name}`}
            title="Edit"
          >
            <Pencil size={14} />
          </Link>
          <button
            onClick={() => handleDuplicate(p.id)}
            className="p-1.5 text-saif-dim hover:text-saif-text transition-colors"
            aria-label={`Duplicate ${p.name}`}
            title="Duplicate"
          >
            <Copy size={14} />
          </button>
          <Link
            to={`/products/${p.slug}`}
            target="_blank"
            className="p-1.5 text-saif-dim hover:text-saif-text transition-colors"
            aria-label={`View ${p.name} in store`}
            title="View in store"
          >
            <ExternalLink size={14} />
          </Link>
          <button
            onClick={() => setDeleteTarget({ id: p.id, name: p.name })}
            className="p-1.5 text-saif-dim hover:text-saif-accent transition-colors"
            aria-label={`Delete ${p.name}`}
            title="Delete"
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
        title={t('admin.products.title')}
        description={`${products.length} products in catalog`}
        actions={
          <Link to="/admin/products/new" className="btn btn-primary btn-sm">
            <Plus size={14} /> Add Product
          </Link>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder={t('admin.products.searchPlaceholder')} className="flex-1" />
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="input py-2.5 text-xs w-full sm:w-44"
          aria-label={t('filters.category')}
        >
          <option value="">{t('admin.products.allCategories')}</option>
          {categories.map(c => (
            <option key={c.id} value={c.id} className="bg-black">
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={e => setSort(e.target.value as SortKey)}
          className="input py-2.5 text-xs w-full sm:w-44"
          aria-label={t('filters.sortBy')}
        >
          <option value="newest">{t('admin.products.sort.newest')}</option>
          <option value="name">Name A–Z</option>
          <option value="price_asc">Price low → high</option>
          <option value="price_desc">Price high → low</option>
          <option value="stock_asc">Stock low → high</option>
        </select>
      </div>

      <div className="mb-4">
        <FilterTabs
          value={statusFilter}
          onChange={v => setStatusFilter(v as StatusFilter)}
          options={[
            { value: '', label: 'All', count: products.length },
            { value: 'active', label: 'Active', count: products.filter(p => p.status === 'active').length },
            { value: 'draft', label: 'Draft', count: products.filter(p => p.status === 'draft').length },
            { value: 'archived', label: 'Archived', count: products.filter(p => p.status === 'archived').length },
          ]}
        />
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4 border border-saif-border bg-white/[0.03] p-3 rounded-sm">
          <span className="text-xs text-saif-dim text-saif-dim">{selected.size} selected</span>
          <button className="btn btn-sm" onClick={() => handleBulk('active')} disabled={bulkBusy}>
            Activate
          </button>
          <button className="btn btn-sm" onClick={() => handleBulk('draft')} disabled={bulkBusy}>
            Move to Draft
          </button>
          <button className="btn btn-sm" onClick={() => handleBulk('feature')} disabled={bulkBusy}>
            Feature
          </button>
          <button className="btn btn-sm" onClick={() => handleBulk('unfeature')} disabled={bulkBusy}>
            Unfeature
          </button>
          <button className="btn btn-sm btn-danger" onClick={() => handleBulk('delete')} disabled={bulkBusy}>
            Delete
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => setSelected(new Set())} disabled={bulkBusy}>
            Clear
          </button>
        </div>
      )}

      {filtered.length > 0 && (
        <label className="flex items-center gap-2 text-xs text-saif-dim mb-3 cursor-pointer">
          <input
            type="checkbox"
            checked={selected.size === filtered.length && filtered.length > 0}
            onChange={toggleSelectAll}
            className="w-4 h-4 accent-[#E63946]"
          />
          Select all ({filtered.length})
        </label>
      )}

      <DataList
        columns={['Product', 'Price', 'Stock', 'Status', 'Created', 'Actions']}
        rows={rows}
        empty={filtered.length === 0}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={`Delete "${deleteTarget?.name}"?`}
        message="This permanently removes the product, its variants and wishlist entries. Order history keeps its snapshot."
        confirmLabel="Delete Product"
        danger
        busy={deleting}
      />
    </div>
  )
}
