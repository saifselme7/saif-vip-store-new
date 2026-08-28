import { Link } from 'react-router-dom'
import { ArrowRight, Zap } from 'lucide-react'
import Reveal, { RevealLine } from '@/components/motion/Reveal'
import { useParallax } from '@/hooks/useParallax'

interface HeroSectionProps {
  heroTitle: string
  heroSubtitle: string
  /** Ambient campaign image (first featured/best product). Optional. */
  heroImage?: string | null
}

/**
 * Cinematic opening scene: ambient product imagery under a heavy black
 * gradient, editorial line-mask wordmark, staggered entrance, parallax depth.
 * The essential brand messaging and CTAs are preserved.
 */
export default function HeroSection({ heroTitle, heroSubtitle, heroImage }: HeroSectionProps) {
  const parallaxRef = useParallax<HTMLDivElement>(90)
  const glowRef = useParallax<HTMLDivElement>(-50)

  const words = (heroTitle || 'SAIF STORE').trim().split(/\s+/)
  const line1 = words[0] ?? 'SAIF'
  const line2 = words.slice(1).join(' ') || 'STORE'

  return (
    <section
      className="relative min-h-[100svh] flex flex-col justify-center overflow-hidden grain"
      aria-label="SAIF STORE — premium streetwear and digital products"
    >
      {/* Ambient campaign image — heavily masked, slow parallax */}
      {heroImage && (
        <div className="absolute inset-0" aria-hidden="true">
          <div ref={parallaxRef} className="parallax absolute -inset-y-[12%] inset-x-0">
            <img
              src={heroImage}
              alt=""
              className="w-full h-full object-cover opacity-[0.2] scale-[1.04]"
              loading="eager"
              decoding="async"
            />
          </div>
          {/* Legibility gradients */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/45 to-black" />
          <div className="absolute inset-0 [background:radial-gradient(70%_60%_at_50%_45%,transparent_0%,rgba(0,0,0,0.75)_100%)]" />
        </div>
      )}

      {/* Red ambient accents */}
      <div ref={glowRef} className="parallax absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute -top-40 -left-40 w-[34rem] h-[34rem] bg-saif-accent/[0.07] rounded-full blur-[130px]" />
        <div className="absolute bottom-0 -right-40 w-[34rem] h-[34rem] bg-saif-accent/[0.05] rounded-full blur-[130px]" />
      </div>

      {/* Composition */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-5 lg:px-10 pt-32 pb-28 md:pt-36 md:pb-32">
        <Reveal variant="fade" duration={900}>
          <p className="eyebrow justify-center text-center">
            Streetwear
            <span className="w-1.5 h-1.5 rotate-45 bg-saif-accent flex-shrink-0" aria-hidden="true" />
            Digital
            <span className="w-1.5 h-1.5 rotate-45 bg-saif-accent flex-shrink-0" aria-hidden="true" />
            Curated
          </p>
        </Reveal>

        <h1 className="mt-8 text-center text-saif-text font-black tracking-tighter leading-[0.84] text-[clamp(72px,17vw,200px)]">
          <RevealLine delay={120}>{line1}</RevealLine>
          <RevealLine delay={280}>
            {line2}
            <sup className="text-[0.14em] font-normal align-super ml-2 tracking-normal text-saif-dim">®</sup>
          </RevealLine>
        </h1>

        <Reveal variant="fade" delay={650} duration={1000}>
          <p className="mt-9 text-sm md:text-base text-saif-dim text-center max-w-md mx-auto leading-relaxed text-balance">
            {heroSubtitle}
          </p>
        </Reveal>

        <Reveal variant="scale" delay={800} duration={800}>
          <div className="mt-11 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link to="/products" data-magnetic className="btn btn-primary w-full sm:w-auto">
              Shop Now <ArrowRight size={14} aria-hidden="true" />
            </Link>
            <Link to="/products?type=digital" className="btn w-full sm:w-auto">
              <Zap size={14} className="text-saif-accent" aria-hidden="true" /> Digital Products
            </Link>
          </div>
        </Reveal>
      </div>

      {/* Scroll cue */}
      <div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden md:flex flex-col items-center gap-3 z-10"
        aria-hidden="true"
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.35em] text-saif-faint">Scroll</span>
        <span className="w-px h-10 bg-saif-text/60 overflow-hidden">
          <span className="block w-full h-full bg-saif-accent animate-scroll-pulse" />
        </span>
      </div>
    </section>
  )
}
