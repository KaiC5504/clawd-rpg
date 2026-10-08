import type { ZoneId } from '../../types'

export type { ZoneId }

export type AwardKind = 'battle' | 'elite' | 'raid' | 'turn'
// `boss`: the raid was the zone's boss, which clears the zone.
export type Award = { kind: AwardKind; foe?: string; boss?: true }

// `exp` is what he has towards the next level, not a lifetime total.
export type Progress = {
  v: 1
  exp: number
  level: number
  zone: ZoneId
  zoneMeter: number
  unlocked: ZoneId[]
  bestiary: Record<string, number>
  roadPos: number
}

export const EXP: Record<AwardKind, number> = { battle: 10, elite: 25, raid: 60, turn: 5 }
export const UNLOCK_LEVEL: Record<ZoneId, number> = { forest: 1, dungeon: 3, neon: 6 }
const ZONES = Object.keys(UNLOCK_LEVEL) as ZoneId[]
// Battles won in a zone before its boss turn.
export const ZONE_BATTLES = 12

export const toNext = (level: number) => 50 + 25 * level

export const FRESH: Progress = { v: 1, exp: 0, level: 1, zone: 'forest', zoneMeter: 0, unlocked: ['forest'], bestiary: {}, roadPos: 0 }

const num = (value: unknown, min: number, fallback: number) => (typeof value === 'number' && Number.isFinite(value) && value >= min ? value : fallback)
const unlockedAt = (level: number) => ZONES.filter(z => level >= UNLOCK_LEVEL[z])

// Stored progress may come from an older build, another hand, or nothing at all: every field
// falls back on its own, and anything that isn't a save is kept aside, not overwritten. A newer
// build's save is never touched: a session still running this build would wipe it.
export function loadProgress(raw: unknown): { progress: Progress; backup?: unknown; isNewer?: true } {
  if (raw === undefined || raw === null) return { progress: FRESH }
  const v = typeof raw === 'object' ? (raw as { v?: unknown }).v : undefined
  if (typeof v === 'number' && v > 1) return { progress: FRESH, isNewer: true }
  if (v !== 1) return { progress: FRESH, backup: raw }
  const r = raw as Record<string, unknown>
  const level = Math.floor(num(r.level, 1, 1))
  const zone = ZONES.includes(r.zone as ZoneId) ? (r.zone as ZoneId) : 'forest'
  const bestiary: Record<string, number> = {}
  if (typeof r.bestiary === 'object' && r.bestiary !== null) {
    for (const [k, n] of Object.entries(r.bestiary)) if (typeof n === 'number' && n > 0) bestiary[k] = Math.floor(n)
  }
  return {
    progress: {
      v: 1,
      exp: Math.min(num(r.exp, 0, 0), toNext(level) - 1),
      level,
      zone: unlockedAt(level).includes(zone) ? zone : 'forest',
      zoneMeter: Math.min(Math.floor(num(r.zoneMeter, 0, 0)), ZONE_BATTLES),
      unlocked: unlockedAt(level),
      bestiary,
      roadPos: num(r.roadPos, 0, 0),
    },
  }
}

export function gain(p: Progress, award: Award): { progress: Progress; levelsUp: number } {
  let exp = p.exp + EXP[award.kind]
  let level = p.level
  while (exp >= toNext(level)) {
    exp -= toNext(level)
    level++
  }
  const won = award.kind === 'battle' || award.kind === 'elite'
  const bestiary = award.foe ? { ...p.bestiary, [award.foe]: (p.bestiary[award.foe] ?? 0) + 1 } : p.bestiary
  const next: Progress = { ...p, exp, level, unlocked: unlockedAt(level), zoneMeter: won ? Math.min(ZONE_BATTLES, p.zoneMeter + 1) : p.zoneMeter, bestiary }
  return { progress: award.boss ? { ...next, zone: nextZone(next), zoneMeter: 0 } : next, levelsUp: level - p.level }
}

export const bossDue = (p: Progress) => p.zoneMeter >= ZONE_BATTLES

// The unlocked zone after his, in road order, back to the forest after the last.
export function nextZone(p: Progress): ZoneId {
  const open = unlockedAt(p.level)
  return open[(open.indexOf(p.zone) + 1) % open.length] ?? 'forest'
}

export const expFraction = (p: Progress) => p.exp / toNext(p.level)
