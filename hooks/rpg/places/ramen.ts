import { put, rect, write } from '../grid'
import { mod, on } from '../noise'
import { NEON } from './neon'
import type { Place } from './place'

// Where the awning starts; his stool is under it, at the band's column 50.
const AWNING = 34
const AWNING_W = 40

// Neon City's rest spot: a stall in the rain, Clawd on a stool behind the counter.
export const RAMEN: Place = {
  col(g, x, lx, t, cam) {
    NEON.col(g, x, lx + 7, t, cam, Number.POSITIVE_INFINITY)
  },
  props(g, ox, t, pw) {
    const l = ox + AWNING
    for (let i = 0; i < AWNING_W; i++) {
      put(g, l + i, 1, mod(i, 4) < 2 ? 0xe5484d : 0xf4f4f4)
      put(g, l + i, 2, mod(i, 4) < 2 ? 0xb23a48 : 0xc8c8c8)
    }
    rect(g, l, 3, 1, 7, 0x5a3d22)
    rect(g, l + AWNING_W - 1, 3, 1, 7, 0x5a3d22)
    for (let i = 3; i < AWNING_W - 3; i += 4) rect(g, l + i, 3, 3, 1, 0x2a2440)
    rect(g, l + 14, 0, 11, 1, 0xb23a48)
    write(g, l + 17, 0, 'RAMEN', 0xffd54f)
    for (const i of [2, AWNING_W - 3]) put(g, l + i, 4, on(t + i * 80, 800) ? 0xff6b35 : 0xffb347)
    rect(g, l + 4, 5, 5, 2, 0x3a2a1a)
    put(g, l + 5, 4, 0xe9e6df)
    put(g, l + 7, 4, 0xe9e6df)
    const vend = pw - 60
    if (vend > AWNING + AWNING_W + 6) {
      rect(g, ox + vend, 2, 6, 8, 0x1b6f8a)
      rect(g, ox + vend + 1, 3, 4, 3, on(t, 1400) ? 0x7ff0ff : 0x5ad8ef)
      put(g, ox + vend + 1, 7, 0xff4fa3)
      put(g, ox + vend + 3, 7, 0xffd54f)
    }
  },
  // The counter over his lap, and a steaming bowl by his right claw.
  front(g, ox, t) {
    const l = ox + AWNING
    rect(g, l + 2, 8, AWNING_W - 4, 1, 0x8a5a2b)
    rect(g, l + 2, 9, AWNING_W - 4, 1, 0x5a3d22)
    rect(g, l + 33, 7, 3, 1, 0xe9e6df)
    for (let i = 0; i < 3; i++) put(g, l + 33 + i, 6 - (Math.floor(t / 520 + i) % 3), 0xc8c8c8)
  },
}
