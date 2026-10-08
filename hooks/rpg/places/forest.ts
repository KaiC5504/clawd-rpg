import { put } from '../grid'
import { mod, noise } from '../noise'
import type { Place } from './place'

export const FOREST: Place = {
  col(g, x, lx, t, cam) {
    const far = x + Math.floor(cam * 0.4)
    for (let y = 0; y < 8; y++) put(g, x, y, 0x0b1a12)
    if (mod(far, 23) < 3) for (let y = 1; y < 8; y++) put(g, x, y, 0x16291d)
    if (mod(far + 11, 37) < 2) for (let y = 1; y < 8; y++) put(g, x, y, 0x13241a)
    if (mod(lx, 71) < 3) for (let y = 0; y < 8; y++) put(g, x, y, mod(lx, 71) === 1 ? 0x4a3626 : 0x3a2a1c)
    if (noise(Math.floor(far / 2) * 3.7) > 0.35) put(g, x, 0, 0x1d4a2a)
    if (noise(Math.floor(far / 3) * 5.1 + 2) > 0.5) put(g, x, 1, 0x173d23)
    if (noise(lx * 13.3 + Math.floor(t / 1200)) > 0.985) put(g, x, 2 + Math.floor(noise(lx) * 5), 0xd4ff7a)
    put(g, x, 8, noise(lx * 1.7) > 0.8 ? 0x3a6a2c : 0x2d4a24)
    put(g, x, 9, 0x1f3319)
    if (noise(lx * 0.91 + 5) > 0.97) {
      put(g, x, 7, 0xe5484d)
      put(g, x, 8, 0xe9e6df)
    }
  },
}
