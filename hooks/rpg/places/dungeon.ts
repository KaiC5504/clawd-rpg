import { put, rect } from '../grid'
import { mod, noise, pick } from '../noise'
import type { Place } from './place'

// Stone courses three pixels high, each laid half a brick over from the one above.
function brick(x: number, y: number, cam: number): number {
  const row = Math.floor(y / 3)
  const wx = x + Math.floor(cam * 0.5) + (row % 2) * 4
  if (y % 3 === 2 || mod(wx, 8) === 0) return 0x221c33
  return noise(Math.floor(wx / 8) * 7 + row * 13) > 0.82 ? 0x1b1729 : 0x15121f
}

// Torch-lit halls: brick walls, a flagstone floor, a torch every 30 columns, the odd chain and grate.
export const DUNGEON: Place = {
  col(g, x, lx, t, cam) {
    for (let y = 0; y < 8; y++) put(g, x, y, brick(x, y, cam))
    if (mod(lx, 53) === 17) for (let y = 0; y < 4; y++) put(g, x, y, y % 2 ? 0x4a4458 : 0x5d5670)
    if (mod(lx, 97) >= 60 && mod(lx, 97) < 64) rect(g, x, 2, 1, 3, mod(lx, 97) % 2 ? 0x0c0a12 : 0x2b2540)
    put(g, x, 8, mod(lx, 6) < 3 ? 0x3b3152 : 0x352c4b)
    put(g, x, 9, 0x2c2540)
    const d = Math.abs(mod(lx - 4 + 15, 30) - 15)
    if (d > 0 && d < 3) put(g, x, 4, 0x3a2a2a)
    if (mod(lx, 30) === 4) {
      const id = Math.floor(lx / 30)
      rect(g, x, 4, 1, 2, 0x6b5444)
      put(g, x, 3, pick([0xff9f1c, 0xffb03a, 0xff8a1c], t + id * 90, 160))
      put(g, x, 2, pick([0xffd60a, 0xfff3b0, 0xffd60a, 0xffb03a], t + id * 50, 120))
    }
  },
}
