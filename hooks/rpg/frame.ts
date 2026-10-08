import type { RpgStats } from '../../types'
import { grid } from './grid'
import type { Grid } from './grid'
import { drawHud } from './hud'
import { FOREST } from './places/forest'
import { clawd, idling, walking } from './sprites/clawd'

export const CLAWD_COL = 50
export const COMPACT_COL = 4
// Below this a fight can't fit left of the HUD, so the band shows Clawd and the place only.
export const COMPACT_BELOW = 100
export const HIDDEN_BELOW = 40

export type Scene = { width: number; t: number; distance: number; isWalking: boolean; stats: RpgStats }

export const clawdCol = (width: number) => (width < COMPACT_BELOW ? COMPACT_COL : CLAWD_COL)

export function frame(s: Scene): Grid {
  const g = grid(s.width)
  const cam = Math.floor(s.distance)
  for (let x = 0; x < s.width; x++) FOREST.col(g, x, x + cam, s.t, cam, Number.POSITIVE_INFINITY)
  clawd(g, clawdCol(s.width), 1, s.isWalking ? walking(s.t) : idling(s.t))
  drawHud(g, s.stats)
  return g
}
