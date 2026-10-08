# clawd-rpg Plan 2 — Battles and Progression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Claude Code's real session drives fights in the forest band: edits are skills that wear down foes dropping from the trees, a failing test run is the enemy's COUNTER, a passing run is the ALL-OUT ATTACK, a finished turn is a victory with loot and EXP, and his level is saved across every session and repo.

**Architecture:** A pure reducer (`hooks/rpg/director.ts`) turns hook events into a `Story` (foe, skill, counter, finisher, victory, flee, call, level-up) plus the deeds that earn EXP; `hooks/rpg/progress.ts` turns deeds into EXP/levels/zone meter and loads saved progress defensively; `frame.ts` draws the story's current beat, derived from timestamps, so every frame stays a pure function of (story, time, width). `register.tsx` feeds classic hook events and the shell call wrapper into the director, writes awards to `$.store` (read fresh before every write), and keeps the frame timer from Plan 1.

**Tech Stack:** TypeScript/TSX run by Claude Code's plugin engine, `claude-code` and `claude-code/testing`, `claude plugin validate .` / `claude plugin test .`.

**Spec:** `docs/superpowers/specs/2026-10-09-clawd-rpg-design.md` (read §3.2, §3.3, §3.4, §3.6, §4, §5, §7). Art reference: `docs/sketches/rpg-sketchbook.html` (v3 · The world: `fight`, `loot`, `banner2`, `slash`, `burst`, `chest`).

**This is plan 2 of 5.** Plan 3: rest spots and travel (pier, campfire, inn, ramen, crystal room, gates, idle/compact walks), walking pace by activity (§3.2) and the quest line (§3.4). Plan 4: Dungeon + Neon City zones, bosses at the full zone meter, party mini Clawds. Plan 5: desktop SVG loops, `/rpg demo|stats|doctor`, README art, release.

**How this plan was checked:** every code block below was run before the plan was written, in a scratch copy of the repo at `f90c12c`: all tasks applied in order give 111 passing tests and `claude plugin validate .` passes; the state after Task 5 (new frame, old register with the Task 5 edits) gives 101 passing tests. A contact sheet of every beat at 179 columns was checked by eye.

## Scope

In: the director (walk, encounter, enemy turn, finisher, victory, flee, call, trudge), forest foes (goblin, mushroom) and elites, skill banners, EXP/levels/zone meter/unlocks/bestiary saved in `$.store`, level-up flash, road position saved at turn end.

Out (later plans): idle walks to rest spots, compaction at the inn and a walking pace that follows activity (plan 3; in this plan Clawd idles where he stopped and walks at one pace), subagent party and boss turns (plan 4; the zone meter fills but no boss comes yet), the quest line (plan 3), `/rpg stats` (plan 5), anything on the desktop.

## Global Constraints

- Plugin `clawd-rpg` at `D:\Repos\Apps\clawd-rpg`; current `main` is `f90c12c` (Plan 1 + the scroll hitch fix).
- Clawd's body colour is `0xde886d` and is never changed: no tint, flash or silhouette. Foes and effects never use that colour either, so he stays unique on screen.
- EXP (spec §3.3): battle won +10, elite +25, raid/boss +60, turn completed +5. EXP to next level = `50 + 25 × level`. Zones unlock at Forest Lv.1, Dungeon Lv.3, Neon City Lv.6. Zone meter: battles won in the zone, capped at 12.
- Progress is shared by every repo and session: one `$.store` key `progress` = `{ v: 1, exp, level, zone, zoneMeter, unlocked, bestiary, roadPos }`. It is read fresh before every change. An unknown version is copied to `progressBackup` and replaced with a fresh save.
- Event → beat (spec §3.2): Edit → CLAW STRIKE, Write → SCRIBE SLASH, non-test Bash (and installs) → SHELL SHOCK, MCP → LINK BEAM; 2–4 hits defeat a foe. A failing test run → `COUNTER  ✗N` and the foe becomes an elite that only a passing run can finish (ALL-OUT ATTACK!!). A tool error → COUNTER ✗1, no elite. A finished turn → victory: loot named after the file edited most (`Blade of scenes.ts`), EXP, level-up flash. An interrupt or error ending the turn → the foe flees, no EXP. Notification/Elicitation → a `!` beside Clawd, who faces the camera. 5-hour limit used up (MP 0) → he trudges (road moves every other frame, half-pace legs).
- Visual rules (spec §5, enforced by tests): Clawd's pixels in every frame are exactly his sprite for that pose; every text cell's background is the pixel beneath; no foe pixel in the HUD's columns on the HUD row; foes stand ≥ 14 columns left of the HUD's first cell; each frame is a pure function of its scene. Plus: no text cell ever covers one of Clawd's pixels.
- Compact view (< 100 columns): no foes, banners, chests or captions; Clawd's pose still follows the beat.
- `types/index.d.ts` must be self-contained: no `import`/`export … from` (the validator rejects it). Shared types live there and code imports them from `../../types`.
- Render hooks never write state (the engine refuses `state.set` during `ui.render`); the story moves only on session events.
- Tempo: frame timer 160 ms; the road moves one whole pixel per frame while walking.
- Test width: **179 first** (the band's width in KaiC's 184-column terminal), then 40/99/100/150/220/300.
- Comments sparse, only the non-obvious *why*. Commits plain, no `Co-Authored-By` or other Claude trailers.

## Review Focus

1. **Two Claude Code sessions earning EXP at the same time** — each award must add onto what the other saved, not overwrite it. Test in Task 6 (`EXP another session earned meanwhile is kept`).
2. **A saved progress from an older/newer build or hand-edited** — missing or nonsense fields fall back one by one; an unknown version is kept aside, never silently lost. Tests in Tasks 2 and 6.
3. **The same tool result reported twice** (classic PostToolUse and the Bash `tool.call` wrapper both settle a command) — one COUNTER, one finisher, never two. Test in Task 3 (`a result reported twice settles once`).
4. **Fights at the narrow end of the full view (100–120 columns)** — Clawd steps back so the sword still reaches, and banner text and captions stop short of him. Test in Task 5 (the pixel-exact Clawd rule runs at 100 and 179).
5. **A turn ending mid-fight by interrupt or error** — the foe flees, no victory, no EXP, and nothing is left running into the next turn. Tests in Tasks 3 and 6.

---

### Task 1: Plumbing — read tool calls the way clawd-bar does

**Files:**
- Create: `hooks/plumbing/work.ts` (copied from clawd-bar), `tests/work.test.ts` (copied from clawd-bar)
- Modify: `types/index.d.ts`

**Interfaces:**
- Produces: `classifyCall(tool: string, input: Record<string, unknown>, id: string, now: number): Work`, `settleCall(work: Work, payload: Record<string, unknown>, failed: boolean, now: number): Work`, `testCounts(output: string)`; types `Work`, `WorkKind`, `WorkResult` exported from `types/index.d.ts`.

- [ ] **Step 1: Copy the tests and point them at the new path**

```bash
cd /d/Repos/Apps/clawd-rpg && mkdir -p hooks/plumbing && cp /d/Repos/Apps/clawd-bar/tests/work.test.ts tests/work.test.ts && sed -i "s|from '../hooks/work'|from '../hooks/plumbing/work'|" tests/work.test.ts
```

- [ ] **Step 2: Run to verify they fail**

Run: `claude plugin test .`
Expected: FAIL — `tests/work.test.ts: cannot import "../hooks/plumbing/work"`.

- [ ] **Step 3: Copy `work.ts`, fix its import, add the types**

```bash
cp /d/Repos/Apps/clawd-bar/hooks/work.ts hooks/plumbing/work.ts && sed -i "s|from '../types'|from '../../types'|" hooks/plumbing/work.ts
```

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

declare module 'claude-code' {
  interface PluginState {
    'clawd-rpg': {
      isHidden: boolean
      stats: RpgStats
    }
  }
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `claude plugin validate . && claude plugin test .`
Expected: validation passes; all tests pass (Plan 1's 39 + 17 work tests = 56).

- [ ] **Step 5: Commit**

```bash
git add hooks/plumbing tests/work.test.ts types/index.d.ts && git commit -m "Tool calls read the way clawd-bar reads them: edits, writes, commands, test runs and their results"
```

---

### Task 2: Progress — EXP, levels, zones, and a save that survives anything

**Files:**
- Create: `hooks/rpg/progress.ts`
- Test: `tests/progress.test.ts`

**Interfaces:**
- Produces: `type ZoneId = 'forest' | 'dungeon' | 'neon'`, `type AwardKind = 'battle' | 'elite' | 'raid' | 'turn'`, `type Award = { kind: AwardKind; foe?: string }`, `type Progress`, `EXP`, `UNLOCK_LEVEL`, `ZONE_BATTLES = 12`, `toNext(level)`, `FRESH: Progress`, `loadProgress(raw: unknown): { progress: Progress; backup?: unknown }`, `gain(p: Progress, award: Award): { progress: Progress; levelsUp: number }`, `expFraction(p: Progress): number`.

- [ ] **Step 1: Write the failing tests**

`tests/progress.test.ts`:
```ts
import { describe, expect, test } from 'claude-code/testing'

import { EXP, FRESH, ZONE_BATTLES, expFraction, gain, loadProgress, toNext } from '../hooks/rpg/progress'
import type { Progress } from '../hooks/rpg/progress'

describe('progress', () => {
  test('EXP per deed and the level curve match the spec', () => {
    expect(EXP).toEqual({ battle: 10, elite: 25, raid: 60, turn: 5 })
    expect([toNext(1), toNext(2), toNext(7)]).toEqual([75, 100, 225])
  })

  test('a battle won adds EXP, fills the zone meter and logs the foe', () => {
    const { progress, levelsUp } = gain(FRESH, { kind: 'battle', foe: 'goblin' })
    expect([progress.exp, progress.zoneMeter, progress.bestiary.goblin, levelsUp]).toEqual([10, 1, 1, 0])
  })

  test('a finished turn adds EXP but no battle', () => {
    const { progress } = gain(FRESH, { kind: 'turn' })
    expect([progress.exp, progress.zoneMeter]).toEqual([5, 0])
  })

  test('crossing the threshold levels up and carries the rest over', () => {
    const near: Progress = { ...FRESH, exp: 70 }
    const { progress, levelsUp } = gain(near, { kind: 'elite', foe: 'chief' })
    expect([progress.level, progress.exp, levelsUp]).toEqual([2, 20, 1])
  })

  test('levels unlock zones: Dungeon at 3, Neon City at 6', () => {
    const at = (level: number) => gain({ ...FRESH, level, exp: toNext(level) - 1 }, { kind: 'turn' }).progress.unlocked
    expect(at(2)).toEqual(['forest', 'dungeon'])
    expect(at(5)).toEqual(['forest', 'dungeon', 'neon'])
    expect(FRESH.unlocked).toEqual(['forest'])
  })

  test('the zone meter stops at the boss mark', () => {
    let p: Progress = { ...FRESH, zoneMeter: ZONE_BATTLES - 1 }
    for (let i = 0; i < 3; i++) p = gain(p, { kind: 'battle' }).progress
    expect(p.zoneMeter).toBe(ZONE_BATTLES)
  })

  test('the EXP bar is the share of this level done', () => {
    expect(expFraction({ ...FRESH, exp: 30 })).toBe(30 / 75)
  })
})

describe('loading saved progress', () => {
  test('nothing saved starts a fresh level 1 hero', () => {
    expect(loadProgress(undefined)).toEqual({ progress: FRESH })
  })

  test('a save from an older build fills its missing fields', () => {
    const { progress } = loadProgress({ v: 1, exp: 12, level: 4 })
    expect(progress).toEqual({ ...FRESH, exp: 12, level: 4, unlocked: ['forest', 'dungeon'] })
  })

  test('nonsense fields fall back one by one', () => {
    const { progress } = loadProgress({ v: 1, exp: -5, level: 'x', zone: 'moon', zoneMeter: 99, bestiary: { goblin: 3, bad: 'x' }, roadPos: NaN })
    expect(progress).toEqual({ ...FRESH, zoneMeter: ZONE_BATTLES, bestiary: { goblin: 3 } })
  })

  test('a zone he has not unlocked yet is not where he stands', () => {
    expect(loadProgress({ v: 1, level: 2, zone: 'neon' }).progress.zone).toBe('forest')
  })

  test('a version this build does not know is kept aside, and he starts fresh', () => {
    const future = { v: 2, exp: 9000 }
    expect(loadProgress(future)).toEqual({ progress: FRESH, backup: future })
    expect(loadProgress('garbage')).toEqual({ progress: FRESH, backup: 'garbage' })
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `claude plugin test .`
Expected: FAIL — cannot import `../hooks/rpg/progress`.

- [ ] **Step 3: Implement**

`hooks/rpg/progress.ts`:
```ts
export type ZoneId = 'forest' | 'dungeon' | 'neon'
export type AwardKind = 'battle' | 'elite' | 'raid' | 'turn'
export type Award = { kind: AwardKind; foe?: string }

// `exp` is what he has towards the next level, not a lifetime total.
export type Progress = {
  v: 1
  exp: number
  level: number
  zone: ZoneId
  zoneMeter: number
  unlocked: ZoneId[]
  bestiary: Record<string, number>
  roadPos: number
}

export const EXP: Record<AwardKind, number> = { battle: 10, elite: 25, raid: 60, turn: 5 }
export const UNLOCK_LEVEL: Record<ZoneId, number> = { forest: 1, dungeon: 3, neon: 6 }
const ZONES = Object.keys(UNLOCK_LEVEL) as ZoneId[]
// Battles won in a zone before its boss turn (plan 4 brings the boss).
export const ZONE_BATTLES = 12

export const toNext = (level: number) => 50 + 25 * level

export const FRESH: Progress = { v: 1, exp: 0, level: 1, zone: 'forest', zoneMeter: 0, unlocked: ['forest'], bestiary: {}, roadPos: 0 }

const num = (value: unknown, min: number, fallback: number) => (typeof value === 'number' && Number.isFinite(value) && value >= min ? value : fallback)
const unlockedAt = (level: number) => ZONES.filter(z => level >= UNLOCK_LEVEL[z])

// Stored progress may come from an older build, another hand, or nothing at all: every field
// falls back on its own, and a version this build doesn't know is kept aside, not overwritten.
export function loadProgress(raw: unknown): { progress: Progress; backup?: unknown } {
  if (raw === undefined || raw === null) return { progress: FRESH }
  if (typeof raw !== 'object' || (raw as { v?: unknown }).v !== 1) return { progress: FRESH, backup: raw }
  const r = raw as Record<string, unknown>
  const level = Math.floor(num(r.level, 1, 1))
  const zone = ZONES.includes(r.zone as ZoneId) ? (r.zone as ZoneId) : 'forest'
  const bestiary: Record<string, number> = {}
  if (typeof r.bestiary === 'object' && r.bestiary !== null) {
    for (const [k, n] of Object.entries(r.bestiary)) if (typeof n === 'number' && n > 0) bestiary[k] = Math.floor(n)
  }
  return {
    progress: {
      v: 1,
      exp: Math.min(num(r.exp, 0, 0), toNext(level) - 1),
      level,
      zone: unlockedAt(level).includes(zone) ? zone : 'forest',
      zoneMeter: Math.min(Math.floor(num(r.zoneMeter, 0, 0)), ZONE_BATTLES),
      unlocked: unlockedAt(level),
      bestiary,
      roadPos: num(r.roadPos, 0, 0),
    },
  }
}

export function gain(p: Progress, award: Award): { progress: Progress; levelsUp: number } {
  let exp = p.exp + EXP[award.kind]
  let level = p.level
  while (exp >= toNext(level)) {
    exp -= toNext(level)
    level++
  }
  const won = award.kind === 'battle' || award.kind === 'elite'
  const bestiary = award.foe ? { ...p.bestiary, [award.foe]: (p.bestiary[award.foe] ?? 0) + 1 } : p.bestiary
  return {
    progress: { ...p, exp, level, unlocked: unlockedAt(level), zoneMeter: won ? Math.min(ZONE_BATTLES, p.zoneMeter + 1) : p.zoneMeter, bestiary },
    levelsUp: level - p.level,
  }
}

export const expFraction = (p: Progress) => p.exp / toNext(p.level)
```

- [ ] **Step 4: Run to verify they pass**

Run: `claude plugin test .`
Expected: all pass (12 new).

- [ ] **Step 5: Commit**

```bash
git add hooks/rpg/progress.ts tests/progress.test.ts && git commit -m "Progress: EXP per deed, the level curve, zone unlocks, and saves that load whatever they hold"
```

---

### Task 3: The director — session events become the story of a fight

**Files:**
- Create: `hooks/rpg/director.ts`
- Modify: `types/index.d.ts` (add `FoeKind`, `Foe`, `Story`; declare the `story` atom)
- Test: `tests/director.test.ts`

**Interfaces:**
- Consumes: `classifyCall`, `settleCall` (Task 1); `EXP`, `Award` (Task 2); `noise` (Plan 1, `hooks/rpg/noise.ts`).
- Produces: types `Foe`, `FoeKind`, `Story` (declared in `types/index.d.ts`, re-exported by the director), `HookPayload`, `Beat = 'walk' | 'idle' | 'encounter' | 'enemyTurn' | 'finisher' | 'victory' | 'flee'`; timings `FOE_ENTER_MS = 800`, `SKILL_MS = 1400`, `DOWN_MS = 1000`, `COUNTER_MS = 2000`, `FINISHER_MS = 2400`, `VICTORY_MS = 4400`, `FLEE_MS = 1600`, `CALL_MS = 6000`, `LEVEL_UP_MS = 3000`; `FOREST_ROSTER`, `SKILLS`, `NO_STORY`, `lootName(files, lastFoe)`, `step(story, event, payload, now): { story, awards }`, `withLevelUp(story, level, now)`, `beatOf(story, now): Beat`.
- Events `step` understands (names as in clawd-bar's `observe`): `SessionStart`, `UserPromptSubmit`, `PreToolUse` (`tool_name`, `tool_input`, `tool_use_id`), `PostToolUse` / `PostToolUseFailure` (`tool_use_id`, `tool_response` / `error`), `TurnEnded` (`reason`: `answer | aborted | error | refusal`), `Notification`, `Elicitation`.

- [ ] **Step 1: Write the failing tests**

`tests/director.test.ts`:
```ts
import { describe, expect, test } from 'claude-code/testing'

import {
  COUNTER_MS,
  DOWN_MS,
  FINISHER_MS,
  FLEE_MS,
  NO_STORY,
  VICTORY_MS,
  beatOf,
  lootName,
  step,
  withLevelUp,
} from '../hooks/rpg/director'
import type { HookPayload, Story } from '../hooks/rpg/director'
import type { Award } from '../hooks/rpg/progress'

const T0 = 1_000_000

// Plays events one second apart and collects the awards; `at` is the time of the last event.
function play(events: [string, HookPayload][], from: Story = NO_STORY) {
  let story = from
  const awards: Award[] = []
  let at = T0
  for (const [event, payload] of events) {
    at += 1000
    const r = step(story, event, payload, at)
    story = r.story
    awards.push(...r.awards)
  }
  return { story, awards, at }
}

let ids = 0
const pre = (tool_name: string, tool_input: HookPayload) => ['PreToolUse', { tool_name, tool_input, tool_use_id: `t${++ids}` }] as [string, HookPayload]
const post = (payload: HookPayload, failed = false) => [failed ? 'PostToolUseFailure' : 'PostToolUse', { tool_use_id: `t${ids}`, ...payload }] as [string, HookPayload]
const prompt: [string, HookPayload] = ['UserPromptSubmit', { prompt: 'go' }]
const edit = (file = 'D:/src/app/scenes.ts') => pre('Edit', { file_path: file, old_string: 'a', new_string: 'b' })
const tests = () => pre('Bash', { command: 'npm test' })
const testsFailed = (n: number) => post({ tool_response: { stdout: `Tests  ${n} failed | 4 passed (${n + 4})`, stderr: '' } })
const testsPassed = () => post({ tool_response: { stdout: 'Tests  6 passed (6)', stderr: '' } })
const done: [string, HookPayload] = ['TurnEnded', { reason: 'answer' }]

describe('walking and fighting', () => {
  test('a prompt starts the walk; reading keeps walking', () => {
    const { story, at } = play([prompt, pre('Read', { file_path: 'a.ts' }), pre('Grep', { pattern: 'x' })])
    expect(story.foe).toBeNull()
    expect(beatOf(story, at)).toBe('walk')
  })

  test('an edit brings a foe from the forest roster and lands a skill on it', () => {
    const { story, at } = play([prompt, edit()])
    expect(['goblin', 'shroom']).toContain(story.foe?.kind)
    expect(story.foe!.maxHp).toBeGreaterThanOrEqual(2)
    expect(story.foe!.maxHp).toBeLessThanOrEqual(4)
    expect(story.foe!.hp).toBe(story.foe!.maxHp - 1)
    expect(story.skill).toEqual({ name: 'CLAW STRIKE', at })
    expect(beatOf(story, at)).toBe('encounter')
  })

  test('each kind of call is its own skill', () => {
    const name = (e: [string, HookPayload]) => play([prompt, e]).story.skill?.name
    expect(name(pre('Write', { file_path: 'a.ts', content: 'x' }))).toBe('SCRIBE SLASH')
    expect(name(pre('Bash', { command: 'git status' }))).toBe('SHELL SHOCK')
    expect(name(pre('mcp__github__get_issue', {}))).toBe('LINK BEAM')
    expect(name(pre('Read', { file_path: 'a.ts' }))).toBeUndefined()
  })

  test('two to four blows defeat a foe, which is a battle won', () => {
    const { story, awards, at } = play([prompt, edit(), edit(), edit(), edit()])
    expect(awards.filter(a => a.kind === 'battle').length).toBeGreaterThanOrEqual(1)
    expect(awards[0]!.foe).toBe(story.down!.kind)
    expect(story.turn.gained).toBe(10 * awards.length)
    expect(beatOf(story, at + DOWN_MS)).toBe(story.foe ? 'encounter' : 'walk')
  })
})

describe('tests: the enemy turn and the finisher', () => {
  test('a failing run is the enemy turn: COUNTER with the failure count, and an elite stands', () => {
    const { story, at } = play([prompt, edit(), tests(), testsFailed(3)])
    expect(story.counter).toEqual({ n: 3, at })
    expect(story.foe?.elite).toBe(true)
    expect(beatOf(story, at)).toBe('enemyTurn')
    expect(beatOf(story, at + COUNTER_MS)).toBe('encounter')
  })

  test('fix edits wear the elite down but cannot finish it', () => {
    const { story } = play([prompt, edit(), tests(), testsFailed(1), edit(), edit(), edit(), edit(), edit()])
    expect(story.foe).toMatchObject({ elite: true, hp: 1 })
  })

  test('a passing run is the ALL-OUT ATTACK that finishes the elite', () => {
    const { story, awards, at } = play([prompt, edit(), tests(), testsFailed(2), edit(), tests(), testsPassed()])
    expect(story.foe).toBeNull()
    expect(story.down).toMatchObject({ finisher: true, at })
    expect(awards.at(-1)!.kind).toBe('elite')
    expect(beatOf(story, at)).toBe('finisher')
    expect(beatOf(story, at + FINISHER_MS)).toBe('walk')
  })

  test('a failing run with nothing in the way brings an elite of its own', () => {
    const { story } = play([prompt, tests(), testsFailed(1)])
    expect(story.foe?.elite).toBe(true)
  })

  test('a tool error is a counter too, with no elite', () => {
    const { story, at } = play([prompt, edit(), pre('Bash', { command: 'ls nope' }), post({ error: 'No such file' }, true)])
    expect(story.counter).toEqual({ n: 1, at })
    expect(story.foe?.elite).toBe(false)
  })

  test('a result reported twice settles once', () => {
    const { story } = play([prompt, edit(), tests(), testsFailed(2), testsFailed(2)])
    expect(story.counter?.n).toBe(2)
    expect(Object.keys(story.calls)).not.toContain(`t${ids}`)
  })
})

describe('the end of a turn', () => {
  test('a finished turn is a victory: the foe still standing falls, loot is named after the file edited most', () => {
    const { story, awards, at } = play([prompt, edit('D:/a/band.tsx'), edit('D:/a/scenes.ts'), edit('D:/a/scenes.ts'), done])
    expect(awards.at(-1)).toEqual({ kind: 'turn' })
    expect(story.victory?.loot).toMatch(/ of scenes\.ts$/)
    expect(story.victory?.gained).toBe(awards.reduce((n, a) => n + ({ battle: 10, elite: 25, raid: 60, turn: 5 })[a.kind], 0))
    expect(beatOf(story, at)).toBe('victory')
    expect(beatOf(story, at + VICTORY_MS)).toBe('idle')
  })

  test('an elite left standing at the end flees instead of falling', () => {
    const { story, awards } = play([prompt, edit(), tests(), testsFailed(1), done])
    expect(awards.map(a => a.kind)).toEqual(['turn'])
    expect(story.fled?.kind).toBeDefined()
  })

  test('an interrupt skids him to a stop and the foe flees: no victory, no EXP', () => {
    const { story, awards, at } = play([prompt, edit(), ['TurnEnded', { reason: 'aborted' }]])
    expect(story.victory).toBeNull()
    expect(awards).toEqual([])
    expect(beatOf(story, at)).toBe('flee')
    expect(beatOf(story, at + FLEE_MS)).toBe('idle')
  })

  test('a turn ends once, however many hooks say so', () => {
    const { awards } = play([prompt, done, done, ['TurnEnded', { reason: 'answer' }]])
    expect(awards).toEqual([{ kind: 'turn' }])
  })

  test('a turn with no fight still has a trophy', () => {
    expect(play([prompt, done]).story.victory?.loot).toBe('Forest Herb')
    expect(lootName({}, 'goblin')).toBe('Goblin Fang')
  })
})

describe('everything else', () => {
  test('Claude needing you is a call he answers wherever he is', () => {
    const { story, at } = play([prompt, ['Notification', { message: 'needs approval' }]])
    expect(story.calledAt).toBe(at)
  })

  test('a level-up is kept across the next prompt so its flash can finish', () => {
    const up = withLevelUp(NO_STORY, 4, T0)
    expect(step(up, 'UserPromptSubmit', {}, T0 + 10).story.levelUp).toEqual({ level: 4, at: T0 })
  })

  test('the same events always tell the same story', () => {
    const events = [prompt, edit(), edit(), tests(), testsFailed(1), done]
    expect(play(events).story).toEqual(play(events).story)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `claude plugin test .`
Expected: FAIL — cannot import `../hooks/rpg/director`.

- [ ] **Step 3: Implement**

Replace `types/index.d.ts` with (the story types live here because the types contract must not import anything):
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

// The battle on the band, moved on by session events (hooks/rpg/director.ts). Times are clock ms.
export type Story = {
  turn: { active: boolean; at: number; files: Record<string, number>; gained: number; foes: number }
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

`hooks/rpg/director.ts`:
```ts
import type { Foe, FoeKind, Story, Work, WorkKind } from '../../types'
import { classifyCall, settleCall } from '../plumbing/work'
import { noise } from './noise'
import { EXP } from './progress'
import type { Award } from './progress'

export type { Foe, FoeKind, Story }
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
  turn: { active: false, at: 0, files: {}, gained: 0, foes: 0 },
  foe: null,
  skill: null,
  down: null,
  counter: null,
  victory: null,
  fled: null,
  levelUp: null,
  calledAt: null,
  calls: {},
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

// Session events in, the story out, plus the deeds that earn EXP.
export function step(s: Story, event: string, payload: HookPayload, now: number): { story: Story; awards: Award[] } {
  const awards: Award[] = []
  const story = ((): Story => {
    switch (event) {
      case 'SessionStart':
        return NO_STORY
      case 'UserPromptSubmit':
        return { ...NO_STORY, levelUp: s.levelUp, turn: { active: true, at: now, files: {}, gained: 0, foes: 0 } }
      case 'PreToolUse': {
        const input = typeof payload.tool_input === 'object' && payload.tool_input !== null ? (payload.tool_input as HookPayload) : {}
        const id = str(payload.tool_use_id)
        const work = classifyCall(str(payload.tool_name), input, id, now)
        const opened = { ...s, calls: { ...s.calls, [id]: work } }
        return attack(opened, work, str(input.file_path) || str(input.notebook_path), now, awards)
      }
      case 'PostToolUse':
        return settle(s, payload, false, now, awards)
      case 'PostToolUseFailure':
        return settle(s, payload, true, now, awards)
      case 'TurnEnded':
        return endTurn(s, str(payload.reason), now, awards)
      case 'Notification':
      case 'Elicitation':
        return { ...s, calledAt: now }
      default:
        return s
    }
  })()
  return { story, awards }
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
Expected: validation passes (the `story` state is declared but not yet used — that is allowed); all pass (18 new).

- [ ] **Step 5: Commit**

```bash
git add hooks/rpg/director.ts tests/director.test.ts types/index.d.ts && git commit -m "The director: edits wear foes down, a failing run is the counter, a passing run the finisher, a finished turn the victory"
```

---

### Task 4: Battle art — foes, banners, sword, chest and Clawd's battle poses

**Files:**
- Create: `hooks/rpg/sprites/foes.ts`, `hooks/rpg/sprites/fx.ts`
- Modify: `hooks/rpg/noise.ts` (add easing helpers), `hooks/rpg/sprites/clawd.ts` (add `trudging`, `cheering`, `hurting`)
- Test: `tests/art.test.ts`

**Interfaces:**
- Consumes: `put`, `rect`, `sprite`, `write`, `Grid` (Plan 1); `FoeKind` (Task 3).
- Produces:
  - `noise.ts`: `clamp01(x)`, `lerp(a, b, q)`, `easeOut(q)`, `through(t, start, ms)` (0..1).
  - `clawd.ts`: `trudging(t): Pose`, `cheering(t): Pose`, `hurting(t): Pose`.
  - `foes.ts`: `FOES: Record<FoeKind, { frames, pal, w, h }>`, `foeTop(kind)`, `drawFoe(g, kind, x, y, t, { flash?, elite? })`, `drawHp(g, x, y, hp, maxHp)`.
  - `fx.ts`: `FX_GLYPHS = ['◆', '✗', '·']`, `banner(g, label, q, bg, fg?, before?)`, `burst(g, x, y, r, colors, n?)`, `sword(g, x, y, down)`, `sparks(g, x, y, t)`, `chest(g, x, y, open, t)`, `cloud(g, x, t)`, `bang(g, x, t)`, `dust(g, x, t)`.
- Departures from the sketch, both forced by spec rule 5 (no foe pixel in the HUD's columns on the HUD row): foes **drop in from the treetops** instead of walking in from the right edge, and a fleeing foe **leaps up and out** instead of running right. The ALL-OUT ATTACK dust cloud is 22 columns wide (the sketch's 28 reached into the HUD) and its flying bits are gold, not Clawd's orange.

- [ ] **Step 1: Write the failing tests**

`tests/art.test.ts`:
```ts
import { describe, expect, test } from 'claude-code/testing'

import { EMPTY, PX_H, at, grid } from '../hooks/rpg/grid'
import { EYE, ORANGE, clawd, cheering, hurting, trudging } from '../hooks/rpg/sprites/clawd'
import { FOES, drawFoe, foeTop } from '../hooks/rpg/sprites/foes'
import { FX_GLYPHS, banner } from '../hooks/rpg/sprites/fx'

describe('battle art', () => {
  test('his new poses keep his body his orange', () => {
    for (const pose of [trudging(0), trudging(640), cheering(0), cheering(480), hurting(0), hurting(160)]) {
      const g = grid(24)
      clawd(g, 4, 1, pose)
      for (const c of g.px) if (c !== EMPTY) expect([ORANGE, EYE]).toContain(c)
    }
  })

  test('out of usage his legs step half as often', () => {
    expect([0, 320, 640, 960].map(t => trudging(t).step)).toEqual([false, false, true, true])
  })

  test('foes never wear his orange, and stand on the ground', () => {
    for (const [kind, look] of Object.entries(FOES)) {
      expect(Object.values(look.pal)).not.toContain(ORANGE)
      for (const frame of look.frames) expect([frame.length, frame[0]!.length]).toEqual([look.h, look.w])
      const g = grid(12)
      drawFoe(g, kind as keyof typeof FOES, 0, foeTop(kind as keyof typeof FOES), 0)
      expect(Array.from({ length: look.w }, (_, x) => at(g, x, PX_H - 1)).some(c => c !== EMPTY)).toBe(true)
    }
  })

  test("a banner's text stops two columns short of where Clawd stands", () => {
    const g = grid(120)
    banner(g, 'COUNTER  ✗3', 0.5, 0x000000, 0xff4b4b, 39)
    const cols = [...g.text.keys()].map(k => k % 120)
    expect(Math.max(...cols)).toBe(37)
    expect([...g.text.keys()].every(k => Math.floor(k / 120) === 2)).toBe(true)
  })

  test('every effect glyph is one BMP character', () => {
    for (const ch of FX_GLYPHS) {
      expect([...ch].length).toBe(1)
      expect(ch.codePointAt(0)!).toBeLessThan(0x10000)
    }
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `claude plugin test .`
Expected: FAIL — cannot import `../hooks/rpg/sprites/foes` / `fx`, and `trudging` is not exported.

- [ ] **Step 3: Implement**

In `hooks/rpg/noise.ts`, add above `export const pick`:
```ts
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
export const lerp = (a: number, b: number, q: number) => a + (b - a) * q
export const easeOut = (q: number) => 1 - (1 - clamp01(q)) ** 3
// How far `t` is through the span from `start` lasting `ms`, as 0..1.
export const through = (t: number, start: number, ms: number) => clamp01((t - start) / ms)
```

In `hooks/rpg/sprites/clawd.ts`, add after `export const walking = …`:
```ts
// Out of usage: half-pace steps, arms hanging.
export const trudging = (t: number): Pose => ({ fx: 1, fy: 1, armL: 10, armR: 10, step: Math.floor(t / (2 * LEG_STEP_MS)) % 2 === 1 })

export const cheering = (t: number): Pose => (Math.floor(t / 480) % 2 === 1 ? POSES.bounce : POSES.cheer)

// Knocked back: eyes shut, arms down, shaking on the spot.
export const hurting = (t: number): Pose => ({ armL: 10, armR: 10, face: 'shut', dx: Math.floor(t / 160) % 2 === 1 ? 1 : -1 })
```

`hooks/rpg/sprites/foes.ts`:
```ts
import { put, rect, sprite } from '../grid'
import type { Grid } from '../grid'
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
}

const WHITE = 0xffffff
const GOLD = 0xffd54f
const HP_ON = 0xe5484d
const HP_OFF = 0x3a1a22

// Feet on the ground: the bottom of the sprite sits on pixel row 9.
export const foeTop = (kind: FoeKind) => 10 - FOES[kind].h

export function drawFoe(g: Grid, kind: FoeKind, x: number, y: number, t: number, opts: { flash?: boolean; elite?: boolean } = {}): void {
  const look = FOES[kind]
  const frame = look.frames[Math.floor(t / 400) % 2]!
  const pal = opts.flash ? Object.fromEntries(Object.keys(look.pal).map(k => [k, WHITE])) : look.pal
  sprite(g, x, y, frame, pal)
  if (opts.elite) for (const dx of [1, 3, 5]) put(g, x + dx, y - 1, GOLD)
}

// Two pixels a hit point, over the foe's head.
export function drawHp(g: Grid, x: number, y: number, hp: number, maxHp: number): void {
  for (let i = 0; i < maxHp; i++) rect(g, x + i * 2, y, 2, 1, i < hp ? HP_ON : HP_OFF)
}
```

`hooks/rpg/sprites/fx.ts`:
```ts
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
```

- [ ] **Step 4: Run to verify they pass**

Run: `claude plugin test .`
Expected: all pass (5 new).

- [ ] **Step 5: Commit**

```bash
git add hooks/rpg/noise.ts hooks/rpg/sprites tests/art.test.ts && git commit -m "Battle art: goblins and mushrooms, skill banners, the sword, the chest, and Clawd's battle poses"
```

---

### Task 5: The frame draws the story, and the HUD shows real progress

**Files:**
- Modify: `hooks/rpg/frame.ts` (replace), `hooks/rpg/stats.ts` (replace), `hooks/register.tsx` (five small edits so it still compiles; Task 6 replaces it)
- Test: `tests/frame.test.ts` (replace), `tests/hud.test.ts` (edit), `tests/svg.test.ts` (edit)

**Interfaces:**
- Consumes: everything from Tasks 2–4; `drawHud`, `hudLeft`, `GLYPHS` (Plan 1).
- Produces:
  - `frame.ts`: `Scene = { width, t, distance, isWalking, stats, story: Story, trudge?: boolean }` (**`story` is now required**), `CLAWD_COL`, `COMPACT_COL`, `COMPACT_BELOW`, `HIDDEN_BELOW`, `clawdCol(width)`, `foeX(width, stats)`, `clawdAt(scene): { x, pose, strike } | null`, `frame(scene): Grid`.
  - `stats.ts`: `statsFrom(usage: Usage | null, place: string, progress: Progress): RpgStats` (**third argument added**).

- [ ] **Step 1: Write the failing tests**

Replace `tests/frame.test.ts` with:
```ts
import { describe, expect, test } from 'claude-code/testing'

import type { RpgStats } from '../types'
import { DEFAULT_COLOR, toWords } from '../hooks/rpg/cells'
import { FOE_ENTER_MS, NO_STORY, beatOf, step, withLevelUp } from '../hooks/rpg/director'
import type { HookPayload, Story } from '../hooks/rpg/director'
import { CLAWD_COL, COMPACT_BELOW, COMPACT_COL, clawdAt, clawdCol, foeX, frame } from '../hooks/rpg/frame'
import type { Scene } from '../hooks/rpg/frame'
import { EMPTY, PX_H, ROWS, at, grid } from '../hooks/rpg/grid'
import { GLYPHS, hudLeft } from '../hooks/rpg/hud'
import { EYE, ORANGE, clawd } from '../hooks/rpg/sprites/clawd'
import { FOES } from '../hooks/rpg/sprites/foes'
import { FX_GLYPHS } from '../hooks/rpg/sprites/fx'

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

// One story per beat, each with the moments worth drawing.
function stories(): { name: string; story: Story; times: number[] }[] {
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
    expect([...seen].sort()).toEqual(['encounter', 'enemyTurn', 'finisher', 'flee', 'victory', 'walk'].sort())
  })
})

describe('the visual rules', () => {
  test("Clawd's pixels are exactly his sprite in every beat: nothing paints over or recolours him", () => {
    for (const width of WIDTHS) {
      for (const { name, story, times } of stories()) {
        for (const t of times) {
          const s = scene(width, t, 10, true, story)
          const me = clawdAt(s)
          if (!me) continue
          const solo = grid(width)
          clawd(solo, me.x, 1, me.pose)
          const g = frame(s)
          const words = toWords(g)
          for (let y = 0; y < PX_H; y++) {
            for (let x = 0; x < width; x++) {
              const c = at(solo, x, y)
              if (c === EMPTY) continue
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
      for (const { story, times } of stories()) {
        for (const t of times) {
          const g = frame(scene(width, t, 10, true, story))
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
      for (const { story, times } of stories()) {
        for (const t of times) {
          const g = frame(scene(width, t, 10, true, story))
          const bare = frame(scene(width, t, 10, true, NO_STORY))
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
    for (const { story, times } of stories()) {
      for (const t of times) {
        const g = frame(scene(80, t, 10, true, story))
        for (const c of g.px) expect(foeColors.has(c)).toBe(false)
        for (const key of g.text.keys()) expect(Math.floor(key / 80)).toBe(ROWS - 1)
      }
    }
  })

  test('every character drawn is ASCII or a known one-cell glyph', () => {
    const known = new Set<string>([...GLYPHS, ...FX_GLYPHS])
    for (const width of WIDTHS) {
      for (const { story, times } of stories()) {
        for (const t of times) {
          for (const { cp } of frame(scene(width, t, 10, true, story)).text.values()) {
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
```

In `tests/hud.test.ts`:
- replace `import { statsFrom } from '../hooks/rpg/stats'` with
```ts
import { FRESH } from '../hooks/rpg/progress'
import { statsFrom } from '../hooks/rpg/stats'
```
- in `'HP is the context left and MP the 5-hour limit left'`, pass `FRESH` as the third argument: `statsFrom({ … }, 'my-app/main', FRESH)`;
- replace the body of `'with no usage to read, HP and MP are full'` and add a test after it:
```ts
  test('with no usage to read, HP and MP are full', () => {
    expect(statsFrom(null, '', FRESH)).toEqual({ level: 1, exp: 0, hp: 1, mp: 1, place: '' })
    expect(statsFrom({}, 'x', FRESH).hp).toBe(1)
  })

  test('level and the EXP bar come from saved progress', () => {
    expect(statsFrom(null, '', { ...FRESH, level: 4, exp: 75 })).toMatchObject({ level: 4, exp: 0.5 })
  })
```

Replace `tests/svg.test.ts` with:
```ts
import { expect, test } from 'claude-code/testing'

import type { RpgStats } from '../types'
import { NO_STORY } from '../hooks/rpg/director'
import { frame } from '../hooks/rpg/frame'
import { SVG_MAX_CHARS, svgLoop } from '../hooks/rpg/svg'

const STATS: RpgStats = { level: 1, exp: 0, hp: 1, mp: 1, place: '' }

test('an 8-frame walk at 96 columns fits the desktop SVG cap', () => {
  const frames = Array.from({ length: 8 }, (_, i) => frame({ width: 96, t: i * 320, distance: i * 2.24, isWalking: true, stats: STATS, story: NO_STORY }))
  const svg = svgLoop(frames, 320)
  // 12 frames at 120 columns measured 164,064 chars, over the cap; see docs/spikes.md.
  console.log(`svg chars for 8 frames at 96 columns: ${svg.length}`)
  expect(svg.length).toBeLessThan(SVG_MAX_CHARS)
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `claude plugin test .`
Expected: FAIL — `frame.test.ts` cannot import `clawdAt` / `foeX`; the new HUD test gets `level 1`.

- [ ] **Step 3: Implement**

`hooks/rpg/frame.ts`:
```ts
import type { RpgStats } from '../../types'
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
} from './director'
import type { Beat, Story } from './director'
import { grid, write } from './grid'
import type { Grid } from './grid'
import { drawHud, hudLeft } from './hud'
import { easeOut, lerp, through } from './noise'
import { FOREST } from './places/forest'
import { POSES, cheering, clawd, hurting, idling, trudging, walking } from './sprites/clawd'
import type { Pose } from './sprites/clawd'
import { drawFoe, drawHp, foeTop } from './sprites/foes'
import { bang, banner, burst, chest, cloud, dust, sparks, sword } from './sprites/fx'

export const CLAWD_COL = 50
export const COMPACT_COL = 4
// Below this a fight can't fit left of the HUD, so the band shows Clawd and the place only.
export const COMPACT_BELOW = 100
export const HIDDEN_BELOW = 40
// Clawd swings from this far left of the foe, so the sword's arc lands on it.
const REACH = 22

export type Scene = { width: number; t: number; distance: number; isWalking: boolean; stats: RpgStats; story: Story; trudge?: boolean }

export const clawdCol = (width: number) => (width < COMPACT_BELOW ? COMPACT_COL : CLAWD_COL)

// Where a foe stands: at most 36 columns past Clawd, and always 14 clear of the HUD.
export const foeX = (width: number, stats: RpgStats) => Math.min(CLAWD_COL + 36, hudLeft(width, stats) - 14)

const isCompact = (s: Scene) => s.width < COMPACT_BELOW
// The sword comes down for the last 45% of each 480 ms swing; the first swing waits for the foe to land.
const swingFrom = (story: Story) => Math.max(story.skill?.at ?? 0, (story.foe?.at ?? 0) + FOE_ENTER_MS)
const isSwinging = (story: Story, t: number) => story.skill !== null && t >= swingFrom(story) && t - swingFrom(story) < SKILL_MS * 0.8
const swingDown = (story: Story, t: number) => (t - swingFrom(story)) % 480 >= 264

// Where Clawd is and how he stands, or null while the ALL-OUT ATTACK cloud hides him.
export function clawdAt(s: Scene): { x: number; pose: Pose; strike: boolean } | null {
  const { t, story } = s
  const beat = beatOf(story, t)
  const home = clawdCol(s.width)
  const walk = s.trudge ? trudging(t) : walking(t)
  const called = story.calledAt !== null && t - story.calledAt < CALL_MS
  if (isCompact(s)) {
    if (beat === 'victory') return { x: home, pose: cheering(t), strike: false }
    if (beat === 'enemyTurn') return { x: home, pose: hurting(t), strike: false }
    return { x: home, pose: called ? POSES.stand : s.isWalking ? walk : idling(t), strike: false }
  }
  const fx = foeX(s.width, s.stats)
  const stand = Math.min(CLAWD_COL, fx - REACH)
  switch (beat) {
    case 'encounter': {
      const x = Math.round(lerp(CLAWD_COL, stand, through(t, story.foe?.at ?? story.down?.at ?? t, 400)))
      if (isSwinging(story, t)) return { x: fx - REACH, pose: swingDown(story, t) ? POSES.strike : POSES.swing, strike: true }
      return { x, pose: POSES.right, strike: false }
    }
    case 'enemyTurn':
      return { x: stand - (t - story.counter!.at < COUNTER_MS / 2 ? 3 : 0), pose: hurting(t), strike: false }
    case 'finisher':
      return t - story.down!.at < FINISHER_MS * 0.7 ? null : { x: stand, pose: cheering(t), strike: false }
    case 'victory':
      return { x: CLAWD_COL, pose: cheering(t), strike: false }
    case 'flee':
      return { x: stand, pose: { fx: 1, armL: 8, armR: 10 }, strike: false }
    default:
      return { x: home, pose: called ? POSES.stand : s.isWalking ? walk : idling(t), strike: false }
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

export function frame(s: Scene): Grid {
  const g = grid(s.width)
  const { t, story } = s
  const cam = Math.floor(s.distance)
  for (let x = 0; x < s.width; x++) FOREST.col(g, x, x + cam, t, cam, Number.POSITIVE_INFINITY)
  const beat = beatOf(story, t)
  const me = clawdAt(s)
  if (!isCompact(s)) drawFight(g, s, beat, me?.x ?? Math.min(CLAWD_COL, foeX(s.width, s.stats) - REACH))
  if (me) {
    clawd(g, me.x, 1, me.pose)
    if (me.strike) sword(g, me.x, 1, me.pose === POSES.strike)
    if (beat === 'enemyTurn') sparks(g, me.x, 1, t)
    if (beat === 'flee') dust(g, me.x, t)
    if (story.calledAt !== null && t - story.calledAt < CALL_MS) bang(g, me.x, t)
  }
  if (beat === 'victory' && story.victory && !isCompact(s)) {
    const fx = foeX(s.width, s.stats)
    chest(g, Math.max(CLAWD_COL + 18, fx - 4), 4, t - story.victory.at > 400, t)
    if (t - story.victory.at > 600) caption(g, `◆ ${story.victory.loot} · +${story.victory.gained} EXP`, 0xffd54f, me?.x ?? CLAWD_COL)
  }
  drawHud(g, s.stats)
  if (story.levelUp && t >= story.levelUp.at && t - story.levelUp.at < LEVEL_UP_MS && !isCompact(s)) {
    write(g, hudLeft(s.width, s.stats), 3, `LEVEL UP!  Lv.${story.levelUp.level}`, 0xffd54f)
  }
  return g
}
```

`hooks/rpg/stats.ts`:
```ts
import type { RpgStats } from '../../types'
import { expFraction } from './progress'
import type { Progress } from './progress'

export type Usage = { context?: { percent?: number }; rateLimits?: { kind: string; percentUsed: number }[] }

export function statsFrom(usage: Usage | null, place: string, progress: Progress): RpgStats {
  const ctx = usage?.context?.percent ?? 0
  const fiveHour = usage?.rateLimits?.find(l => l.kind === 'five_hour')?.percentUsed ?? 0
  return { level: progress.level, exp: expFraction(progress), hp: 1 - ctx / 100, mp: 1 - fiveHour / 100, place }
}
```

In `hooks/register.tsx` (keeps Plan 1's band working until Task 6 replaces the file):
- after `import { encodeCells } from './rpg/cells'` add `import { NO_STORY } from './rpg/director'`;
- after `import { ROWS } from './rpg/grid'` add `import { FRESH } from './rpg/progress'`;
- `statsFrom(null, '')` → `statsFrom(null, '', FRESH)`;
- `const next = statsFrom(usage, place)` → `const next = statsFrom(usage, place, FRESH)`;
- in `cellsNow`, `stats: await read($, stats) }` → `stats: await read($, stats), story: NO_STORY }`.

- [ ] **Step 4: Run to verify they pass**

Run: `claude plugin validate . && claude plugin test .`
Expected: validation passes; all pass (101 in total).

- [ ] **Step 5: Commit**

```bash
git add hooks/rpg/frame.ts hooks/rpg/stats.ts hooks/register.tsx tests/frame.test.ts tests/hud.test.ts tests/svg.test.ts && git commit -m "The frame draws every beat of a fight, and keeps Clawd's pixels, the HUD and his orange untouched"
```

---

### Task 6: Wire it up — hooks drive the story, awards are saved for every session

**Files:**
- Modify: `hooks/register.tsx` (replace), `tests/mod.test.tsx` (edit `fakeSession`, append tests)

**Interfaces:**
- Consumes: `step`, `beatOf`, `withLevelUp`, `NO_STORY` (Task 3); `gain`, `loadProgress`, `FRESH` (Task 2); `frame` (Task 5); `statsFrom` (Task 5).
- Produces: atoms `clawd-rpg.isHidden`, `.stats`, `.story`; store keys `isHidden`, `progress`, `progressBackup`; hooks: `session.start`, `command.run{rpg}`, `ui.render{AbovePrompt}`, `tool.call{Bash, PowerShell}`, `turn.complete`, `classic.SessionStart | UserPromptSubmit | PreToolUse | PostToolUse | PostToolUseFailure | Stop | Notification | Elicitation`.

- [ ] **Step 1: Write the failing tests**

In `tests/mod.test.tsx`, replace the start of `fakeSession`:
```tsx
function fakeSession(
  on: On,
  blits: string[],
  usage: Usage | 'fails' = { context: { window: 200000, tokens: 24000, percent: 12 }, rateLimits: [] },
  repo = { cwd: 'C:/src/my-app', branch: 'main' },
) {
  mock.env(on, { USERPROFILE: '/Users/tester' })
  mock.store(on)
```
with:
```tsx
function fakeSession(
  on: On,
  blits: string[],
  usage: Usage | 'fails' = { context: { window: 200000, tokens: 24000, percent: 12 }, rateLimits: [] },
  repo = { cwd: 'C:/src/my-app', branch: 'main' },
  saved: Record<string, unknown> = {},
) {
  mock.env(on, { USERPROFILE: '/Users/tester' })
  // The plugin's store, kept here so tests can read what was saved.
  const store = new Map<string, unknown>(Object.entries(saved))
  on('store.get', ($, e) => ({ value: store.get(e.key) }))
  on('store.set', ($, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
```
and its end:
```tsx
    return <Text key="beneath">nothing above the prompt</Text>
  })
}
```
with:
```tsx
    return <Text key="beneath">nothing above the prompt</Text>
  })
  return store
}
```

(`mock.store` keeps its map to itself and the test's `$` has no `store`; this map lets the tests read what was saved.)

Append to the end of `tests/mod.test.tsx` (it uses `groundCell`, already defined in the file by the scroll-hitch test):
```tsx
// KaiC's own terminal is 184 columns, where the band is 179 wide.
const WIDE = 179

const EDIT = { tool: 'Edit', file_path: 'C:/src/my-app/hooks/scenes.ts', old_string: 'a', new_string: 'b' }
const TESTS = { tool: 'Bash', command: 'npm test' }
const DONE = { answer: '', durationMs: 4000, isAborted: false, turnId: 't1', reason: 'answer' } as const

function rowText(cells: string, w: number, row: number): string {
  const words = new Uint32Array(Uint8Array.from(atob(cells), c => c.charCodeAt(0)).buffer)
  let text = ''
  for (let col = 0; col < w; col++) text += String.fromCodePoint(words[(row * w + col) * 3]!)
  return text
}

function colorsIn(cells: string): Set<number> {
  const words = new Uint32Array(Uint8Array.from(atob(cells), c => c.charCodeAt(0)).buffer)
  const seen = new Set<number>()
  for (let i = 0; i < words.length; i += 3) seen.add(words[i + 1]!).add(words[i + 2]!)
  return seen
}

// A session mid-turn: answers for the tools the tests call, and a band mounted at KaiC's width.
async function turn($: Parameters<Parameters<typeof test>[1]>[0], on: On, opts: { blits?: string[]; saved?: Record<string, unknown>; testOutput?: string; usage?: Usage } = {}) {
  const clock = mock.clock(on, { now: NOW })
  const store = fakeSession(on, opts.blits ?? [], opts.usage, undefined, opts.saved)
  on('tool.call', { tool: 'Edit' }, () => ({ result: {} }) as never)
  on('tool.call', { tool: 'Bash' }, () => ({ result: { stdout: opts.testOutput ?? 'Tests  6 passed (6)', stderr: '', interrupted: false } }) as never)
  on('turn.complete', () => ({ text: '' }))
  await $.classic.SessionStart({ source: 'startup' })
  await $.classic.UserPromptSubmit({ prompt: 'fix it' })
  await clock.settle()
  return { clock, store }
}

const raster = async (t: { find: (q: never) => Promise<{ props: { cells: unknown } } | undefined> }) => String((await t.find({ type: 'Raster', key: 'rpg' } as never))?.props.cells)

test('an edit brings a foe down from the trees and Clawd stops walking to fight it', async ($, on) => {
  const blits: string[] = []
  const { clock, store } = await turn($, on, { blits })
  await $.tool.call(EDIT as never)
  const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(WIDE, true) })
  await clock.advance(480)
  expect(rowText(blits.at(-1)!, WIDE, 2)).toContain('CLAW STRIKE')
  await clock.advance(1600)
  const colors = colorsIn(blits.at(-1)!)
  expect(colors.has(0x6fbf4e) || colors.has(0xd6453d)).toBe(true)
  const a = blits.at(-1)!
  await clock.advance(960)
  for (let x = 0; x < 20; x++) expect(groundCell(blits.at(-1)!, WIDE, x)).toBe(groundCell(a, WIDE, x))
  await t.unmount()
})

test('a failing test run is the enemy turn: COUNTER ✗2 crosses the band', async ($, on) => {
  const blits: string[] = []
  const { clock, store } = await turn($, on, { blits, testOutput: 'Tests  2 failed | 3 passed (5)' })
  await $.tool.call(EDIT as never)
  await $.tool.call(TESTS as never)
  const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(WIDE, true) })
  await clock.advance(640)
  expect(rowText(blits.at(-1)!, WIDE, 2)).toContain('COUNTER  ✗2')
  await t.unmount()
})

test('a finished turn is a victory: loot named after the file, and the EXP is saved', async ($, on) => {
  const { clock, store } = await turn($, on)
  await $.tool.call(EDIT as never)
  await $.turn.complete(DONE)
  await clock.advance(1000)
  const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(WIDE, true) })
  expect(rowText(await raster(t), WIDE, 0)).toMatch(/◆ \w+ of scenes\.ts · \+15 EXP/)
  expect(store.get('progress')).toMatchObject({ v: 1, level: 1, exp: 15, zoneMeter: 1 })
  await t.unmount()
})

test('crossing a level flashes LEVEL UP over the HUD, which shows the new level', async ($, on) => {
  const { clock, store } = await turn($, on, { saved: { progress: { v: 1, level: 1, exp: 70 } } })
  await $.tool.call(EDIT as never)
  await $.turn.complete(DONE)
  await clock.advance(500)
  const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(WIDE, true) })
  const cells = await raster(t)
  expect(rowText(cells, WIDE, 3)).toContain('LEVEL UP!  Lv.2')
  expect(rowText(cells, WIDE, 4)).toContain('Lv.2 ')
  await t.unmount()
})

test('his level follows him into every session', async ($, on) => {
  await turn($, on, { saved: { progress: { v: 1, level: 4, exp: 75 } } })
  const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(WIDE) })
  expect(rowText(await raster(t), WIDE, 4)).toContain('Lv.4 ▰▰▰▱▱')
  await t.unmount()
})

test('EXP another session earned meanwhile is kept, not overwritten', async ($, on) => {
  const { clock, store } = await turn($, on, { saved: { progress: { v: 1, level: 1, exp: 10 } } })
  store.set('progress', { v: 1, level: 1, exp: 40 })
  await $.tool.call(EDIT as never)
  await $.turn.complete(DONE)
  await clock.settle()
  expect(store.get('progress')).toMatchObject({ exp: 55 })
})

test('a save this build cannot read is kept aside, and he starts fresh', async ($, on) => {
  const future = { v: 9, exp: 1 }
  const { store } = await turn($, on, { saved: { progress: future } })
  expect(store.get('progressBackup')).toEqual(future)
  expect(store.get('progress')).toMatchObject({ v: 1, level: 1, exp: 0 })
})

test('an interrupt earns nothing: the foe flees', async ($, on) => {
  const { clock, store } = await turn($, on)
  await $.tool.call(EDIT as never)
  await $.turn.complete({ ...DONE, isAborted: true, reason: 'aborted' })
  await clock.settle()
  expect(((store.get('progress')) as { exp?: number } | undefined)?.exp ?? 0).toBe(0)
})

test('where he stopped on the road is saved when the turn ends', async ($, on) => {
  const { clock, store } = await turn($, on)
  const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(WIDE, true) })
  for (let i = 0; i < 10; i++) await clock.advance(160)
  await $.turn.complete(DONE)
  await clock.settle()
  expect(((store.get('progress')) as { roadPos: number }).roadPos).toBeGreaterThanOrEqual(10)
  await t.unmount()
})

test('out of usage he trudges: the road moves every other frame', async ($, on) => {
  const blits: string[] = []
  const { clock, store } = await turn($, on, { blits, usage: { context: { window: 200000, tokens: 0, percent: 0 }, rateLimits: [{ kind: 'five_hour', percentUsed: 100 }] } })
  await clock.advance(1000)
  const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(WIDE, true) })
  // Every other frame is still (no step, no move), so the first one sent comes on the second tick.
  await clock.advance(320)
  const first = blits.at(-1)!
  for (let i = 0; i < 12; i++) await clock.advance(160)
  const shift = Array.from({ length: 20 }, (_, k) => k).find(k => Array.from({ length: 20 }, (_, x) => x).every(x => groundCell(blits.at(-1)!, WIDE, x) === groundCell(first, WIDE, x + k)))
  expect(shift).toBe(6)
  await t.unmount()
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `claude plugin test .`
Expected: FAIL — no `CLAW STRIKE` / `COUNTER` / loot text on the band, nothing saved under `progress`, the trudge test sees a 12-pixel shift.

- [ ] **Step 3: Implement**

Replace `hooks/register.tsx` with:
```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { encodeCells } from './rpg/cells'
import { NO_STORY, beatOf, step, withLevelUp } from './rpg/director'
import type { HookPayload, Story } from './rpg/director'
import { HIDDEN_BELOW, frame } from './rpg/frame'
import { ROWS } from './rpg/grid'
import { FRESH, gain, loadProgress } from './rpg/progress'
import type { Award, Progress } from './rpg/progress'
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
let road = { distance: 0, isWalking: false, frames: 0 }
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
// two sessions earning EXP at once don't overwrite each other.
async function loadSaved($: EngineInterface): Promise<Progress> {
  const { progress: loaded, backup } = loadProgress(await $.store.get('progress'))
  if (backup !== undefined) {
    await $.store.set('progressBackup', backup)
    await $.store.set('progress', loaded)
  }
  return loaded
}

async function earn($: EngineInterface, awards: Award[]): Promise<number> {
  let p = await loadSaved($)
  let levelsUp = 0
  for (const a of awards) {
    const r = gain(p, a)
    p = r.progress
    levelsUp += r.levelsUp
  }
  await $.store.set('progress', p)
  progress = p
  return levelsUp
}

async function ensureReady($: EngineInterface): Promise<void> {
  if (isReady) return
  isReady = true
  if ((await $.store.get('isHidden')) === true) await update($, isHidden, () => true)
  progress = await loadSaved($)
  road.distance = progress.roadPos
  $.clock.every(STATS_MS, () => void refreshStats($))
  await refreshPlace($).catch(() => undefined)
  await refreshStats($)
}

async function observe($: EngineInterface, event: string, payload: HookPayload): Promise<void> {
  await ensureReady($)
  const now = await $.clock.now()
  const before = await storyNow($)
  const { story: next, awards } = step(before, event, payload, now)
  let told = next
  if (awards.length > 0) {
    const levelsUp = await earn($, awards)
    if (levelsUp > 0) told = withLevelUp(told, progress.level, now)
    await refreshStats($)
  }
  if (told !== before) await update($, story, () => told)
  if (event === 'TurnEnded' && Math.floor(road.distance) !== progress.roadPos) {
    progress = { ...(await loadSaved($)), roadPos: Math.floor(road.distance) }
    await $.store.set('progress', progress)
  }
}

async function cellsNow($: EngineInterface, width: number, now: number, isWalking: boolean): Promise<string> {
  const s = await read($, stats)
  return encodeCells(frame({ width, t: now, distance: road.distance, isWalking, stats: s, story: await storyNow($), trudge: s.mp <= 0 }))
}

// He walks while Claude works and nothing stands in his way; out of usage he moves every other frame.
async function walkingNow($: EngineInterface, now: number): Promise<boolean> {
  const beat = beatOf(await storyNow($), now)
  return road.isWalking && (beat === 'walk' || beat === 'idle')
}

async function paintFrame($: EngineInterface): Promise<void> {
  const p = painting
  if (!p || isBlitting) return
  isBlitting = true
  try {
    const now = await $.clock.now()
    const isWalking = await walkingNow($, now)
    road.frames++
    if (isWalking && ((await read($, stats)).mp > 0 || road.frames % 2 === 0)) road.distance += 1
    const cells = await cellsNow($, p.width, now, isWalking)
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
  road.isWalking = e.props.isWorking
  const now = await $.clock.now()
  const cells = await cellsNow($, width, now, await walkingNow($, now))
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

  // A render hook may not write state, so the story moves on session events.
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
  on('classic.Stop', async ($, e, next) => {
    await quietly(observe($, 'TurnEnded', { reason: 'answer' }))
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
Expected: validation passes (its "gating hook without .catch" notes are advisory; every gating hook here wraps its work in `quietly`); all 111 tests pass.

- [ ] **Step 5: Commit**

```bash
git add hooks/register.tsx tests/mod.test.tsx && git commit -m "Clawd fights what Claude does: skills, counters, finishers and victories, with EXP saved for every session"
```

---

### Task 7: Try it in the real terminal, then publish (only after KaiC says yes)

**Files:** none new.

- [ ] **Step 1: Manual check (KaiC)** — in Claude Code, run `/reload-plugins`, then ask Claude for something that edits a file and runs the tests (e.g. "add a comment to README.md and run claude plugin test ."). Check at full width:
  1. When Claude edits, a goblin or mushroom drops from the trees, a red `CLAW STRIKE` banner slides in, Clawd steps up and swings, the foe flashes and its HP pips drop.
  2. If a test run fails: a black `COUNTER ✗N` banner, Clawd's eyes shut, sparks; the foe gets a gold crown. A passing run after that: `ALL-OUT ATTACK!!`, a dust cloud, a burst.
  3. When the turn ends: Clawd cheers, a chest opens, `◆ <Loot> of <file> · +N EXP` in the top-left, the HUD's EXP bar grows; on a level up, `LEVEL UP!  Lv.N` above the HUD.
  4. Open a second Claude Code window: its HUD shows the same level.
  5. Press Esc mid-fight: the foe leaps away and no EXP is added.
  6. Clawd is always his own orange, and no text sits on top of him.

- [ ] **Step 2: Ask KaiC** to confirm pushing `main` to `KaiC5504/clawd-rpg`. Do not push without a yes.

- [ ] **Step 3: Push and watch CI**

```bash
cd /d/Repos/Apps/clawd-rpg && git push && gh run watch --exit-status $(gh run list --limit 1 --json databaseId -q '.[0].databaseId')
```
Expected: the Test workflow passes.
