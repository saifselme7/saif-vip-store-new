import { useEffect, useState } from 'react'

const INTRO_SEEN_KEY = 'saif-intro-seen'

/**
 * Minimal fashion-brand intro for the homepage's first load of a session:
 * the wordmark settles, a red rule draws, then the curtain lifts while the
 * hero's masked-line reveal is still in motion — a handoff, never a dead
 * screen. Content renders underneath the whole time (zero layout shift),
 * it shows once per session, and it is skipped entirely for
 * prefers-reduced-motion users.
 */
export default function FashionIntro() {
  const [phase, setPhase] = useState<'check' | 'playing' | 'done'>('check')

  useEffect(() => {
    let seen = true
    try {
      seen = sessionStorage.getItem(INTRO_SEEN_KEY) === '1'
    } catch {
      seen = true // storage unavailable — don't trap the visitor
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (seen || reduced) {
      setPhase('done')
      return
    }
    try {
      sessionStorage.setItem(INTRO_SEEN_KEY, '1')
    } catch {
      /* best effort */
    }
    setPhase('playing')
  }, [])

  if (phase !== 'playing') return null

  return (
    <div
      className="fixed inset-0 z-[300] bg-black flex flex-col items-center justify-center gap-5 pointer-events-none intro-curtain"
      aria-hidden="true"
      onAnimationEnd={e => {
        if (e.animationName === 'introCurtain') setPhase('done')
      }}
    >
      <span className="intro-wordmark text-saif-text text-xl md:text-2xl font-bold uppercase tracking-[0.22em] font-sans">
        SAIF STORE
      </span>
      <span className="block w-10 h-[2px] bg-saif-accent origin-center scale-x-0 animate-[introRule_0.6s_cubic-bezier(0.16,1,0.3,1)_0.25s_forwards]" />
    </div>
  )
}
