// Logo da competição: qualquer imagem (PNG, JPG, SVG, WebP…) é redesenhada num
// canvas e convertida em PNG (o react-pdf só aceita PNG/JPEG), reduzida para no
// máximo 600 px. Fica lembrada neste navegador, por competição.
import { useRef, useState } from 'react'
import { IconImage } from '../../../components/ui/icons'
import type { Logo } from '../pdf/ScorecardDocument'

const MAX_SIDE = 600
const key = (compId: string) => `scorecomps.logo.${compId}`

export function loadLogo(compId: string): Logo | null {
  try {
    const v = JSON.parse(localStorage.getItem(key(compId)) || 'null')
    return v && typeof v.src === 'string' && v.aspect > 0 ? v : null
  } catch {
    return null
  }
}

export function saveLogo(compId: string, logo: Logo | null): void {
  try {
    if (logo) localStorage.setItem(key(compId), JSON.stringify(logo))
    else localStorage.removeItem(key(compId))
  } catch {
    /* sem espaço/armazenamento: a logo vale só nesta sessão */
  }
}

function fileToPng(file: File): Promise<Logo> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const w = img.naturalWidth || 512
      const h = img.naturalHeight || 512
      const k = Math.min(1, MAX_SIDE / Math.max(w, h))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(w * k))
      canvas.height = Math.max(1, Math.round(h * k))
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Canvas indisponível'))
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve({ src: canvas.toDataURL('image/png'), aspect: canvas.width / canvas.height })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Não foi possível ler esta imagem.'))
    }
    img.src = url
  })
}

export function LogoPicker({ logo, onChange }: { logo: Logo | null; onChange: (l: Logo | null) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  return (
    <div>
      <span className="label">Logo da competição</span>
      <div className="flex items-center gap-3">
        <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-border-subtle bg-white">
          {logo ? (
            <img src={logo.src} alt="Logo da competição" className="max-h-12 max-w-12 object-contain" />
          ) : (
            <IconImage className="h-5 w-5 text-neutral-400" />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost btn-sm" onClick={() => input.current?.click()}>
            {logo ? 'Trocar' : 'Adicionar'}
          </button>
          {logo && (
            <button type="button" className="btn-ghost btn-sm" onClick={() => onChange(null)}>
              Remover
            </button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            setError(null)
            try {
              onChange(await fileToPng(f))
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err))
            }
          }}
        />
      </div>
      <p className="mt-1.5 text-xs text-fg-faint">Aparece pequena à esquerda do nome da competição.</p>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}
