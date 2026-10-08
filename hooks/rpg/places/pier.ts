import { PX_H, put } from '../grid'
import { mod, noise, on } from '../noise'
import type { Place } from './place'
import { nightSky } from './sky'

const DECK_END = 76

// Where he waits right after a turn: a jetty over the lake, the moon and a boat pinned right.
export const PIER: Place = {
  col(g, x, lx, t, cam, pw) {
    nightSky(g, x, lx, t, 7)
    const hills = 1 + Math.floor(noise(Math.floor((x + cam * 0.3) / 9)) * 2)
    for (let y = 6 - hills; y < 7; y++) put(g, x, y, 0x101a30)
    const moon = pw - 40
    if (lx >= moon && lx <= moon + 2) for (let y = 1; y <= 3; y++) put(g, x, y, lx === moon && y === 1 ? 0x0a0f22 : 0xf1e9c9)
    if (lx < 12) {
      put(g, x, 7, 0x16211a)
      put(g, x, 8, 0x3a3a2a)
      put(g, x, 9, 0x2e2e22)
      return
    }
    for (let y = 7; y < PX_H; y++) {
      const wave = mod(lx + y * 3 - Math.floor(t / 440), 9)
      put(g, x, y, y === 7 ? (wave < 2 ? 0x3f74a8 : 0x2c5a85) : wave < 1 ? 0x2c5a85 : 0x1b3a5c)
    }
    if (lx >= moon && lx <= moon + 2 && on(t + lx * 180, 520)) put(g, x, 9, 0xc9c1a0)
    if (lx < DECK_END) {
      put(g, x, 8, mod(lx, 4) === 0 ? 0x5a3d22 : 0x6b4a2b)
      if (mod(lx, 8) === 0) put(g, x, 9, 0x4a3220)
    }
    if (lx === DECK_END - 2) {
      put(g, x, 6, 0x4a3220)
      put(g, x, 7, 0x4a3220)
    }
    const boat = pw - 22
    if (boat > 92 && lx >= boat && lx <= boat + 5) {
      const y0 = 6 + (on(t, 1800) ? 1 : 0)
      if (lx === boat + 2) put(g, x, y0 - 2, 0xe9e6df)
      put(g, x, y0 - 1, lx === boat || lx === boat + 5 ? 0x6b4a2b : 0x8a5a2b)
    }
  },
}
