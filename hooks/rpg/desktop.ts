import { CALL_MS, beatOf } from './director'
import { frame } from './frame'
import type { Scene } from './frame'
import { CLAWD_COL, restOf, zoneAt } from './road'
import { SVG_MAX_CHARS, svgLoop } from './svg'

// The desktop draws the band at a fixed width, scaled to fit, as short loops it plays on its own.
export const DESKTOP_COLS = 120
export const DESKTOP_FRAME_MS = 160
const MOST_FRAMES = 12

// As many frames as fit under the Svg cap; `sceneAt(i)` is the scene of frame i.
export function desktopLoop(sceneAt: (i: number) => Scene): { svg: string; ms: number } {
  const grids = Array.from({ length: MOST_FRAMES }, (_, i) => frame(sceneAt(i)))
  for (let n = MOST_FRAMES; n > 1; n--) {
    const svg = svgLoop(grids.slice(0, n), DESKTOP_FRAME_MS)
    if (svg.length <= SVG_MAX_CHARS) return { svg, ms: n * DESKTOP_FRAME_MS }
  }
  return { svg: svgLoop(grids.slice(0, 1), DESKTOP_FRAME_MS), ms: DESKTOP_FRAME_MS }
}

// What a loop shows: while this holds, the loop already built still plays it.
export function desktopKey(s: Scene): string {
  const { story, t } = s
  const rest = restOf(story, t, s.distance, s.width)
  const called = story.calledAt !== null && t >= story.calledAt && t - story.calledAt < CALL_MS
  return [beatOf(story, t), rest?.kind ?? '', rest?.phase ?? '', zoneAt(story, s.distance + CLAWD_COL), story.foe?.kind ?? '', (story.party ?? []).length, called ? '!' : '', s.isWalking ? 'walking' : ''].join('|')
}

// The surface starts an Svg over when it redraws; a rebuilt one picks up `ms` into its loop.
export const resumeAt = (svg: string, ms: number) => svg.replace('<style>', `<style>*{animation-delay:-${Math.round(ms)}ms!important}`)
