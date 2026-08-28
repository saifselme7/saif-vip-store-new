import { useMemo, useState } from 'react'
import { Boxes, History, Plus, Minus, Equal } from 'lucide-react'
import { useAdminProducts } from '@/hooks/admin/useAdminData'
import { useInventoryLogs } from '@/hooks/admin/useAdminData'
import { useToast } from '@/context/ToastContext'
import { useApp } from '@/context/AppContext'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useI18n } from '@/i18n'
import { adminAdjustStock } from '@/lib/api'
import { formatPrice, formatDate, cn } from '@/lib/utils'
import { PageHeader, SearchInput, FilterTabs, DataList, type Cell } from '@/components/admin/ui'
import Modal from '@/components/ui/Modal'
import Loading from '@/components/Loading'

type Filter = '' | 'low' | 'out' | 'variants'

export default function AdminInventory() {
  const { t } = useI18n()
  const { products, loading, refetch } = useAdminProducts()
  const { settings } = useApp()
  const { addToast } = useToast()
  const currency = settings?.currency ?? 'EGP'
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('')

  const [adjustTarget, setAdjustTarget] = useState<{ productId: string; variantId: string | null; name: string; current: number } | null>(null)
  const [adjustAction, setAdjustAction] = useState<'set' | 'increase' | 'decrease'>('set')
  const [adjustValue, setAdjustValue] = useState('0')
  const [adjustNote, setAdjustNote] = useState('')
  const [adjusting, setAdjusting] = useState(false)

  const [historyTarget, setHistoryTarget] = useState<string | null>(null)
  const { logs: historyLogs, loading: historyLoading } = useInventoryLogs(historyTarget ?? undefined)
  const historyProduct = products.find(p => p.id === historyTarget)

  usePageMeta({ title: 'Admin — Inventory' })

  const filtered = useMemo(() => {
    let list = [...products]
    const q = search.trim().toLowerCase()
    if (q) list = list.filter(p => p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q))
    if (filter === 'low') list = list.filter(p => p.product_type === 'physical' && p.stock > 0 && p.stock <= p.low_stock_threshold)
    if (filter === 'out') list = list.filter(p => p.stock === 0)
    if (filter === 'variants') list = list.filter(p => (p.variants?.length ?? 0) > 0)
    return list.sort((a, b) => a.stock - b.stock)
  }, [products, search, filter])

  if (loading) {
    return (
      <div>
        <PageHeader title={t('admin.inventory.title')} />
        <Loading />
      </div>
    )
  }

  function openAdjust(productId: string, variantId: string | null, name: string, current: number) {
    setAdjustTarget({ productId, variantId, name, current })
    setAdjustAction('set')
    setAdjustValue(String(current))
    setAdjustNote('')
  }

  async function handleAdjust() {
    if (!adjustTarget) return
    const value = Number(adjustValue)
    if (Number.isNaN(value) || value < 0) {
      addToast(t('product.enterValidAmount'), 'error')
      return
    }
    setAdjusting(true)
    const { error } = await adminAdjustStock(
      adjustTarget.productId,
      adjustTarget.variantId,
      adjustAction,
      value,
      adjustNote.trim() || null,
    )
    setAdjusting(false)
    if (error) {
      addToast(error, 'error')
      return
    }
    addToast(t('admin.inventory.updated'))
    setAdjustTarget(null)
    refetch()
  }

  const rows: Cell[][] = filtered.map(p => [
    {
      label: 'Product',
      primary: true,
      content: (
        <div className="min-w-0">
          <p className="font-medium text-saif-text truncate">{p.name}</p>
          <p className="text-xs text-saif-dim">{p.sku || 'No SKU'}</p>
        </div>
      ),
    },
    {
      label: 'Price',
      hideOnMobile: true,
      content: <span className="text-saif-dim">{formatPrice(p.price, currency)}</span>,
    },
    {
      label: 'Stock',
      content: (
        <span
          className={cn(
            'font-bold tabular-nums',
            p.stock === 0 ? 'text-red-400' : p.stock <= p.low_stock_threshold ? 'text-yellow-400' : 'text-saif-text',
          )}
        >
          {p.product_type === 'digital' ? '∞' : p.stock}
          {p.product_type === 'physical' && p.stock <= p.low_stock_threshold && p.stock > 0 && (
            <span className="text-[10px] text-saif-dim ml-1">≤ {p.low_stock_threshold}</span>
          )}
        </span>
      ),
    },
    {
      label: 'Variants',
      hideOnMobile: true,
      content: p.variants?.length ? (
        <div className="flex flex-wrap gap-1">
          {p.variants.slice(0, 4).map(v => (
            <button
              key={v.id}
              onClick={() => openAdjust(p.id, v.id, `${p.name} — ${v.name}`, v.stock)}
              className={cn(
                'text-[10px] px-1.5 py-0.5 border rounded-sm hover:border-saif-text transition-colors',
                v.stock === 0 ? 'border-red-500/40 text-red-400' : 'border-saif-border text-saif-dim',
              )}
              title={`${v.name}: ${v.stock} in stock — click to adjust`}
            >
              {v.size || v.color || v.name}: {v.stock}
            </button>
          ))}
          {p.variants.length > 4 && <span className="text-[10px] text-saif-dim">+{p.variants.length - 4}</span>}
        </div>
      ) : (
        <span className="text-xs text-saif-faint">—</span>
      ),
    },
    {
      label: 'Status',
      content: (
        <span
          className={cn(
            'badge',
            p.stock === 0
              ? 'border-red-500/30 text-red-400'
              : p.stock <= p.low_stock_threshold
                ? 'border-yellow-500/30 text-yellow-400'
                : 'border-green-500/30 text-green-400',
          )}
        >
          {p.product_type === 'digital' ? 'digital' : p.stock === 0 ? 'out of stock' : p.stock <= p.low_stock_threshold ? 'low' : 'in stock'}
        </span>
      ),
    },
    {
      label: 'Actions',
      content: (
        <div className="flex gap-1">
          {p.product_type === 'physical' && (
            <button
              className="btn btn-sm"
              onClick={() => openAdjust(p.id, null, p.name, p.stock)}
            >
              <Equal size={11} /> Adjust
            </button>
          )}
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => setHistoryTarget(p.id)}
            aria-label={`Stock history for ${p.name}`}
          >
            <History size={13} />
          </button>
        </div>
      ),
    },
  ])

  return (
    <div className="animate-[pageIn_0.4s_ease]">
      <PageHeader
        title={t('admin.inventory.title')}
        description="Stock levels update automatically when orders are placed and cancelled."
      />

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder={t('admin.inventory.searchPlaceholder')} className="max-w-sm" />
      </div>

      <div className="mb-6">
        <FilterTabs
          value={filter}
          onChange={v => setFilter(v as Filter)}
          options={[
            { value: '', label: t('admin.common.all'), count: products.length },
            { value: 'low', label: t('admin.inventory.low'), count: products.filter(p => p.product_type === 'physical' && p.stock > 0 && p.stock <= p.low_stock_threshold).length },
            { value: 'out', label: t('admin.inventory.out'), count: products.filter(p => p.stock === 0).length },
            { value: 'variants', label: t('admin.inventory.hasVariants'), count: products.filter(p => (p.variants?.length ?? 0) > 0).length },
          ]}
        />
      </div>

      <DataList
        columns={['Product', 'Price', 'Stock', 'Variants', 'Status', 'Actions']}
        rows={rows}
        empty={filtered.length === 0}
      />

      {/* Adjust modal */}
      <Modal
        open={!!adjustTarget}
        onClose={() => setAdjustTarget(null)}
        title={`Adjust Stock — ${adjustTarget?.name ?? ''}`}
      >
        <div className="space-y-5">
          <p className="text-sm text-saif-dim">
            Current stock: <span className="text-saif-text font-bold">{adjustTarget?.current ?? 0}</span>
          </p>
          <div>
            <span className="label">{t('admin.inventory.action')}</span>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label={t('admin.inventory.action')}>
              {[
                { value: 'set' as const, label: 'Set to', icon: Equal },
                { value: 'increase' as const, label: 'Increase by', icon: Plus },
                { value: 'decrease' as const, label: 'Decrease by', icon: Minus },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setAdjustAction(opt.value)
                    setAdjustValue(opt.value === 'set' ? String(adjustTarget?.current ?? 0) : '1')
                  }}
                  aria-pressed={adjustAction === opt.value}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-3 border text-xs transition-colors rounded-sm',
                    adjustAction === opt.value
                      ? 'border-saif-text bg-saif-text text-black font-semibold'
                      : 'border-saif-border text-saif-dim hover:border-saif-dim',
                  )}
                >
                  <opt.icon size={14} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label" htmlFor="adj-value">
              Value
            </label>
            <input
              id="adj-value"
              type="number"
              min="0"
              className="input"
              value={adjustValue}
              onChange={e => setAdjustValue(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="adj-note">
              Note (optional, audited)
            </label>
            <input
              id="adj-note"
              className="input"
              placeholder={t('admin.inventory.notePlaceholder')}
              value={adjustNote}
              onChange={e => setAdjustNote(e.target.value)}
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button className="btn btn-sm" onClick={() => setAdjustTarget(null)} disabled={adjusting}>
              Cancel
            </button>
            <button className="btn btn-sm btn-primary" onClick={handleAdjust} disabled={adjusting}>
              {adjusting ? 'Updating…' : 'Update Stock'}
            </button>
          </div>
        </div>
      </Modal>

      {/* History modal */}
      <Modal
        open={!!historyTarget}
        onClose={() => setHistoryTarget(null)}
        title={`Stock History — ${historyProduct?.name ?? ''}`}
        wide
      >
        {historyLoading ? (
          <Loading />
        ) : historyLogs.length === 0 ? (
          <p className="text-sm text-saif-dim py-6 text-center">{t('admin.inventory.noHistory')}</p>
        ) : (
          <div className="divide-y divide-saif-border max-h-[60vh] overflow-y-auto">
            {historyLogs.map(log => (
              <div key={log.id} className="flex items-center justify-between gap-3 py-3 text-xs">
                <div className="min-w-0">
                  <p className="text-saif-text">
                    <span className={cn('font-bold', log.delta > 0 ? 'text-green-400' : log.delta < 0 ? 'text-red-400' : 'text-saif-dim')}>
                      {log.delta > 0 ? '+' : ''}
                      {log.delta}
                    </span>{' '}
                    <span className="text-saif-dim">
                      ({log.previous_value} → {log.new_value})
                    </span>
                  </p>
                  <p className="text-saif-faint mt-0.5">
                    {formatDate(log.created_at, true)} · {log.change_type}
                    {log.note ? ` · ${log.note}` : ''}
                  </p>
                </div>
                <span className="badge border-saif-border text-saif-dim flex-shrink-0">{log.change_type}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
