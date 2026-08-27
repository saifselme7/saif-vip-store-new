import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  wide?: boolean
}

export default function Modal({ open, onClose, title, children, wide }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-default"
        onClick={onClose}
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          'relative bg-[#0A0A0A] border border-saif-border w-full max-h-[90vh] overflow-y-auto p-6 outline-none animate-[fadeUp_0.25s_ease]',
          wide ? 'max-w-3xl' : 'max-w-md',
        )}
      >
        <div className="flex items-center justify-between mb-5">
          {title && <h2 className="text-lg font-bold text-saif-text">{title}</h2>}
          <button
            onClick={onClose}
            className="text-saif-dim hover:text-saif-text transition-colors p-1 -m-1"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
