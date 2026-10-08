import { EMPTY, PX_H } from './grid'
import type { Grid } from './grid'

export const SVG_MAX_CHARS = 131072

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`

// Runs of one colour per row, so a wide flat backdrop costs a few rects, not hundreds.
function rects(g: Grid): string {
  const out: string[] = []
  for (let y = 0; y < PX_H; y++) {
    let x = 0
    while (x < g.w) {
      const c = g.px[y * g.w + x]!
      let end = x + 1
      while (end < g.w && g.px[y * g.w + end] === c) end++
      if (c !== EMPTY) out.push(`<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${hex(c)}"/>`)
      x = end
    }
  }
  return out.join('')
}

// Each frame shows for its slice of the loop through a step-end opacity animation, so nothing tweens.
export function svgLoop(frames: Grid[], frameMs: number): string {
  const w = frames[0]?.w ?? 1
  const total = frames.length * frameMs
  const pct = (ms: number) => `${((ms / total) * 100).toFixed(3)}%`
  const styles: string[] = []
  const groups = frames.map((g, i) => {
    const start = i * frameMs
    const keys = [start === 0 ? '0%{opacity:1}' : `0%{opacity:0}${pct(start)}{opacity:1}`]
    if (start + frameMs < total) keys.push(`${pct(start + frameMs)}{opacity:0}`)
    styles.push(`@keyframes f${i}{${keys.join('')}}.f${i}{animation:f${i} ${total}ms step-end infinite}`)
    return `<g class="f${i}" opacity="${i === 0 ? 1 : 0}">${rects(g)}</g>`
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${PX_H}" shape-rendering="crispEdges"><style>${styles.join('')}</style>${groups.join('')}</svg>`
}
