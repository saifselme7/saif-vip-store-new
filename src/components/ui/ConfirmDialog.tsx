import Modal from './Modal'

interface Props {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger, busy, onConfirm, onCancel }: Props) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="text-sm text-saif-dim leading-relaxed">{message}</p>
      <div className="flex gap-3 mt-6">
        <button onClick={onCancel} disabled={busy} className="btn flex-1 text-xs">Cancel</button>
        <button
          onClick={onConfirm}
          disabled={busy}
          className={`btn flex-1 text-xs ${danger ? 'btn-danger' : 'btn-primary'}`}
        >
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
