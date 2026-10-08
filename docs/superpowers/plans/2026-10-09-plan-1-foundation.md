# clawd-rpg Plan 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working clawd-rpg plugin whose band shows the big Clawd walking through the Enchanted Forest across the full terminal width, with the in-world HUD fed by real context/usage, plus answers to the three spikes.

**Architecture:** A Claude Code function-hooks plugin (no build step). Pure modules draw a pixel `Grid` (half-block pixels, 10 px tall, any width) from a `Scene`; `cells.ts` encodes it into Raster cells where text cells take the pixel beneath as their background. `register.tsx` renders one `Raster` as wide as the terminal and repaints it every 160 ms with `$.ui.blit`, skipping identical frames.

**Tech Stack:** TypeScript/TSX run by Claude Code's plugin engine, `claude-code` and `claude-code/testing` APIs, `claude plugin validate .` / `claude plugin test .`, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-09-clawd-rpg-design.md` (read §2, §3.1, §3.4, §3.6, §4, §5, §8). Art reference: `docs/sketches/rpg-sketchbook.html`.

**This is plan 1 of 5.** Plan 2: director, battles, progression (EXP/levels/zones, saved progress). Plan 3: rest spots and travel (pier, campfire, inn, ramen, crystal room, gates). Plan 4: Dungeon + Neon City zones, bosses, party. Plan 5: desktop SVG loops, `/rpg demo|stats|doctor`, README art, release. Each is written after the previous one ships.

## Global Constraints

- Plugin name `clawd-rpg`; repo folder `D:\Repos\Apps\clawd-rpg`; MIT licence; author `KaiC5504`.
- Clawd's body colour is `0xde886d` and is never changed (no tint, flash, silhouette).
- Band: one `Raster`, `rows = 5`, `columns = e.props.bodyColumns` (Raster allows 1–512); hidden below 40 columns; compact view below 100.
- Pixels are half blocks: each cell is `▀` (`0x2580`) with fg = top pixel, bg = bottom pixel; `▄` (`0x2584`) when only the bottom is set; colours `0x00RRGGBB`, `0x01000000` = terminal default.
- A text cell's background is the pixel colour beneath it (top pixel of the cell, else bottom, else default). Never a colour of its own.
- Cell characters must be printable width-1 BMP characters (engine refuses others).
- Tempo: frame timer 160 ms; Clawd's leg step 320 ms; walking 7 px/s.
- Clawd stands at screen column 50 (column 4 in the compact view); top of his head at pixel row 1.
- HUD on text row 4 (the bottom row), right-aligned with 2 columns of margin; drops MP below 120 columns and the place below 160.
- Comments: sparse, only the non-obvious *why* (KaiC's global CLAUDE.md). No section-divider comments.
- Commits: plain messages, no `Co-Authored-By` or other Claude attribution trailers (KaiC's standing rule).

## Review Focus

1. **Terminal resized mid-session** — the band must redraw at the new width and the timer must blit cells of the new size (a stale-size blit is refused). Test in Task 6.
2. **Widths at the thresholds (39/40, 99/100, 119/120, 159/160)** — hidden/compact/HUD trimming switch exactly there. Tests in Tasks 4–6.
3. **`$.session.usage()` failing or empty** — HP and MP show full, nothing throws. Test in Tasks 5–6.
4. **A HUD glyph the engine refuses** — the whole Raster would be refused and the band would vanish. Test in Task 6 mounts a band with every HUD glyph and asserts the Raster exists.
5. **Very long repo/branch names** — the HUD must never reach Clawd's column; the place text is capped. Test in Task 5.

---

### Task 1: Repo scaffold

**Files:**
- Create: `D:\Repos\Apps\clawd-rpg\.claude-plugin\plugin.json`
- Create: `.claude-plugin/marketplace.json`, `hooks/hooks.json`, `hooks/register.tsx`, `types/index.d.ts`, `tsconfig.json`, `.gitignore`, `LICENSE`, `README.md`, `.github/workflows/test.yml`, `tests/mod.test.tsx`

**Interfaces:**
- Produces: plugin `clawd-rpg` with `register` export; atom namespace `'clawd-rpg'`; `RpgStats` type in `types/index.d.ts`.

- [ ] **Step 1: Initialise git**

```bash
cd /d/Repos/Apps/clawd-rpg && git init -b main
```

- [ ] **Step 2: Write the manifests and config**

`.claude-plugin/plugin.json`:
```json
{
  "name": "clawd-rpg",
  "version": "0.1.0",
  "description": "Clawd, Claude Code's crab, goes on an adventure above your prompt: your session's work becomes his walks, battles and rest stops, and he levels up as you use Claude Code. Unofficial fan mod.",
  "author": { "name": "KaiC5504" },
  "homepage": "https://github.com/KaiC5504/clawd-rpg",
  "repository": "https://github.com/KaiC5504/clawd-rpg",
  "license": "MIT",
  "keywords": ["clawd", "rpg", "game", "mod", "band", "pixel-art"],
  "types": "./types/index.d.ts"
}
```

`.claude-plugin/marketplace.json`:
```json
{
  "name": "clawd-rpg",
  "description": "Unofficial Claude Code fan mods by KaiC5504",
  "owner": { "name": "KaiC5504" },
  "plugins": [
    {
      "name": "clawd-rpg",
      "source": "./",
      "description": "Clawd goes on an adventure above your Claude Code prompt and levels up as you work. Unofficial fan mod."
    }
  ]
}
```

`hooks/hooks.json`:
```json
{ "modules": ["./register.tsx"] }
```

`tsconfig.json`:
```json
{
  "extends": "./.claude-plugin/types/tsconfig.json"
}
```

`.gitignore`:
```
# Written by Claude Code when it loads the mod
.claude-plugin/types/
node_modules/
# Local notes
.claude/
```

`LICENSE`: the standard MIT text with `Copyright (c) 2026 KaiC5504` (copy the body of `D:\Repos\Apps\clawd-bar\LICENSE`, changing nothing but the year line if it differs).

`.github/workflows/test.yml` (identical to clawd-bar's):
```yaml
name: Test

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    env:
      DISABLE_AUTOUPDATER: '1'
    steps:
      - uses: actions/checkout@v7
      - name: Install Claude Code
        run: |
          curl -fsSL https://claude.ai/install.sh | bash
          echo "$HOME/.local/bin" >> "$GITHUB_PATH"
      - name: Validate the plugin
        run: |
          claude --version
          claude plugin validate .
      - name: Run the tests
        run: claude plugin test .
```

`README.md`:
```markdown
# clawd-rpg

Clawd, Claude Code's crab, goes on an adventure in the band above your prompt. Your session drives
the game: reading is walking, edits are battles, subagents join his party, and a finished turn is a
victory. He levels up the more you use Claude Code.

Unofficial fan mod. Clawd belongs to Anthropic. Sibling of [clawd-bar](https://github.com/KaiC5504/clawd-bar).

Work in progress: see `docs/superpowers/specs/2026-10-09-clawd-rpg-design.md`.
```

- [ ] **Step 3: Write the plugin state types**

`types/index.d.ts`:
```ts
// HP and MP are what's left (1 = full); exp is progress to the next level.
export type RpgStats = { level: number; exp: number; hp: number; mp: number; place: string }

declare module 'claude-code' {
  interface PluginState {
    'clawd-rpg': {
      isHidden: boolean
      stats: RpgStats
    }
  }
}
```

- [ ] **Step 4: Write a minimal register module**

`hooks/register.tsx`:
```tsx
import type { Register } from 'claude-code'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'rpg', description: "Show or hide Clawd's adventure above the prompt" })
    return next(e)
  })
  on('command.run', { command: 'rpg' }, async () => ({ text: 'clawd-rpg is installed.' }))
}
```

- [ ] **Step 5: Write the smoke test**

`tests/mod.test.tsx`:
```tsx
import { expect, mock, test } from 'claude-code/testing'

const NOW = Date.parse('2026-10-09T10:00:00Z')
const TYPED_RPG = {
  command: 'rpg',
  args: '',
  origin: { kind: 'composer' as const },
  presentation: { isFullscreen: false, columns: 150 },
}

test('/rpg answers once the plugin is loaded', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  on('classic.SessionStart', () => ({}))
  await $.classic.SessionStart({ source: 'startup' })
  await clock.settle()
  expect((await $.command.run(TYPED_RPG)).text).toContain('clawd-rpg')
})
```

- [ ] **Step 6: Validate and run**

Run: `cd /d/Repos/Apps/clawd-rpg && claude plugin validate . && claude plugin test .`
Expected: validate passes; 1 test passes. (Validation also writes `.claude-plugin/types/`, which is git-ignored.)

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "clawd-rpg 0.1.0 scaffold: manifest, CI, /rpg"
```

---

### Task 2: Pixel grid and Raster cells

**Files:**
- Create: `hooks/rpg/noise.ts`, `hooks/rpg/grid.ts`, `hooks/rpg/cells.ts`
- Test: `tests/cells.test.ts`

**Interfaces:**
- Produces:
  - `noise.ts`: `mod(a: number, n: number): number`, `on(t: number, ms: number): boolean`, `noise(n: number): number` (0..1), `pick<T>(items: readonly T[], t: number, ms: number): T`
  - `grid.ts`: `ROWS = 5`, `PX_H = 10`, `EMPTY = -1`, `type Grid = { w: number; px: Int32Array; text: Map<number, { cp: number; fg: number }> }`, `grid(w)`, `put(g, x, y, c)`, `at(g, x, y): number`, `rect(g, x, y, w, h, c)`, `sprite(g, x, y, rows, pal)`, `write(g, col, row, s, fg)`
  - `cells.ts`: `DEFAULT_COLOR = 0x01000000`, `toWords(g): Uint32Array`, `encodeCells(g): string`

- [ ] **Step 1: Write the failing tests**

`tests/cells.test.ts`:
```ts
import { describe, expect, test } from 'claude-code/testing'

import { DEFAULT_COLOR, toWords } from '../hooks/rpg/cells'
import { EMPTY, PX_H, ROWS, at, grid, put, rect, sprite, write } from '../hooks/rpg/grid'

const UPPER = 0x2580
const LOWER = 0x2584

describe('grid', () => {
  test('a grid is 10 pixels tall and starts empty', () => {
    const g = grid(4)
    expect(g.px.length).toBe(4 * PX_H)
    expect(at(g, 3, 9)).toBe(EMPTY)
  })

  test('pixels outside the grid are dropped and positions round', () => {
    const g = grid(2)
    put(g, -1, 0, 0xff0000)
    put(g, 2, 0, 0xff0000)
    put(g, 0, 10, 0xff0000)
    put(g, 0.6, 0.4, 0x00ff00)
    expect(Array.from(g.px).filter(c => c !== EMPTY)).toEqual([0x00ff00])
    expect(at(g, 1, 0)).toBe(0x00ff00)
  })

  test('a sprite maps letters through its palette and skips the rest', () => {
    const g = grid(3)
    sprite(g, 0, 0, ['A.B'], { A: 1, B: 2 })
    expect([at(g, 0, 0), at(g, 1, 0), at(g, 2, 0)]).toEqual([1, EMPTY, 2])
  })
})

describe('cells', () => {
  test('two stacked pixels become one half block', () => {
    const g = grid(4)
    put(g, 0, 0, 0xff0000)
    put(g, 0, 1, 0x0000ff)
    put(g, 1, 0, 0xff0000)
    put(g, 2, 1, 0x0000ff)
    const w = toWords(g)
    expect(Array.from(w.slice(0, 12))).toEqual([
      UPPER, 0xff0000, 0x0000ff,
      UPPER, 0xff0000, DEFAULT_COLOR,
      LOWER, 0x0000ff, DEFAULT_COLOR,
      0x20, DEFAULT_COLOR, DEFAULT_COLOR,
    ])
    expect(w.length).toBe(4 * ROWS * 3)
  })

  test("text has no box: its background is the scene's pixel beneath", () => {
    const g = grid(3)
    rect(g, 0, 8, 3, 2, 0x2d4a24)
    put(g, 2, 8, -1)
    put(g, 2, 9, 0x1f3319)
    write(g, 0, 4, 'Lv', 0xffd54f)
    write(g, 2, 4, '.', 0xffd54f)
    const row4 = Array.from(toWords(g).slice(4 * 3 * 3))
    expect(row4).toEqual(['L'.codePointAt(0), 0xffd54f, 0x2d4a24, 'v'.codePointAt(0), 0xffd54f, 0x2d4a24, '.'.codePointAt(0), 0xffd54f, 0x1f3319])
  })

  test('text over empty sky keeps the terminal background', () => {
    const g = grid(1)
    write(g, 0, 0, 'z', 0x90a4ae)
    expect(Array.from(toWords(g).slice(0, 3))).toEqual(['z'.codePointAt(0), 0x90a4ae, DEFAULT_COLOR])
  })

  test('text past the edge is clipped', () => {
    const g = grid(2)
    write(g, 1, 0, 'abc', 0xffffff)
    expect(g.text.size).toBe(1)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `claude plugin test .`
Expected: FAIL — cannot resolve `../hooks/rpg/cells` / `../hooks/rpg/grid`.

- [ ] **Step 3: Implement**

`hooks/rpg/noise.ts`:
```ts
export const mod = (a: number, n: number) => ((a % n) + n) % n

export const on = (t: number, ms: number) => Math.floor(t / ms) % 2 === 1

// Deterministic 0..1 from any number, so every frame is a pure function of time and position.
export function noise(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

export const pick = <T>(items: readonly T[], t: number, ms: number): T => items[Math.floor(t / ms) % items.length]!
```

`hooks/rpg/grid.ts`:
```ts
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
```

`hooks/rpg/cells.ts`:
```ts
import { EMPTY, ROWS } from './grid'
import type { Grid } from './grid'

export const DEFAULT_COLOR = 0x01000000
const UPPER = 0x2580
const LOWER = 0x2584
const SPACE = 0x20

// Raster words: [codePoint, fg, bg] per cell, row by row.
export function toWords(g: Grid): Uint32Array {
  const words = new Uint32Array(g.w * ROWS * 3)
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < g.w; col++) {
      const top = g.px[2 * row * g.w + col]!
      const bottom = g.px[(2 * row + 1) * g.w + col]!
      const i = (row * g.w + col) * 3
      const text = g.text.get(row * g.w + col)
      if (text) words.set([text.cp, text.fg, top !== EMPTY ? top : bottom !== EMPTY ? bottom : DEFAULT_COLOR], i)
      else if (top === EMPTY && bottom === EMPTY) words.set([SPACE, DEFAULT_COLOR, DEFAULT_COLOR], i)
      else if (bottom === EMPTY) words.set([UPPER, top, DEFAULT_COLOR], i)
      else if (top === EMPTY) words.set([LOWER, bottom, DEFAULT_COLOR], i)
      else words.set([UPPER, top, bottom], i)
    }
  }
  return words
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function base64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const n = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0)
    out += BASE64[(n >> 18) & 63]! + BASE64[(n >> 12) & 63]!
    out += i + 1 < bytes.length ? BASE64[(n >> 6) & 63]! : '='
    out += i + 2 < bytes.length ? BASE64[n & 63]! : '='
  }
  return out
}

export const encodeCells = (g: Grid) => base64(new Uint8Array(toWords(g).buffer))
```

- [ ] **Step 4: Run to verify they pass**

Run: `claude plugin test .`
Expected: all tests pass (smoke test + 7 new).

- [ ] **Step 5: Commit**

```bash
git add hooks/rpg tests/cells.test.ts && git commit -m "Half-block pixel grid whose text takes the scene's colour beneath"
```

---

### Task 3: The big Clawd

**Files:**
- Create: `hooks/rpg/sprites/clawd.ts`
- Test: `tests/clawd.test.ts`

**Interfaces:**
- Consumes: `grid`, `put`, `rect`, `at`, `EMPTY`, `PX_H` from `hooks/rpg/grid.ts`.
- Produces: `ORANGE = 0xde886d`, `EYE = 0x000000`, `type Pose`, `clawd(g, x, y, pose?)`, `POSES` (named poses), `LEG_STEP_MS = 320`, `walking(t): Pose`, `idling(t): Pose`, `CLAWD_W = 15`, `CLAWD_H = 9`.

- [ ] **Step 1: Write the failing tests**

`tests/clawd.test.ts`:
```ts
import { describe, expect, test } from 'claude-code/testing'

import { EMPTY, PX_H, at, grid } from '../hooks/rpg/grid'
import { CLAWD_H, CLAWD_W, EYE, ORANGE, POSES, clawd, idling, walking } from '../hooks/rpg/sprites/clawd'
import type { Pose } from '../hooks/rpg/sprites/clawd'

const drawn = (pose: Pose) => {
  const g = grid(20)
  clawd(g, 2, 1, pose)
  const px = new Map<string, number>()
  for (let y = 0; y < PX_H; y++) for (let x = 0; x < 20; x++) if (at(g, x, y) !== EMPTY) px.set(`${x - 2},${y - 1}`, at(g, x, y))
  return px
}

// clawd-bar 0.3.0's standing Clawd, shadow row dropped: torso 11×7, arms 2×2, four legs, eyes 1×2.
const STAND = new Map<string, number>()
for (let y = 0; y < 7; y++) for (let x = 2; x <= 12; x++) STAND.set(`${x},${y}`, ORANGE)
for (const x of [0, 1, 13, 14]) for (const y of [3, 4]) STAND.set(`${x},${y}`, ORANGE)
for (const x of [3, 5, 9, 11]) for (const y of [7, 8]) STAND.set(`${x},${y}`, ORANGE)
for (const x of [4, 10]) for (const y of [2, 3]) STAND.set(`${x},${y}`, EYE)

describe('the big Clawd', () => {
  test('standing, he is exactly the 0.3.0 sprite without its shadow', () => {
    expect([...drawn(POSES.stand)].sort()).toEqual([...STAND].sort())
    expect([CLAWD_W, CLAWD_H]).toEqual([15, 9])
  })

  test('his body is only ever his orange, in every pose and step', () => {
    const poses: Pose[] = [...Object.values(POSES), walking(0), walking(320), idling(0), idling(100), idling(7000)]
    for (const pose of poses) for (const c of drawn(pose).values()) expect([ORANGE, EYE]).toContain(c)
  })

  test('his legs change stance every 320 ms while walking', () => {
    expect(walking(0).step).toBe(false)
    expect(walking(320).step).toBe(true)
    expect(walking(640).step).toBe(false)
  })

  test('he stays inside a 15 × 9 box when standing or walking', () => {
    for (const pose of [POSES.stand, walking(320)]) {
      for (const key of drawn(pose).keys()) {
        const [x, y] = key.split(',').map(Number)
        expect(x! >= 0 && x! < 15 && y! >= 0 && y! < 9).toBe(true)
      }
    }
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `claude plugin test .`
Expected: FAIL — cannot resolve `../hooks/rpg/sprites/clawd`.

- [ ] **Step 3: Implement**

`hooks/rpg/sprites/clawd.ts`:
```ts
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
  step?: boolean
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
  for (const lx of o.step ? [4, 6, 10, 12] : [3, 5, 9, 11]) rect(g, x + lx, y + 7, 1, 2, ORANGE)
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

export const walking = (t: number): Pose => ({ fx: 1, step: Math.floor(t / LEG_STEP_MS) % 2 === 1 })

export const idling = (t: number): Pose => {
  if (t % 5200 < 160) return POSES.blink
  const glance = t % 10400
  return glance > 6800 && glance < 8800 ? POSES.right : POSES.stand
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `claude plugin test .`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add hooks/rpg/sprites tests/clawd.test.ts && git commit -m "The big Clawd from clawd-bar 0.3.0, shadow dropped, orange locked"
```

---

### Task 4: The Enchanted Forest and the frame

**Files:**
- Create: `hooks/rpg/places/place.ts`, `hooks/rpg/places/forest.ts`, `hooks/rpg/frame.ts`
- Test: `tests/frame.test.ts`

**Interfaces:**
- Consumes: grid API (Task 2), `clawd`, `walking`, `idling`, `ORANGE` (Task 3), `drawHud` (Task 5 — see note).
- Produces:
  - `place.ts`: `type Place = { col(g: Grid, x: number, lx: number, t: number, cam: number, pw: number): void }`
  - `forest.ts`: `FOREST: Place`
  - `frame.ts`: `CLAWD_COL = 50`, `COMPACT_COL = 4`, `COMPACT_BELOW = 100`, `HIDDEN_BELOW = 40`, `type Scene = { width: number; t: number; distance: number; isWalking: boolean; stats: RpgStats }`, `frame(s: Scene): Grid`, `clawdCol(width): number`

Note: `frame.ts` calls `drawHud`; Task 5 writes it. In this task, create `hooks/rpg/hud.ts` with only `export function drawHud(_g: Grid, _s: RpgStats): void {}` so the frame compiles; Task 5 replaces the body with the real HUD.

- [ ] **Step 1: Write the failing tests**

`tests/frame.test.ts`:
```ts
import { describe, expect, test } from 'claude-code/testing'

import type { RpgStats } from '../types'
import { EMPTY, PX_H, at } from '../hooks/rpg/grid'
import { CLAWD_COL, COMPACT_BELOW, COMPACT_COL, clawdCol, frame } from '../hooks/rpg/frame'
import { ORANGE } from '../hooks/rpg/sprites/clawd'

const STATS: RpgStats = { level: 1, exp: 0, hp: 1, mp: 1, place: 'my-app/main' }
const scene = (width: number, t = 0, distance = 0, isWalking = true) => ({ width, t, distance, isWalking, stats: STATS })

describe('frame', () => {
  test('the forest fills every pixel of the band at any width', () => {
    for (const width of [40, 99, 100, 150, 220, 300]) {
      for (const distance of [0, 37.5, 1000]) {
        const g = frame(scene(width, 1234, distance))
        for (let y = 0; y < PX_H; y++) for (let x = 0; x < width; x++) expect(at(g, x, y)).not.toBe(EMPTY)
      }
    }
  })

  test('Clawd stands at column 50, or column 4 in the compact view', () => {
    expect(clawdCol(150)).toBe(CLAWD_COL)
    expect(clawdCol(COMPACT_BELOW)).toBe(CLAWD_COL)
    expect(clawdCol(COMPACT_BELOW - 1)).toBe(COMPACT_COL)
    const g = frame(scene(150))
    expect(at(g, CLAWD_COL + 2, 1)).toBe(ORANGE)
    const small = frame(scene(80))
    expect(at(small, COMPACT_COL + 2, 1)).toBe(ORANGE)
  })

  test('the ground scrolls under him as he walks', () => {
    const a = frame(scene(150, 0, 0))
    const b = frame(scene(150, 0, 23))
    // Rows 8–9 are the ground, which moves with him; the far trees above drift slower (parallax).
    const ground = (g: ReturnType<typeof frame>, x: number) => [at(g, x, 8), at(g, x, 9)].join()
    for (let x = 0; x < 40; x++) expect(ground(b, x)).toBe(ground(a, x + 23))
  })

  test('a frame is a pure function of its scene', () => {
    const a = frame(scene(150, 4321, 99.5))
    const b = frame(scene(150, 4321, 99.5))
    expect(Array.from(a.px)).toEqual(Array.from(b.px))
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `claude plugin test .`
Expected: FAIL — cannot resolve `../hooks/rpg/frame`.

- [ ] **Step 3: Implement**

`hooks/rpg/places/place.ts`:
```ts
import type { Grid } from '../grid'

// A place paints one column at a time so it fills any width: `lx` is the column within the place,
// `cam` the camera's position (for parallax layers), `pw` the place's own width.
export type Place = {
  col(g: Grid, x: number, lx: number, t: number, cam: number, pw: number): void
}
```

`hooks/rpg/places/forest.ts` (ported from the sketch's `LOC.forest`, timings doubled for the 0.5× pace):
```ts
import { put } from '../grid'
import { mod, noise } from '../noise'
import type { Place } from './place'

export const FOREST: Place = {
  col(g, x, lx, t, cam) {
    const far = x + Math.floor(cam * 0.4)
    for (let y = 0; y < 8; y++) put(g, x, y, 0x0b1a12)
    if (mod(far, 23) < 3) for (let y = 1; y < 8; y++) put(g, x, y, 0x16291d)
    if (mod(far + 11, 37) < 2) for (let y = 1; y < 8; y++) put(g, x, y, 0x13241a)
    if (mod(lx, 71) < 3) for (let y = 0; y < 8; y++) put(g, x, y, mod(lx, 71) === 1 ? 0x4a3626 : 0x3a2a1c)
    if (noise(Math.floor(far / 2) * 3.7) > 0.35) put(g, x, 0, 0x1d4a2a)
    if (noise(Math.floor(far / 3) * 5.1 + 2) > 0.5) put(g, x, 1, 0x173d23)
    if (noise(lx * 13.3 + Math.floor(t / 1200)) > 0.985) put(g, x, 2 + Math.floor(noise(lx) * 5), 0xd4ff7a)
    put(g, x, 8, noise(lx * 1.7) > 0.8 ? 0x3a6a2c : 0x2d4a24)
    put(g, x, 9, 0x1f3319)
    if (noise(lx * 0.91 + 5) > 0.97) {
      put(g, x, 7, 0xe5484d)
      put(g, x, 8, 0xe9e6df)
    }
  },
}
```

`hooks/rpg/hud.ts` (stub, replaced in Task 5):
```ts
import type { RpgStats } from '../../types'
import type { Grid } from './grid'

export function drawHud(_g: Grid, _s: RpgStats): void {}
```

`hooks/rpg/frame.ts`:
```ts
import type { RpgStats } from '../../types'
import { grid } from './grid'
import type { Grid } from './grid'
import { drawHud } from './hud'
import { FOREST } from './places/forest'
import { clawd, idling, walking } from './sprites/clawd'

export const CLAWD_COL = 50
export const COMPACT_COL = 4
// Below this a fight can't fit left of the HUD, so the band shows Clawd and the place only.
export const COMPACT_BELOW = 100
export const HIDDEN_BELOW = 40

export type Scene = { width: number; t: number; distance: number; isWalking: boolean; stats: RpgStats }

export const clawdCol = (width: number) => (width < COMPACT_BELOW ? COMPACT_COL : CLAWD_COL)

export function frame(s: Scene): Grid {
  const g = grid(s.width)
  const cam = Math.floor(s.distance)
  for (let x = 0; x < s.width; x++) FOREST.col(g, x, x + cam, s.t, cam, Number.POSITIVE_INFINITY)
  clawd(g, clawdCol(s.width), 1, s.isWalking ? walking(s.t) : idling(s.t))
  drawHud(g, s.stats)
  return g
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `claude plugin test .`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add hooks/rpg tests/frame.test.ts && git commit -m "The Enchanted Forest fills any width and scrolls under Clawd"
```

---

### Task 5: The HUD and the stats it shows

**Files:**
- Modify: `hooks/rpg/hud.ts` (replace the stub)
- Create: `hooks/rpg/stats.ts`
- Test: `tests/hud.test.ts`

**Interfaces:**
- Consumes: `write`, `Grid`, `ROWS` (Task 2); `ORANGE` (Task 3); `RpgStats` (Task 1).
- Produces:
  - `hud.ts`: `GLYPHS` (every non-ASCII character the HUD may draw), `PLACE_MAX = 24`, `hudSegments(width, s): [text: string, fg: number][]`, `hudLeft(width, s): number`, `drawHud(g, s)`
  - `stats.ts`: `type Usage = { context?: { percent?: number }; rateLimits?: { kind: string; percentUsed: number }[] }`, `statsFrom(usage: Usage | null, place: string): RpgStats`

- [ ] **Step 1: Write the failing tests**

`tests/hud.test.ts`:
```ts
import { describe, expect, test } from 'claude-code/testing'

import type { RpgStats } from '../types'
import { CLAWD_COL } from '../hooks/rpg/frame'
import { grid } from '../hooks/rpg/grid'
import { GLYPHS, PLACE_MAX, drawHud, hudLeft, hudSegments } from '../hooks/rpg/hud'
import { statsFrom } from '../hooks/rpg/stats'

const S: RpgStats = { level: 7, exp: 0.6, hp: 0.88, mp: 0.62, place: 'my-app/main' }
const text = (width: number, s = S) => hudSegments(width, s).map(([t]) => t).join('')

describe('hud', () => {
  test('wide terminals show level, EXP, HP, MP and the place', () => {
    expect(text(160)).toBe('Lv.7 ▰▰▰▱▱  HP ████░  MP ██░░  ⚑ my-app/main')
  })

  test('it drops the place below 160 columns and MP below 120', () => {
    expect(text(159)).toBe('Lv.7 ▰▰▰▱▱  HP ████░  MP ██░░')
    expect(text(120)).toBe('Lv.7 ▰▰▰▱▱  HP ████░  MP ██░░')
    expect(text(119)).toBe('Lv.7 ▰▰▰▱▱  HP ████░')
  })

  test('it sits on the bottom row, right-aligned with two columns spare', () => {
    const g = grid(150)
    drawHud(g, S)
    const left = hudLeft(150, S)
    expect(g.text.get(4 * 150 + left)?.cp).toBe('L'.codePointAt(0))
    const last = left + [...text(150)].length - 1
    expect(last).toBe(150 - 3)
  })

  test('a long repo name is cut so the HUD never reaches Clawd', () => {
    const long = { ...S, place: 'a-very-long-repository-name/feature/some-really-long-branch' }
    expect([...hudSegments(300, long).at(-1)![0]].length).toBeLessThanOrEqual(PLACE_MAX + 4)
    for (const width of [160, 200, 300]) expect(hudLeft(width, long)).toBeGreaterThan(CLAWD_COL + 15 + 14)
  })

  test('every glyph it draws is a single BMP character', () => {
    for (const ch of GLYPHS) {
      expect([...ch].length).toBe(1)
      expect(ch.codePointAt(0)!).toBeLessThan(0x10000)
    }
    const used = new Set([...text(300)].filter(ch => ch.codePointAt(0)! > 0x7e))
    for (const ch of used) expect(GLYPHS).toContain(ch)
  })
})

describe('stats', () => {
  test('HP is the context left and MP the 5-hour limit left', () => {
    const s = statsFrom({ context: { percent: 12 }, rateLimits: [{ kind: 'five_hour', percentUsed: 38 }] }, 'my-app/main')
    expect([s.hp, s.mp, s.place]).toEqual([0.88, 0.62, 'my-app/main'])
  })

  test('with no usage to read, HP and MP are full', () => {
    expect(statsFrom(null, '')).toEqual({ level: 1, exp: 0, hp: 1, mp: 1, place: '' })
    expect(statsFrom({}, 'x').hp).toBe(1)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `claude plugin test .`
Expected: FAIL — `hudSegments` / `statsFrom` not exported.

- [ ] **Step 3: Implement**

`hooks/rpg/hud.ts`:
```ts
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
```

`hooks/rpg/stats.ts`:
```ts
import type { RpgStats } from '../../types'

export type Usage = { context?: { percent?: number }; rateLimits?: { kind: string; percentUsed: number }[] }

// Level and EXP come from saved progress in plan 2; until then he is a level 1 hero.
export function statsFrom(usage: Usage | null, place: string): RpgStats {
  const ctx = usage?.context?.percent ?? 0
  const fiveHour = usage?.rateLimits?.find(l => l.kind === 'five_hour')?.percentUsed ?? 0
  return { level: 1, exp: 0, hp: 1 - ctx / 100, mp: 1 - fiveHour / 100, place }
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `claude plugin test .`
Expected: all pass. If `0.88`/`0.62` comparisons fail on float error, compare with `Math.round(x * 100) / 100` in `statsFrom` (round HP/MP to two decimals) rather than loosening the test.

- [ ] **Step 5: Commit**

```bash
git add hooks/rpg tests/hud.test.ts && git commit -m "In-world HUD: level, EXP, HP from context, MP from the 5-hour limit"
```

---

### Task 6: The band

**Files:**
- Modify: `hooks/register.tsx` (replace)
- Modify: `tests/mod.test.tsx` (replace)

**Interfaces:**
- Consumes: `frame`, `HIDDEN_BELOW` (Task 4); `encodeCells` (Task 2); `ROWS` (Task 2); `statsFrom`, `Usage` (Task 5); atoms typed in `types/index.d.ts`.
- Produces: the `AbovePrompt` band (`Raster` key `'rpg'`), `/rpg` toggle persisted in `$.store` key `isHidden`.

- [ ] **Step 1: Write the failing tests**

`tests/mod.test.tsx`:
```tsx
import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const NOW = Date.parse('2026-10-09T10:00:00Z')
const TYPED_RPG = {
  command: 'rpg',
  args: '',
  origin: { kind: 'composer' as const },
  presentation: { isFullscreen: false, columns: 150 },
}

type Usage = { context: { window: number; tokens: number; percent: number }; rateLimits: { kind: string; percentUsed: number }[] }

function fakeSession(on: On, blits: string[], usage: Usage | 'fails' = { context: { window: 200000, tokens: 24000, percent: 12 }, rateLimits: [] }) {
  mock.env(on, { USERPROFILE: '/Users/tester' })
  mock.store(on)
  on('process.run', () => ({ value: { exitCode: 0, stdout: 'main\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('session.id', () => ({ value: 's1' }))
  on('session.cwd', () => ({ value: 'C:/src/my-app' }))
  on('session.usage', () => {
    if (usage === 'fails') throw new Error('no usage yet')
    return { value: { startedAt: 0, ...usage } }
  })
  on('classic.SessionStart', () => ({}))
  on('ui.blit', ($, e) => {
    if ('cells' in e) blits.push(e.cells)
    return { value: {} }
  })
}

const band = (bodyColumns: number, isWorking = false) => ({
  component: 'AbovePrompt' as const,
  props: { hasSurvey: false, isWorking, maxRows: 20, bodyColumns, scroll: { offset: 0, bodyRows: 20 }, view: {} },
})

// A base64 Raster of w × 5 cells, 12 bytes a cell.
const cellsFor = (w: number) => Math.ceil((w * 5 * 12) / 3) * 4

test('the band is one 5-row Raster as wide as the terminal, HUD glyphs and all', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  fakeSession(on, [])
  await $.classic.SessionStart({ source: 'startup' })
  await clock.settle()
  for (const w of [40, 100, 160, 300]) {
    const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(w) })
    const r = await t.find({ type: 'Raster', key: 'rpg' })
    expect([r?.props.columns, r?.props.rows]).toEqual([w, 5])
    expect(String(r?.props.cells).length).toBe(cellsFor(w))
    await t.unmount()
  }
})

test('below 40 columns the band steps aside', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  fakeSession(on, [])
  await $.classic.SessionStart({ source: 'startup' })
  await clock.settle()
  const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(39) })
  expect(await t.find({ type: 'Raster' })).toBeUndefined()
  await t.unmount()
})

test('while Claude works he walks: frames are sent every 160 ms, only when they change', async ($, on) => {
  const blits: string[] = []
  const clock = mock.clock(on, { now: NOW })
  fakeSession(on, blits)
  await $.classic.SessionStart({ source: 'startup' })
  await clock.settle()
  const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(150, true) })
  await clock.advance(1600)
  expect(blits.length).toBeGreaterThan(3)
  expect(blits.length).toBeLessThanOrEqual(10)
  expect(new Set(blits).size).toBe(blits.length)
  await t.unmount()
})

test('after a resize the timer paints the new width', async ($, on) => {
  const blits: string[] = []
  const clock = mock.clock(on, { now: NOW })
  fakeSession(on, blits)
  await $.classic.SessionStart({ source: 'startup' })
  await clock.settle()
  const a = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(150, true) })
  await clock.advance(640)
  await a.unmount()
  blits.length = 0
  const b = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(220, true) })
  await clock.advance(640)
  expect(blits.length).toBeGreaterThan(0)
  for (const cells of blits) expect(cells.length).toBe(cellsFor(220))
  await b.unmount()
})

test('with no usage to read, the band still draws', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  fakeSession(on, [], 'fails')
  await $.classic.SessionStart({ source: 'startup' })
  await clock.advance(2000)
  const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(150) })
  expect(await t.find({ type: 'Raster', key: 'rpg' })).toBeDefined()
  await t.unmount()
})

test('/rpg hides the band and brings it back, and remembers', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  fakeSession(on, [])
  await $.classic.SessionStart({ source: 'startup' })
  await clock.settle()
  expect((await $.command.run(TYPED_RPG)).text).toContain('hidden')
  const empty = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(150) })
  expect(await empty.find({ type: 'Raster' })).toBeUndefined()
  await empty.unmount()
  expect((await $.command.run(TYPED_RPG)).text).toContain('back')
  const back = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(150) })
  expect(await back.find({ type: 'Raster', key: 'rpg' })).toBeDefined()
  await back.unmount()
})

test('the desktop gets nothing yet', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  fakeSession(on, [])
  await $.classic.SessionStart({ source: 'startup' })
  await clock.settle()
  const d = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'desktop', ...band(150) })
  expect(await d.find({ type: 'Svg' })).toBeUndefined()
  await d.unmount()
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `claude plugin test .`
Expected: FAIL — no Raster rendered; `/rpg` text lacks "hidden".

- [ ] **Step 3: Implement**

`hooks/register.tsx`:
```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { encodeCells } from './rpg/cells'
import { HIDDEN_BELOW, frame } from './rpg/frame'
import { ROWS } from './rpg/grid'
import { statsFrom } from './rpg/stats'
import type { Usage } from './rpg/stats'

const RASTER_KEY = 'rpg'
// Half the sketch page's speed, the pace KaiC picked as natural.
const FRAME_MS = 160
const WALK_PX_PER_S = 7
const STATS_MS = 1000

const isHidden = atom({ plugin: 'clawd-rpg', key: 'isHidden' } as const, false)
const stats = atom({ plugin: 'clawd-rpg', key: 'stats' } as const, statsFrom(null, ''))

// Module state: a hot reload starts it over, while the atoms live on in $.state.
let isReady = false
let place = ''
let road = { distance: 0, at: 0, isWalking: false }
let painting: { requestId: string; width: number; painted: string } | null = null
let frameTimer: { cancel: () => void } | null = null

function stopPainting(): void {
  frameTimer?.cancel()
  frameTimer = null
  painting = null
}

function advance(now: number, isWalking: boolean): void {
  const distance = road.isWalking && road.at ? road.distance + (WALK_PX_PER_S * (now - road.at)) / 1000 : road.distance
  road = { distance, at: now, isWalking }
}

async function refreshStats($: EngineInterface): Promise<void> {
  const usage = (await $.session.usage().then(u => u, () => null)) as Usage | null
  const next = statsFrom(usage, place)
  if (JSON.stringify(next) !== JSON.stringify(await read($, stats))) await update($, stats, () => next)
}

async function refreshPlace($: EngineInterface): Promise<void> {
  const branch = await $.process.run(['git', 'branch', '--show-current'], { timeoutMs: 5000 }).catch(() => null)
  const folder = (await $.session.cwd().catch(() => '')).replace(/\\/g, '/').split('/').pop() ?? ''
  const name = branch?.exitCode === 0 && branch.stdout.trim() ? `${folder}/${branch.stdout.trim()}` : folder
  if (name !== place) {
    place = name
    await refreshStats($)
  }
}

async function ensureReady($: EngineInterface): Promise<void> {
  if (isReady) return
  isReady = true
  if ((await $.store.get('isHidden')) === true) await update($, isHidden, () => true)
  $.clock.every(STATS_MS, () => void refreshStats($))
  await refreshPlace($).catch(() => undefined)
  await refreshStats($)
}

async function cellsNow($: EngineInterface, width: number, now: number): Promise<string> {
  return encodeCells(frame({ width, t: now, distance: road.distance, isWalking: road.isWalking, stats: await read($, stats) }))
}

async function paintFrame($: EngineInterface): Promise<void> {
  const p = painting
  if (!p) return
  const now = await $.clock.now()
  advance(now, road.isWalking)
  const cells = await cellsNow($, p.width, now)
  if (cells === p.painted) return
  p.painted = cells
  const blitted = await $.ui.blit({ requestId: p.requestId, key: RASTER_KEY, cells })
  // Not mounted any more (hidden, collapsed, resized): rest until the next draw.
  if (blitted.deny !== undefined && painting === p) stopPainting()
}

type BandEvent = Parameters<EngineInterface['ui']['resolve']>[0] & {
  requestId: string
  props: { hasSurvey: boolean; isWorking: boolean; bodyColumns: number }
}

async function drawBand($: EngineInterface, e: BandEvent, next: (e: BandEvent) => unknown) {
  const width = Math.min(512, e.props.bodyColumns)
  if (e.props.hasSurvey || e.surface !== 'terminal' || width < HIDDEN_BELOW || (await read($, isHidden))) {
    stopPainting()
    return next(e)
  }
  await ensureReady($)
  const now = await $.clock.now()
  advance(now, e.props.isWorking)
  const cells = await cellsNow($, width, now)
  if (!painting || painting.requestId !== e.requestId || painting.width !== width) {
    stopPainting()
    painting = { requestId: e.requestId, width, painted: cells }
    frameTimer = $.clock.every(FRAME_MS, () => void paintFrame($))
  } else {
    painting.painted = cells
  }
  const { Raster } = $.ui.resolve(e as never) as never as { Raster: any }
  return <Raster key={RASTER_KEY} columns={width} rows={ROWS} cells={cells} />
}

async function toggle($: EngineInterface): Promise<string> {
  const hide = !(await read($, isHidden))
  await update($, isHidden, () => hide)
  await $.store.set('isHidden', hide)
  return hide ? "Clawd's adventure is hidden. /rpg brings it back." : 'Clawd is back on the road.'
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'rpg', description: "Show or hide Clawd's adventure above the prompt" })
    await ensureReady($)
    return next(e)
  })
  on('command.run', { command: 'rpg' }, async $ => ({ text: await toggle($) }))
  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => drawBand($, e as never, next as never) as never)
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `claude plugin test .`
Expected: all pass. If `$.ui.mount` does not accept the HUD's glyphs (Review Focus 4), the first test fails with a refused tree naming a cell index: swap the refused glyph in `hooks/rpg/hud.ts` for an accepted one (`▰▱` → `■□`, `⚑` → `#`) and update `tests/hud.test.ts`'s expected strings to match; record the swap in `docs/spikes.md` (Task 7).

- [ ] **Step 5: Validate and commit**

Run: `claude plugin validate .`
Expected: passes.
```bash
git add hooks/register.tsx tests/mod.test.tsx && git commit -m "The band: Clawd walks the forest across the whole terminal while Claude works"
```

---

### Task 7: Spikes — terminal cost, real glyphs, desktop size

**Files:**
- Create: `hooks/rpg/svg.ts`, `tests/svg.test.ts`, `docs/spikes.md`

**Interfaces:**
- Consumes: `frame`, `Scene` (Task 4), `Grid`, `EMPTY`, `PX_H` (Task 2).
- Produces: `SVG_MAX_CHARS = 131072`, `svgLoop(frames: Grid[], frameMs: number): string` (used again by plan 5).

- [ ] **Step 1: Write the failing test (desktop size spike)**

`tests/svg.test.ts`:
```ts
import { expect, test } from 'claude-code/testing'

import type { RpgStats } from '../types'
import { frame } from '../hooks/rpg/frame'
import { SVG_MAX_CHARS, svgLoop } from '../hooks/rpg/svg'

const STATS: RpgStats = { level: 1, exp: 0, hp: 1, mp: 1, place: '' }

test('a 12-frame walk at 120 columns fits the desktop SVG cap', () => {
  const frames = Array.from({ length: 12 }, (_, i) => frame({ width: 120, t: i * 320, distance: i * 2.24, isWalking: true, stats: STATS }))
  const svg = svgLoop(frames, 320)
  // The number this spike exists to learn; kept in docs/spikes.md.
  console.log(`svg chars for 12 frames at 120 columns: ${svg.length}`)
  expect(svg.length).toBeLessThan(SVG_MAX_CHARS)
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `claude plugin test .`
Expected: FAIL — cannot resolve `../hooks/rpg/svg`.

- [ ] **Step 3: Implement**

`hooks/rpg/svg.ts`:
```ts
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
```

- [ ] **Step 4: Run, read the measured size**

Run: `claude plugin test .`
Expected: PASS, and the log line prints the character count. If it FAILS (over the cap), do not loosen the test: change it to 8 frames at 96 columns, rerun, and record both numbers. Either way, write the numbers into `docs/spikes.md` (Step 6).

- [ ] **Step 5: Manual spike — run it in your real terminal (KaiC)**

The commands below install the local folder as a plugin. In Claude Code:
```
/plugin marketplace add D:\Repos\Apps\clawd-rpg
/plugin install clawd-rpg@clawd-rpg
```
Disable clawd-bar's band for this check with `/clawd` (it toggles clawd-bar off), then restart Claude Code and check:
1. The forest band appears above the prompt, full width, 5 rows; Clawd stands at column ~50.
2. Ask Claude something that takes a while (e.g. "read every file in this repo and summarise it"): Clawd walks and the forest scrolls; no flicker, no lag typing in the prompt.
3. Widen and narrow the window: the band refills the width; below ~100 columns Clawd moves to the left edge; below ~40 the band disappears.
4. The HUD at bottom-right shows `Lv.1`, the bars and `⚑ folder/branch`, with no dark box behind it, and all glyphs render (no `?` or tofu boxes).
5. Open Task Manager while Claude works at full width: note Claude Code's CPU % compared with the band hidden (`/rpg`).

After a change to the repo, `/reload-plugins` picks it up (it reads the repo folder).

- [ ] **Step 6: Record the results**

`docs/spikes.md`:
```markdown
# Spikes (plan 1)

| Question | Result |
|---|---|
| Desktop SVG: chars for 12 frames at 120 columns (cap 131,072) | <number from Step 4> |
| Raster at full width every 160 ms: CPU with band on vs hidden, any flicker | <KaiC's notes from Step 5.5> |
| HUD glyphs ▰ ▱ █ ░ ⚑ … render in KaiC's terminal | <yes / which failed> |
| Text cells take any background colour | <yes/no from Step 5.4> |
```
Fill in every row from Steps 4–5; if any answer is "no", stop and raise it with KaiC before plan 2.

- [ ] **Step 7: Commit**

```bash
git add hooks/rpg/svg.ts tests/svg.test.ts docs/spikes.md && git commit -m "Spikes: desktop SVG size, full-width Raster cost, HUD glyphs"
```

---

### Task 8: Publish the repo (only after KaiC says yes)

**Files:** none new.

- [ ] **Step 1: Ask KaiC** to confirm creating the public GitHub repo `KaiC5504/clawd-rpg` and pushing `main`. Do not run Step 2 without a yes.

- [ ] **Step 2: Create and push**

```bash
cd /d/Repos/Apps/clawd-rpg && gh repo create KaiC5504/clawd-rpg --public --source . --remote origin --description "Clawd goes on an adventure above your Claude Code prompt. Unofficial fan mod." --push
```
Expected: repo created; `main` pushed; the Test workflow starts.

- [ ] **Step 3: Check CI**

Run: `gh run watch --exit-status`
Expected: the Test workflow passes (validate + tests on ubuntu).
