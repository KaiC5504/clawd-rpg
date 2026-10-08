import { put } from '../grid'
import { mod, noise } from '../noise'
import type { Place } from './place'

const SKY = [0x0d0620, 0x120828, 0x170a30, 0x1b0c36, 0x1f0e3a, 0x22103e, 0x241242, 0x261444]
const PINK = 0xff4fa3
const CYAN = 0x3ff0ff

// Neon City at night: two layers of towers with lit windows, flickering signs and rain on the street.
export const NEON: Place = {
  col(g, x, lx, t, cam) {
    for (let y = 0; y < 8; y++) put(g, x, y, SKY[y]!)
    const far = x + Math.floor(cam * 0.25)
    const farH = 2 + Math.floor(noise(Math.floor(far / 6) * 1.3) * 4)
    for (let y = 7 - farH; y < 8; y++) put(g, x, y, 0x1a1036)
    const near = x + Math.floor(cam * 0.6)
    const block = Math.floor(near / 9)
    const nearH = 3 + Math.floor(noise(block * 2.7 + 1) * 4)
    const edge = mod(near, 9)
    if (edge < 7) {
      for (let y = 8 - nearH; y < 8; y++) {
        const lit = mod(near, 2) === 0 && y % 2 === 1 && noise(near * 3.1 + y * 7 + block) > 0.72
        put(g, x, y, lit ? (noise(block + y) > 0.5 ? 0xffd27a : 0x7fd1ff) : 0x140b26)
      }
      if (edge === 0 || edge === 6) put(g, x, 8 - nearH, noise(block) > 0.5 ? PINK : CYAN)
    }
    const sign = Math.floor(lx / 43)
    const sx = mod(lx, 43)
    if (sx < 4 && noise(sign + Math.floor(t / 300) * 0.37) > 0.12) {
      const c = noise(sign * 3) > 0.5 ? PINK : CYAN
      put(g, x, 2, c)
      put(g, x, 3, sx === 0 || sx === 3 ? c : c === PINK ? 0x732348 : 0x1c6c73)
    }
    put(g, x, 8, 0x2a1e3e)
    put(g, x, 9, mod(lx, 7) === 0 ? 0x3a2a55 : 0x1c1430)
    // Neon caught in the wet street.
    if (noise(Math.floor(lx / 3) * 4.3) > 0.85) put(g, x, 9, noise(Math.floor(lx / 3)) > 0.5 ? 0x5a2648 : 0x1f4a55)
    if (noise(lx * 3.3) > 0.8) {
      const y = mod(Math.floor(t / 90) + Math.floor(noise(lx * 1.9) * 20), 14) - 2
      put(g, x, y, 0x5a7ab8)
      put(g, x, y - 1, 0x38507e)
    }
  },
}
