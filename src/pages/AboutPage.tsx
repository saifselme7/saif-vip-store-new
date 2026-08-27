import { usePageMeta } from '@/hooks/usePageMeta'

export default function AboutPage() {
  usePageMeta('About', 'The story behind SAIF STORE.')

  return (
    <div className="animate-[pageIn_0.5s_ease] px-6 lg:px-10 pt-14 pb-20">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl sm:text-6xl font-black tracking-tighter text-saif-text mb-10">About</h1>
        <p className="text-base text-saif-dim leading-relaxed mb-6">
          SAIF STORE is a premium streetwear and digital products platform. We curate heavyweight apparel
          alongside carefully managed digital services — one catalog, one standard of quality.
        </p>
        <p className="text-base text-saif-dim leading-relaxed mb-6">
          Founded to blend streetwear culture with the digital economy, SAIF STORE represents the next
          generation of commerce: honest products, transparent manual payment verification, and fulfillment
          handled by real people.
        </p>
        <p className="text-base text-saif-dim leading-relaxed">
          Every product is carefully selected. Every experience is intentionally designed.
        </p>
      </div>
    </div>
  )
}
