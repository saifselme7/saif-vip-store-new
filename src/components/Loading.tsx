/**
 * Minimal brand loader — a hairline rule that fills, in place of a generic
 * spinner. Used by route suspenses and data-loading states.
 */
export default function Loading() {
  return (
    <div className="flex items-center justify-center py-24" role="status" aria-label="Loading">
      <span className="block w-16 h-px bg-saif-border relative overflow-hidden">
        <span className="absolute inset-0 bg-saif-accent origin-left animate-[loadingRule_1.1s_cubic-bezier(0.16,1,0.3,1)_infinite]" />
      </span>
    </div>
  )
}
