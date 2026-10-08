import { put, rect, sprite } from '../grid'
import type { Grid } from '../grid'
import type { FoeKind } from '../director'

type Look = { frames: readonly (readonly string[])[]; pal: Readonly<Record<string, number>>; w: number; h: number }

export const FOES: Record<FoeKind, Look> = {
  goblin: {
    frames: [
      ['..GGGG..', '.GGGGGG.', '.GKGGKG.', '..GGGG.S', '.BBBBBBS', '..BBBB.S', '..B..B..'],
      ['..GGGG..', '.GGGGGG.', '.GKGGKG.', '..GGGG.S', '.BBBBBBS', '..BBBB.S', '.B....B.'],
    ],
    pal: { G: 0x6fbf4e, K: 0x1a1a1a, B: 0x6b4a2b, S: 0xc8c8c8 },
    w: 8,
    h: 7,
  },
  shroom: {
    frames: [
      ['.RRRRR.', 'RRWRRWR', 'RRRRRRR', '.SKSKS.', '..SSS..', '.SS.SS.'],
      ['.......', '.RRRRR.', 'RRWRRWR', 'RRRRRRR', '.SKSKS.', '.SSSSS.'],
    ],
    pal: { R: 0xd6453d, W: 0xf4f4f4, S: 0xe9e6df, K: 0x1a1a1a },
    w: 7,
    h: 6,
  },
}

const WHITE = 0xffffff
const GOLD = 0xffd54f
const HP_ON = 0xe5484d
const HP_OFF = 0x3a1a22

// Feet on the ground: the bottom of the sprite sits on pixel row 9.
export const foeTop = (kind: FoeKind) => 10 - FOES[kind].h

export function drawFoe(g: Grid, kind: FoeKind, x: number, y: number, t: number, opts: { flash?: boolean; elite?: boolean } = {}): void {
  const look = FOES[kind]
  const frame = look.frames[Math.floor(t / 400) % 2]!
  const pal = opts.flash ? Object.fromEntries(Object.keys(look.pal).map(k => [k, WHITE])) : look.pal
  sprite(g, x, y, frame, pal)
  if (opts.elite) for (const dx of [1, 3, 5]) put(g, x + dx, y - 1, GOLD)
}

// Two pixels a hit point, over the foe's head.
export function drawHp(g: Grid, x: number, y: number, hp: number, maxHp: number): void {
  for (let i = 0; i < maxHp; i++) rect(g, x + i * 2, y, 2, 1, i < hp ? HP_ON : HP_OFF)
}
