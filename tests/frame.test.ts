import { describe, expect, test } from 'claude-code/testing'

import type { RpgStats } from '../types'
import { EMPTY, PX_H, at } from '../hooks/rpg/grid'
import { CLAWD_COL, COMPACT_BELOW, COMPACT_COL, clawdCol, frame } from '../hooks/rpg/frame'
import { ORANGE } from '../hooks/rpg/sprites/clawd'

const STATS: RpgStats = { level: 1, exp: 0, hp: 1, mp: 1, place: 'my-app/main' }
const scene = (width: number, t = 0, distance = 0, isWalking = true) => ({ width, t, distance, isWalking, stats: STATS })

describe('frame', () => {
  test('the forest fills every pixel of the band at any width', () => {
    for (const width of [40, 99, 100, 150, 220, 300]) {
      for (const distance of [0, 37.5, 1000]) {
        const g = frame(scene(width, 1234, distance))
        for (let y = 0; y < PX_H; y++) for (let x = 0; x < width; x++) expect(at(g, x, y)).not.toBe(EMPTY)
      }
    }
  })

  test('Clawd stands at column 50, or column 4 in the compact view', () => {
    expect(clawdCol(150)).toBe(CLAWD_COL)
    expect(clawdCol(COMPACT_BELOW)).toBe(CLAWD_COL)
    expect(clawdCol(COMPACT_BELOW - 1)).toBe(COMPACT_COL)
    const g = frame(scene(150))
    expect(at(g, CLAWD_COL + 2, 1)).toBe(ORANGE)
    const small = frame(scene(80))
    expect(at(small, COMPACT_COL + 2, 1)).toBe(ORANGE)
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
    const a = frame(scene(150, 4321, 99.5))
    const b = frame(scene(150, 4321, 99.5))
    expect(Array.from(a.px)).toEqual(Array.from(b.px))
  })
})
