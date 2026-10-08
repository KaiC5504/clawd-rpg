import { put, rect, sprite } from '../grid'
import type { Grid } from '../grid'
import { on } from '../noise'
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
  slime: {
    frames: [
      ['..LGL..', '.GGGGG.', 'GKGGGKG', 'GGGGGGG', '.GGGGG.'],
      ['.......', '..LGL..', 'GKGGGKG', 'GGGGGGG', 'GGGGGGG'],
    ],
    pal: { G: 0x7ad15a, L: 0xd8ffc4, K: 0x173a12 },
    w: 7,
    h: 5,
  },
  skeleton: {
    frames: [
      ['..WWW..', '.WKWKW.', '..WWW..', '.W.W.WS', '..WWW.S', '..W.W.S', '.W...W.'],
      ['..WWW..', '.WKWKW.', '..WWW..', '.W.W.WS', '..WWW.S', '..W.W.S', '..W.W..'],
    ],
    pal: { W: 0xe9e6df, K: 0x1a1a1a, S: 0xa0a8b8 },
    w: 7,
    h: 7,
  },
  drone: {
    frames: [
      ['PP...PP', '..CCC..', 'CCKRKCC', '.C...C.'],
      ['.P...P.', '..CCC..', 'CCKRKCC', '.C...C.'],
    ],
    pal: { P: 0xc8d0e8, C: 0x7f8aa8, K: 0x1a1a2a, R: 0xff3b5c },
    w: 7,
    h: 4,
  },
  bug: {
    frames: [
      ['.A...A.', '..A.A..', '.YYYYY.', 'YKYYYKY', '.L.L.L.'],
      ['.A...A.', '..A.A..', '.YYYYY.', 'YKYYYKY', 'L.L.L.L'],
    ],
    pal: { A: 0xff4fa3, Y: 0x3ff0ff, K: 0x0d0620, L: 0xff4fa3 },
    w: 7,
    h: 5,
  },
  treant: {
    frames: [
      ['....GGGGGG....', '..GGGGGGGGGG..', '.GGGGGGGGGGGG.', '..GGTTTTTTGG..', 'B...TYTTYT...B', '.B..TTTTTT..B.', '..BBTTKKTTBB..', '....TTTTTT....', '...TT.TT.TT...'],
      ['...GGGGGG.....', '.GGGGGGGGGG...', 'GGGGGGGGGGGG..', 'B.GGTTTTTTGG.B', '.B..TYTTYT..B.', '..BBTTTTTTBB..', '....TTKKTT....', '....TTTTTT....', '...TT.TT.TT...'],
    ],
    pal: { G: 0x2f7a3a, T: 0x6b4a2b, Y: 0xffd54f, K: 0x2a1a10, B: 0x5a3d22 },
    w: 14,
    h: 9,
  },
  hydra: {
    frames: [
      ['.HHHH...HHHH...HHHH.', 'HYHHH..HYHHH..HYHHH.', 'KHHH...KHHH...KHHH..', '..NN.....NN.....NN..', '..NN.....NN.....NN..', '..BBBBBBBBBBBBBBBB..', '.BBBBBBLLLLLLBBBBBB.', 'BBBBBBLLLLLLLLBBBBBB', '.BB..BB......BB..BB.'],
      ['.HHHH...HHHH...HHHH.', 'HYHHH..HYHHH..HYHHH.', 'FHHH...FHHH...FHHH..', '..NN.....NN.....NN..', '..NN.....NN.....NN..', '..BBBBBBBBBBBBBBBB..', '.BBBBBBLLLLLLBBBBBB.', 'BBBBBBLLLLLLLLBBBBBB', '.BB..BB......BB..BB.'],
    ],
    pal: { H: 0x5fae6e, Y: 0xffd54f, K: 0x2a1030, F: 0xff6b35, N: 0x4b2a6b, B: 0x4b2a6b, L: 0x6b3f8f },
    w: 20,
    h: 9,
  },
  mech: {
    frames: [
      ['....GGGGGGGG....', '....GRRGGRRG....', '....GGGGGGGG....', 'AA.MMMMMMMMMM.AA', 'AAMMMMYYYYMMMMAA', '..MMMMMMMMMMMM..', '...MM......MM...', '...MM......MM...', '..MMMM....MMMM..'],
      ['....GGGGGGGG....', '....GrrGGrrG....', '....GGGGGGGG....', 'AA.MMMMMMMMMM.AA', 'AAMMMMyyyyMMMMAA', '..MMMMMMMMMMMM..', '...MM......MM...', '...MM......MM...', '..MMMM....MMMM..'],
    ],
    pal: { G: 0x8a93a8, R: 0xff3b5c, r: 0x8a1f30, M: 0x5a6378, A: 0x3a4152, Y: 0x3ff0ff, y: 0x1c6c73 },
    w: 16,
    h: 9,
  },
}

export const BOSS_KINDS = ['treant', 'hydra', 'mech'] as const satisfies readonly FoeKind[]

const WHITE = 0xffffff
const GOLD = 0xffd54f
const HP_ON = 0xe5484d
const HP_OFF = 0x3a1a22

// Feet on the ground: the bottom of the sprite sits on pixel row 9. The drone hovers.
export const foeTop = (kind: FoeKind) => (kind === 'drone' ? 2 : 10 - FOES[kind].h)
export const foeWidth = (kind: FoeKind) => FOES[kind].w

export function drawFoe(g: Grid, kind: FoeKind, x: number, y: number, t: number, opts: { flash?: boolean; elite?: boolean } = {}): void {
  const look = FOES[kind]
  const frame = look.frames[Math.floor(t / 400) % 2]!
  const pal = opts.flash ? Object.fromEntries(Object.keys(look.pal).map(k => [k, WHITE])) : look.pal
  sprite(g, x, y + (kind === 'drone' && on(t, 600) ? 1 : 0), frame, pal)
  if (opts.elite) for (const dx of [1, 3, 5]) put(g, x + dx, y - 1, GOLD)
}

// Two pixels a hit point, over the foe's head.
export function drawHp(g: Grid, x: number, y: number, hp: number, maxHp: number): void {
  for (let i = 0; i < maxHp; i++) rect(g, x + i * 2, y, 2, 1, i < hp ? HP_ON : HP_OFF)
}
