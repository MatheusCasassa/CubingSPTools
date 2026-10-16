// Logo preto e branco: o PNG gerado precisa ser cinza + alfa (tipo de cor 4),
// com a luminância certa e a transparência preservada.
import assert from 'node:assert/strict'
import { unzlibSync } from 'fflate'
import { luminance, rgbaToGrayPng } from '../src/tools/scorecomps/model/grayPng'

// 2×1: vermelho opaco e azul semitransparente
const png = rgbaToGrayPng(new Uint8Array([220, 40, 40, 255, 30, 90, 220, 128]), 2, 1)
assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const dv = new DataView(png.buffer, png.byteOffset)
assert.equal(dv.getUint32(16), 2) // largura
assert.equal(dv.getUint32(20), 1) // altura
assert.equal(png[24], 8) // bits
assert.equal(png[25], 4) // cinza + alfa
const idatLen = dv.getUint32(33)
const raw = unzlibSync(png.subarray(41, 41 + idatLen))
assert.deepEqual([...raw], [0, luminance(220, 40, 40), 255, luminance(30, 90, 220), 128])
assert.equal(luminance(255, 255, 255), 255)
assert.equal(luminance(0, 0, 0), 0)
console.log('✓ logo preto e branco (PNG cinza + alfa)')
