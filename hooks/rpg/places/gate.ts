import { put } from '../grid'
import type { Grid } from '../grid'
import { mod, noise } from '../noise'

export const GATE_W = 14

// The portal between zones: stone pillars and a lintel round a swirl of purple. `lx` is the
// column within the gate.
export function gateCol(g: Grid, x: number, lx: number, t: number): void {
  if (lx < 0 || lx >= GATE_W) return
  put(g, x, 0, 0x7d8696)
  put(g, x, 1, lx === 0 || lx === GATE_W - 1 ? 0x7d8696 : 0x5a5f73)
  const pillar = lx < 3 || lx >= GATE_W - 3
  for (let y = 2; y < 10; y++) {
    if (pillar) put(g, x, y, mod(y + (lx < 3 ? 0 : 1), 3) === 0 ? 0x5a5f73 : 0x6b6f7f)
    else put(g, x, y, noise(lx * 3 + y * 7 + Math.floor(t / 160)) > 0.5 ? 0x7a4fd0 : 0xc58bff)
  }
}
