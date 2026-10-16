// Ícones em SVG inline (sem dependências, sem emoji).
type P = { className?: string }

export const IconSun = ({ className = 'h-4 w-4' }: P) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
)
export const IconMoon = ({ className = 'h-4 w-4' }: P) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
)
export const IconGrid = ({ className = 'h-5 w-5' }: P) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    {[0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={3 + c * 6.3} y={3 + r * 6.3} width="5.1" height="5.1" rx="1.1" />))}
  </svg>
)
export const IconArrowLeft = ({ className = 'h-4 w-4' }: P) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </svg>
)
export const IconArrowRight = ({ className = 'h-4 w-4' }: P) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)
export const IconExternal = ({ className = 'h-3.5 w-3.5' }: P) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </svg>
)
export const IconMenu = ({ className = 'h-5 w-5' }: P) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
)
export const IconDownload = ({ className = 'h-4 w-4' }: P) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </svg>
)
export const IconEye = ({ className = 'h-4 w-4' }: P) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)
export const IconImage = ({ className = 'h-4 w-4' }: P) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="2" />
    <path d="m21 16-5-5-9 9" />
  </svg>
)
export const IconWca = ({ className = 'h-5 w-5' }: P) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
    <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
    <path d="M9 3.5v17M15 3.5v17M3.5 9h17M3.5 15h17" />
  </svg>
)
export const IconBook = ({ className = 'h-5 w-5' }: P) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
    <path d="M19 17H6a2 2 0 0 0-2 2" />
    <path d="M8 7h7M8 10.5h7" />
  </svg>
)
export const IconGithub = ({ className = 'h-5 w-5' }: P) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-.87-.01-1.72-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.36 1.12 2.94.85.09-.66.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05a9.36 9.36 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.35 4.79-4.58 5.05.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.82 0 .27.18.6.69.49A10.26 10.26 0 0 0 22 12.25C22 6.58 17.52 2 12 2z" />
  </svg>
)
export const IconMail = ({ className = 'h-5 w-5' }: P) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3.5 6.5 8.5 6 8.5-6" />
  </svg>
)
export const IconSpinner = ({ className = 'h-4 w-4' }: P) => (
  <svg viewBox="0 0 24 24" className={`animate-spin ${className}`} fill="none" aria-hidden>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
)

/** Marca do ScoreComps: cubo amarelo canarinho sobre azul escuro. */
export function ScoreCompsMark({ className = 'h-7 w-7' }: P) {
  const cells = [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]]
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="7" fill="#14235e" />
      {cells.map(([c, r], i) => (
        <rect key={i} x={5 + c * 7.5} y={5 + r * 7.5} width="6.6" height="6.6" rx="1.4" fill="#ffdf00" />
      ))}
    </svg>
  )
}

/** Marca do CubeStaff: cubo em azul CubingSP com "pessoas" (staff). */
export function CubeStaffMark({ className = 'h-7 w-7' }: P) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="7" fill="#2b4bdb" />
      {[0, 1, 2].map((c) => (
        <g key={c} fill="#fff">
          <circle cx={9 + c * 7} cy={12} r="2.6" />
          <rect x={5.6 + c * 7} y={16} width="6.8" height="9" rx="3.2" opacity={c === 1 ? 1 : 0.7} />
        </g>
      ))}
    </svg>
  )
}
