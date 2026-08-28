import Footer from '@/components/Footer'
import { usePageMeta } from '@/hooks/usePageMeta'

export default function AboutPage() {
  usePageMeta({ title: 'About', description: 'The story behind SAIF STORE — premium streetwear and digital products.' })
  return (
    <div className="animate-[pageIn_0.6s_ease] pt-24 md:pt-28 px-5 lg:px-10 pb-20">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-[clamp(36px,6vw,72px)] font-black tracking-tighter text-saif-text mb-10">About</h1>
        <p className="text-base text-saif-dim leading-relaxed mb-6">
          SAIF STORE is a premium fashion and digital products platform. We curate the finest physical apparel alongside cutting-edge digital services.
        </p>
        <p className="text-base text-saif-dim leading-relaxed mb-6">
          Founded with a vision to blend streetwear culture with the digital economy, SAIF STORE represents the next generation of commerce.
        </p>
        <p className="text-base text-saif-dim leading-relaxed">
          Every product is carefully selected. Every experience is intentionally designed.
        </p>
      </div>
      <Footer />
    </div>
  )
}
