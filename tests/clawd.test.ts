import { describe, expect, test } from 'claude-code/testing'

import { EMPTY, PX_H, at, grid } from '../hooks/rpg/grid'
import { CLAWD_H, CLAWD_W, EYE, ORANGE, POSES, clawd, idling, walking } from '../hooks/rpg/sprites/clawd'
import type { Pose } from '../hooks/rpg/sprites/clawd'

const drawn = (pose: Pose) => {
  const g = grid(20)
  clawd(g, 2, 1, pose)
  const px = new Map<string, number>()
  for (let y = 0; y < PX_H; y++) for (let x = 0; x < 20; x++) if (at(g, x, y) !== EMPTY) px.set(`${x - 2},${y - 1}`, at(g, x, y))
  return px
}

// His lowest row of pixels: where his feet are and which columns they're in.
const feet = (px: Map<string, number>) => {
  const at = [...px.keys()].map(k => k.split(',').map(Number) as [number, number])
  const y = Math.max(...at.map(([, y]) => y))
  return { y, xs: at.filter(([, py]) => py === y).map(([x]) => x).sort((a, b) => a - b) }
}

// clawd-bar 0.3.0's standing Clawd, shadow row dropped: torso 11×7, arms 2×2, four legs, eyes 1×2.
const STAND = new Map<string, number>()
for (let y = 0; y < 7; y++) for (let x = 2; x <= 12; x++) STAND.set(`${x},${y}`, ORANGE)
for (const x of [0, 1, 13, 14]) for (const y of [3, 4]) STAND.set(`${x},${y}`, ORANGE)
for (const x of [3, 5, 9, 11]) for (const y of [7, 8]) STAND.set(`${x},${y}`, ORANGE)
for (const x of [4, 10]) for (const y of [2, 3]) STAND.set(`${x},${y}`, EYE)

describe('the big Clawd', () => {
  test('standing, he is exactly the 0.3.0 sprite without its shadow', () => {
    expect([...drawn(POSES.stand)].sort()).toEqual([...STAND].sort())
    expect([CLAWD_W, CLAWD_H]).toEqual([15, 9])
  })

  test('his body is only ever his orange, in every pose and step', () => {
    const poses: Pose[] = [...Object.values(POSES), walking(0), walking(160), walking(320), walking(480), idling(0), idling(100), idling(7000)]
    for (const pose of poses) for (const c of drawn(pose).values()) expect([ORANGE, EYE]).toContain(c)
  })

  test('walking, he waddles: his first and third legs lift with his left arm up, then his second and fourth with his right', () => {
    expect([0, 160, 320, 480, 640].map(t => feet(drawn(walking(t))).xs)).toEqual([[3, 5, 9, 11], [5, 11], [3, 5, 9, 11], [3, 9], [3, 5, 9, 11]])
    expect([0, 160, 320, 480].map(t => [walking(t).armL ?? 9, walking(t).armR ?? 9])).toEqual([[9, 9], [8, 10], [9, 9], [10, 8]])
  })

  test('he stays inside a 15 × 9 box when standing or walking', () => {
    for (const pose of [POSES.stand, walking(0), walking(160), walking(320), walking(480)]) {
      for (const key of drawn(pose).keys()) {
        const [x, y] = key.split(',').map(Number)
        expect(x! >= 0 && x! < 15 && y! >= 0 && y! < 9).toBe(true)
      }
    }
  })
})
