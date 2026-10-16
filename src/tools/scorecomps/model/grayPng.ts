// Converte uma imagem RGBA num PNG em TONS DE CINZA de verdade (tipo de cor 4:
// cinza + alfa). Assim o PDF embute a logo como DeviceGray e a impressora usa
// só a tinta preta — um PNG "cinza" em RGB ainda poderia sair misturando as
// tintas coloridas. Funciona igual no navegador e no Node (testes).
import { zlibSync } from 'fflate'

/** Luminância (Rec. 601), a mesma usada pela maioria dos "converter para P&B". */
export function luminance(r: number, g: number, b: number): number {
  return Math.round(0.299 * r + 0.587 * g + 0.114 * b)
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, data.length)
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  out.set(data, 8)
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}

/** RGBA (como o `ImageData` do canvas) → bytes de um PNG cinza + alfa. */
export function rgbaToGrayPng(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number): Uint8Array {
  // Cada linha: 1 byte de filtro (0 = nenhum) + 2 bytes (cinza, alfa) por pixel.
  const row = 1 + width * 2
  const raw = new Uint8Array(row * height)
  for (let y = 0; y < height; y++) {
    raw[y * row] = 0
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const o = y * row + 1 + x * 2
      raw[o] = luminance(rgba[i], rgba[i + 1], rgba[i + 2])
      raw[o + 1] = rgba[i + 3]
    }
  }
  const ihdr = new Uint8Array(13)
  const dv = new DataView(ihdr.buffer)
  dv.setUint32(0, width)
  dv.setUint32(4, height)
  ihdr[8] = 8 // bits por canal
  ihdr[9] = 4 // cinza + alfa
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlibSync(raw, { level: 9 })),
    chunk('IEND', new Uint8Array(0)),
  ]
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let off = 0
  for (const p of parts) {
    out.set(p, off)
    off += p.length
  }
  return out
}

export function bytesToBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
