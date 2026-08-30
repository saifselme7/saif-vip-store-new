/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Semantic tokens resolved from CSS variables (RGB triplets) so that
        // opacity modifiers keep working and any wrapper can flip the whole
        // palette between the black "ink" theme and the warm off-white
        // "paper" theme (see .theme-paper in index.css). The accent is a
        // fixed brand red on both surfaces.
        saif: {
          bg: 'rgb(var(--saif-bg) / <alpha-value>)',
          text: 'rgb(var(--saif-text) / <alpha-value>)',
          dim: 'rgb(var(--saif-dim) / <alpha-value>)',
          faint: 'rgb(var(--saif-faint) / <alpha-value>)',
          accent: '#E63946',
          accentDark: '#C1121F',
          surface: 'rgb(var(--saif-surface) / <alpha-value>)',
          panel: 'rgb(var(--saif-panel) / <alpha-value>)',
          border: 'rgb(var(--saif-border-rgb) / var(--saif-border-alpha, 1))',
          borderStrong: 'rgb(var(--saif-border-rgb) / var(--saif-border-strong-alpha, 1))',
          ink: '#111111',
          paper: '#F2EFE9',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Anton', 'Inter', '"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
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
        introCurtain: {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(-101%)' },
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
