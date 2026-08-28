/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        saif: {
          bg: '#000000',
          text: '#F5F0E8',                 // cream — 18.5:1 on black
          dim: '#9C9C9C',                  // secondary text — 7.6:1 on black
          faint: '#787878',                // tertiary/metadata text — 4.75:1 on black (AA)
          accent: '#E63946',
          accentDark: '#C1121F',
          surface: '#0A0A0A',
          panel: '#0D0D0D',                // elevated panels (replaces raw #111)
          border: 'rgba(245, 240, 232, 0.08)',
          borderStrong: 'rgba(245, 240, 232, 0.16)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
      },
      letterSpacing: {
        tighter: '-0.04em',
        tight: '-0.02em',
        widest2: '0.25em',
      },
      maxWidth: {
        editorial: '72rem',
      },
      transitionTimingFunction: {
        'saif': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        heartPop: {
          '0%': { transform: 'scale(1)' },
          '40%': { transform: 'scale(1.45)' },
          '100%': { transform: 'scale(1)' },
        },
        scrollPulse: {
          '0%': { transform: 'scaleY(0)', transformOrigin: 'top' },
          '45%': { transform: 'scaleY(1)', transformOrigin: 'top' },
          '55%': { transform: 'scaleY(1)', transformOrigin: 'bottom' },
          '100%': { transform: 'scaleY(0)', transformOrigin: 'bottom' },
        },
      },
      animation: {
        'heart-pop': 'heartPop 420ms cubic-bezier(0.16, 1, 0.3, 1)',
        'scroll-pulse': 'scrollPulse 2.2s cubic-bezier(0.16, 1, 0.3, 1) infinite',
      },
    },
  },
  plugins: [],
}
