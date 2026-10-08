import { describe, expect, test } from 'claude-code/testing'

import { NO_STORY } from '../hooks/rpg/director'
import type { Story, Trip } from '../hooks/rpg/director'
import { DOZE_MS, PACK_MS, SLEEP_MS, camOf, gateAt, goalOf, moveRoad, placeAt, placeWidth, reanchor, restOf, spotsOf, stopsOf, zoneAt } from '../hooks/rpg/road'

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

  test("a last trip's spot that the current trip's spots overlap is gone; one clear of them stays", () => {
    const overlapped: Story = { ...NO_STORY, trail: trip({ leftAt: T0 + 1 }), trip: trip({ origin: 1100, at: T0 + 2000 }) }
    expect(placeAt(overlapped, 1000 + W, T0 + 3000, W)).toBeNull()
    expect(placeAt(overlapped, 1100 + W, T0 + 3000, W)).toEqual({ kind: 'pier', from: 1100 + W })
    expect(placeAt(overlapped, 999, T0 + 3000, W)).toBeNull()
    const clear: Story = { ...overlapped, trip: trip({ origin: 1000 + 2 * W, at: T0 + 2000 }) }
    expect(placeAt(clear, 1000 + W, T0 + 3000, W)).toEqual({ kind: 'pier', from: 1000 + W })
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

describe('a resize while he rests', () => {
  test('he stays on the spot he was at, whatever the change of width', () => {
    for (const [at, kind] of [[T0, 'pier'], [T0 + DOZE_MS, 'camp'], [T0 + SLEEP_MS, 'inn']] as const)
      for (const [from, to] of [[179, 120], [250, 179], [179, 250], [300, 100], [179, 80], [80, 179]]) {
        const d = reanchor(resting(), at, goalOf(resting(), at, from)!.from, from, to)
        expect(restOf(resting(), at, d, to)).toEqual({ kind, phase: 'rest', since: T0 })
      }
  })

  test('packing up, he stays where he is packing', () => {
    const called: Story = { ...working(), trip: trip({ leftAt: T0 + 500 }) }
    expect(restOf(called, T0 + 600, reanchor(called, T0 + 600, 1000 + W, W, 120), 120)?.phase).toBe('pack')
  })

  test('on his way, a resize leaves him where he is', () => {
    expect(reanchor(resting(), T0, 1050, W, 120)).toBe(1050)
  })

  test('past the spot he is heading for, he is put back on it rather than left in the forest', () => {
    expect(moveRoad(resting(), T0 + SLEEP_MS, 1000 + 5 * W, W, 0, false, false).distance).toBe(1000 + 3 * W)
  })
})

describe('zones on the road', () => {
  test("a trip rests at its zone's own spot between the pier and the inn", () => {
    expect(stopsOf(trip({ zone: 'dungeon' }), T0 + SLEEP_MS)).toEqual(['pier', 'crystal', 'inn'])
    expect(stopsOf(trip({ zone: 'neon' }), T0 + SLEEP_MS)).toEqual(['pier', 'ramen', 'inn'])
    expect(stopsOf(trip({ zone: 'forest' }), T0 + DOZE_MS)).toEqual(['pier', 'camp'])
  })

  test('the road is the zone behind the gate up to it, and the zone he walks from it on', () => {
    const crossed: Story = { ...NO_STORY, zone: 'neon', gate: { x: 500, from: 'dungeon' } }
    expect([zoneAt(crossed, 499), zoneAt(crossed, 500), zoneAt(crossed, 9000)]).toEqual(['dungeon', 'neon', 'neon'])
    expect(zoneAt(NO_STORY, 123)).toBe('forest')
  })

  test("a gate goes where asked, or past any rest spot and its signpost it would stand in", () => {
    const story = resting()
    const pw = placeWidth(W)
    expect(gateAt(story, T0, W, 1066)).toBe(1066)
    expect(gateAt(story, T0, W, 1000 + pw - 5)).toBe(1000 + 2 * pw + 2)
    expect(gateAt(story, T0, W, 1000 + pw + 40)).toBe(1000 + 2 * pw + 2)
    expect(gateAt(story, T0 + DOZE_MS, W, 1000 + pw + 40)).toBe(1000 + 3 * pw + 2)
  })
})
