import { put, rect, write } from '../grid'
import { mod, noise, on } from '../noise'
import type { Place } from './place'

// The Crab & Quill: long idle and compactions end here, tucked into bed by the fireplace.
export const INN: Place = {
  col(g, x, lx) {
    for (let y = 0; y < 2; y++) put(g, x, y, mod(lx + y * 2, 3) === 0 ? 0x5e2c22 : 0x7a3b2e)
    for (let y = 2; y < 8; y++) put(g, x, y, mod(lx, 5) === 0 ? 0x3d2b1f : 0x4a3426)
    if (mod(lx, 60) < 2) for (let y = 2; y < 8; y++) put(g, x, y, 0x2e2018)
    put(g, x, 8, 0x5a3d22)
    put(g, x, 9, 0x3a3532)
  },
  props(g, ox, t, pw) {
    rect(g, ox + 12, 3, 10, 5, 0x5a5f73)
    rect(g, ox + 11, 2, 12, 1, 0x6b6f7f)
    rect(g, ox + 14, 5, 6, 3, 0x1a0e08)
    const f = Math.floor(t / 160)
    for (let c = 0; c < 6; c++) {
      const h = 1 + Math.floor(noise(c * 5 + f) * 2.5)
      for (let j = 0; j < h; j++) put(g, ox + 14 + c, 7 - j, j ? 0xffd60a : 0xff9f1c)
    }
    rect(g, ox + 28, 3, 7, 4, 0x3d2b1f)
    rect(g, ox + 29, 4, 5, 2, 0x1b2a4a)
    put(g, ox + 32, 4, 0xf1e9c9)
    rect(g, ox + 47, 4, 2, 5, 0x6b4a2b)
    rect(g, ox + 49, 6, 21, 2, 0xe9e6df)
    put(g, ox + 49, 8, 0x6b4a2b)
    put(g, ox + 69, 8, 0x6b4a2b)
    rect(g, ox + 49, 5, 4, 1, 0xf4f4f4)
    const roomy = pw - 52 > 92
    if (roomy) {
      rect(g, ox + 80, 6, 10, 1, 0x8a5a2b)
      put(g, ox + 81, 7, 0x6b4a2b)
      put(g, ox + 88, 7, 0x6b4a2b)
      put(g, ox + 84, 5, on(t, 600) ? 0xffd27a : 0xffb347)
      for (const bx of [pw - 52, pw - 46]) {
        rect(g, ox + bx, 5, 4, 3, 0x7a5532)
        rect(g, ox + bx, 6, 4, 1, 0x5a3d22)
      }
    }
    const bar = pw - 36
    rect(g, ox + bar, 5, 26, 3, 0x6b4a2b)
    rect(g, ox + bar, 5, 26, 1, 0x8a5a2b)
    for (const mx of [4, 11, 19]) {
      put(g, ox + bar + mx, 4, 0xe8bd62)
      put(g, ox + bar + mx + 1, 4, 0xf4f4f4)
    }
    write(g, ox + 76, 1, roomy ? 'THE CRAB & QUILL' : 'INN', 0xffd54f)
    put(g, ox + pw - 6, 2, 0x5a5a5a)
    put(g, ox + pw - 6, 3, on(t, 800) ? 0xffd27a : 0xffb347)
  },
  // The blanket goes over him once he's in bed.
  front(g, ox) {
    rect(g, ox + 52, 6, 18, 2, 0xb23a48)
    for (let i = 0; i < 18; i += 3) put(g, ox + 52 + i, 6, 0xd6556a)
  },
}
