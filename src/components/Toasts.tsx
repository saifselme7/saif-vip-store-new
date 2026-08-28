import { CheckCircle, XCircle, Info, X } from 'lucide-react'
import { useToast } from '@/context/ToastContext'

export default function Toasts() {
  const { toasts, removeToast } = useToast()

  return (
    <div
      className="fixed bottom-6 right-6 z-[300] flex flex-col gap-3 max-w-[calc(100vw-3rem)]"
      role="status"
      aria-live="polite"
    >
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 px-5 py-3.5 min-w-[280px] max-w-md animate-[toastIn_0.4s_ease] shadow-2xl rounded-sm ${
            toast.type === 'error'
              ? 'bg-saif-accent text-white'
              : toast.type === 'info'
                ? 'bg-neutral-800 text-saif-text'
                : 'bg-saif-text text-black'
          }`}
        >
          {toast.type === 'error' ? <XCircle size={18} /> : toast.type === 'info' ? <Info size={18} /> : <CheckCircle size={18} />}
          <span className="text-sm font-medium flex-1">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="opacity-60 hover:opacity-100"
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
