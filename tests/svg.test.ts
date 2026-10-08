import { describe, expect, test } from 'claude-code/testing'

import type { RpgStats } from '../types'
import { NO_STORY } from '../hooks/rpg/director'
import { DEMO, demoScene } from '../hooks/rpg/demo'
import { DESKTOP_COLS, desktopKey, desktopLoop, resumeAt } from '../hooks/rpg/desktop'
import { frame } from '../hooks/rpg/frame'
import { grid, rect, write } from '../hooks/rpg/grid'
import { SVG_MAX_CHARS, svgLoop } from '../hooks/rpg/svg'

const STATS: RpgStats = { level: 1, exp: 0, hp: 1, mp: 1, place: '' }

describe('svg loops', () => {
  test('a 12-frame walk at 120 columns fits the desktop SVG cap with room to spare', () => {
    const frames = Array.from({ length: 12 }, (_, i) => frame({ width: 120, t: i * 160, distance: i, isWalking: true, stats: STATS, story: NO_STORY }))
    const svg = svgLoop(frames, 160)
    console.log(`svg chars for 12 frames at 120 columns: ${svg.length}`)
    expect(svg.length).toBeLessThan(SVG_MAX_CHARS * 0.6)
  })

  test("pixels are horizontal strokes of their colour; a text cell's two pixels take the colour beneath it", () => {
    const g = grid(6)
    rect(g, 0, 0, 3, 1, 0xff0000)
    rect(g, 0, 1, 6, 1, 0x00ff00)
    write(g, 4, 0, 'A', 0xffffff)
    const svg = svgLoop([g], 160)
    expect(svg).toContain('<path stroke="#ff0000" d="M0 0.5h3"/>')
    expect(svg).toContain('<path stroke="#00ff00" d="M4 0.5h1M0 1.5h6"/>')
  })

  test('text is drawn in its cells, one run per colour, escaped', () => {
    const g = grid(20)
    write(g, 2, 4, 'Lv.3 <&>', 0xffd54f)
    const svg = svgLoop([g], 160)
    expect(svg).toContain('<text x="2" y="9.6" fill="#ffd54f" textLength="8">Lv.3 &lt;&amp;&gt;</text>')
  })

  test('each frame shows for its slice of the loop and nothing tweens', () => {
    const svg = svgLoop([grid(4), grid(4)], 160)
    expect(svg).toContain('animation:f1 320ms step-end infinite')
    expect(svg).toContain('@keyframes f1{0%{opacity:0}50.000%{opacity:1}}')
  })
})

describe('desktop loops', () => {
  test('every demo scene loops at 120 columns under the cap, at least 8 frames long', () => {
    let from = 0
    for (const d of DEMO) {
      const start = from
      const { svg, ms } = desktopLoop(i => demoScene(start + i * 160, DESKTOP_COLS).scene)
      expect(svg.length).toBeLessThanOrEqual(SVG_MAX_CHARS)
      expect(ms).toBeGreaterThanOrEqual(8 * 160)
      from += d.ms
    }
  })

  test('a rebuilt loop starts where the last one was', () => {
    const { svg } = desktopLoop(i => demoScene(i * 160, DESKTOP_COLS).scene)
    expect(resumeAt(svg, 480)).toContain('<style>*{animation-delay:-480ms!important}')
  })

  test("the loop's key holds while the scene does, and changes with the beat", () => {
    const a = demoScene(100, DESKTOP_COLS).scene
    const b = demoScene(900, DESKTOP_COLS).scene
    expect(desktopKey(a)).toBe(desktopKey(b))
    const fight = demoScene(DEMO[0]!.ms + 100, DESKTOP_COLS).scene
    expect(desktopKey(fight)).not.toBe(desktopKey(a))
  })
})
