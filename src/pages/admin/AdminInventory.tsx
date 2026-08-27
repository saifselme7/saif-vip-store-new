import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Minus, Plus, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/context/AppContext'
import { usePageMeta } from '@/hooks/usePageMeta'
import { formatDate } from '@/lib/utils'
import Loading from '@/components/Loading'
import EmptyState from '@/components/EmptyState'
import type { Product, ProductVariant } from '@/types'

type Row = {
  key: string
  product: Product
  variant: ProductVariant | null
  stock: number
  sku: string | null
}

export default function AdminInventory() {
  const { addToast } = useApp()
  const [searchParams, setSearchParams] = useSearchParams()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [log, setLog] = useState<Array<{ id: string; change: number; stock_after: number; created_at: string; products?: { name: string } | null }>>([])
  const [busyKey, setBusyKey] = useState<string | null>(null)

  usePageMeta('Inventory', 'Stock levels and audit trail.')
  const filter = searchParams.get('filter') || ''

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('products')
      .select('*, product_variants(*)')
      .eq('product_type', 'physical')
      .order('name')
    const products = (data || []) as unknown as Product[]
    const out: Row[] = []
    for (const p of products) {
      if (p.variants && p.variants.length > 0) {
        for (const v of p.variants) {
          out.push({ key: `v-${v.id}`, product: p, variant: v, stock: v.stock, sku: v.sku })
        }
      } else {
        out.push({ key: `p-${p.id}`, product: p, variant: null, stock: p.stock, sku: p.sku })
      }
    }
    setRows(out)
    setLoading(false)

    const { data: logData } = await supabase
      .from('inventory_log')
      .select('*, products(name)')
      .order('created_at', { ascending: false })
      .limit(15)
    setLog((logData || []) as never[])
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => rows.filter(r => {
    if (filter === 'low') return r.stock > 0 && r.stock <= r.product.low_stock_threshold
    if (filter === 'out') return r.stock <= 0
    return true
  }), [rows, filter])

  async function adjust(row: Row, delta: number) {
    const next = Math.max(0, row.stock + delta)
    if (next === row.stock) return
    setBusyKey(row.key)
    const { error } = row.variant
      ? await supabase.from('product_variants').update({ stock: next }).eq('id', row.variant.id)
      : await supabase.from('products').update({ stock: next }).eq('id', row.product.id)
    setBusyKey(null)
    if (error) {
      addToast(error.message || 'Failed to update stock', 'error')
    } else {
      // Also keep the aggregate product stock in sync when a variant moves.
      if (row.variant) {
        const siblings = rows.filter(r => r.product.id === row.product.id && r.variant)
        const aggregate = siblings.reduce((s, r) => s + (r.key === row.key ? next : r.stock), 0)
        await supabase.from('products').update({ stock: aggregate }).eq('id', row.product.id)
      }
      setRows(prev => prev.map(r => (r.key === row.key ? { ...r, stock: next } : r)))
      load()
    }
  }

  return (
    <div className="animate-[pageIn_0.4s_ease]">
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-saif-text">Inventory</h1>
        <button onClick={load} className="text-xs text-saif-dim hover:text-saif-text flex items-center gap-1.5">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {[
          { id: '', label: 'All' },
          { id: 'low', label: 'Low Stock' },
          { id: 'out', label: 'Out of Stock' },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => {
              const next = new URLSearchParams(searchParams)
              if (f.id) next.set('filter', f.id); else next.delete('filter')
              setSearchParams(next, { replace: true })
            }}
            aria-pressed={filter === f.id}
            className={`px-3.5 py-2 text-xs border whitespace-nowrap transition-colors ${
              filter === f.id ? 'border-saif-text text-saif-text font-semibold' : 'border-saif-border text-saif-dim hover:text-saif-text'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? <Loading /> : filtered.length === 0 ? (
        <EmptyState title="Nothing here" description="No physical products match this filter." />
      ) : (
        <div className="border border-saif-border overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-saif-border text-left">
                {['Product', 'Variant', 'SKU', 'Status', 'Stock', 'Adjust'].map(h => (
                  <th key={h} className="p-4 text-[10px] uppercase tracking-wider text-saif-dim font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => {
                const threshold = row.product.low_stock_threshold ?? 5
                const status = row.stock <= 0 ? 'Out' : row.stock <= threshold ? 'Low' : 'OK'
                return (
                  <tr key={row.key} className="border-b border-saif-border hover:bg-white/[0.03] transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {row.product.thumbnail && <img src={row.product.thumbnail} alt="" className="w-8 h-10 object-cover bg-[#111]" loading="lazy" />}
                        <span className="text-saif-text font-medium">{row.product.name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-saif-dim">{row.variant ? row.variant.name : '—'}</td>
                    <td className="p-4 text-saif-dim text-xs">{row.sku || '—'}</td>
                    <td className="p-4">
                      <span className={`text-xs font-semibold uppercase ${status === 'Out' ? 'text-red-400' : status === 'Low' ? 'text-saif-accent' : 'text-green-400'}`}>
                        {status}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-saif-text">{row.stock}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => adjust(row, -1)}
                          disabled={busyKey === row.key || row.stock <= 0}
                          className="p-1.5 border border-saif-border text-saif-dim hover:text-saif-text disabled:opacity-30 transition-colors"
                          aria-label={`Decrease stock of ${row.product.name}`}
                        >
                          <Minus size={12} />
                        </button>
                        <button
                          onClick={() => adjust(row, 1)}
                          disabled={busyKey === row.key}
                          className="p-1.5 border border-saif-border text-saif-dim hover:text-saif-text disabled:opacity-30 transition-colors"
                          aria-label={`Increase stock of ${row.product.name}`}
                        >
                          <Plus size={12} />
                        </button>
                        <button
                          onClick={() => adjust(row, 10)}
                          disabled={busyKey === row.key}
                          className="px-2 py-1.5 border border-saif-border text-[10px] text-saif-dim hover:text-saif-text disabled:opacity-30 transition-colors"
                        >
                          +10
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Audit trail */}
      <section className="mt-8 border border-saif-border">
        <header className="p-4 border-b border-saif-border">
          <h2 className="text-xs font-bold uppercase tracking-widest text-saif-text">Recent Stock Changes</h2>
        </header>
        {log.length === 0 ? (
          <p className="p-4 text-sm text-saif-dim">No stock changes recorded yet.</p>
        ) : (
          <div className="divide-y divide-[rgba(245,240,232,0.08)]">
            {log.map(entry => (
              <div key={entry.id} className="flex items-center justify-between gap-3 p-3.5 text-sm">
                <span className="text-saif-dim truncate">{entry.products?.name || 'Product'}</span>
                <span className={`font-semibold flex-shrink-0 ${entry.change > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {entry.change > 0 ? '+' : ''}{entry.change} → {entry.stock_after}
                </span>
                <span className="text-xs text-saif-dim flex-shrink-0">{formatDate(entry.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
