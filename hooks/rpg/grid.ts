export const ROWS = 5
export const PX_H = ROWS * 2
export const EMPTY = -1

export type Grid = { w: number; px: Int32Array; text: Map<number, { cp: number; fg: number }> }

export function grid(w: number): Grid {
  return { w, px: new Int32Array(w * PX_H).fill(EMPTY), text: new Map() }
}

export function put(g: Grid, x: number, y: number, c: number): void {
  const px = Math.round(x)
  const py = Math.round(y)
  if (px < 0 || py < 0 || px >= g.w || py >= PX_H) return
  g.px[py * g.w + px] = c
}

export const at = (g: Grid, x: number, y: number): number => (x < 0 || y < 0 || x >= g.w || y >= PX_H ? EMPTY : g.px[y * g.w + x]!)

export function rect(g: Grid, x: number, y: number, w: number, h: number, c: number): void {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(g, x + i, y + j, c)
}

// A straight line of pixels, every `every`th one (2 gives a dotted fishing line).
export function line(g: Grid, x0: number, y0: number, x1: number, y1: number, c: number, every = 1): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
  for (let i = 0; i <= n; i += every) put(g, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c)
}

export function sprite(g: Grid, x: number, y: number, rows: readonly string[], pal: Readonly<Record<string, number>>): void {
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const c = pal[row[i]!]
      if (c !== undefined) put(g, x + i, y + j, c)
    }
  })
}

// Text takes whole cells and wins over the pixels there; cells.ts gives it their colour as background.
export function write(g: Grid, col: number, row: number, s: string, fg: number): void {
  let i = 0
  for (const ch of s) {
    const c = col + i++
    if (c < 0 || c >= g.w || row < 0 || row >= ROWS) continue
    g.text.set(row * g.w + c, { cp: ch.codePointAt(0)!, fg })
  }
}
