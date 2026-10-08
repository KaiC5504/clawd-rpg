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
    for (const pose of [sitting(0), sitting(2600), asleep(0), asleep(2600), walking(0, 160), walking(80, 160), walking(240, 160)]) {
      const g = grid(24)
      clawd(g, 4, 1, pose)
      for (const c of g.px) if (c !== EMPTY) expect([ORANGE, EYE]).toContain(c)
    }
  })

  test('hurrying, his legs lift twice as often', () => {
    expect([0, 80, 160, 240].map(t => walking(t, 160).lift)).toEqual([undefined, 'odd', undefined, 'even'])
    expect([0, 80, 160, 240].map(t => walking(t).lift)).toEqual([undefined, undefined, 'odd', 'odd'])
  })
})
