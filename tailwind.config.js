/** @type {import('tailwindcss').Config} */
// Identidade visual da CubingSP (mesmos tokens do site principal).
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Mesma escala do site da CubingSP (700 = azul exato do P da logo).
        brand: {
          DEFAULT: '#1242b6',
          300: '#a3b8f0',
          400: '#6b8ce6',
          500: '#3d6fe6',
          600: '#1f55d1',
          700: '#1242b6',
          800: '#0e3590',
          900: '#0b2a70',
        },
        // Cores exatas da logo — só na marca (logo, wordmark).
        logo: { red: '#e60000', blue: '#1242b6', black: '#0a0908' },
        ink: { 950: '#0b0c10', 900: '#101218', 800: '#161923', 700: '#1f2330', 600: '#2a2f40' },
        // Vermelho do C; o amarelo fica só para avisos (fora da marca).
        accent: { red: '#e60000', yellow: '#f5c518' },
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
        // Tomorrow: wordmark e títulos (h1/h2), como no site da CubingSP.
        display: ['Tomorrow', '"Geist Sans"', 'Geist', 'system-ui', 'sans-serif'],
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
