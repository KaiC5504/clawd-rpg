import { put, rect, write } from '../grid'
import type { Grid } from '../grid'
import { easeOut, lerp, noise, on } from '../noise'

// Non-ASCII characters the effects may write; each must be one cell wide (tests check them).
export const FX_GLYPHS = ['◆', '✗', '·'] as const

const WHITE = 0xffffff
const PAPER = 0xf4f4f4

// A Persona-style cut-in: a slanted slab slides in from the left with the skill's name on it. Its
// text stops short of `before` (Clawd's column), since a text cell would cover his pixels.
export function banner(g: Grid, label: string, q: number, bg: number, fg = WHITE, before = Number.POSITIVE_INFINITY): void {
  if (q <= 0 || q >= 1) return
  const w = [...label].length + 12
  const x0 = Math.round(lerp(-70, Math.min(22, before - w + 4), easeOut(q / 0.25)))
  for (let y = 3; y <= 6; y++) rect(g, x0 + (6 - y), y, w, 1, bg)
  rect(g, x0 + 4, 7, w - 4, 1, PAPER)
  write(g, x0 + 7, 2, label, fg)
}

// A ring of pixels growing out from (x, y), one colour per stage.
export function burst(g: Grid, x: number, y: number, r: number, colors: readonly number[], n = 10): void {
  if (r < 0 || r > colors.length * 1.3 + 1) return
  const c = colors[Math.min(colors.length - 1, Math.floor(r / 1.3))]!
  for (let a = 0; a < n; a++) {
    const ang = (a / n) * Math.PI * 2
    put(g, x + Math.cos(ang) * r * 1.6, y + Math.sin(ang) * r * 0.8, c)
  }
}

// The sword in Clawd's right claw: raised, or brought down with its arc.
export function sword(g: Grid, x: number, y: number, down: boolean): void {
  const hilt = 0xe8bd62
  const blade = 0xd7dde8
  if (!down) {
    put(g, x + 15, y + 1, hilt)
    put(g, x + 16, y, blade)
    put(g, x + 17, y - 1, blade)
    return
  }
  put(g, x + 15, y + 5, hilt)
  put(g, x + 16, y + 6, blade)
  put(g, x + 17, y + 7, blade)
  put(g, x + 18, y + 8, WHITE)
  for (const [ax, ay, c] of [[19, 0, 0xfff6d5], [21, 1, 0xfff6d5], [22, 3, 0xffd54f], [22, 5, 0xffd54f], [21, 7, 0xff9f1c]] as const) put(g, x + ax, y + ay, c)
}

// Sparks around his head while he takes a hit; they stay off his body.
export function sparks(g: Grid, x: number, y: number, t: number): void {
  const c = on(t, 160) ? 0xffd54f : WHITE
  for (const [dx, dy] of on(t, 160) ? [[-2, 0], [16, 1], [-1, 3]] : [[-2, 2], [16, -1], [17, 2]]) put(g, x + dx, y + dy, c)
}

export function chest(g: Grid, x: number, y: number, open: boolean, t: number): void {
  if (!open) {
    rect(g, x, y, 8, 2, 0xa0714a)
    rect(g, x, y + 1, 8, 1, 0x6b4a2b)
    rect(g, x, y + 2, 8, 4, 0x8a5a2b)
    rect(g, x + 3, y + 2, 2, 1, 0xe8bd62)
    rect(g, x, y + 5, 8, 1, 0x5a3d22)
    return
  }
  for (const rx of [x + 1, x + 4, x + 7]) if (on(t + rx * 80, 400)) rect(g, rx, 0, 1, y - 1, 0xfff3b0)
  rect(g, x, y - 1, 8, 1, 0xa0714a)
  rect(g, x, y, 8, 1, 0x6b4a2b)
  rect(g, x + 1, y + 1, 6, 5, 0x8a5a2b)
  rect(g, x + 1, y + 1, 6, 1, 0xffd54f)
  rect(g, x, y + 5, 8, 1, 0x5a3d22)
}

// The ALL-OUT ATTACK brawl: a dust cloud with flying bits over the foe's spot, ending short of the HUD.
export function cloud(g: Grid, x: number, t: number): void {
  const f = Math.floor(t / 160)
  for (let i = 0; i < 70; i++) put(g, x - 8 + Math.floor(noise(i + f * 3) * 22), Math.floor(noise(i * 5 + f) * 10), noise(i * 9 + f) > 0.5 ? PAPER : 0x0b0a10)
  for (let i = 0; i < 4; i++) rect(g, x - 4 + Math.floor(noise(i + f) * 14), Math.floor(noise(i * 3 + f) * 7), 2, 2, 0xffd54f)
}

// A "!" over his shoulder when Claude needs you.
export function bang(g: Grid, x: number, t: number): void {
  if (!on(t + 160, 640)) return
  rect(g, x + 16, 0, 1, 3, 0xffd54f)
  put(g, x + 16, 4, 0xffd54f)
}

// Dust kicked up behind his feet as he skids.
export function dust(g: Grid, x: number, t: number): void {
  const c = on(t, 160) ? 0xc8c0b0 : 0xa39890
  for (const [dx, dy] of [[-1, 9], [-3, 8], [-2, 9]] as const) put(g, x + dx, dy, c)
}
