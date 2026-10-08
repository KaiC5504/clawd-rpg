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
