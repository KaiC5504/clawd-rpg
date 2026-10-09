import { EMPTY, ROWS } from './grid'
import type { Grid } from './grid'

export const DEFAULT_COLOR = 0x01000000
const UPPER = 0x2580
const LOWER = 0x2584
const SPACE = 0x20

// Raster words: [codePoint, fg, bg] per cell, row by row.
export function toWords(g: Grid): Uint32Array {
  const words = new Uint32Array(g.w * ROWS * 3)
  let i = 0
  const cell = (cp: number, fg: number, bg: number) => {
    words[i++] = cp
    words[i++] = fg
    words[i++] = bg
  }
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < g.w; col++) {
      const top = g.px[2 * row * g.w + col]!
      const bottom = g.px[(2 * row + 1) * g.w + col]!
      const text = g.text.get(row * g.w + col)
      if (text) cell(text.cp, text.fg, top !== EMPTY ? top : bottom !== EMPTY ? bottom : DEFAULT_COLOR)
      else if (top === EMPTY && bottom === EMPTY) cell(SPACE, DEFAULT_COLOR, DEFAULT_COLOR)
      else if (bottom === EMPTY) cell(UPPER, top, DEFAULT_COLOR)
      else if (top === EMPTY) cell(LOWER, bottom, DEFAULT_COLOR)
      else cell(UPPER, top, bottom)
    }
  }
  return words
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function base64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const n = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0)
    out += BASE64[(n >> 18) & 63]! + BASE64[(n >> 12) & 63]!
    out += i + 1 < bytes.length ? BASE64[(n >> 6) & 63]! : '='
    out += i + 2 < bytes.length ? BASE64[n & 63]! : '='
  }
  return out
}

export const encodeCells = (g: Grid) => base64(new Uint8Array(toWords(g).buffer))
