import { useRef, useState } from 'react'
import { X, ZoomIn } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'

interface Props {
  images: string[]
  alt: string
}

/** Product image gallery with thumbnails, hover zoom and a full-screen preview. */
export default function ProductGallery({ images, alt }: Props) {
  const { t } = useI18n()
  const [selected, setSelected] = useState(0)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [zoom, setZoom] = useState({ active: false, x: 50, y: 50 })
  const frameRef = useRef<HTMLDivElement>(null)

  const list = images.length ? images : ['']
  const current = list[selected] ?? ''

  function onMouseMove(e: React.MouseEvent) {
    const rect = frameRef.current?.getBoundingClientRect()
    if (!rect) return
    setZoom({
      active: true,
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    })
  }

  return (
    <div>
      <div
        ref={frameRef}
        className="relative aspect-[3/4] bg-saif-panel overflow-hidden rounded-sm cursor-zoom-in group"
        onMouseMove={onMouseMove}
        onMouseLeave={() => setZoom(z => ({ ...z, active: false }))}
        onClick={() => setPreviewOpen(true)}
        role="button"
        aria-label={t('a11y.openPreview')}
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') setPreviewOpen(true)
        }}
      >
        <img
          src={current}
          alt={alt}
          className="w-full h-full object-cover transition-transform duration-200"
          style={
            zoom.active
              ? { transform: 'scale(1.8)', transformOrigin: `${zoom.x}% ${zoom.y}%` }
              : undefined
          }
        />
        <span className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-sm text-saif-text p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <ZoomIn size={15} />
        </span>
      </div>

      {list.length > 1 && (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1" role="group" aria-label={t('a11y.productImages')}>
          {list.map((img, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className={cn(
                'w-16 h-20 overflow-hidden border-2 transition-colors flex-shrink-0 rounded-sm',
                selected === i ? 'border-saif-text' : 'border-transparent hover:border-saif-dim',
              )}
              aria-label={`${t('a11y.productImages')} ${i + 1}`}
              aria-pressed={selected === i}
            >
              <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {/* Full-screen preview */}
      {previewOpen && (
        <div
          className="fixed inset-0 z-[220] bg-black/95 flex items-center justify-center p-4 md:p-10"
          role="dialog"
          aria-modal="true"
          aria-label={t('a11y.orderPreview')}
          onClick={() => setPreviewOpen(false)}
          onKeyDown={e => {
            if (e.key === 'Escape') setPreviewOpen(false)
          }}
        >
          <button
            className="absolute top-5 right-5 text-saif-dim hover:text-saif-text p-2"
            aria-label={t('a11y.closePreview')}
          >
            <X size={24} />
          </button>
          <img
            src={current}
            alt={alt}
            className="max-w-full max-h-full object-contain"
            onClick={e => e.stopPropagation()}
          />
          {list.length > 1 && (
            <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2" onClick={e => e.stopPropagation()}>
              {list.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelected(i)}
                  className={cn('w-2.5 h-2.5 rounded-full transition-colors', selected === i ? 'bg-saif-text' : 'bg-saif-dim/40')}
                  aria-label={`${t('a11y.productImages')} ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
