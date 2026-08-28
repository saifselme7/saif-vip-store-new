import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  className?: string
  wide?: boolean
}

/**
 * Accessible modal: Esc to close, backdrop click, initial focus,
 * focus trapped inside while open, focus restored to the trigger on close.
 */
export default function Modal({ open, onClose, title, children, className, wide }: ModalProps) {
  const { t } = useI18n()
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    restoreFocusRef.current = document.activeElement as HTMLElement | null
    const previouslyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusables = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      )

    const t = setTimeout(() => {
      focusables()[0]?.focus()
    }, 50)

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key === 'Tab') {
        const items = focusables()
        if (items.length === 0) return
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = previouslyOverflow
      clearTimeout(t)
      restoreFocusRef.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === 'string' ? title : 'Dialog'}
    >
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className={cn(
          'relative w-full bg-black border border-saif-border max-h-[92vh] overflow-y-auto animate-scaleIn rounded-t-lg sm:rounded-sm',
          wide ? 'sm:max-w-4xl' : 'sm:max-w-lg',
          className,
        )}
      >
        {title && (
          <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-saif-border sticky top-0 bg-black z-10">
            <h2 className="text-base font-bold tracking-tight text-saif-text">{title}</h2>
            <button
              onClick={onClose}
              className="w-11 h-11 flex items-center justify-center text-saif-dim hover:text-saif-text transition-colors -mr-2"
              aria-label={t('a11y.closeDialog')}
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
