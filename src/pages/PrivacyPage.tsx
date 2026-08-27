import { usePageMeta } from '@/hooks/usePageMeta'

export default function PrivacyPage() {
  usePageMeta('Privacy', 'How SAIF STORE handles your data.')

  return (
    <div className="animate-[pageIn_0.5s_ease] px-6 lg:px-10 pt-14 pb-20">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-4xl sm:text-6xl font-black tracking-tighter text-saif-text">Privacy</h1>
        <p className="text-sm text-saif-dim leading-relaxed">
          SAIF STORE collects only the information needed to process orders: your name, contact details,
          delivery address, and the payment evidence you submit. We never sell your data.
        </p>
        <p className="text-sm text-saif-dim leading-relaxed">
          Payment screenshots are stored privately and are accessible only to you and our verification team.
          We never store bank or wallet credentials — payments happen directly between you and your
          InstaPay / Vodafone Cash account.
        </p>
        <p className="text-sm text-saif-dim leading-relaxed">
          You can request deletion of your account data by contacting support from your account email.
        </p>
      </div>
    </div>
  )
}
