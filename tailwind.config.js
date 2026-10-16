/** @type {import('tailwindcss').Config} */
// Identidade visual da CubingSP (mesmos tokens do site principal).
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#2b4bdb',
          300: '#8fa3f5',
          400: '#5c77ee',
          500: '#3b5bea',
          600: '#2b4bdb',
          700: '#2340b8',
          800: '#1d3391',
        },
        ink: { 950: '#0b0c10', 900: '#101218', 800: '#161923', 700: '#1f2330', 600: '#2a2f40' },
        accent: { red: '#c81e3c', yellow: '#f5c518' },
        // Tokens semânticos (CSS vars em src/styles/index.css)
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',
        fg: 'rgb(var(--fg) / <alpha-value>)',
        'fg-muted': 'rgb(var(--fg-muted) / <alpha-value>)',
        'fg-faint': 'rgb(var(--fg-faint) / <alpha-value>)',
        'border-subtle': 'rgb(var(--border) / <alpha-value>)',
        'border-strong': 'rgb(var(--border-strong) / <alpha-value>)',
        // Marca do ScoreComps
        canary: '#ffdf00',
        navy: '#14235e',
      },
      fontFamily: {
        sans: ['"Geist Sans"', 'Geist', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: { 'fade-up': 'fade-up .35s ease-out both' },
    },
  },
  plugins: [],
}
