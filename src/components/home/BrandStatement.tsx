import Reveal from '@/components/motion/Reveal'

const FACTS = [
  {
    title: 'Physical drops',
    text: 'Heavyweight fabrics, careful printing — built to outlast trends.',
  },
  {
    title: 'Digital essentials',
    text: 'Boosts and digital goods, delivered after your payment is verified.',
  },
  {
    title: 'Verified by humans',
    text: 'Every InstaPay / Vodafone Cash transfer is checked by our team.',
  },
]

/**
 * Brand statement — the editorial pause after the hero. Serif italic accent
 * type against the grotesque wordmark is part of the signature language.
 */
export default function BrandStatement() {
  return (
    <section className="relative px-5 lg:px-10 py-24 md:py-36" aria-labelledby="brand-statement">
      <div className="max-w-4xl mx-auto text-center">
        <Reveal variant="fade" duration={700}>
          <p className="eyebrow justify-center mb-8">
            <span className="text-saif-accent tabular-nums">01</span>
            <span className="w-3 h-px bg-saif-border" aria-hidden="true" />
            The Brand
          </p>
        </Reveal>

        <Reveal variant="up" duration={900}>
          <h2 id="brand-statement" className="text-[clamp(34px,6vw,76px)] leading-[1.04] tracking-tight text-balance">
            <span className="font-display italic font-normal text-saif-text">Made to be worn.</span>{' '}
            <span className="font-black text-saif-text">Or judged.</span>{' '}
            <span className="font-display italic font-normal text-saif-accent">Or both.</span>
          </h2>
        </Reveal>

        <Reveal variant="fade" delay={220} duration={1000}>
          <p className="mt-8 text-sm md:text-[15px] text-saif-dim leading-relaxed max-w-xl mx-auto text-balance">
            SAIF STORE curates premium streetwear alongside digital culture essentials — one standard for
            both worlds: real quality, honest information, and payments verified by people, not promises.
          </p>
        </Reveal>

        <div className="mt-16 md:mt-20 grid grid-cols-1 sm:grid-cols-3 gap-px bg-saif-border border border-saif-border rounded-sm overflow-hidden text-left">
          {FACTS.map((fact, i) => (
            <Reveal
              key={fact.title}
              variant="fade"
              delay={i * 140}
              duration={900}
              className="bg-black p-6 md:p-8 group hover:bg-saif-surface transition-colors duration-500"
            >
              <span className="block w-7 h-0.5 bg-saif-accent mb-5 transition-all duration-500 group-hover:w-12" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-saif-text uppercase tracking-wider">{fact.title}</h3>
              <p className="mt-2.5 text-sm text-saif-dim leading-relaxed">{fact.text}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
