// Marca d'água: a transparência é escolhida pelo usuário (padrão 75%) e fica
// entre 50% e 95% — nunca forte a ponto de atrapalhar a leitura, nem tão
// fraca que suma na impressão. Fica fora de pdf/ para a tela não carregar o
// react-pdf só por causa destes números.
export const WATERMARK_TRANSPARENCY = { min: 50, max: 95, step: 5, default: 75 }

/** Transparência em % → opacidade (0–1) usada no PDF e na prévia. */
export function watermarkOpacity(transparency?: number): number {
  const t = Number.isFinite(transparency) ? (transparency as number) : WATERMARK_TRANSPARENCY.default
  const clamped = Math.min(WATERMARK_TRANSPARENCY.max, Math.max(WATERMARK_TRANSPARENCY.min, t))
  return Math.round((1 - clamped / 100) * 1000) / 1000
}
