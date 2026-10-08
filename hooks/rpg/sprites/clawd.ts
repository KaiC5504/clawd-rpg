import { put, rect } from '../grid'
import type { Grid } from '../grid'

export const ORANGE = 0xde886d
export const EYE = 0x000000
export const CLAWD_W = 15
export const CLAWD_H = 9
export const LEG_STEP_MS = 320

export type Pose = {
  armL?: number
  armR?: number
  top?: number
  dx?: number
  // Which pair of legs is off the ground: 'odd' is his first and third from the left, 'even' the others.
  lift?: 'odd' | 'even'
  face?: 'eyes' | 'shut' | 'happy'
  fx?: number
  fy?: number
  fh?: number
  hy?: number
  sit?: boolean
}

// Ported from clawd-bar 0.3.0's hooks/sprites.ts with the shadow row dropped. Pose numbers keep
// 0.3.0's grid (rows 6..14), so `y` here is the top of his head and row n draws at y + n - 6.
export function clawd(g: Grid, x: number, y: number, o: Pose = {}): void {
  const dx = o.dx ?? 0
  if (o.sit) {
    const top = o.top ?? 9
    rect(g, x + 2, y + top - 6, 11, 15 - top, ORANGE)
    rect(g, x, y + 7, 2, 2, ORANGE)
    rect(g, x + 13, y + 7, 2, 2, ORANGE)
    rect(g, x + 4, y + top - 3, 2, 1, EYE)
    rect(g, x + 9, y + top - 3, 2, 1, EYE)
    return
  }
  const top = o.top ?? 6
  for (const [i, lx] of [3, 5, 9, 11].entries()) rect(g, x + lx, y + 7, 1, o.lift === (i % 2 === 0 ? 'odd' : 'even') ? 1 : 2, ORANGE)
  rect(g, x + 2 + dx, y + top - 6, 11, 13 - top, ORANGE)
  rect(g, x + dx, y + (o.armL ?? 9) - 6, 2, 2, ORANGE)
  rect(g, x + 13 + dx, y + (o.armR ?? 9) - 6, 2, 2, ORANGE)
  const face = o.face ?? 'eyes'
  if (face === 'eyes') {
    const fx = o.fx ?? 0
    const fy = o.fy ?? 0
    const fh = o.fh ?? 2
    rect(g, x + 4 + fx + dx, y + 2 + fy, 1, fh, EYE)
    rect(g, x + 10 + fx + dx, y + 2 + fy, 1, fh, EYE)
  } else if (face === 'shut') {
    rect(g, x + 4 + dx, y + 3, 2, 1, EYE)
    rect(g, x + 9 + dx, y + 3, 2, 1, EYE)
  } else {
    const hy = o.hy ?? 0
    for (const [ex, ey] of [[3, 3], [4, 2], [5, 3], [9, 3], [10, 2], [11, 3]] as const) put(g, x + ex + dx, y + ey + hy, EYE)
  }
}

export const POSES = {
  stand: {},
  right: { fx: 1 },
  blink: { fy: 1, fh: 1 },
  ponder: { fx: 1, fy: -1 },
  cheer: { armL: 8, armR: 8, face: 'happy' },
  bounce: { armL: 10, armR: 10, top: 7, face: 'happy', hy: 1 },
  slump: { armL: 10, armR: 10, face: 'shut' },
  swing: { armR: 7, fx: 1, fy: 1 },
  strike: { armR: 10, fx: 1, fy: 1 },
  squeeze: { armL: 10, armR: 10, top: 8, fy: 1, fh: 1 },
  stretch: { armL: 7, armR: 7, fy: -1 },
  sit: { sit: true, top: 9 },
  sitOut: { sit: true, top: 10 },
} as const satisfies Record<string, Pose>

// Each step plants all four feet for half of `legMs`, then lifts one pair for the other half.
const stride = (t: number, legMs: number): Pose['lift'] => ([undefined, 'odd', undefined, 'even'] as const)[Math.floor((2 * t) / legMs) % 4]

// A waddle: the arm on the side of the lifted legs swings up, the other down.
// `legMs`: how long each step takes; he hurries with quicker steps.
export const walking = (t: number, legMs = LEG_STEP_MS): Pose => {
  const lift = stride(t, legMs)
  if (lift === 'odd') return { fx: 1, lift, armL: 8, armR: 10 }
  if (lift === 'even') return { fx: 1, lift, armL: 10, armR: 8 }
  return { fx: 1 }
}

// Out of usage: half-pace steps, arms hanging.
export const trudging = (t: number): Pose => ({ fx: 1, fy: 1, armL: 10, armR: 10, lift: stride(t, 2 * LEG_STEP_MS) })

export const cheering = (t: number): Pose => (Math.floor(t / 480) % 2 === 1 ? POSES.bounce : POSES.cheer)

// Knocked back: eyes shut, arms down, shaking on the spot.
export const hurting = (t: number): Pose => ({ armL: 10, armR: 10, face: 'shut', dx: Math.floor(t / 160) % 2 === 1 ? 1 : -1 })

export const idling = (t: number): Pose => {
  if (t % 5200 < 160) return POSES.blink
  const glance = t % 10400
  return glance > 6800 && glance < 8800 ? POSES.right : POSES.stand
}

// By the campfire: sitting, leaning out now and then.
export const sitting = (t: number): Pose => (Math.floor(t / 2600) % 2 === 1 ? POSES.sitOut : POSES.sit)

// In bed: sitting low, breathing slowly; the inn's blanket covers him from row 6 down.
export const asleep = (t: number): Pose => ({ sit: true, top: Math.floor(t / 2600) % 2 === 1 ? 10 : 9 })
