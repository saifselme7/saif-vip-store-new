import { useState, type ReactNode } from 'react'
import Modal from './Modal'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  message: ReactNode
  confirmLabel?: string
  danger?: boolean
  requireText?: string
  busy?: boolean
}

/**
 * Confirmation dialog for destructive / irreversible actions.
 * `requireText` forces the operator to type the given text
 * (used for the most sensitive actions).
 */
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  requireText,
  busy = false,
}: ConfirmDialogProps) {
  const [text, setText] = useState('')
  const canConfirm = !requireText || text.trim().toUpperCase() === requireText.toUpperCase()

  return (
    <Modal open={open} onClose={busy ? () => undefined : onClose} title={title}>
      <div className="space-y-5">
        <div className="text-sm text-saif-dim leading-relaxed">{message}</div>
        {requireText && (
          <div>
            <label className="label" htmlFor="confirm-text">
              Type <span className="text-saif-text font-mono">{requireText}</span> to confirm
            </label>
            <input
              id="confirm-text"
              className="input font-mono"
              value={text}
              onChange={e => setText(e.target.value)}
              autoComplete="off"
              disabled={busy}
            />
          </div>
        )}
        <div className="flex gap-3 justify-end">
          <button className="btn btn-sm" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className={`btn btn-sm ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => onConfirm()}
            disabled={!canConfirm || busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
