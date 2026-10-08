import { describe, expect, test } from 'claude-code/testing'

import { DEFAULT_COLOR, toWords } from '../hooks/rpg/cells'
import { EMPTY, PX_H, ROWS, at, grid, put, rect, sprite, write } from '../hooks/rpg/grid'

const UPPER = 0x2580
const LOWER = 0x2584

describe('grid', () => {
  test('a grid is 10 pixels tall and starts empty', () => {
    const g = grid(4)
    expect(g.px.length).toBe(4 * PX_H)
    expect(at(g, 3, 9)).toBe(EMPTY)
  })

  test('pixels outside the grid are dropped and positions round', () => {
    const g = grid(2)
    put(g, -1, 0, 0xff0000)
    put(g, 2, 0, 0xff0000)
    put(g, 0, 10, 0xff0000)
    put(g, 0.6, 0.4, 0x00ff00)
    expect(Array.from(g.px).filter(c => c !== EMPTY)).toEqual([0x00ff00])
    expect(at(g, 1, 0)).toBe(0x00ff00)
  })

  test('a sprite maps letters through its palette and skips the rest', () => {
    const g = grid(3)
    sprite(g, 0, 0, ['A.B'], { A: 1, B: 2 })
    expect([at(g, 0, 0), at(g, 1, 0), at(g, 2, 0)]).toEqual([1, EMPTY, 2])
  })
})

describe('cells', () => {
  test('two stacked pixels become one half block', () => {
    const g = grid(4)
    put(g, 0, 0, 0xff0000)
    put(g, 0, 1, 0x0000ff)
    put(g, 1, 0, 0xff0000)
    put(g, 2, 1, 0x0000ff)
    const w = toWords(g)
    expect(Array.from(w.slice(0, 12))).toEqual([
      UPPER, 0xff0000, 0x0000ff,
      UPPER, 0xff0000, DEFAULT_COLOR,
      LOWER, 0x0000ff, DEFAULT_COLOR,
      0x20, DEFAULT_COLOR, DEFAULT_COLOR,
    ])
    expect(w.length).toBe(4 * ROWS * 3)
  })

  test("text has no box: its background is the scene's pixel beneath", () => {
    const g = grid(3)
    rect(g, 0, 8, 3, 2, 0x2d4a24)
    put(g, 2, 8, -1)
    put(g, 2, 9, 0x1f3319)
    write(g, 0, 4, 'Lv', 0xffd54f)
    write(g, 2, 4, '.', 0xffd54f)
    const row4 = Array.from(toWords(g).slice(4 * 3 * 3))
    expect(row4).toEqual(['L'.codePointAt(0), 0xffd54f, 0x2d4a24, 'v'.codePointAt(0), 0xffd54f, 0x2d4a24, '.'.codePointAt(0), 0xffd54f, 0x1f3319])
  })

  test('text over empty sky keeps the terminal background', () => {
    const g = grid(1)
    write(g, 0, 0, 'z', 0x90a4ae)
    expect(Array.from(toWords(g).slice(0, 3))).toEqual(['z'.codePointAt(0), 0x90a4ae, DEFAULT_COLOR])
  })

  test('text past the edge is clipped', () => {
    const g = grid(2)
    write(g, 1, 0, 'abc', 0xffffff)
    expect(g.text.size).toBe(1)
  })
})
