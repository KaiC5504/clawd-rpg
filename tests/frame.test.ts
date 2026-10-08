import { describe, expect, test } from 'claude-code/testing'

import type { RpgStats } from '../types'
import { DEFAULT_COLOR, toWords } from '../hooks/rpg/cells'
import { FOE_ENTER_MS, NO_STORY, beatOf, passGate, step, withLevelUp } from '../hooks/rpg/director'
import type { HookPayload, Story } from '../hooks/rpg/director'
import { CLAWD_COL, COMPACT_BELOW, COMPACT_COL, ROAD_GLYPHS, clawdAt, clawdCol, foeX, frame } from '../hooks/rpg/frame'
import type { Scene } from '../hooks/rpg/frame'
import { EMPTY, PX_H, ROWS, at, grid } from '../hooks/rpg/grid'
import { GLYPHS, hudLeft } from '../hooks/rpg/hud'
import { EYE, ORANGE, clawd } from '../hooks/rpg/sprites/clawd'
import { FOES } from '../hooks/rpg/sprites/foes'
import { FX_GLYPHS } from '../hooks/rpg/sprites/fx'
import { CAMP } from '../hooks/rpg/places/camp'
import { CRYSTAL } from '../hooks/rpg/places/crystal'
import { DUNGEON } from '../hooks/rpg/places/dungeon'
import { FOREST } from '../hooks/rpg/places/forest'
import { INN } from '../hooks/rpg/places/inn'
import { NEON } from '../hooks/rpg/places/neon'
import { PIER } from '../hooks/rpg/places/pier'
import { RAMEN } from '../hooks/rpg/places/ramen'
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
    ...zones(),
  ]
}

const startIn = (zone: string): [string, HookPayload] => ['SessionStart', { source: 'startup', zone }]
const bossPrompt: [string, HookPayload] = ['UserPromptSubmit', { boss: true }]
const joins = (id: string, type: string): [string, HookPayload] => ['SubagentStart', { agent_id: id, agent_type: type }]

// The other zones, their bosses, the party, and a gate on the road.
function zones(): Moment[] {
  const span = (from: number, ms: number) => Array.from({ length: 9 }, (_, i) => from + Math.round((i * ms) / 8))
  const moments: Moment[] = []
  for (const zone of ['forest', 'dungeon', 'neon']) {
    const walk = tell([startIn(zone), prompt])
    const fight = tell([startIn(zone), prompt, edit])
    const boss = tell([startIn(zone), bossPrompt, edit])
    const bossFinished = tell([startIn(zone), bossPrompt, edit, pre('Bash', { command: 'npm test' }), post('Tests  5 passed (5)')])
    const bossWon = tell([startIn(zone), bossPrompt, edit, ['TurnEnded', { reason: 'answer' }]])
    const ended = tell([startIn(zone), prompt, done()])
    moments.push(
      { name: `${zone}Walk`, story: walk.story, times: span(walk.at, 2000) },
      { name: `${zone}Fight`, story: fight.story, times: span(fight.at, 2400) },
      { name: `${zone}Boss`, story: boss.story, times: span(boss.at, 2400) },
      { name: `${zone}BossFinished`, story: bossFinished.story, times: span(bossFinished.at, 2400) },
      { name: `${zone}BossWon`, story: bossWon.story, times: span(bossWon.at, 4400) },
      { name: `${zone}Nook`, story: ended.story, times: span(ended.at + DOZE_MS, 5200), at: w => 2 * placeWidth(w), still: true },
    )
  }
  const party = tell([prompt, joins('a1', 'Explore'), joins('a2', 'Plan'), joins('a3', 'general-purpose')])
  const partyFight = tell([prompt, joins('a1', 'Explore'), joins('a2', 'Plan'), joins('a3', 'general-purpose'), edit, ['SubagentStop', { agent_id: 'a2', agent_type: 'Plan' }]])
  const scoutShot = tell([prompt, edit, joins('a1', 'Explore'), ['SubagentStop', { agent_id: 'a1', agent_type: 'Explore' }]])
  const knightBash = tell([prompt, edit, joins('a1', 'general-purpose'), ['SubagentStop', { agent_id: 'a1', agent_type: 'general-purpose' }]])
  const partyWon = tell([prompt, joins('a1', 'Explore'), edit, ['TurnEnded', { reason: 'answer' }]])
  const crossing = tell([prompt, done(500)])
  const gated = passGate(crossing.story, 'dungeon', 566)
  moments.push(
    { name: 'party', story: party.story, times: span(party.at - 2000, 3000) },
    { name: 'partyFight', story: partyFight.story, times: span(partyFight.at, 2400) },
    { name: 'scoutShot', story: scoutShot.story, times: span(scoutShot.at, 1400) },
    { name: 'knightBash', story: knightBash.story, times: span(knightBash.at, 1400) },
    { name: 'partyWon', story: partyWon.story, times: span(partyWon.at, 4400) },
    { name: 'gate', story: gated, times: span(crossing.at + 5000, 2000), at: () => 500 },
    { name: 'gateBehind', story: gated, times: span(crossing.at + 8000, 2000), at: () => 560 },
  )
  return moments
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
    // Walking back out, the place's own text (the inn's sign) scrolls past him.
    ...[4, 13, 20, 28, 40].flatMap(k => [
      { name: `leavePier+${k}`, story: back.story, times: [back.at + PACK_MS + 160], at: (w: number) => placeWidth(w) + k },
      { name: `leaveInn+${k}`, story: backFromInn.story, times: [backFromInn.at + PACK_MS + 160], at: (w: number) => 2 * placeWidth(w) + k },
    ]),
  ]
}

// The sweeps over every moment at every width take a while.
const SLOW = { timeoutMs: 60_000 }

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
  test("Clawd's pixels are exactly his sprite in every beat: nothing paints over or recolours him", SLOW, () => {
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
              // In bed the inn's blanket is over him below his eyes; at the ramen stall, the counter over his lap.
              if (c === EMPTY || (me.tucked && y >= 6) || (me.counter && y >= 8)) continue
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

  test('every text cell takes the pixel beneath it as its background', SLOW, () => {
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

  test('no foe pixel reaches the HUD: the HUD row past its first cell is pure forest', SLOW, () => {
    for (const width of WIDTHS) {
      const left = hudLeft(width, STATS)
      for (const m of stories()) {
        for (const t of m.times) {
          const g = frame(sceneOf(m, width, t))
          const bare = frame(sceneOf({ ...m, story: { ...NO_STORY, trip: m.story.trip, trail: m.story.trail, zone: m.story.zone, gate: m.story.gate } }, width, t))
          for (const y of [8, 9])
            for (let x = left; x < width; x++) if (at(g, x, y) !== at(bare, x, y)) throw new Error(`${m.name} at ${width}, t+${t - m.times[0]!}: ${x},${y}`)
        }
      }
    }
  })

  test('foes stand at least 14 columns left of the HUD; a boss ends 6 short of it, as an ordinary foe does', () => {
    for (const width of [100, 120, 150, 160, 220, 300]) {
      expect(foeX(width, STATS)).toBeLessThanOrEqual(hudLeft(width, STATS) - 14)
      for (const kind of ['treant', 'hydra', 'mech'] as const) expect(foeX(width, STATS, FOES[kind].w) + FOES[kind].w).toBeLessThanOrEqual(hudLeft(width, STATS) - 6)
    }
  })

  test('the compact view has no foes, party, banners or loot, only Clawd and the place', SLOW, () => {
    const foeColors = new Set([FOES.goblin.pal.G, FOES.shroom.pal.R, FOES.slime.pal.G, FOES.skeleton.pal.S, FOES.drone.pal.R, FOES.treant.pal.G, FOES.hydra.pal.H, FOES.mech.pal.M])
    for (const m of stories()) {
      for (const t of m.times) {
        const s = sceneOf(m, 80, t)
        const g = frame(s)
        for (const c of g.px) expect(foeColors.has(c)).toBe(false)
        const me = clawdAt(s)
        const solo = grid(80)
        if (me) clawd(solo, me.x, me.y, me.pose)
        expect([...g.px].filter(c => c === ORANGE).length).toBeLessThanOrEqual([...solo.px].filter(c => c === ORANGE).length)
        // Only the HUD, and a place's own name painted on it (the inn's sign, the ramen stall's).
        for (const [key, { cp }] of g.text) {
          expect([0, 1, ROWS - 1]).toContain(Math.floor(key / 80))
          if (key < 80) expect('RAMEN').toContain(String.fromCodePoint(cp))
        }
      }
    }
  })

  test('every character drawn is ASCII or a known one-cell glyph', SLOW, () => {
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
    const places: [string, Place][] = [['pier', PIER], ['camp', CAMP], ['inn', INN], ['dungeonNook', CRYSTAL], ['neonNook', RAMEN]]
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

  test('in the Dungeon he sits by the crystal, in Neon City at the ramen counter, each saying so', () => {
    const at179 = (name: string) => sceneOf(moment(name), 179, moment(name).times[0]!)
    expect(clawdAt(at179('dungeonNook'))!.pose.sit).toBe(true)
    expect(clawdAt(at179('neonNook'))).toMatchObject({ counter: true })
    expect(textRow(frame(at179('dungeonNook')), 0).trim()).toBe('idle · by the save crystal')
    expect(textRow(frame(at179('neonNook')), 0)).toMatch(/^ +idle · slurp… +RAMEN +$/)
  })
})

describe('zones, bosses and the party on screen', () => {
  const first = (name: string, width = 179, dt = 0) => sceneOf(moment(name), width, moment(name).times[0]! + dt)
  const alone = (place: Place, width: number, cam: number, t: number) => {
    const g = grid(width)
    for (let x = 0; x < width; x++) place.col(g, x, cam + x, t, cam, Number.POSITIVE_INFINITY)
    return g
  }

  test('each zone draws its own backdrop behind him', () => {
    for (const [zone, place] of [['forest', FOREST], ['dungeon', DUNGEON], ['neon', NEON]] as const) {
      const s = first(`${zone}Walk`)
      const g = frame(s)
      const bare = alone(place, 179, s.distance, s.t)
      for (const x of [2, 30, 100]) expect(at(g, x, 8)).toBe(at(bare, x, 8))
    }
  })

  test('a gate: the old zone up to it, the portal, then the new zone', () => {
    const s = first('gate')
    const g = frame(s)
    const forest = alone(FOREST, 179, s.distance, s.t)
    const dungeon = alone(DUNGEON, 179, s.distance, s.t)
    expect(at(g, 20, 8)).toBe(at(forest, 20, 8))
    expect(at(g, 120, 8)).toBe(at(dungeon, 120, 8))
    expect(at(g, 566 - s.distance, 5)).toBe(0x6b6f7f)
    expect(textRow(g, 0)).toContain('DUNGEON')
  })

  test("the boss stands in the band, named in the top-left with its health over its head", () => {
    for (const [zone, name] of [['forest', 'TREANT'], ['dungeon', 'MERGE HYDRA'], ['neon', 'MECH']] as const) {
      const s = first(`${zone}Boss`, 179, 2000)
      const g = frame(s)
      expect(textRow(g, 0).trim()).toBe(`★ BOSS · ${name}`)
      const kind = s.story.foe!.kind
      const fx = foeX(179, STATS, FOES[kind].w)
      const own = new Set(Object.values(FOES[kind].pal))
      expect(Array.from({ length: FOES[kind].w }, (_, x) => at(g, fx + x, 9)).some(c => own.has(c))).toBe(true)
      expect(at(g, fx, 0)).toBe(0xe5484d)
    }
  })

  test('the party walks behind him, his orange, and drops in when it joins', () => {
    const orangeLeftOf = (s: Scene) => {
      const g = frame(s)
      const me = clawdAt(s)!
      let n = 0
      for (let y = 0; y < PX_H; y++) for (let x = 0; x < me.x; x++) if (at(g, x, y) === ORANGE) n++
      return n
    }
    expect(orangeLeftOf(first('party', 179, 4000))).toBeGreaterThan(3 * 40)
    expect(orangeLeftOf(sceneOf(moment('walk'), 179, moment('walk').times[0]!))).toBe(0)
  })

  test("a member's class attack is called out over its head, and no cut-in covers the party", () => {
    for (const [name, label] of [['scoutShot', 'QUICK SHOT'], ['knightBash', 'SHIELD BASH'], ['partyFight', 'ARCANE BOLT']] as const) {
      const s = first(name, 179, 400)
      const g = frame(s)
      expect(textRow(g, 0)).toContain(label)
      expect(textRow(g, 2).trim()).toBe('')
    }
    const joining = first('party', 179, 2000 + 300)
    expect(textRow(frame(joining), 0)).toContain('KNIGHT JOINS!')
  })

  test('a boss victory names the boss loot', () => {
    const g = frame(first('forestBossWon', 179, 1000))
    expect(textRow(g, 0)).toContain('Treant Heartwood')
  })
})

describe("the last trip's spots", () => {
  test("an old trip's campfire never shows inside the pier he is at now", () => {
    const trip = (origin: number, at: number, leftAt: number | null) => ({ origin, at, compactAt: null, leftAt })
    for (const width of WIDTHS) {
      const pw = placeWidth(width)
      const now: Story = { ...NO_STORY, trip: trip(30, T0 + 70_000, null) }
      const withTrail: Story = { ...now, trail: trip(0, T0, T0 + 65_000) }
      for (const t of [T0 + 80_000, T0 + 83_000]) {
        const a = frame(scene(width, t, 30 + pw, false, withTrail))
        const b = frame(scene(width, t, 30 + pw, false, now))
        expect([...a.px]).toEqual([...b.px])
        expect([...a.text]).toEqual([...b.text])
      }
    }
  })
})
