import { describe, expect, test } from 'claude-code/testing'

import { EMPTY, PX_H, at, grid } from '../hooks/rpg/grid'
import { CAMP } from '../hooks/rpg/places/camp'
import { CRYSTAL } from '../hooks/rpg/places/crystal'
import { DUNGEON } from '../hooks/rpg/places/dungeon'
import { FOREST } from '../hooks/rpg/places/forest'
import { GATE_W, gateCol } from '../hooks/rpg/places/gate'
import { INN } from '../hooks/rpg/places/inn'
import { NEON } from '../hooks/rpg/places/neon'
import { PIER } from '../hooks/rpg/places/pier'
import { RAMEN } from '../hooks/rpg/places/ramen'
import type { Place } from '../hooks/rpg/places/place'
import { FRAME_MS } from '../hooks/rpg/road'
import { EYE, LEG_STEP_MS, ORANGE, asleep, clawd, sitting, walking } from '../hooks/rpg/sprites/clawd'

const RESTS: [string, Place][] = [['pier', PIER], ['camp', CAMP], ['crystal', CRYSTAL], ['ramen', RAMEN], ['inn', INN]]
const ZONES: [string, Place][] = [['forest', FOREST], ['dungeon', DUNGEON], ['neon', NEON]]
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

  test("at the band's frame rate every pace shows each step, whenever the walk starts", () => {
    for (const legMs of [LEG_STEP_MS / 2, LEG_STEP_MS, LEG_STEP_MS * 2])
      for (let start = 0; start < legMs * 2; start += 7) {
        const lifts = new Set(Array.from({ length: 16 }, (_, f) => walking(start + f * FRAME_MS, legMs).lift))
        expect([legMs, start, [...lifts].length]).toEqual([legMs, start, 3])
      }
  })

  test('hurrying, his legs lift twice as often', () => {
    expect([0, 80, 160, 240].map(t => walking(t, 160).lift)).toEqual([undefined, 'odd', undefined, 'even'])
    expect([0, 80, 160, 240].map(t => walking(t).lift)).toEqual([undefined, undefined, 'odd', 'odd'])
  })
})

describe('zones', () => {
  const road = (place: Place, w: number, t: number, cam: number) => {
    const g = grid(w)
    for (let x = 0; x < w; x++) place.col(g, x, cam + x, t, cam, Number.POSITIVE_INFINITY)
    return g
  }

  test('each fills every pixel of the band, anywhere along the road', () => {
    for (const [, place] of ZONES)
      for (const cam of [0, 437, 90001]) {
        const g = road(place, 300, 0, cam)
        for (let y = 0; y < PX_H; y++) for (let x = 0; x < 300; x++) expect(at(g, x, y)).not.toBe(EMPTY)
      }
  })

  test("none of them uses Clawd's orange", () => {
    for (const [, place] of ZONES) for (const t of TIMES) expect([...road(place, 300, t, 1234).px]).not.toContain(ORANGE)
  })

  test('the dungeon and the city look nothing like the forest', () => {
    const colors = (place: Place) => new Set(road(place, 300, 0, 0).px)
    const forest = colors(FOREST)
    for (const place of [DUNGEON, NEON]) {
      const own = [...colors(place)].filter(c => !forest.has(c))
      expect(own.length).toBeGreaterThan(colors(place).size * 0.8)
    }
  })

  test('the city flickers and rains, so it changes from frame to frame', () => {
    expect([...road(NEON, 179, 0, 0).px]).not.toEqual([...road(NEON, 179, 480, 0).px])
  })
})

describe('the gate', () => {
  test('stone pillars either side of a purple portal, top to bottom', () => {
    const g = grid(GATE_W)
    for (let lx = 0; lx < GATE_W; lx++) gateCol(g, lx, lx, 0)
    for (let y = 0; y < PX_H; y++) {
      expect(at(g, 0, y)).not.toBe(EMPTY)
      expect(at(g, GATE_W - 1, y)).not.toBe(EMPTY)
    }
    const middle = Array.from({ length: PX_H - 2 }, (_, y) => at(g, GATE_W >> 1, y + 2))
    for (const c of middle) {
      expect(c & 0xff).toBeGreaterThan((c >> 8) & 0xff)
      expect((c >> 16) & 0xff).toBeGreaterThan((c >> 8) & 0xff)
    }
    expect([...g.px]).not.toContain(ORANGE)
  })
})

describe('the new rest spots', () => {
  test("the crystal room's crystal and the ramen stall's awning stay in view at any width", () => {
    for (const w of [100, 179, 300]) {
      const crystal = paint(CRYSTAL, w, 0)
      expect([...crystal.px].some(c => c === 0x7fd1ff || c === 0x5ee0ff)).toBe(true)
      const ramen = paint(RAMEN, w, 0)
      expect([...ramen.text.values()].map(c => String.fromCodePoint(c.cp)).join('')).toContain('RAMEN')
    }
  })

  test('the ramen counter stands in front of where he sits', () => {
    const g = grid(179)
    RAMEN.front!(g, 0, 0, 179)
    for (let x = 52; x <= 62; x++) expect(at(g, x, 9)).not.toBe(EMPTY)
  })
})
