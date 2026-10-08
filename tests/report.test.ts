import { describe, expect, test } from 'claude-code/testing'

import { FRESH, ZONE_BATTLES, gain } from '../hooks/rpg/progress'
import type { Progress } from '../hooks/rpg/progress'
import { doctorText, statsText } from '../hooks/rpg/report'
import type { DoctorFacts } from '../hooks/rpg/report'

const at = (level: number, over: Partial<Progress> = {}): Progress => ({ ...gain({ ...FRESH, level }, { kind: 'turn' }).progress, exp: 0, ...over })

describe('/rpg stats', () => {
  test('a fresh start: Lv.1, the forest, nothing met yet', () => {
    expect(statsText(FRESH)).toBe(
      ['Clawd · Lv.1 · 0/75 EXP to Lv.2', 'Zone: Enchanted Forest · 0/12 battles to the Treant', 'Zones open: Enchanted Forest · Dungeon opens at Lv.3', 'Bestiary: nothing met yet'].join('\n'),
    )
  })

  test('a full meter says the boss is waiting', () => {
    expect(statsText(at(4, { zone: 'dungeon', zoneMeter: ZONE_BATTLES }))).toContain('Zone: Dungeon · the Merge Hydra waits: the next turn that fights is a boss fight')
  })

  test('every zone open, and the bestiary most met first', () => {
    const text = statsText(at(6, { zone: 'neon', zoneMeter: 3, bestiary: { goblin: 2, drone: 9, treant: 1 } }))
    expect(text).toContain('Zone: Neon City · 3/12 battles to the Mech')
    expect(text).toContain('Zones open: Enchanted Forest, Dungeon, Neon City')
    expect(statsText(at(4))).toContain('Zones open: Enchanted Forest, Dungeon · Neon City opens at Lv.6')
    expect(text).toContain('Bestiary: drone ×9, goblin ×2, treant ×1')
  })
})

describe('/rpg doctor', () => {
  const ok: DoctorFacts = { hidden: false, width: 179, painting: true, lastBlitMs: 200, save: 'fine', level: 3, zone: 'dungeon', clawdBar: false }

  test('all well: shown, the view for its width, painting, a fine save', () => {
    expect(doctorText(ok)).toBe(
      [
        'clawd-rpg doctor',
        '· Band: shown, last drawn 179 columns wide (full view), painting frames (last one 0.2 s ago)',
        '· Save: fine (Lv.3, Dungeon)',
        '· clawd-bar: not enabled, so no second band',
      ].join('\n'),
    )
  })

  test('narrow, hidden, never drawn', () => {
    expect(doctorText({ ...ok, width: 80 })).toContain('80 columns wide (compact view: Clawd and the place, no fights)')
    expect(doctorText({ ...ok, width: 30 })).toContain('30 columns wide (too narrow: the band hides below 40)')
    expect(doctorText({ ...ok, hidden: true })).toContain('· Band: hidden (/rpg brings it back)')
    expect(doctorText({ ...ok, width: null, painting: false, lastBlitMs: null })).toContain('· Band: shown, not drawn yet this session')
    expect(doctorText({ ...ok, painting: false })).toContain('not painting (it starts at the next redraw)')
  })

  test('the save and clawd-bar', () => {
    expect(doctorText({ ...ok, save: 'backup' })).toContain("· Save: an unreadable save was kept as 'progressBackup' and a new one started")
    expect(doctorText({ ...ok, save: 'newer' })).toContain('· Save: written by a newer clawd-rpg; this session plays on without saving')
    expect(doctorText({ ...ok, save: 'broken' })).toContain("· Save: the plugin store can't be read; progress lives only in this session")
    expect(doctorText({ ...ok, clawdBar: true })).toContain('· clawd-bar: also enabled, and its band stacks with this one: /clawd hides it')
  })
})
