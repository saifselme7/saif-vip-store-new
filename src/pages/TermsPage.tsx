import { usePageMeta } from '@/hooks/usePageMeta'

export default function TermsPage() {
  usePageMeta('Terms', 'SAIF STORE terms of service.')

  return (
    <div className="animate-[pageIn_0.5s_ease] px-6 lg:px-10 pt-14 pb-20">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-4xl sm:text-6xl font-black tracking-tighter text-saif-text">Terms</h1>
        <p className="text-sm text-saif-dim leading-relaxed">
          By using SAIF STORE you agree to these terms. Orders are confirmed only after manual payment
          verification succeeds; until then an order remains in review. All sales are subject to availability.
        </p>
        <p className="text-sm text-saif-dim leading-relaxed">
          Digital services are fulfilled for accounts and content you own. We reserve the right to refuse
          or cancel orders that violate platform policies or applicable law, with a refund of any approved
          payment where appropriate.
        </p>
      </div>
    </div>
  )
}
