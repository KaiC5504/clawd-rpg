import type { ZoneId } from '../../types'
import { BOSSES } from './director'
import { COMPACT_BELOW } from './road'
import { HIDDEN_BELOW } from './frame'
import { UNLOCK_LEVEL, ZONE_BATTLES, bossDue, toNext } from './progress'
import type { Progress } from './progress'

const ZONE_NAMES: Record<ZoneId, string> = { forest: 'Enchanted Forest', dungeon: 'Dungeon', neon: 'Neon City' }
const BOSS_NAMES: Record<string, string> = { treant: 'Treant', hydra: 'Merge Hydra', mech: 'Mech' }
const ZONE_ORDER: ZoneId[] = ['forest', 'dungeon', 'neon']

// What /rpg stats says: his level, the zone and its boss, what's open, and what he's met.
export function statsText(p: Progress): string {
  const boss = BOSS_NAMES[BOSSES[p.zone]]!
  const meter = bossDue(p) ? `the ${boss} waits: the next turn that fights is a boss fight` : `${p.zoneMeter}/${ZONE_BATTLES} battles to the ${boss}`
  const open = ZONE_ORDER.filter(z => p.level >= UNLOCK_LEVEL[z])
  const next = ZONE_ORDER.find(z => p.level < UNLOCK_LEVEL[z])
  const met = Object.entries(p.bestiary).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  return [
    `Clawd · Lv.${p.level} · ${p.exp}/${toNext(p.level)} EXP to Lv.${p.level + 1}`,
    `Zone: ${ZONE_NAMES[p.zone]} · ${meter}`,
    `Zones open: ${open.map(z => ZONE_NAMES[z]).join(', ')}${next ? ` · ${ZONE_NAMES[next]} opens at Lv.${UNLOCK_LEVEL[next]}` : ''}`,
    `Bestiary: ${met.length ? met.map(([kind, n]) => `${kind} ×${n}`).join(', ') : 'nothing met yet'}`,
  ].join('\n')
}

// `width`: the band's last drawn width, null before it has been drawn; `lastBlitMs`: how long ago the
// last frame went out.
export type DoctorFacts = {
  hidden: boolean
  width: number | null
  painting: boolean
  lastBlitMs: number | null
  save: 'fine' | 'backup' | 'newer' | 'broken'
  level: number
  zone: ZoneId
  clawdBar: boolean
}

function view(width: number): string {
  if (width < HIDDEN_BELOW) return `too narrow: the band hides below ${HIDDEN_BELOW}`
  if (width < COMPACT_BELOW) return 'compact view: Clawd and the place, no fights'
  return 'full view'
}

const SAVES: Record<DoctorFacts['save'], (f: DoctorFacts) => string> = {
  fine: f => `fine (Lv.${f.level}, ${ZONE_NAMES[f.zone]})`,
  backup: () => "an unreadable save was kept as 'progressBackup' and a new one started",
  newer: () => 'written by a newer clawd-rpg; this session plays on without saving',
  broken: () => "the plugin store can't be read; progress lives only in this session",
}

// What /rpg doctor says: is the band up and painting, is the save healthy, is clawd-bar's band there too.
export function doctorText(f: DoctorFacts): string {
  let band = 'hidden (/rpg brings it back)'
  if (!f.hidden && f.width === null) band = 'shown, not drawn yet this session'
  else if (!f.hidden && f.width !== null) {
    const frames = f.painting ? `painting frames${f.lastBlitMs === null ? '' : ` (last one ${(f.lastBlitMs / 1000).toFixed(1)} s ago)`}` : 'not painting (it starts at the next redraw)'
    band = `shown, last drawn ${f.width} columns wide (${view(f.width)}), ${frames}`
  }
  return [
    'clawd-rpg doctor',
    `· Band: ${band}`,
    `· Save: ${SAVES[f.save](f)}`,
    `· clawd-bar: ${f.clawdBar ? 'also enabled, and its band stacks with this one: /clawd hides it' : 'not enabled, so no second band'}`,
  ].join('\n')
}
