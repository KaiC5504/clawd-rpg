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
