import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import Reveal, { RevealLine } from '@/components/motion/Reveal'
import { useParallax } from '@/hooks/useParallax'
import { useI18n } from '@/i18n'
import { configText, type HeroConfig } from '@/hooks/useHomepageSections'

interface HeroSectionProps {
  heroTitle: string
  heroSubtitle: string
  /** Campaign image (first featured/best product). Optional. */
  heroImage?: string | null
  config?: unknown
}

/**
 * The opening campaign: oversized editorial statement, a fully-lit campaign
 * image (never tinted or desaturated), staggered masked-line entrance and a
 * whisper of parallax depth. CTAs stay above the fold on every viewport.
 */
export default function HeroSection({ heroTitle, heroSubtitle, heroImage, config }: HeroSectionProps) {
  const { t, isRTL } = useI18n()
  const cfg = (config ?? {}) as HeroConfig
  const parallaxRef = useParallax<HTMLDivElement>(46)

  return (
    <section
      className="relative min-h-[100svh] flex flex-col overflow-hidden grain"
      aria-label="SAIF STORE — premium fashion label"
    >
      {/* Ghost outline wordmark behind the composition */}
      <span
        className="ghost-index text-outline-faint hidden xl:block text-[clamp(140px,22vw,340px)] -bottom-10 -start-6 font-display"
        aria-hidden="true"
      >
        SAIF
      </span>

      <div className="relative z-10 flex-1 w-full max-w-[100rem] mx-auto px-5 lg:px-10 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center pt-32 pb-16 md:pt-36 md:pb-20">
        {/* ---------- Copy ---------- */}
        <div className="lg:col-span-7">
          <Reveal variant="fade" duration={800}>
            <p className="eyebrow">
              {heroTitle || 'SAIF STORE'}
              <span className="w-1.5 h-1.5 rotate-45 bg-saif-accent flex-shrink-0" aria-hidden="true" />
              {t('hero.eyebrow')}
            </p>
          </Reveal>

          <h1 className="mt-6 md:mt-8 font-display text-saif-text leading-[0.92] text-[clamp(64px,12.5vw,176px)]">
            <RevealLine delay={140}>{t('hero.statement1')}</RevealLine>
            <RevealLine delay={300}>
              <span className="font-serif italic font-normal tracking-tight">{t('hero.statement2')}</span>
            </RevealLine>
          </h1>

          <Reveal variant="fade" delay={520} duration={1000}>
            <p className="mt-8 md:mt-10 text-sm md:text-[15px] text-saif-dim leading-relaxed max-w-md text-balance">
              {heroSubtitle || t('hero.subtitle')}
            </p>
          </Reveal>

          <Reveal variant="up" delay={680} duration={800}>
            <div className="mt-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
              <Link to={cfg.cta1_dest || '/products'} data-magnetic className="btn btn-primary">
                {configText(cfg, 'cta1_text', isRTL ? 'ar' : 'en') ?? t('hero.shopCollection')}
                <ArrowRight size={14} className={isRTL ? 'rotate-180' : ''} aria-hidden="true" />
              </Link>
              <Link to={cfg.cta2_dest || '/products?sort=newest'} className="btn">
                {configText(cfg, 'cta2_text', isRTL ? 'ar' : 'en') ?? t('hero.shopNew')}
              </Link>
            </div>
          </Reveal>

          {/* Trust meta line */}
          <Reveal variant="fade" delay={860} duration={1000}>
            <ul className="mt-12 md:mt-14 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] md:text-[11px] font-medium uppercase tracking-[0.22em] text-saif-faint">
              <li>{t('home.trustShippingEgypt')}</li>
              <li className="w-1 h-1 rotate-45 bg-saif-accent" aria-hidden="true" />
              <li>{t('home.trustVerified')}</li>
              <li className="w-1 h-1 rotate-45 bg-saif-accent" aria-hidden="true" />
              <li>{t('home.trustMethods')}</li>
            </ul>
          </Reveal>
        </div>

        {/* ---------- Campaign image — natural colours, never tinted ---------- */}
        <div className="lg:col-span-5">
          <Reveal variant="mask" duration={1200} className="relative">
            <div className="relative aspect-[4/3] sm:aspect-[16/10] lg:aspect-auto lg:h-[calc(100svh-13rem)] min-h-[24rem] overflow-hidden bg-saif-panel">
              {heroImage ? (
                <div ref={parallaxRef} className="parallax absolute -inset-y-[8%] inset-x-0">
                  <img
                    src={heroImage}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="eager"
                    decoding="async"
                  />
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-display text-outline text-[clamp(70px,10vw,150px)] leading-none" aria-hidden="true">
                    SAIF
                  </span>
                </div>
              )}
              {/* Campaign tag — solid chip, image itself stays untouched */}
              <span className="absolute bottom-4 start-4 inline-flex items-center gap-2 bg-black text-saif-text text-[10px] font-semibold uppercase tracking-[0.25em] px-3 py-2">
                <span className="w-1.5 h-1.5 bg-saif-accent" aria-hidden="true" />
                {t('hero.campaignMeta')}
              </span>
            </div>
          </Reveal>
        </div>
      </div>

      {/* Scroll cue */}
      <div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden md:flex flex-col items-center gap-3 z-10"
        aria-hidden="true"
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.35em] text-saif-faint">{t('hero.scroll')}</span>
        <span className="w-px h-10 bg-saif-text/60 overflow-hidden">
          <span className="block w-full h-full bg-saif-accent animate-scroll-pulse" />
        </span>
      </div>
    </section>
  )
}
