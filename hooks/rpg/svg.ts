import { EMPTY, PX_H } from './grid'
import type { Grid } from './grid'

export const SVG_MAX_CHARS = 131072

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// A text cell shows the pixel beneath it across the whole cell, as the terminal paints it.
function pixels(g: Grid): Int32Array {
  const px = g.px.slice()
  for (const key of g.text.keys()) {
    const x = key % g.w
    const row = Math.floor(key / g.w)
    const top = px[2 * row * g.w + x]!
    const bg = top !== EMPTY ? top : px[(2 * row + 1) * g.w + x]!
    px[2 * row * g.w + x] = bg
    px[(2 * row + 1) * g.w + x] = bg
  }
  return px
}

// One path per colour, each run of it a one-pixel stroke: far shorter than a rect per run.
function strokes(g: Grid): string {
  const px = pixels(g)
  const runs = new Map<number, string[]>()
  for (let y = 0; y < PX_H; y++) {
    let x = 0
    while (x < g.w) {
      const c = px[y * g.w + x]!
      let end = x + 1
      while (end < g.w && px[y * g.w + end] === c) end++
      if (c !== EMPTY) runs.set(c, [...(runs.get(c) ?? []), `M${x} ${y + 0.5}h${end - x}`])
      x = end
    }
  }
  return [...runs].map(([c, d]) => `<path stroke="${hex(c)}" d="${d.join('')}"/>`).join('')
}

type Cell = { key: number; cp: number; fg: number }

// Runs of text in one colour along a row, each stretched to exactly its cells.
function texts(cells: Cell[], w: number): string {
  const sorted = [...cells].sort((a, b) => a.key - b.key)
  const out: string[] = []
  let i = 0
  while (i < sorted.length) {
    const first = sorted[i]!
    let n = 1
    while (i + n < sorted.length && sorted[i + n]!.key === first.key + n && sorted[i + n]!.fg === first.fg && (first.key + n) % w !== 0) n++
    const chars = sorted.slice(i, i + n).map(c => String.fromCodePoint(c.cp)).join('')
    const row = Math.floor(first.key / w)
    out.push(`<text x="${first.key % w}" y="${row * 2 + 1.6}" fill="${hex(first.fg)}" textLength="${n}">${esc(chars)}</text>`)
    i += n
  }
  return out.join('')
}

const cellsOf = (g: Grid): Cell[] => [...g.text].map(([key, c]) => ({ key, ...c }))
const same = (a: Cell, b: { cp: number; fg: number } | undefined) => b !== undefined && a.cp === b.cp && a.fg === b.fg

// Each frame shows for its slice of the loop through a step-end opacity animation, so nothing tweens.
// Text that stays put through the whole loop (the HUD, a caption) is drawn once, over every frame.
export function svgLoop(frames: Grid[], frameMs: number): string {
  const w = frames[0]?.w ?? 1
  const total = frames.length * frameMs
  const pct = (ms: number) => `${((ms / total) * 100).toFixed(3)}%`
  const steady = cellsOf(frames[0] ?? { w, px: new Int32Array(0), text: new Map() }).filter(c => frames.every(g => same(c, g.text.get(c.key))))
  const isSteady = new Set(steady.map(c => c.key))
  const styles: string[] = ['text{font-family:monospace;font-size:1.7px;white-space:pre}']
  const groups = frames.map((g, i) => {
    const start = i * frameMs
    const keys = [start === 0 ? '0%{opacity:1}' : `0%{opacity:0}${pct(start)}{opacity:1}`]
    if (start + frameMs < total) keys.push(`${pct(start + frameMs)}{opacity:0}`)
    styles.push(`@keyframes f${i}{${keys.join('')}}.f${i}{animation:f${i} ${total}ms step-end infinite}`)
    return `<g class="f${i}" opacity="${i === 0 ? 1 : 0}">${strokes(g)}${texts(cellsOf(g).filter(c => !isSteady.has(c.key)), w)}</g>`
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${PX_H}" shape-rendering="crispEdges"><style>${styles.join('')}</style>${groups.join('')}${texts(steady, w)}</svg>`
}
