import type { ReactNode } from 'react'

interface Props {
  label: string
  error?: string
  hint?: string
  required?: boolean
  children: ReactNode
  htmlFor?: string
}

/** Form field wrapper with accessible label + error message. */
export default function Field({ label, error, hint, required, children, htmlFor }: Props) {
  return (
    <div>
      <label htmlFor={htmlFor} className="label">
        {label}{required && <span className="text-saif-accent ml-0.5" aria-hidden="true">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-red-400 mt-1.5" role="alert">{error}</p>
      ) : hint ? (
        <p className="text-xs text-saif-dim mt-1.5">{hint}</p>
      ) : null}
    </div>
  )
}
