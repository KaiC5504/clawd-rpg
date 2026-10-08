import { put, rect } from '../grid'
import { mod, noise, on } from '../noise'
import { fire } from '../sprites/fx'
import type { Place } from './place'
import { nightSky } from './sky'

// The forest's rest spot: a log seat by the fire, the tent pinned right.
export const CAMP: Place = {
  col(g, x, lx, t, _cam, pw) {
    nightSky(g, x, lx, t, 8)
    const treeline = 5 + Math.round(Math.sin(lx / 5) + noise(Math.floor(lx / 3)))
    for (let y = treeline; y < 8; y++) put(g, x, y, 0x0f1a14)
    if (lx < 10 || lx > pw - 12) for (let y = 0; y < 8; y++) put(g, x, y, mod(lx, 5) < 2 ? 0x3a2a1c : 0x0d2416)
    const lit = lx > 64 && lx < 90
    put(g, x, 8, lit ? 0x4a4a24 : 0x2d4a24)
    put(g, x, 9, 0x1f3319)
  },
  props(g, ox, t, pw) {
    rect(g, ox + 50, 8, 14, 1, 0x6b4a2b)
    put(g, ox + 50, 9, 0x4a3220)
    put(g, ox + 63, 9, 0x4a3220)
    fire(g, ox + 76, 1, t)
    const tent = Math.min(pw - 8, Math.max(96, pw - 42))
    if (tent - 6 > 93) for (let i = 0; i < 4; i++) rect(g, ox + 88 + i, 9 - (i % 2), 1, 1 + (i % 2), 0x6b4a2b)
    for (let y = 3; y < 10; y++) {
      const hw = y - 3
      rect(g, ox + tent - hw, y, hw * 2 + 1, 1, 0xc9a26b)
      put(g, ox + tent - hw, y, 0xa07a48)
      put(g, ox + tent + hw, y, 0xa07a48)
      if (y >= 6) rect(g, ox + tent - (y - 6), y, (y - 6) * 2 + 1, 1, 0x2a1f14)
    }
    if (pw - 22 > tent + 8) {
      rect(g, ox + pw - 22, 4, 1, 6, 0x5a3d22)
      put(g, ox + pw - 22, 3, on(t, 800) ? 0xffd27a : 0xffb347)
    }
  },
}
