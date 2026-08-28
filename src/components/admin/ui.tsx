import type { LucideIcon } from 'lucide-react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'
import { useI18n } from '@/i18n'

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-saif-text">{title}</h1>
        {description && <p className="text-sm text-saif-dim mt-1.5">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  )
}

export function StatCard({
  label,
  value,
  icon: Icon,
  alert,
  hint,
}: {
  label: string
  value: string | number
  icon?: LucideIcon
  alert?: boolean
  hint?: string
}) {
  return (
    <div className={cn('card p-4 lg:p-5', alert && 'border-yellow-500/40')}>
      <div className="flex items-start justify-between gap-2 mb-3">
        {Icon && <Icon size={17} className={alert ? 'text-yellow-400' : 'text-saif-dim'} />}
        {hint && <span className="text-[10px] text-saif-faint uppercase tracking-wider">{hint}</span>}
      </div>
      <p className={cn('text-xl lg:text-2xl font-bold tabular-nums', alert ? 'text-yellow-400' : 'text-saif-text')}>
        {value}
      </p>
      <p className="text-[10px] lg:text-[11px] text-saif-dim uppercase tracking-wider mt-1">{label}</p>
    </div>
  )
}

const { t: _t } = { t: undefined as never }
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  className,
  label,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  label?: string
}) {
  const { t } = useI18n()
  const id = `search-${placeholder.replace(/\W/g, '')}`
  return (
    <div className={cn('relative', className)}>
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-saif-dim" />
      <label htmlFor={id} className="sr-only">
        {label || placeholder}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="input pl-9 py-2.5 text-xs"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-saif-dim hover:text-saif-text text-xs"
          aria-label={t('a11y.clearSearch')}
        >
          ✕
        </button>
      )}
    </div>
  )
}

export function FilterTabs({
  options,
  value,
  onChange,
  ariaLabel = 'Filter',
}: {
  options: { value: string; label: string; count?: number }[]
  value: string
  onChange: (v: string) => void
  ariaLabel?: string
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" role="group" aria-label={ariaLabel}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={cn(
            'px-3 py-1.5 text-xs whitespace-nowrap border rounded-full transition-colors flex items-center gap-1.5',
            value === opt.value
              ? 'border-saif-text bg-saif-text text-black font-semibold'
              : 'border-saif-border text-saif-dim hover:text-saif-text hover:border-saif-dim',
          )}
        >
          {opt.label}
          {opt.count !== undefined && (
            <span className={cn('tabular-nums', value === opt.value ? 'text-black/60' : 'text-saif-faint')}>
              {opt.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

export interface Cell {
  label: string
  content: ReactNode
  className?: string
  /** Hide this cell on mobile cards (e.g. redundant info). */
  hideOnMobile?: boolean
  /** Give the cell primary prominence on mobile. */
  primary?: boolean
}

/**
 * Responsive data collection: renders a real table on desktop and stacked
 * cards on mobile — from a single cell spec. No horizontal overflow.
 */
export function DataList({
  columns,
  rows,
  empty,
}: {
  columns: string[]
  rows: Cell[][]
  empty?: boolean
}) {
  if (empty || rows.length === 0) {
    return (
      <div className="border border-saif-border rounded-sm py-16 text-center">
        <p className="text-sm text-saif-dim">Nothing to show.</p>
      </div>
    )
  }

  return (
    <div className="border border-saif-border rounded-sm overflow-hidden">
      {/* Desktop: table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-saif-border text-left bg-white/[0.02]">
              {columns.map(col => (
                <th key={col} className="p-3.5 text-[11px] uppercase tracking-wider text-saif-dim font-semibold whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((cells, i) => (
              <tr key={i} className="border-b border-saif-border last:border-0 hover:bg-white/[0.03] transition-colors">
                {cells.map((cell, j) => (
                  <td key={j} className={cn('p-3.5 align-middle', cell.className)}>
                    {cell.content}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards */}
      <div className="md:hidden divide-y divide-saif-border">
        {rows.map((cells, i) => (
          <div key={i} className="p-4 space-y-2.5">
            {cells
              .filter(c => !c.hideOnMobile)
              .map((cell, j) => (
                <div key={j} className={cn('flex justify-between items-start gap-3 text-sm', cell.primary && 'pb-2 border-b border-saif-border/50')}>
                  <span className="text-[10px] uppercase tracking-wider text-saif-faint pt-0.5 flex-shrink-0">
                    {cell.label}
                  </span>
                  <span className={cn('text-right min-w-0', cell.primary && 'font-semibold text-saif-text')}>
                    {cell.content}
                  </span>
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function EmptyPanel({ title, description }: { title: string; description?: string }) {
  return (
    <div className="border border-saif-border rounded-sm py-16 text-center">
      <p className="text-sm font-semibold text-saif-text mb-1">{title}</p>
      {description && <p className="text-sm text-saif-dim">{description}</p>}
    </div>
  )
}
