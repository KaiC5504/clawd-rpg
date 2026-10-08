import { put, rect } from '../grid'
import type { Grid } from '../grid'
import type { PartyClass } from '../director'
import { EYE, ORANGE } from './clawd'

export const MINI_W = 11
// Gear included: a shield, staff or bow stands just past his right claw.
export const MINI_REACH = 13

const STEEL = 0x9aa0b2
const PLUME = 0xe5484d
const SHIELD = 0xc9d3e6
const ROBE = 0x7a4fd0
const GOLD = 0xffd54f
const WOOD = 0x8a5a2b
const HOOD = 0x4f8a3a
const STRING = 0xe9e6df

export type MiniPose = { cheer?: boolean; step?: boolean; glow?: boolean }

// A subagent as a mini Clawd, about two-thirds his size and his own orange; `y` is the top of
// its body, with its class gear above and beside it, never on it.
export function mini(g: Grid, x: number, y: number, cls: PartyClass, o: MiniPose = {}): void {
  rect(g, x + 1, y, 9, 4, ORANGE)
  const armY = o.cheer ? y + 1 : y + 2
  put(g, x, armY, ORANGE)
  put(g, x + 10, armY, ORANGE)
  for (const lx of o.step ? [3, 5, 7, 9] : [2, 4, 6, 8]) rect(g, x + lx, y + 4, 1, 2, ORANGE)
  if (o.cheer) for (const [ex, ey] of [[2, 2], [3, 1], [4, 2], [6, 2], [7, 1], [8, 2]] as const) put(g, x + ex, y + ey, EYE)
  else {
    rect(g, x + 3, y + 1, 1, 2, EYE)
    rect(g, x + 7, y + 1, 1, 2, EYE)
  }
  if (cls === 'knight') {
    rect(g, x + 1, y - 1, 9, 1, STEEL)
    put(g, x + 5, y - 2, PLUME)
    rect(g, x + 11, y + 1, 2, 3, SHIELD)
    put(g, x + 11, y + 2, PLUME)
  } else if (cls === 'mage') {
    rect(g, x + 3, y - 1, 5, 1, ROBE)
    rect(g, x + 4, y - 2, 3, 1, ROBE)
    put(g, x + 5, y - 2, GOLD)
    rect(g, x + 11, y - 1, 1, 7, WOOD)
    put(g, x + 11, y - 2, o.glow ? 0xff7af0 : 0xffb3f6)
  } else {
    rect(g, x + 2, y - 1, 7, 1, HOOD)
    put(g, x + 8, y - 2, PLUME)
    put(g, x + 11, y, WOOD)
    rect(g, x + 12, y + 1, 1, 3, WOOD)
    put(g, x + 11, y + 4, WOOD)
    rect(g, x + 11, y + 1, 1, 3, STRING)
  }
}
