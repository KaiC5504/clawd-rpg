import { describe, expect, test } from 'claude-code/testing'

import { DEFAULT_COLOR, toWords } from '../hooks/rpg/cells'
import { beatOf } from '../hooks/rpg/director'
import { DEMO, DEMO_MS, demoScene } from '../hooks/rpg/demo'
import { clawdAt, frame } from '../hooks/rpg/frame'
import { EMPTY, PX_H, at, grid } from '../hooks/rpg/grid'
import { restOf, zoneAt } from '../hooks/rpg/road'
import { EYE, LEG_STEP_MS, ORANGE, clawd } from '../hooks/rpg/sprites/clawd'

// Every scene, sampled through its length.
function samples(width: number, per = 6) {
  const out: ReturnType<typeof demoScene>[] = []
  let from = 0
  for (const d of DEMO) {
    for (let i = 0; i < per; i++) out.push(demoScene(from + Math.floor((i * d.ms) / per), width))
    from += d.ms
  }
  return out
}

describe('the demo', () => {
  test('is the scenes one after another, on a loop', () => {
    expect(DEMO_MS).toBe(DEMO.reduce((n, d) => n + d.ms, 0))
    expect(demoScene(0, 179).name).toBe(DEMO[0]!.name)
    expect(demoScene(DEMO[0]!.ms, 179).name).toBe(DEMO[1]!.name)
    expect(demoScene(DEMO_MS + 5, 179).name).toBe(DEMO[0]!.name)
    expect(DEMO_MS).toBeGreaterThan(40_000)
    expect(DEMO_MS).toBeLessThan(90_000)
  })

  test('plays every beat, every zone, every rest spot, a boss, the party and a gate', () => {
    const beats = new Set<string>()
    const zones = new Set<string>()
    const rests = new Set<string>()
    let boss = false
    let party = false
    let gate = false
    let called = false
    for (const { scene: s } of samples(179, 12)) {
      beats.add(beatOf(s.story, s.t))
      zones.add(zoneAt(s.story, s.distance + 50))
      const rest = restOf(s.story, s.t, s.distance, s.width)
      if (rest?.phase === 'rest') rests.add(rest.kind)
      boss ||= s.story.foe?.boss === true
      party ||= s.story.party.length > 0
      gate ||= s.story.gate !== null && Math.abs(s.story.gate.x - s.distance) < s.width
      called ||= s.story.calledAt !== null && s.t - s.story.calledAt < 6000 && s.t >= s.story.calledAt
    }
    expect([...beats].sort()).toEqual(['encounter', 'enemyTurn', 'finisher', 'flee', 'idle', 'victory', 'walk'])
    expect([...zones].sort()).toEqual(['dungeon', 'forest', 'neon'])
    expect([...rests].sort()).toEqual(['camp', 'crystal', 'inn', 'pier', 'ramen'])
    expect([boss, party, gate, called]).toEqual([true, true, true, true])
  })

  test('every demo frame keeps the visual rules: his pixels are his, text never on him, text takes the pixel beneath', () => {
    for (const width of [100, 179, 300]) {
      for (const { name, scene: s } of samples(width)) {
        const g = frame(s)
        const me = clawdAt(s)
        if (me) {
          const solo = grid(width)
          clawd(solo, me.x, me.y, me.pose)
          for (let y = 0; y < PX_H; y++)
            for (let x = 0; x < width; x++) {
              const c = at(solo, x, y)
              if (c === EMPTY || (me.tucked && y >= 6) || (me.counter && y >= 8)) continue
              expect([ORANGE, EYE]).toContain(c)
              if (at(g, x, y) !== c || g.text.has(Math.floor(y / 2) * width + x)) throw new Error(`${name} at ${width}: ${x},${y}`)
            }
        }
        const words = toWords(g)
        for (const key of g.text.keys()) {
          const top = at(g, key % width, 2 * Math.floor(key / width))
          const bottom = at(g, key % width, 2 * Math.floor(key / width) + 1)
          expect(words[key * 3 + 2]).toBe(top !== EMPTY ? top : bottom !== EMPTY ? bottom : DEFAULT_COLOR)
        }
      }
    }
  })

  test('his legs keep up with the road: twice the steps where it moves two pixels a frame', () => {
    let from = 0
    for (const d of DEMO) {
      const a = demoScene(from + 1600, 179).scene
      const b = demoScene(from + 1760, 179).scene
      if (a.isWalking) expect([d.name, (a.legMs ?? LEG_STEP_MS) * (b.distance - a.distance)]).toEqual([d.name, LEG_STEP_MS])
      from += d.ms
    }
  })

  test('the compact view plays too', () => {
    for (const { scene: s } of samples(80, 2)) expect(frame(s).w).toBe(80)
  })
})
