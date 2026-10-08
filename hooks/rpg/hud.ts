import type { RpgStats } from '../../types'
import { ROWS, write } from './grid'
import type { Grid } from './grid'
import { ORANGE } from './sprites/clawd'

const ON = '▰'
const OFF = '▱'
const FULL = '█'
const EMPTY_BAR = '░'
const FLAG = '⚑'
const CUT = '…'
export const GLYPHS = [ON, OFF, FULL, EMPTY_BAR, FLAG, CUT] as const
export const PLACE_MAX = 24

const GOLD = 0xffd54f
const MUTED = 0xa39890
const MP_BLUE = 0x5ea8ff

const bar = (on: string, off: string, n: number, frac: number) => {
  const k = Math.round(n * Math.max(0, Math.min(1, frac)))
  return on.repeat(k) + off.repeat(n - k)
}
const hpColor = (hp: number) => (hp > 0.5 ? 0x6bd46b : hp > 0.25 ? 0xe3b341 : 0xe5484d)
const clip = (s: string) => ([...s].length > PLACE_MAX ? [...s].slice(0, PLACE_MAX - 1).join('') + CUT : s)

export function hudSegments(width: number, s: RpgStats): [string, number][] {
  const segs: [string, number][] = [
    [`Lv.${s.level} `, GOLD],
    [bar(ON, OFF, 5, s.exp), ORANGE],
    ['  HP ', MUTED],
    [bar(FULL, EMPTY_BAR, 5, s.hp), hpColor(s.hp)],
  ]
  if (width >= 120) segs.push(['  MP ', MUTED], [bar(FULL, EMPTY_BAR, 4, s.mp), MP_BLUE])
  if (width >= 160 && s.place) segs.push([`  ${FLAG} ${clip(s.place)}`, MUTED])
  return segs
}

const length = (segs: [string, number][]) => segs.reduce((n, [t]) => n + [...t].length, 0)

export const hudLeft = (width: number, s: RpgStats) => width - length(hudSegments(width, s)) - 2

export function drawHud(g: Grid, s: RpgStats): void {
  let col = hudLeft(g.w, s)
  for (const [t, fg] of hudSegments(g.w, s)) {
    write(g, col, ROWS - 1, t, fg)
    col += [...t].length
  }
}
