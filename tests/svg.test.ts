import { expect, test } from 'claude-code/testing'

import type { RpgStats } from '../types'
import { frame } from '../hooks/rpg/frame'
import { SVG_MAX_CHARS, svgLoop } from '../hooks/rpg/svg'

const STATS: RpgStats = { level: 1, exp: 0, hp: 1, mp: 1, place: '' }

test('an 8-frame walk at 96 columns fits the desktop SVG cap', () => {
  const frames = Array.from({ length: 8 }, (_, i) => frame({ width: 96, t: i * 320, distance: i * 2.24, isWalking: true, stats: STATS }))
  const svg = svgLoop(frames, 320)
  // 12 frames at 120 columns measured 164,064 chars, over the cap; see docs/spikes.md.
  console.log(`svg chars for 8 frames at 96 columns: ${svg.length}`)
  expect(svg.length).toBeLessThan(SVG_MAX_CHARS)
})
