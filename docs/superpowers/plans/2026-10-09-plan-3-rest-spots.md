# clawd-rpg Plan 3 — Rest Spots, Pace and the Quest Line Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Between turns Clawd walks off the road to rest — the lakeside pier right after a turn, the campfire after a minute, the inn after ten or when you compact — and packs up and walks back when you send a prompt; while Claude works his pace follows how busy it is, and the task list shows as a quest line.

**Architecture:** The director (`hooks/rpg/director.ts`) records a **trip** when a turn ends (where on the road he stopped, when he went idle, any compaction, the prompt that called him back) and keeps the task list and the turn's last three tool-call times. A new pure module `hooks/rpg/road.ts` turns a trip into rest spots placed one band apart past that point, says which spot he's heading for, and moves the camera a whole number of pixels each frame at the right pace. `frame.ts` draws the road column by column — forest, or the rest spot at that column — plus signposts, his resting poses, the pier's fishing line, the inn's blanket and the top-left caption or quest line. `register.tsx` feeds the road position into each event and drives the frame timer with `moveRoad`.

**Tech Stack:** TypeScript/TSX run by Claude Code's plugin engine, `claude-code` and `claude-code/testing`, `claude plugin validate .` / `claude plugin test .`.

**Spec:** `docs/superpowers/specs/2026-10-09-clawd-rpg-design.md` (read §2 "Rest spots" / "Stopped scenes", §3.1, §3.2 rows "Thinking…", "Waiting for you", "Idle ≥ 60 s", "Idle ≥ 10 min", "Compact", "New prompt while resting", "Claude needs you", "5h limit", §3.4 quest line, §3.5, §3.6, §5 rule 3). Art reference: `docs/sketches/rpg-sketchbook.html`, v3 · The world (`LOC.pier`, `LOC.camp`, `LOC.inn`, `fire`, the road's signposts and the `fish` / `camp` / `sleep` / `wake` beats).

**This is plan 3 of 5.** Plan 4: Dungeon + Neon City zones with their rest spots (crystal room, ramen stall) and the gates between zones, bosses at the full zone meter, party mini Clawds. Plan 5: desktop SVG loops, `/rpg demo|stats|doctor`, README art, release.

**How this plan was checked:** every code block below was run before the plan was written, in a scratch copy of the repo at `971c689` (Clawd's trot): each task applied in order passes `claude plugin validate .` and gives 127 → 140 → 157 → 163 → 169 passing tests. A contact sheet of the rest scenes at 179 columns (plus 80 and 120) was checked by eye.

## Scope

In: the pier, campfire and inn as full-width rest spots; signposts; walking to them by idle time and on compaction; packing up on a new prompt; resting poses (fishing with a catch now and then, sitting by the fire, asleep under the blanket); captions while resting; the `!` call while resting; working pace (walk, hurry when busy, halved out of usage); the quest line from TaskCreate/TaskUpdate/TaskCompleted and TodoWrite; the compact view of all of it.

Out (later plans): the crystal room and ramen stall (their zones arrive in plan 4), gates between zones (plan 4), bosses and the party (plan 4), `/rpg stats|demo|doctor` and the desktop (plan 5).

## Decisions this plan makes (raise any you disagree with before executing)

- **Where rest spots are.** The road is endless forest, so a trip's spots are placed one band apart past where he stopped: pier, then campfire, then inn. Each is exactly one band wide (spec §2, §5 rule 3), so when he arrives the camera lines up and the band shows that place alone. Below 100 columns a spot is 46 columns wider so its props stay next to Clawd, who stands at column 4 there.
- **Pace.** Whole pixels per frame only (Plan 1's hitch fix): working = 1 px a frame (thinking and reading included), **hurrying** = 2 px a frame when the turn's last three tool calls all started within 8 s, travelling to a rest spot = 2 px a frame. Out of usage every pace is halved. His legs keep time (320 / 160 / 640 ms a step).
- **Session start.** A new session counts as waiting for you: he heads for the pier.
- **Compaction.** A compaction between turns sends him straight to the inn ("z Z · HP refilling", while the HUD's HP refills from the real context). A compaction mid-turn (auto-compact) leaves the fight alone — Plan 2 already keeps the fight through it.
- **Packing up.** A prompt while he's at a spot: 1.2 s of reeling in / getting up, then he walks right, out of the spot and back into the forest. A prompt before he arrived skips the packing.
- **Quest line.** Top-left (`☐ 2/5 fix login`) while he works; resting captions and the victory caption take that spot when they show; hidden in the compact view; task names pass through the HUD's `drawable()` so a name the band can't draw shows `?`.
- **Captions.** Kept from the sketch: `waiting for you…`, `idle · warming up`, `z Z` (`z Z  ·  HP refilling` after a compaction). Wide view only.
- **Signposts.** A post with `→ Pier` / `→ Camp` / `→ Inn` 12 columns before each spot. The name is drawn only where it doesn't touch Clawd, and never in the compact view.
- **Known look to judge in the manual check:** at some widths the campfire's tent stands under the HUD text, as in the sketch.

## Global Constraints

- Plugin `clawd-rpg` at `D:\Repos\Apps\clawd-rpg`; work on branch `plan-3` from `main` at `607da08`.
- Clawd's body colour is `0xde886d` and is never changed: no tint, flash or silhouette. Places, props and effects never use that colour.
- Spec §3.2: "Waiting for you (right after a turn) → walks to the pier and fishes"; "Idle ≥ 60 s (clawd-bar's `DOZE_AFTER_MS`) → walks to the zone's rest spot (Forest → campfire)"; "Idle ≥ 10 min (`SLEEP_AFTER_MS`) → walks to the inn, sleeps in bed"; "Compact → goes to the inn; HP refills as context drops"; "New prompt while resting → packs up (reels in, stands from bed) and walks back into the zone"; "Claude needs you → turns to the camera with `!` wherever he is"; "5h limit used up → trudges (slower walk)".
- Visual rules (spec §5, enforced by tests): Clawd's pixels in every frame are exactly his sprite for that pose (in bed, the blanket covers him from pixel row 6 down); every text cell's background is the pixel beneath; no foe pixel in the HUD's columns on the HUD row; at rest stops the band contains exactly one place at every width from 100 to 300 columns; each frame is a pure function of its scene; no text cell covers one of Clawd's pixels.
- Raster cells must be printable one-column characters or the engine refuses the whole band: every non-ASCII glyph drawn is listed (`GLYPHS`, `FX_GLYPHS`, `ROAD_GLYPHS`) and tested; user-supplied text goes through `drawable()`.
- `types/index.d.ts` must be self-contained: no `import`/`export … from`.
- Render hooks never write state; the story moves only on session events. The road position is module state in `register.tsx`, moved by the frame timer.
- Tempo: frame timer 160 ms; the road moves whole pixels per frame.
- Test width: **179 first** (the band's width in KaiC's 184-column terminal), then 40/99/100/150/220/300.
- Comments sparse, only the non-obvious *why*. Commits plain, no `Co-Authored-By` or other Claude trailers.

## Review Focus

1. **Resizing the terminal while he rests** — he stays on the spot and the band still shows only that place, at the new width. Tests in Task 3 (`a narrower band moves the spot under him, and he stays on it`) and Task 4 (`at a rest spot the band shows that place alone, at every width from 100 to 300`).
2. **A prompt arriving while he's still on his way** — no packing pose, he goes straight back to work. Test in Task 3 (`a prompt before he gets there…`).
3. **Leaving it idle for hours** — he ends at the inn and stays there; nothing comes after the inn, nothing grows. Test in Task 3 (`a compaction goes straight to the inn, and nothing comes after the inn`).
4. **An auto-compaction mid-turn** — the fight goes on; no trip to the inn. Test in Task 2 (`compacting mid-turn changes nothing`).
5. **Task names the band can't draw, or too long to fit** — `?` for what can't be drawn one cell wide, cut with `…` before Clawd. Test in Task 4 (`working, the top-left is the quest line…`) plus the existing rules that no text covers Clawd and every glyph is known.

---

### Task 1: Rest-spot art — the pier, the campfire, the inn, and Clawd at rest

**Files:**
- Modify: `hooks/rpg/places/place.ts` (replace), `hooks/rpg/sprites/fx.ts` (append `fire`), `hooks/rpg/sprites/clawd.ts` (`walking` takes a pace; add `sitting`, `asleep`)
- Create: `hooks/rpg/places/sky.ts`, `hooks/rpg/places/pier.ts`, `hooks/rpg/places/camp.ts`, `hooks/rpg/places/inn.ts`
- Test: `tests/places.test.ts`

**Interfaces:**
- Consumes: `put`, `rect`, `write`, `PX_H`, `Grid` (`hooks/rpg/grid.ts`); `mod`, `noise`, `on` (`hooks/rpg/noise.ts`); `POSES`, `Pose`, `LEG_STEP_MS` (`hooks/rpg/sprites/clawd.ts`).
- Produces: `Place` gains optional `props(g, ox, t, pw)` and `front(g, ox, t, pw)`; `PIER`, `CAMP`, `INN: Place` (`INN.front` is the blanket); `nightSky(g, x, lx, t, top)`; `fire(g, x, size, t)`; `walking(t, legMs = LEG_STEP_MS)`, `sitting(t)`, `asleep(t)`.

- [ ] **Step 1: Write the failing tests**

`tests/places.test.ts`:
```ts
import { describe, expect, test } from 'claude-code/testing'

import { EMPTY, PX_H, at, grid } from '../hooks/rpg/grid'
import { CAMP } from '../hooks/rpg/places/camp'
import { INN } from '../hooks/rpg/places/inn'
import { PIER } from '../hooks/rpg/places/pier'
import type { Place } from '../hooks/rpg/places/place'
import { EYE, ORANGE, asleep, clawd, sitting, walking } from '../hooks/rpg/sprites/clawd'

const RESTS: [string, Place][] = [['pier', PIER], ['camp', CAMP], ['inn', INN]]
const WIDTHS = [179, 40, 99, 100, 150, 220, 300]
const TIMES = [0, 1700, 5200, 9999]

function paint(place: Place, w: number, t: number, room = 0) {
  const g = grid(w + room)
  for (let x = 0; x < w; x++) place.col(g, x, x, t, 0, w)
  place.props?.(g, 0, t, w)
  place.front?.(g, 0, t, w)
  return g
}

describe('rest spots', () => {
  test('each fills every pixel of the band at any width', () => {
    for (const [, place] of RESTS)
      for (const w of WIDTHS) {
        const g = paint(place, w, 0)
        for (let y = 0; y < PX_H; y++) for (let x = 0; x < w; x++) expect(at(g, x, y)).not.toBe(EMPTY)
      }
  })

  test("none of them uses Clawd's orange", () => {
    for (const [, place] of RESTS)
      for (const t of TIMES) {
        const g = paint(place, 179, t)
        expect([...g.px]).not.toContain(ORANGE)
      }
  })

  test('props and text stay inside the place', () => {
    for (const [, place] of RESTS)
      for (const w of [100, 179, 300]) {
        const g = paint(place, w, 0, 40)
        for (let y = 0; y < PX_H; y++) for (let x = w; x < w + 40; x++) expect(at(g, x, y)).toBe(EMPTY)
        for (const key of g.text.keys()) expect(key % (w + 40)).toBeLessThan(w)
      }
  })

  test('the inn names itself in full only when there is room', () => {
    const text = (w: number) => [...paint(INN, w, 0).text.entries()].filter(([k]) => Math.floor(k / w) === 1).map(([, c]) => String.fromCodePoint(c.cp)).join('')
    expect(text(179)).toBe('THE CRAB & QUILL')
    expect(text(140)).toBe('INN')
  })
})

describe('resting poses', () => {
  test('sitting, asleep and a hurried walk keep his body his orange', () => {
    for (const pose of [sitting(0), sitting(2600), asleep(0), asleep(2600), walking(0, 160), walking(160, 160)]) {
      const g = grid(24)
      clawd(g, 4, 1, pose)
      for (const c of g.px) if (c !== EMPTY) expect([ORANGE, EYE]).toContain(c)
    }
  })

  test('hurrying, his legs step twice as often', () => {
    expect([0, 160, 320, 480].map(t => walking(t, 160).step)).toEqual([false, true, false, true])
    expect([0, 160, 320, 480].map(t => walking(t).step)).toEqual([false, false, true, true])
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `claude plugin test .`
Expected: FAIL — `tests/places.test.ts: cannot import "../hooks/rpg/places/pier"` (one of the new places).

- [ ] **Step 3: Implement**

Replace `hooks/rpg/places/place.ts` with:
```ts
import type { Grid } from '../grid'

// A place paints one column at a time so it fills any width: `lx` is the column within the place,
// `cam` the camera's position (for parallax layers), `pw` the place's own width. A rest spot also
// draws its props once (`ox` is where the place starts on screen) and anything in front of Clawd.
export type Place = {
  col(g: Grid, x: number, lx: number, t: number, cam: number, pw: number): void
  props?(g: Grid, ox: number, t: number, pw: number): void
  front?(g: Grid, ox: number, t: number, pw: number): void
}
```

`hooks/rpg/places/sky.ts`:
```ts
import { put } from '../grid'
import type { Grid } from '../grid'
import { noise } from '../noise'

// Rest spots are at night: a dark sky down to `top`, with the odd twinkling star.
export function nightSky(g: Grid, x: number, lx: number, t: number, top: number): void {
  for (let y = 0; y < top; y++) put(g, x, y, y < 3 ? 0x0a0f22 : 0x0d1430)
  if (noise(lx * 5.7) > 0.93) put(g, x, Math.floor(noise(lx * 2.1) * 4), noise(lx + Math.floor(t / 1000)) > 0.25 ? 0xc8d0e8 : 0x3a4260)
}
```

`hooks/rpg/places/pier.ts`:
```ts
import { PX_H, put } from '../grid'
import { mod, noise, on } from '../noise'
import type { Place } from './place'
import { nightSky } from './sky'

const DECK_END = 76

// Where he waits right after a turn: a jetty over the lake, the moon and a boat pinned right.
export const PIER: Place = {
  col(g, x, lx, t, cam, pw) {
    nightSky(g, x, lx, t, 7)
    const hills = 1 + Math.floor(noise(Math.floor((x + cam * 0.3) / 9)) * 2)
    for (let y = 6 - hills; y < 7; y++) put(g, x, y, 0x101a30)
    const moon = pw - 40
    if (lx >= moon && lx <= moon + 2) for (let y = 1; y <= 3; y++) put(g, x, y, lx === moon && y === 1 ? 0x0a0f22 : 0xf1e9c9)
    if (lx < 12) {
      put(g, x, 7, 0x16211a)
      put(g, x, 8, 0x3a3a2a)
      put(g, x, 9, 0x2e2e22)
      return
    }
    for (let y = 7; y < PX_H; y++) {
      const wave = mod(lx + y * 3 - Math.floor(t / 440), 9)
      put(g, x, y, y === 7 ? (wave < 2 ? 0x3f74a8 : 0x2c5a85) : wave < 1 ? 0x2c5a85 : 0x1b3a5c)
    }
    if (lx >= moon && lx <= moon + 2 && on(t + lx * 180, 520)) put(g, x, 9, 0xc9c1a0)
    if (lx < DECK_END) {
      put(g, x, 8, mod(lx, 4) === 0 ? 0x5a3d22 : 0x6b4a2b)
      if (mod(lx, 8) === 0) put(g, x, 9, 0x4a3220)
    }
    if (lx === DECK_END - 2) {
      put(g, x, 6, 0x4a3220)
      put(g, x, 7, 0x4a3220)
    }
    const boat = pw - 22
    if (boat > 92 && lx >= boat && lx <= boat + 5) {
      const y0 = 6 + (on(t, 1800) ? 1 : 0)
      if (lx === boat + 2) put(g, x, y0 - 2, 0xe9e6df)
      put(g, x, y0 - 1, lx === boat || lx === boat + 5 ? 0x6b4a2b : 0x8a5a2b)
    }
  },
}
```

`hooks/rpg/places/camp.ts`:
```ts
import { put, rect } from '../grid'
import { mod, noise, on } from '../noise'
import { fire } from '../sprites/fx'
import type { Place } from './place'
import { nightSky } from './sky'

// The forest's rest spot: a log seat by the fire, the tent pinned right.
export const CAMP: Place = {
  col(g, x, lx, t, _cam, pw) {
    nightSky(g, x, lx, t, 8)
    const treeline = 5 + Math.round(Math.sin(lx / 5) + noise(Math.floor(lx / 3)))
    for (let y = treeline; y < 8; y++) put(g, x, y, 0x0f1a14)
    if (lx < 10 || lx > pw - 12) for (let y = 0; y < 8; y++) put(g, x, y, mod(lx, 5) < 2 ? 0x3a2a1c : 0x0d2416)
    const lit = lx > 64 && lx < 90
    put(g, x, 8, lit ? 0x4a4a24 : 0x2d4a24)
    put(g, x, 9, 0x1f3319)
  },
  props(g, ox, t, pw) {
    rect(g, ox + 50, 8, 14, 1, 0x6b4a2b)
    put(g, ox + 50, 9, 0x4a3220)
    put(g, ox + 63, 9, 0x4a3220)
    fire(g, ox + 76, 1, t)
    const tent = Math.min(pw - 8, Math.max(96, pw - 42))
    if (tent - 6 > 93) for (let i = 0; i < 4; i++) rect(g, ox + 88 + i, 9 - (i % 2), 1, 1 + (i % 2), 0x6b4a2b)
    for (let y = 3; y < 10; y++) {
      const hw = y - 3
      rect(g, ox + tent - hw, y, hw * 2 + 1, 1, 0xc9a26b)
      put(g, ox + tent - hw, y, 0xa07a48)
      put(g, ox + tent + hw, y, 0xa07a48)
      if (y >= 6) rect(g, ox + tent - (y - 6), y, (y - 6) * 2 + 1, 1, 0x2a1f14)
    }
    if (pw - 22 > tent + 8) {
      rect(g, ox + pw - 22, 4, 1, 6, 0x5a3d22)
      put(g, ox + pw - 22, 3, on(t, 800) ? 0xffd27a : 0xffb347)
    }
  },
}
```

`hooks/rpg/places/inn.ts`:
```ts
import { put, rect, write } from '../grid'
import { mod, noise, on } from '../noise'
import type { Place } from './place'

// The Crab & Quill: long idle and compactions end here, tucked into bed by the fireplace.
export const INN: Place = {
  col(g, x, lx) {
    for (let y = 0; y < 2; y++) put(g, x, y, mod(lx + y * 2, 3) === 0 ? 0x5e2c22 : 0x7a3b2e)
    for (let y = 2; y < 8; y++) put(g, x, y, mod(lx, 5) === 0 ? 0x3d2b1f : 0x4a3426)
    if (mod(lx, 60) < 2) for (let y = 2; y < 8; y++) put(g, x, y, 0x2e2018)
    put(g, x, 8, 0x5a3d22)
    put(g, x, 9, 0x3a3532)
  },
  props(g, ox, t, pw) {
    rect(g, ox + 12, 3, 10, 5, 0x5a5f73)
    rect(g, ox + 11, 2, 12, 1, 0x6b6f7f)
    rect(g, ox + 14, 5, 6, 3, 0x1a0e08)
    const f = Math.floor(t / 160)
    for (let c = 0; c < 6; c++) {
      const h = 1 + Math.floor(noise(c * 5 + f) * 2.5)
      for (let j = 0; j < h; j++) put(g, ox + 14 + c, 7 - j, j ? 0xffd60a : 0xff9f1c)
    }
    rect(g, ox + 28, 3, 7, 4, 0x3d2b1f)
    rect(g, ox + 29, 4, 5, 2, 0x1b2a4a)
    put(g, ox + 32, 4, 0xf1e9c9)
    rect(g, ox + 47, 4, 2, 5, 0x6b4a2b)
    rect(g, ox + 49, 6, 21, 2, 0xe9e6df)
    put(g, ox + 49, 8, 0x6b4a2b)
    put(g, ox + 69, 8, 0x6b4a2b)
    rect(g, ox + 49, 5, 4, 1, 0xf4f4f4)
    const roomy = pw - 52 > 92
    if (roomy) {
      rect(g, ox + 80, 6, 10, 1, 0x8a5a2b)
      put(g, ox + 81, 7, 0x6b4a2b)
      put(g, ox + 88, 7, 0x6b4a2b)
      put(g, ox + 84, 5, on(t, 600) ? 0xffd27a : 0xffb347)
      for (const bx of [pw - 52, pw - 46]) {
        rect(g, ox + bx, 5, 4, 3, 0x7a5532)
        rect(g, ox + bx, 6, 4, 1, 0x5a3d22)
      }
    }
    const bar = pw - 36
    rect(g, ox + bar, 5, 26, 3, 0x6b4a2b)
    rect(g, ox + bar, 5, 26, 1, 0x8a5a2b)
    for (const mx of [4, 11, 19]) {
      put(g, ox + bar + mx, 4, 0xe8bd62)
      put(g, ox + bar + mx + 1, 4, 0xf4f4f4)
    }
    write(g, ox + 76, 1, roomy ? 'THE CRAB & QUILL' : 'INN', 0xffd54f)
    put(g, ox + pw - 6, 2, 0x5a5a5a)
    put(g, ox + pw - 6, 3, on(t, 800) ? 0xffd27a : 0xffb347)
  },
  // The blanket goes over him once he's in bed.
  front(g, ox) {
    rect(g, ox + 52, 6, 18, 2, 0xb23a48)
    for (let i = 0; i < 18; i += 3) put(g, ox + 52 + i, 6, 0xd6556a)
  },
}
```

Append to `hooks/rpg/sprites/fx.ts` (its imports already include `put`, `rect` and `noise`):
```ts
// A campfire at column x: stones, logs, and flames that flicker and throw sparks upward.
export function fire(g: Grid, x: number, size: number, t: number): void {
  for (let i = -6; i <= 6; i++) put(g, x + i, 9, Math.abs(i) < 4 ? 0x3a2a1a : 0x2a2016)
  rect(g, x - 3, 9, 7, 1, 0x5a3d22)
  put(g, x - 2, 8, 0x6b4a2b)
  put(g, x + 2, 8, 0x6b4a2b)
  const f = Math.floor(t / 160)
  for (let c = -2; c <= 2; c++) {
    const h = Math.round(size * (4 - Math.abs(c)) * (0.6 + noise(c * 7 + f) * 0.5))
    for (let j = 0; j < h; j++) {
      const q = j / Math.max(1, h)
      put(g, x + c, 8 - j, q < 0.35 ? 0xff6b35 : q < 0.7 ? 0xff9f1c : 0xffd60a)
    }
  }
  for (let i = 0; i < 4; i++) {
    const age = (t / 180 + i * 4) % 12
    put(g, x + Math.round(Math.sin(age + i) * 1.5), 7 - age, 0xffd60a)
  }
}
```

In `hooks/rpg/sprites/clawd.ts`, replace
```ts
export const walking = (t: number): Pose => (Math.floor(t / LEG_STEP_MS) % 2 === 1 ? { fx: 1, step: true } : { fx: 1, step: false, hop: true })
```
with
```ts
// `legMs`: how long each step takes; he hurries with quicker steps.
export const walking = (t: number, legMs = LEG_STEP_MS): Pose => (Math.floor(t / legMs) % 2 === 1 ? { fx: 1, step: true } : { fx: 1, step: false, hop: true })
```
and append to the end of the file:
```ts
// By the campfire: sitting, leaning out now and then.
export const sitting = (t: number): Pose => (Math.floor(t / 2600) % 2 === 1 ? POSES.sitOut : POSES.sit)

// In bed: sitting low, breathing slowly; the inn's blanket covers him from row 6 down.
export const asleep = (t: number): Pose => ({ sit: true, top: Math.floor(t / 2600) % 2 === 1 ? 10 : 9 })
```

- [ ] **Step 4: Run to verify they pass**

Run: `claude plugin validate . && claude plugin test .`
Expected: validation passes; 127 pass (121 + 6).

- [ ] **Step 5: Commit**

```bash
git add hooks/rpg/places hooks/rpg/sprites tests/places.test.ts && git commit -m "Rest spots: the lakeside pier, the campfire and the Crab & Quill inn, and Clawd sitting and asleep"
```

---

### Task 2: The director keeps trips, the task list, and his pace

**Files:**
- Modify: `types/index.d.ts` (replace), `hooks/rpg/director.ts` (replace)
- Test: `tests/director.test.ts` (add `questOf` to the import list; append tests)

**Interfaces:**
- Consumes: Plan 2's director (`step`, `endTurn`, `NO_STORY`, …).
- Produces:
  - Types: `RestKind = 'pier' | 'camp' | 'inn'`, `Trip = { origin, at, compactAt, leftAt }`, `QuestTask = { id, subject, status }`; `Story` gains `trip: Trip | null`, `trail: Trip | null`, `tasks: QuestTask[]` and `turn.recent: number[]`.
  - `step(story, event, payload, now)` reads `payload.roadAt` (road pixels, added by `register.tsx` in Task 5) on `SessionStart` and `TurnEnded`, and understands three new events: `Compact`, `TaskCreated` (`task_id`, `task_subject`), `TaskCompleted` (`task_id`, `task_subject`). `PreToolUse` of `TodoWrite` / `TaskUpdate` updates the task list.
  - `questOf(story): string | null` — `☐ done/total subject`.

- [ ] **Step 1: Write the failing tests**

In `tests/director.test.ts`, add `questOf` to the names imported from `'../hooks/rpg/director'` (after `lootName`), then append:
```ts
const ended = (roadAt: number, reason = 'answer'): [string, HookPayload] => ['TurnEnded', { reason, roadAt }]

describe('resting between turns', () => {
  test('a finished turn starts a trip from where he stopped on the road', () => {
    const { story, at } = play([prompt, edit(), ended(340)])
    expect(story.trip).toEqual({ origin: 340, at, compactAt: null, leftAt: null })
  })

  test('an interrupted turn sends him resting too', () => {
    expect(play([prompt, edit(), ended(12, 'aborted')]).story.trip?.origin).toBe(12)
  })

  test('a new session starts him resting where the road left off', () => {
    expect(step(NO_STORY, 'SessionStart', { source: 'startup', roadAt: 90 }, T0).story.trip).toEqual({ origin: 90, at: T0, compactAt: null, leftAt: null })
  })

  test('a prompt calls him back: the trip is left, and kept for the road behind him', () => {
    const { story, at } = play([['SessionStart', { source: 'startup', roadAt: 0 }], prompt])
    expect(story.trip).toMatchObject({ origin: 0, leftAt: at })
    expect(story.turn.active).toBe(true)
  })

  test("the next turn's trip starts where he stopped, and the last one becomes the trail", () => {
    const { story } = play([['SessionStart', { source: 'startup', roadAt: 0 }], prompt, edit(), ended(500)])
    expect(story.trail).toMatchObject({ origin: 0 })
    expect(story.trip).toMatchObject({ origin: 500, leftAt: null })
  })

  test('compacting while he rests sends him on to the inn, once', () => {
    const { story } = play([prompt, ended(0), ['Compact', {}], ['Compact', {}]])
    expect(story.trip?.compactAt).toBe(T0 + 3000)
  })

  test('compacting mid-turn changes nothing', () => {
    const { story } = play([prompt, edit()])
    expect(step(story, 'Compact', {}, T0 + 9000).story).toBe(story)
  })
})

describe('the quest line', () => {
  const created = (id: string, subject: string): [string, HookPayload] => ['TaskCreated', { task_id: id, task_subject: subject }]
  const completed = (id: string): [string, HookPayload] => ['TaskCompleted', { task_id: id, task_subject: '' }]

  test('created and completed tasks make the quest line: done of total, then the next one up', () => {
    const { story } = play([prompt, created('1', 'read the spec'), created('2', 'fix login'), created('3', 'ship it'), completed('1')])
    expect(questOf(story)).toBe('☐ 1/3 fix login')
  })

  test('TodoWrite hands over the whole list, and the task in progress leads', () => {
    const todos = [
      { content: 'read the spec', status: 'completed' },
      { content: 'add tests', status: 'pending' },
      { content: 'fix login', status: 'in_progress' },
    ]
    expect(questOf(play([prompt, pre('TodoWrite', { todos })]).story)).toBe('☐ 1/3 fix login')
  })

  test('TaskUpdate moves a task along, and deleting one drops it', () => {
    const { story } = play([
      prompt,
      created('1', 'a'),
      created('2', 'b'),
      pre('TaskUpdate', { taskId: '2', status: 'in_progress' }),
      pre('TaskUpdate', { taskId: '1', status: 'deleted' }),
    ])
    expect(questOf(story)).toBe('☐ 0/1 b')
  })

  test('with no tasks, or all of them done, there is no quest line', () => {
    expect(questOf(NO_STORY)).toBeNull()
    expect(questOf(play([prompt, created('1', 'a'), completed('1')]).story)).toBeNull()
  })

  test('tasks outlast a prompt but not a new session', () => {
    const { story } = play([prompt, created('1', 'a'), prompt])
    expect(questOf(story)).toBe('☐ 0/1 a')
    expect(questOf(step(story, 'SessionStart', { source: 'clear' }, T0 + 9000).story)).toBeNull()
  })
})

describe('pace', () => {
  test('the last three tool calls are remembered, and a prompt forgets them', () => {
    const { story, at } = play([prompt, edit(), edit(), edit(), edit()])
    expect(story.turn.recent).toEqual([at - 2000, at - 1000, at])
    expect(step(story, 'UserPromptSubmit', {}, at + 1).story.turn.recent).toEqual([])
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `claude plugin test .`
Expected: FAIL — `Export named 'questOf' not found in module '…hooks/rpg/director.ts'`.

- [ ] **Step 3: Implement**

Replace `types/index.d.ts` with:
```ts
// HP and MP are what's left (1 = full); exp is progress to the next level.
export type RpgStats = { level: number; exp: number; hp: number; mp: number; place: string }

export type WorkKind = 'edit' | 'write' | 'shell' | 'tests' | 'install' | 'mcp' | 'other'

// `passed` / `failed`: test counts, when the runner's output gave them.
export type WorkResult = { ok: boolean; ms: number; passed?: number; failed?: number }

// `cmd`: the program a shell call runs (or the package manager, for installs).
export type Work = {
  id: string
  kind: WorkKind
  startedAt: number
  ext?: string
  removed?: number
  added?: number
  lines?: number
  cmd?: string
  server?: string
  result?: WorkResult
}

export type FoeKind = 'goblin' | 'shroom'

// `at` is when it dropped in; `hitAt` the last blow it took.
export type Foe = { kind: FoeKind; hp: number; maxHp: number; elite: boolean; at: number; hitAt: number }

export type RestKind = 'pier' | 'camp' | 'inn'

// A trip to the rest spots, which stand one band apart past `origin` (road pixels, where he stopped).
// `at`: when he went idle; `compactAt`: a compaction that sends him on to the inn; `leftAt`: the
// prompt that called him back.
export type Trip = { origin: number; at: number; compactAt: number | null; leftAt: number | null }

export type QuestTask = { id: string; subject: string; status: 'pending' | 'in_progress' | 'completed' }

// The battle on the band, moved on by session events (hooks/rpg/director.ts). Times are clock ms.
export type Story = {
  // `recent`: when the turn's last three tool calls started, which sets his pace.
  turn: { active: boolean; at: number; files: Record<string, number>; gained: number; foes: number; recent: number[] }
  foe: Foe | null
  skill: { name: string; at: number } | null
  down: { kind: FoeKind; at: number; finisher: boolean } | null
  counter: { n: number; at: number } | null
  victory: { at: number; loot: string; gained: number } | null
  fled: { kind: FoeKind; at: number } | null
  levelUp: { level: number; at: number } | null
  calledAt: number | null
  // Calls still running, by tool_use_id, so each settles once however many hooks report it.
  calls: Record<string, Work>
  // The trip he is on, and the one before it, still drawn while it scrolls away behind him.
  trip: Trip | null
  trail: Trip | null
  tasks: QuestTask[]
}

declare module 'claude-code' {
  interface PluginState {
    'clawd-rpg': {
      isHidden: boolean
      stats: RpgStats
      story: Story
    }
  }
}
```

Replace `hooks/rpg/director.ts` with:
```ts
import type { Foe, FoeKind, QuestTask, Story, Trip, Work, WorkKind } from '../../types'
import { classifyCall, settleCall } from '../plumbing/work'
import { noise } from './noise'
import { EXP } from './progress'
import type { Award } from './progress'

export type { Foe, FoeKind, QuestTask, Story, Trip }
export type HookPayload = Record<string, unknown>
export type Beat = 'walk' | 'idle' | 'encounter' | 'enemyTurn' | 'finisher' | 'victory' | 'flee'

export const FOE_ENTER_MS = 800
export const SKILL_MS = 1400
export const DOWN_MS = 1000
export const COUNTER_MS = 2000
export const FINISHER_MS = 2400
export const VICTORY_MS = 4400
export const FLEE_MS = 1600
export const CALL_MS = 6000
export const LEVEL_UP_MS = 3000

export const FOREST_ROSTER: readonly FoeKind[] = ['goblin', 'shroom']

export const SKILLS: Partial<Record<WorkKind, string>> = {
  edit: 'CLAW STRIKE',
  write: 'SCRIBE SLASH',
  shell: 'SHELL SHOCK',
  install: 'SHELL SHOCK',
  mcp: 'LINK BEAM',
}

const TROPHY: Record<FoeKind, string> = { goblin: 'Goblin Fang', shroom: 'Glow Cap' }
const LOOT_WORDS = ['Blade', 'Tome', 'Charm', 'Sigil'] as const

export const NO_STORY: Story = {
  turn: { active: false, at: 0, files: {}, gained: 0, foes: 0, recent: [] },
  foe: null,
  skill: null,
  down: null,
  counter: null,
  victory: null,
  fled: null,
  levelUp: null,
  calledAt: null,
  calls: {},
  trip: null,
  trail: null,
  tasks: [],
}

const str = (value: unknown) => (typeof value === 'string' ? value : '')
const base = (path: string) => path.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? path

function spawn(s: Story, now: number): Foe {
  const seed = s.turn.at / 997 + s.turn.foes * 7.3
  const kind = FOREST_ROSTER[Math.floor(noise(seed) * FOREST_ROSTER.length)]!
  const maxHp = 2 + Math.floor(noise(seed + 1) * 3)
  return { kind, hp: maxHp, maxHp, elite: false, at: now, hitAt: 0 }
}

// The file edited most this turn names the loot; a turn without edits keeps a trophy from the fight.
export function lootName(files: Record<string, number>, lastFoe: FoeKind | null): string {
  const top = Object.entries(files).sort((a, b) => b[1] - a[1])[0]?.[0]
  if (!top) return lastFoe ? TROPHY[lastFoe] : 'Forest Herb'
  const word = LOOT_WORDS[[...top].reduce((n, ch) => n + ch.codePointAt(0)!, 0) % LOOT_WORDS.length]!
  return `${word} of ${top}`
}

function defeat(s: Story, foe: Foe, now: number, finisher: boolean, awards: Award[]): Story {
  const kind = foe.elite ? 'elite' : 'battle'
  awards.push({ kind, foe: foe.kind })
  return { ...s, foe: null, down: { kind: foe.kind, at: now, finisher }, turn: { ...s.turn, gained: s.turn.gained + EXP[kind] } }
}

function attack(s: Story, work: Work, path: string, now: number, awards: Award[]): Story {
  const name = SKILLS[work.kind]
  if (!name) return s
  const files = path && (work.kind === 'edit' || work.kind === 'write') ? { ...s.turn.files, [base(path)]: (s.turn.files[base(path)] ?? 0) + 1 } : s.turn.files
  const fresh = s.foe === null
  const foe = s.foe ?? spawn(s, now)
  const next: Story = { ...s, skill: { name, at: now }, turn: { ...s.turn, files, foes: s.turn.foes + (fresh ? 1 : 0) } }
  // An elite stands for a failing test: only a passing run finishes it.
  const hp = foe.elite ? Math.max(1, foe.hp - 1) : foe.hp - 1
  if (hp <= 0) return defeat(next, foe, now, false, awards)
  return { ...next, foe: { ...foe, hp, hitAt: now } }
}

function settle(s: Story, payload: HookPayload, failed: boolean, now: number, awards: Award[]): Story {
  const id = str(payload.tool_use_id)
  const open = s.calls[id]
  if (!open) return s
  const { [id]: _, ...calls } = s.calls
  const work = settleCall(open, payload, failed, now)
  const next = { ...s, calls }
  if (work.kind !== 'tests') return failed ? { ...next, counter: { n: 1, at: now } } : next
  const result = work.result!
  if (!result.ok || (result.failed ?? 0) > 0) {
    const foe = next.foe ?? spawn(next, now)
    return {
      ...next,
      counter: { n: Math.max(1, result.failed ?? 0), at: now },
      foe: { ...foe, elite: true, hp: Math.max(foe.hp, 2) },
      turn: { ...next.turn, foes: next.turn.foes + (next.foe ? 0 : 1) },
    }
  }
  return next.foe ? defeat(next, next.foe, now, true, awards) : next
}

function endTurn(s: Story, reason: string, now: number, awards: Award[]): Story {
  if (!s.turn.active) return s
  const ended: Story = { ...s, calls: {}, turn: { ...s.turn, active: false } }
  if (reason !== 'answer') return { ...ended, foe: null, fled: s.foe ? { kind: s.foe.kind, at: now } : null }
  let won = ended
  if (won.foe && !won.foe.elite) won = defeat(won, won.foe, now, false, awards)
  else if (won.foe) won = { ...won, foe: null, fled: { kind: won.foe.kind, at: now } }
  awards.push({ kind: 'turn' })
  const gained = won.turn.gained + EXP.turn
  return { ...won, turn: { ...won.turn, gained }, victory: { at: now, loot: lootName(won.turn.files, won.down?.kind ?? null), gained } }
}

const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0)
const restFrom = (roadAt: unknown, now: number): Trip => ({ origin: num(roadAt), at: now, compactAt: null, leftAt: null })

const taskStatus = (value: unknown): QuestTask['status'] => (value === 'completed' || value === 'in_progress' ? value : 'pending')

// TodoWrite hands over the whole list; TaskUpdate moves one task along, or deletes it.
function plan(tasks: QuestTask[], tool: string, input: HookPayload): QuestTask[] {
  if (tool === 'TodoWrite' && Array.isArray(input.todos)) {
    return (input.todos as HookPayload[]).map((todo, i) => ({ id: `todo-${i}`, subject: str(todo.content), status: taskStatus(todo.status) }))
  }
  if (tool !== 'TaskUpdate') return tasks
  const id = str(input.taskId)
  if (input.status === 'deleted') return tasks.filter(task => task.id !== id)
  return tasks.map(task => (task.id !== id ? task : { ...task, subject: str(input.subject) || task.subject, status: input.status === undefined ? task.status : taskStatus(input.status) }))
}

function created(tasks: QuestTask[], id: string, subject: string): QuestTask[] {
  return !id || tasks.some(task => task.id === id) ? tasks : [...tasks, { id, subject, status: 'pending' }]
}

function completed(tasks: QuestTask[], id: string, subject: string): QuestTask[] {
  if (!tasks.some(task => task.id === id)) return [...tasks, { id, subject, status: 'completed' }]
  return tasks.map(task => (task.id === id ? { ...task, status: 'completed' } : task))
}

// Session events in, the story out, plus the deeds that earn EXP.
export function step(s: Story, event: string, payload: HookPayload, now: number): { story: Story; awards: Award[] } {
  const awards: Award[] = []
  const story = ((): Story => {
    switch (event) {
      // A compaction happens mid-turn: the fight goes on through it.
      case 'SessionStart':
        return payload.source === 'compact' ? s : { ...NO_STORY, trip: restFrom(payload.roadAt, now) }
      case 'UserPromptSubmit':
        return {
          ...NO_STORY,
          levelUp: s.levelUp,
          tasks: s.tasks,
          trip: s.trip && { ...s.trip, leftAt: s.trip.leftAt ?? now },
          trail: s.trail,
          turn: { active: true, at: now, files: {}, gained: 0, foes: 0, recent: [] },
        }
      case 'PreToolUse': {
        // Background work after the turn has ended has no turn to close its fight.
        if (!s.turn.active) return s
        const input = typeof payload.tool_input === 'object' && payload.tool_input !== null ? (payload.tool_input as HookPayload) : {}
        const id = str(payload.tool_use_id)
        const work = classifyCall(str(payload.tool_name), input, id, now)
        const recent = [...(s.turn.recent ?? []), now].slice(-3)
        const opened = { ...s, calls: { ...s.calls, [id]: work }, tasks: plan(s.tasks, str(payload.tool_name), input), turn: { ...s.turn, recent } }
        return attack(opened, work, str(input.file_path) || str(input.notebook_path), now, awards)
      }
      case 'PostToolUse':
        return settle(s, payload, false, now, awards)
      case 'PostToolUseFailure':
        return settle(s, payload, true, now, awards)
      case 'TurnEnded': {
        const ended = endTurn(s, str(payload.reason), now, awards)
        return ended === s ? s : { ...ended, trip: restFrom(payload.roadAt, now), trail: s.trip }
      }
      // A compaction between turns sends him to the inn; one mid-turn leaves the fight be.
      case 'Compact':
        return !s.turn.active && s.trip && s.trip.leftAt === null && s.trip.compactAt === null ? { ...s, trip: { ...s.trip, compactAt: now } } : s
      case 'TaskCreated':
        return { ...s, tasks: created(s.tasks, str(payload.task_id), str(payload.task_subject)) }
      case 'TaskCompleted':
        return { ...s, tasks: completed(s.tasks, str(payload.task_id), str(payload.task_subject)) }
      case 'Notification':
      case 'Elicitation':
        return { ...s, calledAt: now }
      default:
        return s
    }
  })()
  return { story, awards }
}

// `☐ 2/5 fix login`: the task list as a quest, led by the task in progress, or the next one up.
export function questOf(s: Story): string | null {
  const tasks = s.tasks ?? []
  const done = tasks.filter(task => task.status === 'completed').length
  const next = tasks.find(task => task.status === 'in_progress') ?? tasks.find(task => task.status === 'pending')
  return next ? `☐ ${done}/${tasks.length} ${next.subject}` : null
}

export const withLevelUp = (s: Story, level: number, now: number): Story => ({ ...s, levelUp: { level, at: now } })

const within = (at: number | undefined, ms: number, now: number) => at !== undefined && now >= at && now - at < ms

export function beatOf(s: Story, now: number): Beat {
  if (within(s.fled?.at, FLEE_MS, now)) return 'flee'
  if (within(s.victory?.at, VICTORY_MS, now)) return 'victory'
  if (s.down?.finisher && within(s.down.at, FINISHER_MS, now)) return 'finisher'
  if (within(s.counter?.at, COUNTER_MS, now)) return 'enemyTurn'
  if (s.foe || within(s.down?.at, DOWN_MS, now)) return 'encounter'
  return s.turn.active ? 'walk' : 'idle'
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `claude plugin validate . && claude plugin test .`
Expected: validation passes; 140 pass (13 new).

- [ ] **Step 5: Commit**

```bash
git add types/index.d.ts hooks/rpg/director.ts tests/director.test.ts && git commit -m "The director keeps rest trips, the task list and the pace of tool calls"
```

---

### Task 3: The road — where the rest spots stand and how fast he gets there

**Files:**
- Create: `hooks/rpg/road.ts`
- Test: `tests/road.test.ts`

**Interfaces:**
- Consumes: `Story`, `Trip`, `RestKind` (Task 2); `beatOf`, `CALL_MS` (director); `LEG_STEP_MS` (Clawd sprite).
- Produces: `CLAWD_COL = 50`, `COMPACT_COL = 4`, `COMPACT_BELOW = 100`, `clawdCol(width)` (moved here from `frame.ts`, which re-exports them in Task 4); `DOZE_MS = 60_000`, `SLEEP_MS = 600_000`, `PACK_MS = 1200`, `HURRY_WINDOW_MS = 8000`; `stopsOf(trip, now): RestKind[]`; `placeWidth(width)`; `camOf(distance, width)`; `type Spot = { kind, from }`; `spotsOf(trip, now, width): Spot[]`; `goalOf(story, now, width): Spot | null`; `placeAt(story, wx, now, width): Spot | null`; `type Rest = { kind, phase: 'travel' | 'rest' | 'pack', since }`; `restOf(story, now, distance, width): Rest | null`; `type Motion = { distance, isWalking, legMs }`; `moveRoad(story, now, distance, width, frame, isWorking, trudge): Motion`.

- [ ] **Step 1: Write the failing tests**

`tests/road.test.ts`:
```ts
import { describe, expect, test } from 'claude-code/testing'

import { NO_STORY } from '../hooks/rpg/director'
import type { Story, Trip } from '../hooks/rpg/director'
import { DOZE_MS, PACK_MS, SLEEP_MS, camOf, goalOf, moveRoad, placeAt, placeWidth, restOf, spotsOf, stopsOf } from '../hooks/rpg/road'

const T0 = 1_000_000
const W = 179
const trip = (over: Partial<Trip> = {}): Trip => ({ origin: 1000, at: T0, compactAt: null, leftAt: null, ...over })
const resting = (over: Partial<Trip> = {}): Story => ({ ...NO_STORY, trip: trip(over) })
const working = (recent: number[] = []): Story => ({ ...NO_STORY, turn: { ...NO_STORY.turn, active: true, recent }, trip: trip({ leftAt: T0 }) })

// Runs the road for `frames` frames from `distance`, 160 ms apart, and returns where it got to.
function run(story: Story, frames: number, distance: number, isWorking: boolean, trudge = false, width = W, at = T0) {
  let d = distance
  for (let f = 0; f < frames; f++) d = moveRoad(story, at + f * 160, d, width, f, isWorking, trudge).distance
  return d
}

describe('where he rests', () => {
  test('the pier right after a turn, the campfire after a minute, the inn after ten', () => {
    expect(stopsOf(trip(), T0)).toEqual(['pier'])
    expect(stopsOf(trip(), T0 + DOZE_MS)).toEqual(['pier', 'camp'])
    expect(stopsOf(trip(), T0 + SLEEP_MS)).toEqual(['pier', 'camp', 'inn'])
  })

  test('a compaction goes straight to the inn, and nothing comes after the inn', () => {
    const compacted = trip({ compactAt: T0 + 5000 })
    expect(stopsOf(compacted, T0 + 5000)).toEqual(['pier', 'inn'])
    expect(stopsOf(compacted, T0 + SLEEP_MS * 2)).toEqual(['pier', 'inn'])
  })

  test('a trip a prompt called him back from stays as it was', () => {
    expect(stopsOf(trip({ leftAt: T0 + 1000 }), T0 + SLEEP_MS)).toEqual(['pier'])
  })

  test('the spots stand one band apart past where he stopped', () => {
    expect(spotsOf(trip(), T0 + DOZE_MS, W)).toEqual([
      { kind: 'pier', from: 1000 + W },
      { kind: 'camp', from: 1000 + 2 * W },
    ])
  })

  test('in the compact view a spot is wider, so its props stay where he sits', () => {
    expect(placeWidth(80)).toBe(126)
    expect(camOf(1000, 80)).toBe(1046)
    expect(camOf(1000, W)).toBe(1000)
  })

  test("the current trip's spots cover the last trip's, and the forest is everywhere else", () => {
    const story: Story = { ...NO_STORY, trail: trip({ leftAt: T0 + 1 }), trip: trip({ origin: 1100, at: T0 + 2000 }) }
    expect(placeAt(story, 1000 + W, T0 + 3000, W)).toEqual({ kind: 'pier', from: 1000 + W })
    expect(placeAt(story, 1100 + W, T0 + 3000, W)).toEqual({ kind: 'pier', from: 1100 + W })
    expect(placeAt(story, 999, T0 + 3000, W)).toBeNull()
  })
})

describe('getting there', () => {
  test('idle, he hurries two pixels a frame to the pier and stops exactly on it', () => {
    expect(run(resting(), 10, 1000, false)).toBe(1020)
    expect(run(resting(), 200, 1000, false)).toBe(1000 + W)
    expect(restOf(resting(), T0, 1000 + W, W)).toEqual({ kind: 'pier', phase: 'rest', since: T0 })
    expect(moveRoad(resting(), T0, 1000 + W, W, 0, false, false).isWalking).toBe(false)
  })

  test('after a minute he gets up and walks on to the campfire', () => {
    const later = T0 + DOZE_MS
    expect(goalOf(resting(), later, W)).toEqual({ kind: 'camp', from: 1000 + 2 * W })
    expect(run(resting(), 300, 1000 + W, false, false, W, later)).toBe(1000 + 2 * W)
  })

  test('a narrower band moves the spot under him, and he stays on it', () => {
    expect(moveRoad(resting(), T0, 1000 + W, 150, 0, false, false).distance).toBe(1150)
  })

  test('a prompt while he rests: he packs up first, then walks back to work', () => {
    const called: Story = { ...working(), trip: trip({ leftAt: T0 + 500 }) }
    expect(restOf(called, T0 + 600, 1000 + W, W)).toEqual({ kind: 'pier', phase: 'pack', since: T0 + 500 })
    expect(moveRoad(called, T0 + 600, 1000 + W, W, 0, true, false).distance).toBe(1000 + W)
    expect(moveRoad(called, T0 + 500 + PACK_MS, 1000 + W, W, 0, true, false).distance).toBe(1001 + W)
  })

  test('a prompt before he gets there: nothing to pack, he goes straight back to work', () => {
    const called: Story = { ...working(), trip: trip({ leftAt: T0 + 500 }) }
    expect(restOf(called, T0 + 600, 1050, W)).toBeNull()
    expect(moveRoad(called, T0 + 600, 1050, W, 0, true, false).distance).toBe(1051)
  })
})

describe('pace', () => {
  test('working, he walks one pixel a frame', () => {
    expect(run(working(), 12, 0, true)).toBe(12)
  })

  test('three tool calls in eight seconds and he hurries, two pixels a frame', () => {
    expect(run(working([T0 - 3000, T0 - 2000, T0 - 1000]), 12, 0, true)).toBe(24)
    expect(run(working([T0 - 30000, T0 - 2000, T0 - 1000]), 12, 0, true)).toBe(12)
  })

  test('out of usage every pace is halved', () => {
    expect(run(working(), 12, 0, true, true)).toBe(6)
    expect(run(resting(), 12, 1000, false, true)).toBe(1012)
  })

  test('his legs keep time with the pace', () => {
    expect(moveRoad(working(), T0, 0, W, 0, true, false).legMs).toBe(320)
    expect(moveRoad(resting(), T0, 1000, W, 0, false, false).legMs).toBe(160)
    expect(moveRoad(working(), T0, 0, W, 0, true, true).legMs).toBe(640)
  })

  test('a fight, or Claude calling, stops him where he is', () => {
    const fighting: Story = { ...working(), foe: { kind: 'goblin', hp: 2, maxHp: 2, elite: false, at: T0, hitAt: 0 } }
    expect(run(fighting, 12, 0, true)).toBe(0)
    expect(run({ ...resting(), calledAt: T0 }, 12, 1000, false)).toBe(1000)
  })

  test('idle with nowhere to go, he stays put', () => {
    expect(run(NO_STORY, 12, 40, false)).toBe(40)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `claude plugin test .`
Expected: FAIL — `tests/road.test.ts: cannot import "../hooks/rpg/road"`.

- [ ] **Step 3: Implement**

`hooks/rpg/road.ts`:
```ts
import type { RestKind, Story, Trip } from '../../types'
import { CALL_MS, beatOf } from './director'
import { LEG_STEP_MS } from './sprites/clawd'

export const CLAWD_COL = 50
export const COMPACT_COL = 4
// Below this a fight can't fit left of the HUD, so the band shows Clawd and the place only.
export const COMPACT_BELOW = 100

export const clawdCol = (width: number) => (width < COMPACT_BELOW ? COMPACT_COL : CLAWD_COL)

// clawd-bar's DOZE_AFTER_MS and SLEEP_AFTER_MS: a minute idle he moves on to the campfire, ten to the inn.
export const DOZE_MS = 60_000
export const SLEEP_MS = 600_000
// Reeling in, or getting up, before he walks back to work.
export const PACK_MS = 1200
// Three tool calls inside this window and he hurries.
export const HURRY_WINDOW_MS = 8000

// Paces in road pixels per four frames: whole pixels only, since a fraction scrolls unevenly.
const WALK = 4
const HURRY = 8

const SCHEDULE: readonly [RestKind, number][] = [
  ['pier', 0],
  ['camp', DOZE_MS],
  ['inn', SLEEP_MS],
]

// The rest spots a trip has reached by `now`, in order. A compaction goes straight to the inn, and
// the inn is always the last stop.
export function stopsOf(trip: Trip, now: number): RestKind[] {
  const until = trip.leftAt ?? now
  const due: [RestKind, number][] = SCHEDULE.map(([kind, after]) => [kind, trip.at + after])
  if (trip.compactAt !== null) due.push(['inn', trip.compactAt])
  due.sort((a, b) => a[1] - b[1])
  const stops: RestKind[] = []
  for (const [kind, at] of due) {
    if (at > until || stops.includes(kind)) continue
    stops.push(kind)
    if (kind === 'inn') break
  }
  return stops
}

// A stopped scene fills the band, so a rest spot is one band wide. In the compact view Clawd stands
// further left, so the spot stretches to keep its props where he sits.
export const placeWidth = (width: number) => width + CLAWD_COL - clawdCol(width)

// The road column at the band's left edge, when the camera is at `distance`.
export const camOf = (distance: number, width: number) => Math.floor(distance) + CLAWD_COL - clawdCol(width)

export type Spot = { kind: RestKind; from: number }

export function spotsOf(trip: Trip, now: number, width: number): Spot[] {
  const pw = placeWidth(width)
  return stopsOf(trip, now).map((kind, i) => ({ kind, from: trip.origin + (i + 1) * pw }))
}

// Where the road takes him while he rests: the last spot his trip has reached.
export function goalOf(story: Story, now: number, width: number): Spot | null {
  const trip = story.trip
  if (!trip || trip.leftAt !== null) return null
  return spotsOf(trip, now, width).at(-1) ?? null
}

// The rest spot at road column `wx`, if any; the current trip's spots cover the last trip's.
export function placeAt(story: Story, wx: number, now: number, width: number): Spot | null {
  const pw = placeWidth(width)
  for (const trip of [story.trip, story.trail]) {
    if (!trip) continue
    for (const spot of spotsOf(trip, now, width)) if (wx >= spot.from && wx < spot.from + pw) return spot
  }
  return null
}

export type Rest = { kind: RestKind; phase: 'travel' | 'rest' | 'pack'; since: number }

// What resting looks like now: on his way to a spot, there, or packing up after a prompt.
export function restOf(story: Story, now: number, distance: number, width: number): Rest | null {
  const trip = story.trip
  if (!trip) return null
  const d = Math.floor(distance)
  if (trip.leftAt !== null) {
    const left = spotsOf(trip, trip.leftAt, width).at(-1)
    return left && d === left.from && now - trip.leftAt < PACK_MS ? { kind: left.kind, phase: 'pack', since: trip.leftAt } : null
  }
  const goal = goalOf(story, now, width)
  if (!goal) return null
  return { kind: goal.kind, phase: d === goal.from ? 'rest' : 'travel', since: trip.at }
}

const isHurried = (story: Story, now: number) => {
  const recent = story.turn.recent ?? []
  return recent.length >= 3 && now - recent[recent.length - 3]! <= HURRY_WINDOW_MS
}

export type Motion = { distance: number; isWalking: boolean; legMs: number }

// One frame of the road: how far the camera moves, given the story and whether Claude is working.
export function moveRoad(story: Story, now: number, distance: number, width: number, frame: number, isWorking: boolean, trudge: boolean): Motion {
  const still: Motion = { distance, isWalking: false, legMs: LEG_STEP_MS }
  const beat = beatOf(story, now)
  if (beat !== 'walk' && beat !== 'idle') return still
  if (story.calledAt !== null && now - story.calledAt < CALL_MS) return still
  if (restOf(story, now, distance, width)?.phase === 'pack') return still
  const goal = isWorking ? null : goalOf(story, now, width)
  if (!isWorking && !goal) return still
  // A narrower band moves the spot back under him: he stays on it rather than wandering off.
  if (goal && distance >= goal.from) return { ...still, distance: distance - goal.from < placeWidth(width) ? goal.from : distance }
  let rate = goal || isHurried(story, now) ? HURRY : WALK
  if (trudge) rate /= 2
  const step = Math.floor(((frame + 1) * rate) / 4) - Math.floor((frame * rate) / 4)
  return { distance: goal ? Math.min(goal.from, distance + step) : distance + step, isWalking: true, legMs: (LEG_STEP_MS * WALK) / rate }
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `claude plugin validate . && claude plugin test .`
Expected: validation passes; 157 pass (17 new).

- [ ] **Step 5: Commit**

```bash
git add hooks/rpg/road.ts tests/road.test.ts && git commit -m "The road: rest spots one band apart past where he stopped, and whole-pixel paces to reach them"
```

---

### Task 4: The frame draws the road, his rest, the signposts and the quest line

**Files:**
- Modify: `hooks/rpg/frame.ts` (replace), `hooks/rpg/grid.ts` (add `line`), `hooks/rpg/sprites/clawd.ts` (`trudging` takes a pace)
- Test: `tests/frame.test.ts` (replace)

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: `Scene` gains `legMs?: number`; `clawdAt(scene)` returns `ClawdPlace = { x, y, pose, strike, tucked? }` (`y` is new: −1 in bed, 1 otherwise); `ROAD_GLYPHS = ['→', '☐', '…']`; `frame.ts` re-exports `CLAWD_COL`, `COMPACT_BELOW`, `COMPACT_COL`, `clawdCol` from `road.ts` and keeps `HIDDEN_BELOW`, `foeX`, `frame`; `line(g, x0, y0, x1, y1, c, every = 1)` in `grid.ts`; `trudging(t, legMs = 2 * LEG_STEP_MS)`.

- [ ] **Step 1: Write the failing tests**

Replace `tests/frame.test.ts` with (the Plan 2 tests now also run over every rest scene, and the new `resting between turns` block is at the end):
```ts
import { describe, expect, test } from 'claude-code/testing'

import type { RpgStats } from '../types'
import { DEFAULT_COLOR, toWords } from '../hooks/rpg/cells'
import { FOE_ENTER_MS, NO_STORY, beatOf, step, withLevelUp } from '../hooks/rpg/director'
import type { HookPayload, Story } from '../hooks/rpg/director'
import { CLAWD_COL, COMPACT_BELOW, COMPACT_COL, ROAD_GLYPHS, clawdAt, clawdCol, foeX, frame } from '../hooks/rpg/frame'
import type { Scene } from '../hooks/rpg/frame'
import { EMPTY, PX_H, ROWS, at, grid } from '../hooks/rpg/grid'
import { GLYPHS, hudLeft } from '../hooks/rpg/hud'
import { EYE, ORANGE, clawd } from '../hooks/rpg/sprites/clawd'
import { FOES } from '../hooks/rpg/sprites/foes'
import { FX_GLYPHS } from '../hooks/rpg/sprites/fx'
import { CAMP } from '../hooks/rpg/places/camp'
import { INN } from '../hooks/rpg/places/inn'
import { PIER } from '../hooks/rpg/places/pier'
import type { Place } from '../hooks/rpg/places/place'
import { DOZE_MS, PACK_MS, SLEEP_MS, placeWidth } from '../hooks/rpg/road'

const STATS: RpgStats = { level: 7, exp: 0.6, hp: 0.88, mp: 0.62, place: 'my-app/main' }
const T0 = 5_000_000
const scene = (width: number, t = 0, distance = 0, isWalking = true, story: Story = NO_STORY): Scene => ({ width, t, distance, isWalking, stats: STATS, story })

let ids = 0
function tell(events: [string, HookPayload][]): { story: Story; at: number } {
  let story = NO_STORY
  let at = T0
  for (const [event, payload] of events) story = step(story, event, payload, (at += 1000)).story
  return { story, at }
}
const pre = (tool_name: string, tool_input: HookPayload): [string, HookPayload] => ['PreToolUse', { tool_name, tool_input, tool_use_id: `f${++ids}` }]
const post = (stdout: string): [string, HookPayload] => ['PostToolUse', { tool_use_id: `f${ids}`, tool_response: { stdout, stderr: '' } }]
const prompt: [string, HookPayload] = ['UserPromptSubmit', {}]
const edit = pre('Edit', { file_path: 'D:/a/scenes.ts', old_string: 'a', new_string: 'b' })

// `at`: where the camera stands for a width (the forest by default); `still`: he isn't walking.
type Moment = { name: string; story: Story; times: number[]; at?: (width: number) => number; still?: boolean }
const sceneOf = (m: Moment, width: number, t: number): Scene => scene(width, t, m.at?.(width) ?? 10, !m.still, m.story)

// One story per beat and per rest, each with the moments worth drawing.
function stories(): Moment[] {
  const fight = tell([prompt, edit])
  const failed = tell([prompt, edit, pre('Bash', { command: 'npm test' }), post('Tests  2 failed | 3 passed (5)')])
  const passed = tell([prompt, edit, pre('Bash', { command: 'npm test' }), post('Tests  2 failed (2)'), pre('Bash', { command: 'npm test' }), post('Tests  5 passed (5)')])
  const won = tell([prompt, edit, ['TurnEnded', { reason: 'answer' }]])
  const fled = tell([prompt, edit, ['TurnEnded', { reason: 'aborted' }]])
  const called = tell([prompt, ['Notification', {}]])
  const up = { story: withLevelUp(won.story, 8, won.at), at: won.at }
  const span = (from: number, ms: number) => Array.from({ length: 9 }, (_, i) => from + Math.round((i * ms) / 8))
  return [
    { name: 'walk', story: tell([prompt]).story, times: span(T0, 2000) },
    { name: 'encounter', story: fight.story, times: span(fight.at, 2400) },
    { name: 'enemyTurn', story: failed.story, times: span(failed.at, 2000) },
    { name: 'finisher', story: passed.story, times: span(passed.at, 2400) },
    { name: 'victory', story: won.story, times: span(won.at, 4400) },
    { name: 'flee', story: fled.story, times: span(fled.at, 1600) },
    { name: 'call', story: called.story, times: span(called.at, 3000) },
    { name: 'levelUp', story: up.story, times: span(up.at, 3000) },
    ...rests(),
  ]
}

const done = (roadAt = 0): [string, HookPayload] => ['TurnEnded', { reason: 'answer', roadAt }]
const created = (id: string, subject: string): [string, HookPayload] => ['TaskCreated', { task_id: id, task_subject: subject }]

// After a turn ends at the road's start: on his way, at each rest spot, and packing up again.
function rests(): Moment[] {
  const span = (from: number, ms: number) => Array.from({ length: 9 }, (_, i) => from + Math.round((i * ms) / 8))
  const ended = tell([prompt, done()])
  const after = ended.at + 5000
  const compacted = tell([prompt, done(), ['Compact', {}]])
  const back = tell([prompt, done(), prompt])
  const backFromInn = tell([prompt, done(), ['Compact', {}], prompt])
  const called = tell([prompt, done(), ['Notification', {}]])
  const quest = tell([prompt, created('1', 'read the spec'), created('2', 'fix login')])
  return [
    { name: 'travel', story: ended.story, times: span(after, 2000), at: () => 20 },
    { name: 'pier', story: ended.story, times: span(after, 7600), at: w => placeWidth(w), still: true },
    { name: 'camp', story: ended.story, times: span(ended.at + DOZE_MS, 5200), at: w => 2 * placeWidth(w), still: true },
    { name: 'inn', story: ended.story, times: span(ended.at + SLEEP_MS, 5200), at: w => 3 * placeWidth(w), still: true },
    { name: 'compacted', story: compacted.story, times: span(compacted.at + 4000, 5200), at: w => 2 * placeWidth(w), still: true },
    { name: 'packPier', story: back.story, times: span(back.at, PACK_MS), at: w => placeWidth(w), still: true },
    { name: 'packInn', story: backFromInn.story, times: span(backFromInn.at, PACK_MS), at: w => 2 * placeWidth(w), still: true },
    { name: 'calledAtPier', story: called.story, times: span(called.at + 4000, 1500), at: w => placeWidth(w), still: true },
    { name: 'quest', story: quest.story, times: span(quest.at, 2000) },
  ]
}

// 179 first: the band's width in KaiC's own terminal (184 columns).
const WIDTHS = [179, 40, 99, 100, 150, 220, 300]

describe('frame', () => {
  test('the forest fills every pixel of the band at any width', () => {
    for (const width of WIDTHS) {
      for (const distance of [0, 37.5, 1000]) {
        const g = frame(scene(width, 1234, distance))
        for (let y = 0; y < PX_H; y++) for (let x = 0; x < width; x++) expect(at(g, x, y)).not.toBe(EMPTY)
      }
    }
  })

  test('Clawd walks at column 50, or column 4 in the compact view', () => {
    expect(clawdCol(150)).toBe(CLAWD_COL)
    expect(clawdCol(COMPACT_BELOW)).toBe(CLAWD_COL)
    expect(clawdCol(COMPACT_BELOW - 1)).toBe(COMPACT_COL)
    expect(at(frame(scene(150)), CLAWD_COL + 2, 1)).toBe(ORANGE)
    expect(at(frame(scene(80)), COMPACT_COL + 2, 1)).toBe(ORANGE)
  })

  test('the ground scrolls under him as he walks', () => {
    const a = frame(scene(150, 0, 0))
    const b = frame(scene(150, 0, 23))
    // Rows 8–9 are the ground, which moves with him; the far trees above drift slower (parallax).
    // Only columns that stay left of Clawd (column 50) in both frames, so his legs are not compared.
    const ground = (g: ReturnType<typeof frame>, x: number) => [at(g, x, 8), at(g, x, 9)].join()
    for (let x = 0; x + 23 < CLAWD_COL; x++) expect(ground(b, x)).toBe(ground(a, x + 23))
  })

  test('a frame is a pure function of its scene', () => {
    for (const { story, times } of stories()) {
      const a = frame(scene(150, times[3]!, 99.5, true, story))
      const b = frame(scene(150, times[3]!, 99.5, true, story))
      expect(Array.from(a.px)).toEqual(Array.from(b.px))
      expect([...a.text]).toEqual([...b.text])
    }
  })

  test('every beat shows up', () => {
    const seen = new Set(stories().map(({ story, times }) => beatOf(story, times[0]!)))
    expect([...seen].sort()).toEqual(['encounter', 'enemyTurn', 'finisher', 'flee', 'idle', 'victory', 'walk'].sort())
  })
})

describe('the visual rules', () => {
  test("Clawd's pixels are exactly his sprite in every beat: nothing paints over or recolours him", () => {
    for (const width of WIDTHS) {
      for (const m of stories()) {
        const { name, times } = m
        for (const t of times) {
          const s = sceneOf(m, width, t)
          const me = clawdAt(s)
          if (!me) continue
          const solo = grid(width)
          clawd(solo, me.x, me.y, me.pose)
          const g = frame(s)
          const words = toWords(g)
          for (let y = 0; y < PX_H; y++) {
            for (let x = 0; x < width; x++) {
              const c = at(solo, x, y)
              // In bed the inn's blanket is over him below his eyes.
              if (c === EMPTY || (me.tucked && y >= 6)) continue
              expect([ORANGE, EYE]).toContain(c)
              if (at(g, x, y) !== c) throw new Error(`${name} at ${width} cols, t+${t - times[0]!}: pixel ${x},${y} is ${at(g, x, y).toString(16)}`)
              const over = g.text.get(Math.floor(y / 2) * width + x)
              if (over) throw new Error(`${name} at ${width} cols, t+${t - times[0]!}: '${String.fromCodePoint(over.cp)}' covers his pixel ${x},${y}`)
            }
          }
          expect(words.length).toBe(width * ROWS * 3)
        }
      }
    }
  })

  test('every text cell takes the pixel beneath it as its background', () => {
    for (const width of WIDTHS) {
      for (const m of stories()) {
        for (const t of m.times) {
          const g = frame(sceneOf(m, width, t))
          const words = toWords(g)
          for (const key of g.text.keys()) {
            const row = Math.floor(key / width)
            const col = key % width
            const top = at(g, col, 2 * row)
            const bottom = at(g, col, 2 * row + 1)
            expect(words[key * 3 + 2]).toBe(top !== EMPTY ? top : bottom !== EMPTY ? bottom : DEFAULT_COLOR)
          }
        }
      }
    }
  })

  test('no foe pixel reaches the HUD: the HUD row past its first cell is pure forest', () => {
    for (const width of WIDTHS) {
      const left = hudLeft(width, STATS)
      for (const m of stories()) {
        for (const t of m.times) {
          const g = frame(sceneOf(m, width, t))
          const bare = frame(sceneOf({ ...m, story: { ...NO_STORY, trip: m.story.trip, trail: m.story.trail } }, width, t))
          for (const y of [8, 9]) for (let x = left; x < width; x++) expect(at(g, x, y)).toBe(at(bare, x, y))
        }
      }
    }
  })

  test('foes stand at least 14 columns left of the HUD', () => {
    for (const width of [100, 120, 150, 160, 220, 300]) expect(foeX(width, STATS)).toBeLessThanOrEqual(hudLeft(width, STATS) - 14)
  })

  test('the compact view has no foes, banners or loot, only Clawd and the forest', () => {
    const foeColors = new Set([FOES.goblin.pal.G, FOES.shroom.pal.R])
    for (const m of stories()) {
      for (const t of m.times) {
        const g = frame(sceneOf(m, 80, t))
        for (const c of g.px) expect(foeColors.has(c)).toBe(false)
        // Only the HUD, and a place's own name painted on it (the inn's sign).
        for (const key of g.text.keys()) expect([1, ROWS - 1]).toContain(Math.floor(key / 80))
      }
    }
  })

  test('every character drawn is ASCII or a known one-cell glyph', () => {
    const known = new Set<string>([...GLYPHS, ...FX_GLYPHS, ...ROAD_GLYPHS])
    for (const width of WIDTHS) {
      for (const m of stories()) {
        for (const t of m.times) {
          for (const { cp } of frame(sceneOf(m, width, t)).text.values()) {
            const ch = String.fromCodePoint(cp)
            expect(cp <= 0x7e || known.has(ch)).toBe(true)
          }
        }
      }
    }
  })
})

describe('the fight on screen', () => {
  test('a foe drops in from the treetops and lands on the ground', () => {
    const { story, at: t0 } = tell([prompt, edit])
    const landed = frame(scene(150, t0 + FOE_ENTER_MS + 100, 0, true, story))
    const fx = foeX(150, STATS)
    const look = FOES[story.foe!.kind]
    const colors = new Set(Object.values(look.pal))
    let lowest = -1
    for (let y = 0; y < PX_H; y++) for (let x = fx; x < fx + look.w; x++) if (colors.has(at(landed, x, y))) lowest = y
    expect(lowest).toBe(9)
  })

  test('his foes never wear his orange', () => {
    for (const look of Object.values(FOES)) expect(Object.values(look.pal)).not.toContain(ORANGE)
  })
})

const textRow = (g: ReturnType<typeof frame>, row: number) => {
  let text = ''
  for (let col = 0; col < g.w; col++) text += g.text.has(row * g.w + col) ? String.fromCodePoint(g.text.get(row * g.w + col)!.cp) : ' '
  return text
}
const moment = (name: string) => stories().find(m => m.name === name)!

describe('resting between turns', () => {
  test('at a rest spot the band shows that place alone, at every width from 100 to 300', () => {
    const places: [string, Place][] = [['pier', PIER], ['camp', CAMP], ['inn', INN]]
    for (const [name, place] of places) {
      const m = moment(name)
      for (const width of [100, 150, 179, 220, 300]) {
        const t = m.times[0]!
        const g = frame(sceneOf(m, width, t))
        const alone = grid(width)
        for (let x = 0; x < width; x++) place.col(alone, x, x, t, m.at!(width), width)
        place.props?.(alone, 0, t, width)
        // Right of Clawd and his rod, above the HUD: nothing but the place.
        for (let y = 0; y < 8; y++) for (let x = CLAWD_COL + 40; x < width; x++) expect(at(g, x, y)).toBe(at(alone, x, y))
      }
    }
  })

  test('he fishes at the pier, sits by the fire, and sleeps at the inn tucked in', () => {
    const pose = (name: string) => clawdAt(sceneOf(moment(name), 179, moment(name).times[0]!))!
    expect(pose('pier')).toMatchObject({ x: CLAWD_COL, y: 1 })
    expect(pose('pier').pose.sit).toBeUndefined()
    expect(pose('camp').pose.sit).toBe(true)
    expect(pose('inn')).toMatchObject({ y: -1, tucked: true })
    expect(pose('packInn').tucked).toBe(true)
    const up = moment('packInn')
    expect(clawdAt(sceneOf(up, 179, up.times[0]! + PACK_MS * 0.75))).toMatchObject({ y: 1 })
  })

  test('at the pier his rod is out; called, he puts it down to turn to you', () => {
    const rod = (name: string) => at(frame(sceneOf(moment(name), 179, moment(name).times[0]!)), CLAWD_COL + 15, 4)
    expect(rod('pier')).toBe(0xa0714a)
    expect(rod('calledAtPier')).not.toBe(0xa0714a)
  })

  test('resting, the top-left says what he is doing; at the inn after a compaction, that HP refills', () => {
    const said = (name: string) => textRow(frame(sceneOf(moment(name), 179, moment(name).times[0]!)), 0).trim()
    expect(said('pier')).toBe('waiting for you…')
    expect(said('camp')).toBe('idle · warming up')
    expect(said('inn')).toBe('z Z')
    expect(said('compacted')).toBe('z Z  ·  HP refilling')
  })

  test('working, the top-left is the quest line, with what the band cannot draw as ?', () => {
    const g = frame(sceneOf(moment('quest'), 179, moment('quest').times[0]!))
    expect(textRow(g, 0).trim()).toBe('☐ 0/2 read the spec')
    const odd = tell([prompt, created('1', 'fix the 日本 login')])
    expect(textRow(frame(scene(179, odd.at, 10, true, odd.story)), 0).trim()).toBe('☐ 0/1 fix the ?? login')
  })

  test('a signpost names the rest spot ahead', () => {
    const m = moment('travel')
    const g = frame(scene(179, m.times[0]!, placeWidth(179) - 100, true, m.story))
    expect(textRow(g, 1)).toContain('→ Pier')
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `claude plugin test .`
Expected: FAIL — `Export named 'ROAD_GLYPHS' not found in module '…hooks/rpg/frame.ts'`.

- [ ] **Step 3: Implement**

In `hooks/rpg/grid.ts`, add above `export function sprite(`:
```ts
// A straight line of pixels, every `every`th one (2 gives a dotted fishing line).
export function line(g: Grid, x0: number, y0: number, x1: number, y1: number, c: number, every = 1): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
  for (let i = 0; i <= n; i += every) put(g, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c)
}
```

In `hooks/rpg/sprites/clawd.ts`, replace
```ts
export const trudging = (t: number): Pose => ({ fx: 1, fy: 1, armL: 10, armR: 10, step: Math.floor(t / (2 * LEG_STEP_MS)) % 2 === 1 })
```
with
```ts
export const trudging = (t: number, legMs = 2 * LEG_STEP_MS): Pose => ({ fx: 1, fy: 1, armL: 10, armR: 10, step: Math.floor(t / legMs) % 2 === 1 })
```

Replace `hooks/rpg/frame.ts` with:
```ts
import type { RestKind, RpgStats } from '../../types'
import {
  CALL_MS,
  COUNTER_MS,
  DOWN_MS,
  FINISHER_MS,
  FLEE_MS,
  FOE_ENTER_MS,
  LEVEL_UP_MS,
  SKILL_MS,
  VICTORY_MS,
  beatOf,
  questOf,
} from './director'
import type { Beat, Story } from './director'
import { grid, line, rect, sprite, write } from './grid'
import type { Grid } from './grid'
import { drawHud, drawable, hudLeft } from './hud'
import { easeOut, lerp, through } from './noise'
import { CAMP } from './places/camp'
import { FOREST } from './places/forest'
import { INN } from './places/inn'
import { PIER } from './places/pier'
import type { Place } from './places/place'
import { CLAWD_COL, COMPACT_BELOW, PACK_MS, camOf, clawdCol, placeWidth, restOf, spotsOf } from './road'
import type { Rest, Spot } from './road'
import { POSES, asleep, cheering, clawd, hurting, idling, sitting, trudging, walking } from './sprites/clawd'
import type { Pose } from './sprites/clawd'
import { drawFoe, drawHp, foeTop } from './sprites/foes'
import { bang, banner, burst, chest, cloud, dust, sparks, sword } from './sprites/fx'

export { CLAWD_COL, COMPACT_BELOW, COMPACT_COL, clawdCol } from './road'
export const HIDDEN_BELOW = 40
// Clawd swings from this far left of the foe, so the sword's arc lands on it.
const REACH = 22

// Non-ASCII characters the road may write; each must be one cell wide (tests check them).
export const ROAD_GLYPHS = ['→', '☐', '…'] as const

const REST_PLACES: Record<RestKind, Place> = { pier: PIER, camp: CAMP, inn: INN }
const SIGNS: Record<RestKind, string> = { pier: '→ Pier', camp: '→ Camp', inn: '→ Inn' }
// The inn's blanket covers him from this pixel row down.
const TUCKED_FROM = 6
const FISH_MS = 7600

// `legMs`: how long each of his steps takes at the pace the road moves.
export type Scene = { width: number; t: number; distance: number; isWalking: boolean; stats: RpgStats; story: Story; trudge?: boolean; legMs?: number }

// Where a foe stands: at most 36 columns past Clawd, and always 14 clear of the HUD.
export const foeX = (width: number, stats: RpgStats) => Math.min(CLAWD_COL + 36, hudLeft(width, stats) - 14)

const isCompact = (s: Scene) => s.width < COMPACT_BELOW
// The sword comes down for the last 45% of each 480 ms swing; the first swing waits for the foe to land.
const swingFrom = (story: Story) => Math.max(story.skill?.at ?? 0, (story.foe?.at ?? 0) + FOE_ENTER_MS)
const isSwinging = (story: Story, t: number) => story.skill !== null && t >= swingFrom(story) && t - swingFrom(story) < SKILL_MS * 0.8
const swingDown = (story: Story, t: number) => (t - swingFrom(story)) % 480 >= 264

// `tucked`: in bed, under the inn's blanket from TUCKED_FROM down.
export type ClawdPlace = { x: number; y: number; pose: Pose; strike: boolean; tucked?: boolean }

function resting(rest: Rest, x: number, t: number, called: boolean): ClawdPlace | null {
  if (rest.phase === 'travel') return null
  if (rest.phase === 'pack') {
    if (rest.kind === 'pier') return { x, y: 1, pose: POSES.stand, strike: false }
    const up = t - rest.since >= PACK_MS / 2
    if (rest.kind === 'inn' && !up) return { x, y: -1, pose: asleep(t), strike: false, tucked: true }
    return { x, y: 1, pose: up ? POSES.stretch : POSES.sit, strike: false }
  }
  if (rest.kind === 'inn') return { x, y: -1, pose: called ? { sit: true, top: 8 } : asleep(t), strike: false, tucked: true }
  if (called) return { x, y: 1, pose: POSES.stand, strike: false }
  return { x, y: 1, pose: rest.kind === 'camp' ? sitting(t) : idling(t), strike: false }
}

// Where Clawd is and how he stands, or null while the ALL-OUT ATTACK cloud hides him.
export function clawdAt(s: Scene): ClawdPlace | null {
  const { t, story } = s
  const beat = beatOf(story, t)
  const home = clawdCol(s.width)
  const walk = s.trudge ? trudging(t, s.legMs) : walking(t, s.legMs)
  const called = story.calledAt !== null && t - story.calledAt < CALL_MS
  const rest = beat === 'idle' || beat === 'walk' ? restOf(story, t, s.distance, s.width) : null
  const still = rest && resting(rest, home, t, called)
  if (still) return still
  const standing = { x: home, y: 1, pose: called ? POSES.stand : s.isWalking ? walk : idling(t), strike: false }
  if (isCompact(s)) {
    if (beat === 'victory') return { x: home, y: 1, pose: cheering(t), strike: false }
    if (beat === 'enemyTurn') return { x: home, y: 1, pose: hurting(t), strike: false }
    return standing
  }
  const fx = foeX(s.width, s.stats)
  const stand = Math.min(CLAWD_COL, fx - REACH)
  switch (beat) {
    case 'encounter': {
      const x = Math.round(lerp(CLAWD_COL, stand, through(t, story.foe?.at ?? story.down?.at ?? t, 400)))
      if (isSwinging(story, t)) return { x: fx - REACH, y: 1, pose: swingDown(story, t) ? POSES.strike : POSES.swing, strike: true }
      return { x, y: 1, pose: POSES.right, strike: false }
    }
    case 'enemyTurn':
      return { x: stand - (t - story.counter!.at < COUNTER_MS / 2 ? 3 : 0), y: 1, pose: hurting(t), strike: false }
    case 'finisher':
      return t - story.down!.at < FINISHER_MS * 0.7 ? null : { x: stand, y: 1, pose: cheering(t), strike: false }
    case 'victory':
      return { x: CLAWD_COL, y: 1, pose: cheering(t), strike: false }
    case 'flee':
      return { x: stand, y: 1, pose: { fx: 1, armL: 8, armR: 10 }, strike: false }
    default:
      return standing
  }
}

function drawFight(g: Grid, s: Scene, beat: Beat, before: number): void {
  const { t, story } = s
  const fx = foeX(s.width, s.stats)
  const foe = story.foe
  if (foe) {
    const y = Math.round(lerp(-8, foeTop(foe.kind), easeOut(through(t, foe.at, FOE_ENTER_MS))))
    const flash = isSwinging(story, t) && swingDown(story, t)
    drawFoe(g, foe.kind, fx, y, t, { flash, elite: foe.elite })
    drawHp(g, fx, y - (foe.elite ? 3 : 2), foe.hp, foe.maxHp)
  }
  const down = story.down
  if (down && beat === 'encounter' && t - down.at < DOWN_MS) burst(g, fx + 3, 6, (t - down.at) / 180, [0xffffff, 0xb6f09c, 0x6fbf4e])
  if (beat === 'finisher' && down) {
    const q = through(t, down.at, FINISHER_MS)
    if (q < 0.7) cloud(g, fx, t)
    else burst(g, fx + 3, 5, (t - down.at - FINISHER_MS * 0.7) / 120, [0xffffff, 0xff9f8a, 0xd6453d], 12)
    banner(g, 'ALL-OUT ATTACK!!', q / 0.7, 0xe5202e, undefined, before)
  }
  if (beat === 'flee' && story.fled) {
    const q = through(t, story.fled.at, FLEE_MS)
    drawFoe(g, story.fled.kind, fx + Math.round(q * 6), Math.round(foeTop(story.fled.kind) - q * 14), t)
  }
  if (story.skill && beat === 'encounter') banner(g, story.skill.name, (t - story.skill.at) / SKILL_MS, 0xe5202e, undefined, before)
  if (beat === 'enemyTurn' && story.counter) banner(g, `COUNTER  ✗${story.counter.n}`, (t - story.counter.at) / COUNTER_MS, 0x000000, 0xff4b4b, before)
}

function caption(g: Grid, text: string, fg: number, before: number): void {
  const room = before - 6
  const chars = [...text]
  write(g, 4, 0, chars.length > room ? chars.slice(0, room - 1).join('') + '…' : text, fg)
}

// The rest spots on screen: the current trip's first, so they cover the last trip's.
function spotsOn(s: Scene): Spot[] {
  const { story, t, width } = s
  return [...(story.trip ? spotsOf(story.trip, t, width) : []), ...(story.trail ? spotsOf(story.trail, t, width) : [])]
}

function drawRoad(g: Grid, s: Scene, spots: Spot[], cam: number, pw: number): void {
  const { t } = s
  for (let x = 0; x < s.width; x++) {
    const wx = cam + x
    const spot = spots.find(p => wx >= p.from && wx < p.from + pw)
    if (spot) REST_PLACES[spot.kind].col(g, x, wx - spot.from, t, cam, pw)
    else FOREST.col(g, x, wx, t, cam, Number.POSITIVE_INFINITY)
  }
  for (const spot of [...spots].reverse()) {
    const ox = spot.from - cam
    if (ox < s.width && ox + pw > 0) REST_PLACES[spot.kind].props?.(g, ox, t, pw)
  }
}

// A signpost just before each rest spot; its name stays clear of Clawd and out of the compact view.
function drawSigns(g: Grid, s: Scene, spots: Spot[], cam: number, me: ClawdPlace | null): void {
  for (const spot of spots) {
    const x = spot.from - 12 - cam
    if (x < -4 || x > s.width) continue
    rect(g, x, 6, 1, 4, 0x6b4a2b)
    rect(g, x - 2, 5, 6, 2, 0x8a5a2b)
    const label = SIGNS[spot.kind]
    const end = x - 1 + label.length
    const clear = !me || end < me.x - 1 || x - 1 > me.x + 16
    if (!isCompact(s) && clear && x - 1 >= 0 && end <= s.width) write(g, x - 1, 1, label, 0xe9e6df)
  }
}

// At the pier: rod out, the line to a bobbing float, and now and then a fish pulled in.
function fishing(g: Grid, x: number, t: number): void {
  line(g, x + 15, 4, x + 20, 0, 0xa0714a)
  const k = t % FISH_MS
  const float = x + 34
  const dip = k > 4800 && k < 5600
  const y = dip ? 9 : 7 + (Math.floor(t / 1200) % 2 === 1 ? 0 : -1)
  line(g, x + 20, 0, float, y, 0x6b7390, 2)
  if (dip) {
    g.px[7 * g.w + float - 1] = 0xf4f4f4
    g.px[7 * g.w + float + 1] = 0xf4f4f4
  } else {
    sprite(g, float, y - 1, ['R', 'W'], { R: 0xff4b4b, W: 0xf4f4f4 })
  }
  if (k > 5600 && k < 7000) {
    const q = through(k, 5600, 1400)
    sprite(g, Math.round(lerp(float, x + 18, q)), Math.round(lerp(7, 0, q)), ['GGG', 'GGTT'], { G: 0xc8d0e8, T: 0x9aa0b2 })
  }
}

function restCaption(s: Scene, rest: Rest | null): [string, number] | null {
  if (!rest || rest.phase !== 'rest') return null
  if (rest.kind === 'pier') return ['waiting for you…', 0x7fd1ff]
  if (rest.kind === 'camp') return ['idle · warming up', 0xffb27a]
  return [s.story.trip?.compactAt !== null ? 'z Z  ·  HP refilling' : 'z Z', 0x9be38a]
}

export function frame(s: Scene): Grid {
  const g = grid(s.width)
  const { t, story } = s
  const cam = camOf(s.distance, s.width)
  const pw = placeWidth(s.width)
  const spots = spotsOn(s)
  drawRoad(g, s, spots, cam, pw)
  const beat = beatOf(story, t)
  const me = clawdAt(s)
  drawSigns(g, s, spots, cam, me)
  const rest = beat === 'idle' || beat === 'walk' ? restOf(story, t, s.distance, s.width) : null
  const called = story.calledAt !== null && t - story.calledAt < CALL_MS
  if (!isCompact(s)) drawFight(g, s, beat, me?.x ?? Math.min(CLAWD_COL, foeX(s.width, s.stats) - REACH))
  if (me) {
    clawd(g, me.x, me.y, me.pose)
    if (me.strike) sword(g, me.x, 1, me.pose === POSES.strike)
    if (beat === 'enemyTurn') sparks(g, me.x, 1, t)
    if (beat === 'flee') dust(g, me.x, t)
    if (rest?.phase === 'rest' && rest.kind === 'pier' && !called) fishing(g, me.x, t)
    if (me.tucked) INN.front?.(g, me.x - CLAWD_COL, t, pw)
    if (called) bang(g, me.x, t)
  }
  if (beat === 'victory' && story.victory && !isCompact(s)) {
    const fx = foeX(s.width, s.stats)
    chest(g, Math.max(CLAWD_COL + 18, fx - 4), 4, t - story.victory.at > 400, t)
    if (t - story.victory.at > 600) caption(g, `◆ ${drawable(story.victory.loot).join('')} · +${story.victory.gained} EXP`, 0xffd54f, me?.x ?? CLAWD_COL)
  } else if (!isCompact(s) && me) {
    const quest = questOf(story)
    // The task's own words may hold characters the band can't draw one cell wide.
    const said: [string, number] | null = restCaption(s, rest) ?? (quest ? [`☐ ${drawable(quest.slice(2)).join('')}`, 0xd7c9a0] : null)
    if (said) caption(g, said[0], said[1], me.x)
  }
  drawHud(g, s.stats)
  if (story.levelUp && t >= story.levelUp.at && t - story.levelUp.at < LEVEL_UP_MS && !isCompact(s)) {
    write(g, hudLeft(s.width, s.stats), 3, `LEVEL UP!  Lv.${story.levelUp.level}`, 0xffd54f)
  }
  return g
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `claude plugin validate . && claude plugin test .`
Expected: validation passes; 163 pass (6 new; the Plan 2 frame tests now cover the rest scenes too).

- [ ] **Step 5: Commit**

```bash
git add hooks/rpg/frame.ts hooks/rpg/grid.ts hooks/rpg/sprites/clawd.ts tests/frame.test.ts && git commit -m "The frame draws the road's rest spots, signposts, his rest and the quest line, under every visual rule"
```

---

### Task 5: Wire it up — the road moves with the story, compactions and tasks reach it

**Files:**
- Modify: `hooks/register.tsx` (replace)
- Test: `tests/mod.test.tsx` (append)

**Interfaces:**
- Consumes: `moveRoad`, `Motion` (Task 3); `frame` with `legMs` (Task 4); the director's `Compact` / `TaskCreated` / `TaskCompleted` events and `payload.roadAt` (Task 2).
- Produces: hooks `classic.PreCompact` → `Compact`, `classic.TaskCreated`, `classic.TaskCompleted`; every event the director steps carries `roadAt` (the road position, whole pixels); the frame timer moves the road with `moveRoad` instead of Plan 2's walk check.

- [ ] **Step 1: Write the failing tests**

Append to the end of `tests/mod.test.tsx` (it uses `turn`, `band`, `raster`, `rowText`, `groundCell`, `WIDE` and `DONE`, already defined there):
```tsx
// Lets the frame timer run `ms` of road while the band is mounted.
async function wait(clock: { advance: (ms: number) => Promise<unknown> }, ms: number) {
  for (let left = ms; left > 0; left -= 160) await clock.advance(160)
}

test('after a turn he walks off to the pier, passing its signpost, and fishes there', async ($, on) => {
  const blits: string[] = []
  const { clock } = await turn($, on, { blits })
  await $.turn.complete(DONE)
  const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(WIDE) })
  await wait(clock, 4800 + 160 * 30)
  await t.unmount()
  // A fresh mount goes through the engine's check that every cell is one printable column.
  const midway = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(WIDE) })
  expect(rowText(await raster(midway), WIDE, 1)).toContain('→ Pier')
  await wait(clock, 160 * 70)
  expect(rowText(blits.at(-1)!, WIDE, 0)).toContain('waiting for you…')
  await midway.unmount()
})

test('a minute idle he moves on to the campfire', async ($, on) => {
  const blits: string[] = []
  const { clock } = await turn($, on, { blits })
  await $.turn.complete(DONE)
  const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(WIDE) })
  await wait(clock, 60_000 + 160 * 100)
  expect(rowText(blits.at(-1)!, WIDE, 0)).toContain('idle · warming up')
  await t.unmount()
})

test('compacting between turns takes him to the inn, where HP refills', async ($, on) => {
  on('classic.PreCompact', () => ({}))
  const blits: string[] = []
  const { clock } = await turn($, on, { blits })
  await $.turn.complete(DONE)
  await $.classic.PreCompact({ trigger: 'manual', custom_instructions: null } as never)
  const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(WIDE) })
  await wait(clock, 4800 + 160 * 200)
  expect(rowText(blits.at(-1)!, WIDE, 0)).toContain('z Z  ·  HP refilling')
  await t.unmount()
})

test('a prompt while he rests: he packs up, then walks back to work', async ($, on) => {
  const blits: string[] = []
  const { clock } = await turn($, on, { blits })
  await $.turn.complete(DONE)
  const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(WIDE) })
  await wait(clock, 4800 + 160 * 100)
  await t.unmount()
  await $.classic.UserPromptSubmit({ prompt: 'next' })
  const working = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(WIDE, true) })
  // The pier's shore is its first 12 columns: how many are still on screen says how far he has walked.
  const shore = (cells: string) => Array.from({ length: 12 }, (_, x) => groundCell(cells, WIDE, x)).filter(c => c.split(' ')[1] === String(0x3a3a2a)).length
  await wait(clock, 640)
  const packing = blits.at(-1)!
  expect(shore(packing)).toBe(12)
  expect(rowText(packing, WIDE, 0)).not.toContain('waiting for you')
  await wait(clock, 1200)
  const a = shore(blits.at(-1)!)
  await wait(clock, 160 * 4)
  expect(a - shore(blits.at(-1)!)).toBe(4)
  await working.unmount()
})

test('busy with tool calls, he hurries two pixels a frame', async ($, on) => {
  on('tool.call', { tool: 'Read' }, () => ({ result: {} }) as never)
  const blits: string[] = []
  const { clock } = await turn($, on, { blits })
  for (let i = 0; i < 3; i++) await $.tool.call({ tool: 'Read', file_path: 'C:/src/my-app/README.md' } as never)
  const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(WIDE, true) })
  await wait(clock, 320)
  const a = blits.at(-1)!
  await wait(clock, 160 * 4)
  expect(Array.from({ length: 20 }, (_, x) => groundCell(blits.at(-1)!, WIDE, x))).toEqual(Array.from({ length: 20 }, (_, x) => groundCell(a, WIDE, x + 8)))
  await t.unmount()
})

test('the task list shows as a quest line while he works', async ($, on) => {
  on('classic.TaskCreated', () => ({}))
  on('classic.TaskCompleted', () => ({}))
  const blits: string[] = []
  const { clock } = await turn($, on, { blits })
  await $.classic.TaskCreated({ task_id: '1', task_subject: 'read the spec' } as never)
  await $.classic.TaskCreated({ task_id: '2', task_subject: 'fix login' } as never)
  await $.classic.TaskCompleted({ task_id: '1', task_subject: 'read the spec' } as never)
  const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(WIDE, true) })
  expect(rowText(await raster(t), WIDE, 0)).toContain('☐ 1/2 fix login')
  await clock.advance(160)
  await t.unmount()
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `claude plugin test .`
Expected: FAIL — the six new tests: no `→ Pier`, no resting captions (he never leaves the forest), the quest line is missing because `classic.TaskCreated` is not hooked, and he does not hurry.

- [ ] **Step 3: Implement**

Replace `hooks/register.tsx` with:
```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { encodeCells } from './rpg/cells'
import { NO_STORY, step, withLevelUp } from './rpg/director'
import type { HookPayload, Story } from './rpg/director'
import { HIDDEN_BELOW, frame } from './rpg/frame'
import { ROWS } from './rpg/grid'
import { FRESH, gain, loadProgress } from './rpg/progress'
import type { Award, Progress } from './rpg/progress'
import { moveRoad } from './rpg/road'
import type { Motion } from './rpg/road'
import { statsFrom } from './rpg/stats'
import type { Usage } from './rpg/stats'

const RASTER_KEY = 'rpg'
// Half the sketch page's speed, the pace KaiC picked as natural. The road moves one whole pixel a
// frame (6.25 px/s): a speed in fractions of a pixel scrolls 1, 1, 1, then 2, which reads as a hitch.
const FRAME_MS = 160
const STATS_MS = 1000

const isHidden = atom({ plugin: 'clawd-rpg', key: 'isHidden' } as const, false)
const stats = atom({ plugin: 'clawd-rpg', key: 'stats' } as const, statsFrom(null, '', FRESH))
const story = atom({ plugin: 'clawd-rpg', key: 'story' } as const, NO_STORY)

// Module state: a hot reload starts it over, while the atoms live on in $.state.
let isReady = false
let place = ''
let progress: Progress = FRESH
let road = { distance: 0, isWorking: false, frames: 0 }
let painting: { requestId: string; width: number; painted: string } | null = null
let frameTimer: { cancel: () => void } | null = null
// A frame still on its way to the terminal: the next tick skips rather than piling blits up.
let isBlitting = false

function stopPainting(): void {
  frameTimer?.cancel()
  frameTimer = null
  painting = null
}

// A story saved by an older build may lack fields this one reads.
const storyNow = async ($: EngineInterface): Promise<Story> => ({ ...NO_STORY, ...(await read($, story)) })

async function refreshStats($: EngineInterface): Promise<void> {
  const usage = (await $.session.usage().then(u => u, () => null)) as Usage | null
  const next = statsFrom(usage, place, progress)
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

// Progress lives in the store, shared by every session: it is read fresh before each change so
// two sessions earning EXP at once don't overwrite each other. null: a newer build saved it, so
// this session plays on in memory and leaves the save alone.
async function loadSaved($: EngineInterface): Promise<Progress | null> {
  const { progress: loaded, backup, isNewer } = loadProgress(await $.store.get('progress'))
  if (isNewer) return null
  if (backup !== undefined) {
    // The first backup is the one most likely to hold real progress.
    if ((await $.store.get('progressBackup')) === undefined) await $.store.set('progressBackup', backup)
    await $.store.set('progress', loaded)
  }
  return loaded
}

async function saveWith($: EngineInterface, change: (p: Progress) => Progress): Promise<void> {
  const saved = await loadSaved($)
  progress = change(saved ?? progress)
  if (saved) await $.store.set('progress', progress)
}

async function earn($: EngineInterface, awards: Award[]): Promise<number> {
  let levelsUp = 0
  await saveWith($, p => {
    for (const a of awards) {
      const r = gain(p, a)
      p = r.progress
      levelsUp += r.levelsUp
    }
    return p
  })
  return levelsUp
}

async function ensureReady($: EngineInterface): Promise<void> {
  if (isReady) return
  isReady = true
  if ((await $.store.get('isHidden')) === true) await update($, isHidden, () => true)
  progress = (await loadSaved($)) ?? FRESH
  road.distance = progress.roadPos
  $.clock.every(STATS_MS, () => void refreshStats($))
  await refreshPlace($).catch(() => undefined)
  await refreshStats($)
}

// Hooks for parallel tool calls run side by side: each event steps the story only once the one
// before it has landed, or both would step from the same story and one would be lost.
let queue: Promise<void> = Promise.resolve()

function observe($: EngineInterface, event: string, payload: HookPayload): Promise<void> {
  const run = queue.then(() => observeNow($, event, payload))
  queue = run.catch(() => undefined)
  return run
}

async function observeNow($: EngineInterface, event: string, payload: HookPayload): Promise<void> {
  await ensureReady($)
  const now = await $.clock.now()
  const before = await storyNow($)
  // Where he stands on the road is where a trip to the rest spots sets out from.
  const { story: next, awards } = step(before, event, { ...payload, roadAt: Math.floor(road.distance) }, now)
  let told = next
  if (awards.length > 0) {
    const levelsUp = await earn($, awards)
    if (levelsUp > 0) told = withLevelUp(told, progress.level, now)
    await refreshStats($)
  }
  if (told !== before) await update($, story, () => told)
  if (event === 'TurnEnded' && Math.floor(road.distance) !== progress.roadPos) {
    await saveWith($, p => ({ ...p, roadPos: Math.floor(road.distance) }))
  }
}

// He walks while Claude works and nothing stands in his way, and between turns heads for a rest spot.
// `advance`: this is a frame of the timer, so the road moves; a redraw only looks.
async function motionNow($: EngineInterface, width: number, now: number, advance: boolean): Promise<Motion> {
  const frames = advance ? ++road.frames : road.frames
  const motion = moveRoad(await storyNow($), now, road.distance, width, frames, road.isWorking, (await read($, stats)).mp <= 0)
  if (advance) road.distance = motion.distance
  return motion
}

async function cellsNow($: EngineInterface, width: number, now: number, motion: Motion): Promise<string> {
  const s = await read($, stats)
  return encodeCells(frame({ width, t: now, distance: road.distance, isWalking: motion.isWalking, stats: s, story: await storyNow($), trudge: s.mp <= 0, legMs: motion.legMs }))
}

async function paintFrame($: EngineInterface): Promise<void> {
  const p = painting
  if (!p || isBlitting) return
  isBlitting = true
  try {
    const now = await $.clock.now()
    const cells = await cellsNow($, p.width, now, await motionNow($, p.width, now, true))
    if (cells === p.painted) return
    p.painted = cells
    const blitted = await $.ui.blit({ requestId: p.requestId, key: RASTER_KEY, cells })
    // Not mounted any more (hidden, collapsed, resized): rest until the next draw.
    if (blitted.deny !== undefined && painting === p) stopPainting()
  } finally {
    isBlitting = false
  }
}

type BandEvent = Parameters<EngineInterface['ui']['resolve']>[0] & {
  requestId: string
  props: { hasSurvey: boolean; isWorking: boolean; bodyColumns: number }
}

async function drawBand($: EngineInterface, e: BandEvent, next: (e: BandEvent) => unknown) {
  const width = Math.min(512, e.props.bodyColumns)
  if (e.props.hasSurvey || e.surface !== 'terminal' || width < HIDDEN_BELOW || (await read($, isHidden))) {
    // The desktop or a phone redrawing must not freeze the terminal's band.
    if (e.surface === 'terminal') stopPainting()
    return next(e)
  }
  road.isWorking = e.props.isWorking
  const now = await $.clock.now()
  const cells = await cellsNow($, width, now, await motionNow($, width, now, false))
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
  await ensureReady($)
  const hide = !(await read($, isHidden))
  await update($, isHidden, () => hide)
  await $.store.set('isHidden', hide)
  return hide ? "Clawd's adventure is hidden. /rpg brings it back." : 'Clawd is back on the road.'
}

type Shell = { tool_use_id?: string }
type ShellResult = { deny?: string; isError?: boolean; text?: string; result?: unknown }

// A command's result straight from the call; PostToolUse brings the same, and the story settles it once.
async function onShell($: EngineInterface, e: Shell, next: (e: Shell) => Promise<ShellResult>): Promise<ShellResult> {
  const ran = await next(e)
  if (ran.deny === undefined) {
    const payload = ran.isError ? { tool_use_id: e.tool_use_id ?? '', error: ran.text ?? '' } : { tool_use_id: e.tool_use_id ?? '', tool_response: ran.result }
    await observe($, ran.isError ? 'PostToolUseFailure' : 'PostToolUse', payload).catch(() => undefined)
  }
  return ran
}

const quietly = (work: Promise<void>) => work.catch(() => undefined)

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'rpg', description: "Show or hide Clawd's adventure above the prompt" })
    await quietly(ensureReady($))
    return next(e)
  })
  on('command.run', { command: 'rpg' }, async $ => ({ text: await toggle($) }))
  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => drawBand($, e as never, next as never) as never)
  on('tool.call', { tool: 'Bash' }, ($, e, next) => onShell($, e as never, next as never) as never)
  on('tool.call', { tool: 'PowerShell' }, ($, e, next) => onShell($, e as never, next as never) as never)

  // A render hook may not write state, so the story moves on session events. The turn ends here and
  // not at classic.Stop, which a user's own Stop hook can block to keep Claude working.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined) await quietly(observe($, 'TurnEnded', { reason: e.reason }))
    return result
  })
  on('classic.SessionStart', async ($, e, next) => {
    await quietly(observe($, 'SessionStart', e as never))
    return next(e)
  })
  // Claude switches branches mid-session, so the HUD's place is re-read at every prompt.
  on('classic.UserPromptSubmit', async ($, e, next) => {
    await quietly(observe($, 'UserPromptSubmit', e as never).then(() => refreshPlace($)))
    return next(e)
  })
  on('classic.PreToolUse', async ($, e, next) => {
    // classic.PreToolUse carries the tool call envelope, not the hook's stdin JSON.
    const { tool, tool_use_id: toolUseId, consent: _consent, ...input } = e as unknown as Record<string, unknown>
    await quietly(observe($, 'PreToolUse', { tool_name: tool, tool_input: input, tool_use_id: toolUseId }))
    return next(e)
  })
  on('classic.PostToolUse', async ($, e, next) => {
    await quietly(observe($, 'PostToolUse', e as never))
    return next(e)
  })
  on('classic.PostToolUseFailure', async ($, e, next) => {
    await quietly(observe($, 'PostToolUseFailure', e as never))
    return next(e)
  })
  // A compaction between turns sends him to the inn; the director ignores one mid-turn.
  on('classic.PreCompact', async ($, e, next) => {
    await quietly(observe($, 'Compact', e as never))
    return next(e)
  })
  on('classic.TaskCreated', async ($, e, next) => {
    await quietly(observe($, 'TaskCreated', e as never))
    return next(e)
  })
  on('classic.TaskCompleted', async ($, e, next) => {
    await quietly(observe($, 'TaskCompleted', e as never))
    return next(e)
  })
  on('classic.Notification', async ($, e, next) => {
    await quietly(observe($, 'Notification', e as never))
    return next(e)
  })
  on('classic.Elicitation', async ($, e, next) => {
    await quietly(observe($, 'Elicitation', e as never))
    return next(e)
  })
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `claude plugin validate . && claude plugin test .`
Expected: validation passes (its "gating hook without .catch" notes are advisory); 169 pass.

- [ ] **Step 5: Commit**

```bash
git add hooks/register.tsx tests/mod.test.tsx && git commit -m "Between turns Clawd walks to the pier, the campfire and the inn; busy turns hurry him; tasks are his quest"
```

---

### Task 6: Add Plan 3 to the manual checklist

**Files:**
- Modify: `docs/manual-testing.md` (append a Plan 3 section at the end)

KaiC runs the whole checklist once every plan is in, so this task only records what to look for. Nothing is pushed.

- [ ] **Step 1: Append to `docs/manual-testing.md`**

```markdown

## Plan 3: rest spots, pace and the quest line

Rest spots come into view between turns, so most of this is watching the band while you read
Claude's answer or step away.

- [ ] A turn ends: after the victory, Clawd hurries right; a `→ Pier` signpost passes, the lakeside
      pier slides in and stops exactly filling the band. He stands at the end of the jetty with
      his rod out and a bobbing float; now and then the float dips and a fish flies in. Top-left:
      `waiting for you…`.
- [ ] Leave it a minute: he walks on to the campfire and sits on the log by the fire, tent on the
      right. Top-left: `idle · warming up`.
- [ ] Leave it ten minutes: on to the inn, asleep in bed under the red blanket by the fireplace.
      Top-left: `z Z`.
- [ ] `/compact` between turns: he goes straight to the inn, top-left `z Z  ·  HP refilling`, and
      the HUD's HP bar fills as the context drops.
- [ ] Send a prompt while he rests: he reels in (or gets out of bed), then walks right, out of the
      rest spot and back into the forest.
- [ ] Send a prompt while he's still on his way to a spot: no packing up, he goes straight back to
      work.
- [ ] A new Claude Code window: he heads for the pier while waiting for your first prompt.
- [ ] While Claude thinks or reads, a steady walk; when Claude fires off several tool calls in a
      few seconds, he hurries (faster scroll and quicker steps).
- [ ] Out of usage (MP empty), every pace is halved.
- [ ] Ask Claude to plan a few steps as tasks: the top-left reads `☐ 1/4 <the task in progress>`
      while he works, updates as tasks finish, and goes away once all are done.
- [ ] Claude asks you something while he rests: he puts the rod down and turns to you with a `!`
      (in bed he sits up).
- [ ] Resize the window while he rests: the band still shows only the rest spot.
- [ ] Below 100 columns: the rest spots still show, with Clawd at the left; no signpost names or
      captions.
- [ ] Throughout: Clawd is always his own orange; no text sits on him; the band never flickers
      or drops out.
- [ ] Judge the look: at some widths the campfire's tent stands under the HUD text (as in the
      sketch). Say if it should move.

Known and left for later (don't count these as failures):
- The Dungeon's crystal room, Neon City's ramen stall and the gates between zones come with those
  zones in plan 4.
```

- [ ] **Step 2: Run the whole suite once more**

Run: `claude plugin validate . && claude plugin test .`
Expected: validation passes; 169 pass.

- [ ] **Step 3: Commit**

```bash
git add docs/manual-testing.md && git commit -m "Manual checklist: plan 3's rest spots, pace and quest line"
```
