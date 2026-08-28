import { ClipboardList, Send, ShieldCheck } from 'lucide-react'
import Reveal from '@/components/motion/Reveal'
import SectionHeader from '@/components/SectionHeader'

const STEPS = [
  {
    icon: ClipboardList,
    title: 'Place your order',
    text: 'Check out with your account — your items are reserved immediately while we wait for payment.',
  },
  {
    icon: Send,
    title: 'Transfer the total',
    text: 'Send the exact amount via InstaPay or Vodafone Cash to the number shown at checkout, then upload the screenshot.',
  },
  {
    icon: ShieldCheck,
    title: 'We verify & deliver',
    text: 'Our team checks every transfer manually. Once approved, physical orders ship and digital items are delivered.',
  },
]

/**
 * Trust through transparency — the manual payment flow explained honestly,
 * matching the real verification workflow.
 */
export default function HowItWorks() {
  return (
    <section className="px-5 lg:px-10 py-24 md:py-32" aria-labelledby="how-it-works">
      <div className="max-w-7xl mx-auto">
        <SectionHeader
          index="10"
          eyebrow="How It Works"
          title="Ordered. Transferred. Verified."
          description="No card needed. A payment flow built on manual verification — slow enough to be careful, fast enough to feel instant."
          align="center"
        />

        <ol className="relative grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-6">
          {/* Connecting rule on desktop */}
          <span
            className="hidden md:block absolute top-[3.4rem] left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-saif-border to-transparent"
            aria-hidden="true"
          />
          {STEPS.map((step, i) => (
            <Reveal key={step.title} as="li" variant="up" delay={i * 160} duration={900} className="relative text-center">
              <div className="relative z-10 mx-auto w-[6.8rem] h-[6.8rem] rounded-full border border-saif-border bg-black flex items-center justify-center">
                <step.icon size={26} className="text-saif-accent" aria-hidden="true" />
                <span className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-saif-accent text-black text-xs font-bold flex items-center justify-center tabular-nums">
                  {i + 1}
                </span>
              </div>
              <h3 className="mt-6 text-base font-semibold text-saif-text">{step.title}</h3>
              <p className="mt-2.5 text-sm text-saif-dim leading-relaxed max-w-xs mx-auto text-balance">{step.text}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  )
}
