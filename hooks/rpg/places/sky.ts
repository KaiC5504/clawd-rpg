import { put } from '../grid'
import type { Grid } from '../grid'
import { noise } from '../noise'

// Rest spots are at night: a dark sky down to `top`, with the odd twinkling star.
export function nightSky(g: Grid, x: number, lx: number, t: number, top: number): void {
  for (let y = 0; y < top; y++) put(g, x, y, y < 3 ? 0x0a0f22 : 0x0d1430)
  if (noise(lx * 5.7) > 0.93) put(g, x, Math.floor(noise(lx * 2.1) * 4), noise(lx + Math.floor(t / 1000)) > 0.25 ? 0xc8d0e8 : 0x3a4260)
}
