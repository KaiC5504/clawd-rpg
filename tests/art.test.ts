import { describe, expect, test } from 'claude-code/testing'

import { EMPTY, PX_H, at, grid } from '../hooks/rpg/grid'
import { EYE, ORANGE, clawd, cheering, hurting, trudging } from '../hooks/rpg/sprites/clawd'
import { BOSS_KINDS, FOES, drawFoe, foeTop, foeWidth } from '../hooks/rpg/sprites/foes'
import { FX_GLYPHS, banner } from '../hooks/rpg/sprites/fx'
import { MINI_REACH, mini } from '../hooks/rpg/sprites/mini'

describe('battle art', () => {
  test('his new poses keep his body his orange', () => {
    for (const pose of [trudging(0), trudging(640), cheering(0), cheering(480), hurting(0), hurting(160)]) {
      const g = grid(24)
      clawd(g, 4, 1, pose)
      for (const c of g.px) if (c !== EMPTY) expect([ORANGE, EYE]).toContain(c)
    }
  })

  test('out of usage his legs lift half as often, and his arms just hang', () => {
    expect([0, 320, 640, 960].map(t => trudging(t).lift)).toEqual([undefined, 'odd', undefined, 'even'])
    expect([0, 320, 640, 960].map(t => [trudging(t).armL, trudging(t).armR])).toEqual([[10, 10], [10, 10], [10, 10], [10, 10]])
  })

  test('foes never wear his orange, and stand on the ground', () => {
    for (const [kind, look] of Object.entries(FOES)) {
      expect(Object.values(look.pal)).not.toContain(ORANGE)
      for (const frame of look.frames) for (const row of frame) expect([frame.length, row.length]).toEqual([look.h, look.w])
      if (kind === 'drone') continue
      const g = grid(24)
      drawFoe(g, kind as keyof typeof FOES, 0, foeTop(kind as keyof typeof FOES), 0)
      expect(Array.from({ length: look.w }, (_, x) => at(g, x, PX_H - 1)).some(c => c !== EMPTY)).toBe(true)
    }
  })

  test('every zone has its own foes, and the drone flies', () => {
    for (const kind of ['slime', 'skeleton', 'drone', 'bug'] as const) expect(FOES[kind]).toBeDefined()
    const g = grid(12)
    drawFoe(g, 'drone', 0, foeTop('drone'), 0)
    for (let x = 0; x < 12; x++) for (const y of [8, 9]) expect(at(g, x, y)).toBe(EMPTY)
  })

  test('bosses fill the band from row 1 to the ground, and are the widest things on the road', () => {
    for (const kind of BOSS_KINDS) {
      expect(FOES[kind].h).toBe(9)
      expect(foeTop(kind)).toBe(1)
      expect(foeWidth(kind)).toBeGreaterThanOrEqual(14)
      expect(foeWidth(kind)).toBeLessThanOrEqual(20)
    }
    for (const kind of ['goblin', 'shroom', 'slime', 'skeleton', 'drone', 'bug'] as const) expect(foeWidth(kind)).toBeLessThanOrEqual(8)
  })

  test('mini Clawds are his orange, with their gear off their bodies and above row 2', () => {
    for (const cls of ['knight', 'mage', 'scout'] as const)
      for (const o of [{}, { cheer: true }, { step: true }, { glow: true }]) {
        const g = grid(20)
        mini(g, 2, 4, cls, o)
        for (let y = 0; y < PX_H; y++)
          for (let x = 0; x < 20; x++) {
            const c = at(g, x, y)
            const isBody = x >= 3 && x <= 11 && y >= 4 && y <= 7
            if (isBody) expect([ORANGE, EYE]).toContain(c)
            else if (c !== EMPTY && c !== ORANGE) expect(y).toBeGreaterThanOrEqual(2)
            if (c !== EMPTY) expect(x).toBeLessThan(2 + MINI_REACH)
          }
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
