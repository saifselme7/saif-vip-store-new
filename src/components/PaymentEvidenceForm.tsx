import { useState } from 'react'
import { Copy, Upload, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useApp } from '@/context/AppContext'
import { PAYMENT_METHODS, DEFAULT_PAYMENT_NUMBER } from '@/lib/constants'
import { validatePaymentForm, type FieldErrors } from '@/lib/checkout'
import { formatPrice, copyToClipboard } from '@/lib/utils'
import { uploadPaymentScreenshot, MAX_SCREENSHOT_BYTES } from '@/lib/storage'
import type { PaymentMethod } from '@/types'
import Field from './ui/Field'

interface Props {
  orderId: string
  expectedAmount: number
  defaultMethod?: PaymentMethod | null
  onDone: () => void
}

/** Manual payment evidence submission (used at the order page when the
 * order still needs a payment or a previous one was rejected). */
export default function PaymentEvidenceForm({ orderId, expectedAmount, defaultMethod, onDone }: Props) {
  const { user } = useAuth()
  const { settings, addToast } = useApp()
  const [method, setMethod] = useState<PaymentMethod | null>(defaultMethod ?? null)
  const [payer, setPayer] = useState('')
  const [amount, setAmount] = useState(String(expectedAmount))
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [stage, setStage] = useState('')

  const currency = settings?.currency || 'EGP'
  const paymentNumber = settings?.payment_number || DEFAULT_PAYMENT_NUMBER
  const methodMeta = PAYMENT_METHODS.find(m => m.id === method)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(f.type)) {
      addToast('Screenshot must be a PNG, JPG or WEBP image', 'error')
      return
    }
    if (f.size > MAX_SCREENSHOT_BYTES) {
      addToast('Screenshot too large — maximum 5 MB', 'error')
      return
    }
    if (preview) URL.revokeObjectURL(preview)
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setErrors(p => ({ ...p, screenshot_path: undefined }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!method) {
      setErrors({ method: 'Choose a payment method.' })
      return
    }
    const errs = validatePaymentForm({
      transferred_amount: amount === '' ? '' : Number(amount),
      payer_identifier: payer,
      screenshot_path: file ? 'pending' : null,
    })
    setErrors(errs)
    if (Object.keys(errs).some(k => errs[k])) return

    setSubmitting(true)
    try {
      setStage('Uploading screenshot…')
      const upload = await uploadPaymentScreenshot(user.id, orderId, file!)
      if (!upload.ok || !upload.path) throw new Error(upload.error || 'Upload failed.')

      setStage('Submitting for review…')
      const { error } = await supabase.rpc('submit_payment', {
        p_order_id: orderId,
        p_payment_method: method,
        p_transferred_amount: Number(amount),
        p_payer_identifier: payer.trim(),
        p_screenshot_path: upload.path,
        p_customer_note: note.trim() || null,
      })
      if (error) throw new Error(error.message)
      addToast('Payment submitted — we will review it shortly.')
      onDone()
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Submission failed. Try again.', 'error')
      setSubmitting(false)
      setStage('')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-[#0A0A0A] border border-saif-accent/30 p-4 text-xs text-saif-dim leading-relaxed">
        Transfer <span className="text-saif-text font-bold">{formatPrice(expectedAmount, currency)}</span> to{' '}
        <span dir="ltr" className="text-saif-accent font-bold">{paymentNumber}</span> via your chosen method,
        then submit the receipt below. Verification is manual.
      </div>

      <div>
        <p className="label">Payment Method <span className="text-saif-accent">*</span></p>
        <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Payment method">
          {PAYMENT_METHODS.map(m => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={method === m.id}
              onClick={() => { setMethod(m.id); setErrors(p => ({ ...p, method: undefined })) }}
              className={`p-3 border text-left text-sm font-semibold transition-colors ${
                method === m.id ? 'border-saif-accent bg-saif-accent/10 text-saif-text' : 'border-saif-border text-saif-dim hover:border-saif-text'
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>
        {errors.method && <p className="text-xs text-red-400 mt-2" role="alert">{errors.method}</p>}
        {methodMeta && (
          <ul className="mt-3 space-y-1 list-disc list-inside text-xs text-saif-dim">
            {methodMeta.instructions.slice(0, 3).map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-saif-dim">
        Receiving number: <span dir="ltr" className="text-saif-text font-bold">{paymentNumber}</span>
        <button
          type="button"
          onClick={async () => {
            const ok = await copyToClipboard(paymentNumber)
            addToast(ok ? 'Number copied' : 'Could not copy', ok ? 'success' : 'error')
          }}
          className="p-1 border border-saif-border text-saif-dim hover:text-saif-text"
          aria-label="Copy payment number"
        >
          <Copy size={11} />
        </button>
      </div>

      <Field label="Amount you transferred" required error={errors.transferred_amount} htmlFor={`pe-amount-${orderId}`}>
        <input id={`pe-amount-${orderId}`} type="number" min="0" step="0.01" inputMode="decimal" className="input" value={amount} onChange={e => { setAmount(e.target.value); setErrors(p => ({ ...p, transferred_amount: undefined })) }} />
      </Field>

      <Field label="Phone/account you paid from" required error={errors.payer_identifier} htmlFor={`pe-payer-${orderId}`}>
        <input id={`pe-payer-${orderId}`} dir="ltr" className="input" value={payer} onChange={e => { setPayer(e.target.value); setErrors(p => ({ ...p, payer_identifier: undefined })) }} placeholder="01xxxxxxxxx" />
      </Field>

      <Field label="Optional note" htmlFor={`pe-note-${orderId}`}>
        <input id={`pe-note-${orderId}`} className="input" value={note} onChange={e => setNote(e.target.value)} />
      </Field>

      <div>
        <p className="label">Transfer Screenshot <span className="text-saif-accent">*</span></p>
        {preview ? (
          <div className="relative border border-saif-border inline-block">
            <img src={preview} alt="Payment screenshot preview" className="max-h-40" />
            <button
              type="button"
              onClick={() => { setFile(null); if (preview) URL.revokeObjectURL(preview); setPreview(null) }}
              className="absolute top-2 right-2 p-1.5 bg-black/80 text-saif-text hover:text-saif-accent"
              aria-label="Remove screenshot"
            >
              <X size={13} />
            </button>
          </div>
        ) : (
          <label className="flex items-center justify-center gap-2 border border-dashed border-saif-border hover:border-saif-text transition-colors cursor-pointer p-5 text-sm text-saif-dim">
            <Upload size={16} /> Choose screenshot (PNG/JPG/WEBP, max 5 MB)
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange} className="sr-only" />
          </label>
        )}
        {errors.screenshot_path && <p className="text-xs text-red-400 mt-2" role="alert">{errors.screenshot_path}</p>}
      </div>

      <button type="submit" disabled={submitting} className="btn btn-primary w-full text-xs">
        {submitting ? (stage || 'Submitting…') : 'Submit Payment for Review'}
      </button>
    </form>
  )
}
