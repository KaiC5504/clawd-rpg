import { put, rect, sprite } from '../grid'
import { mod, noise, on } from '../noise'
import { DUNGEON } from './dungeon'
import type { Place } from './place'

// The Dungeon's rest spot: a quiet chamber where the save crystal hums beside a stone bench.
export const CRYSTAL: Place = {
  col(g, x, lx, t, _cam, pw) {
    DUNGEON.col(g, x, lx + 13, t, 0, pw)
    if (noise(lx * 7.7) > 0.94) put(g, x, 1 + Math.floor(noise(lx * 3.3) * 5), on(t + lx * 70, 900) ? 0x4fb8d8 : 0x2a6f8a)
    if (lx < 8 || lx > pw - 9) for (let y = 0; y < 8; y++) put(g, x, y, mod(y, 3) === 2 ? 0x221c33 : 0x2c2540)
  },
  props(g, ox, t, pw) {
    rect(g, ox + 50, 8, 14, 1, 0x5a5f73)
    put(g, ox + 50, 9, 0x3b3550)
    put(g, ox + 63, 9, 0x3b3550)
    const c = on(t, 600) ? 0x5ee0ff : 0x7fd1ff
    const bob = on(t, 1200) ? 1 : 0
    rect(g, ox + 73, 8, 7, 2, 0x4a4458)
    rect(g, ox + 74, 7, 5, 1, 0x5d5670)
    sprite(g, ox + 74, 1 + bob, ['..C..', '.CCC.', 'CCWCC', '.CCC.', '..C..'], { C: c, W: 0xffffff })
    if (on(t + 400, 800)) put(g, ox + 72, 3 + bob, 0xe6fbff)
    if (on(t, 1000)) put(g, ox + 80, 5 + bob, 0xe6fbff)
    if (pw > 150) {
      rect(g, ox + 92, 3, 12, 1, 0x4a3a2a)
      for (const [dx, potion] of [[93, 0xd6453d], [96, 0x5ea8ff], [99, 0x6bd46b], [102, 0xffd54f]] as const) rect(g, ox + dx, 1, 1, 2, potion)
    }
    const door = pw - 20
    if (door < 86) return
    rect(g, ox + door, 2, 9, 6, 0x0c0a12)
    rect(g, ox + door - 1, 1, 11, 1, 0x5a5f73)
    for (let i = 0; i < 4; i++) rect(g, ox + door + 1 + i * 2, 7 - i, 7 - i * 2, 1, 0x2c2540)
  },
}
