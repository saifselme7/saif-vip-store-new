import { cn } from '@/lib/utils'
import type { ProductVariant } from '@/types'

interface Props {
  variants: ProductVariant[]
  sizes: string[]
  colors: string[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  className?: string
}

/**
 * Two-dimensional variant picker (size × color) that only allows
 * valid in-stock combinations.
 */
export default function VariantSelector({ variants, sizes, colors, selectedId, onSelect, className }: Props) {
  const selected = variants.find(v => v.id === selectedId) ?? null

  function stockFor(size: string | null, color: string | null) {
    return variants
      .filter(v => (size ? v.size === size : true) && (color ? v.color === color : true))
      .reduce((sum, v) => sum + (v.stock ?? 0), 0)
  }

  const availableSizes = sizes.filter(s => stockFor(s, selected?.color ?? null) > 0)
  const availableColors = colors.filter(c => stockFor(selected?.size ?? null, c) > 0)

  function pick(size: string | null, color: string | null) {
    const match = variants.find(v => v.size === size && v.color === color)
    if (match && match.stock > 0) {
      onSelect(match.id)
      return
    }
    // Try to find any in-stock variant matching one dimension
    const fallback = variants.find(
      v => v.stock > 0 && ((v.size === size && v.color === color) || v.size === size || v.color === color),
    )
    if (fallback) onSelect(fallback.id)
    else onSelect(null)
  }

  const showSizes = sizes.length > 0
  const showColors = colors.length > 0
  const singleDimension = variants.length > 0 && (showSizes !== showColors)

  if (singleDimension) {
    const options = showSizes ? sizes : colors
    return (
      <div className={cn('space-y-3', className)}>
        <span className="label mb-0">{showSizes ? 'Size' : 'Color'}</span>
        <div className="flex flex-wrap gap-2" role="group" aria-label={showSizes ? 'Size' : 'Color'}>
          {options.map(option => {
            const variant = variants.find(v => (showSizes ? v.size === option : v.color === option))!
            const isSelected = selected?.[showSizes ? 'size' : 'color'] === option
            const disabled = variant.stock <= 0
            return (
              <button
                key={option}
                type="button"
                onClick={() => pick(showSizes ? option : null, showColors ? null : option)}
                disabled={disabled}
                aria-pressed={isSelected}
                className={cn(
                  'min-h-[44px] px-4 text-sm font-medium border transition-all rounded-sm',
                  isSelected
                    ? 'border-saif-text bg-saif-text text-black'
                    : 'border-saif-border text-saif-text hover:border-saif-text',
                  disabled && 'opacity-30 line-through pointer-events-none',
                )}
              >
                {option}
              </button>
            )
          })}
        </div>
        {selected && selected.stock > 0 && selected.stock <= 5 && (
          <p className="text-xs text-yellow-400">Only {selected.stock} left</p>
        )}
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {showSizes && (
        <div>
          <span className="label mb-0">
            Size {selected?.size ? <span className="text-saif-text">· {selected.size}</span> : null}
          </span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Size">
            {sizes.map(size => {
              const disabled = !availableSizes.includes(size)
              const isSelected = selected?.size === size
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => pick(size, selected?.color ?? null)}
                  disabled={disabled}
                  aria-pressed={isSelected}
                  className={cn(
                    'min-w-[44px] min-h-[44px] px-3.5 text-sm font-medium border transition-all rounded-sm',
                    isSelected
                      ? 'border-saif-text bg-saif-text text-black'
                      : 'border-saif-border text-saif-text hover:border-saif-text',
                    disabled && 'opacity-30 line-through pointer-events-none',
                  )}
                >
                  {size}
                </button>
              )
            })}
          </div>
        </div>
      )}
      {showColors && (
        <div>
          <span className="label mb-0">
            Color {selected?.color ? <span className="text-saif-text">· {selected.color}</span> : null}
          </span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Color">
            {colors.map(color => {
              const disabled = !availableColors.includes(color)
              const isSelected = selected?.color === color
              return (
                <button
                  key={color}
                  type="button"
                  onClick={() => pick(selected?.size ?? null, color)}
                  disabled={disabled}
                  aria-pressed={isSelected}
                  className={cn(
                    'min-h-[44px] px-4 text-sm font-medium border transition-all rounded-sm',
                    isSelected
                      ? 'border-saif-text bg-saif-text text-black'
                      : 'border-saif-border text-saif-text hover:border-saif-text',
                    disabled && 'opacity-30 line-through pointer-events-none',
                  )}
                >
                  {color}
                </button>
              )
            })}
          </div>
        </div>
      )}
      {selected && selected.stock > 0 && selected.stock <= 5 && (
        <p className="text-xs text-yellow-400">Only {selected.stock} left</p>
      )}
      {!selected && (
        <p className="text-xs text-saif-dim">Select size and color to see availability</p>
      )}
    </div>
  )
}
