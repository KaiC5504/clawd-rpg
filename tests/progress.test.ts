import { describe, expect, test } from 'claude-code/testing'

import { EXP, FRESH, ZONE_BATTLES, expFraction, gain, loadProgress, toNext } from '../hooks/rpg/progress'
import type { Progress } from '../hooks/rpg/progress'

describe('progress', () => {
  test('EXP per deed and the level curve match the spec', () => {
    expect(EXP).toEqual({ battle: 10, elite: 25, raid: 60, turn: 5 })
    expect([toNext(1), toNext(2), toNext(7)]).toEqual([75, 100, 225])
  })

  test('a battle won adds EXP, fills the zone meter and logs the foe', () => {
    const { progress, levelsUp } = gain(FRESH, { kind: 'battle', foe: 'goblin' })
    expect([progress.exp, progress.zoneMeter, progress.bestiary.goblin, levelsUp]).toEqual([10, 1, 1, 0])
  })

  test('a finished turn adds EXP but no battle', () => {
    const { progress } = gain(FRESH, { kind: 'turn' })
    expect([progress.exp, progress.zoneMeter]).toEqual([5, 0])
  })

  test('crossing the threshold levels up and carries the rest over', () => {
    const near: Progress = { ...FRESH, exp: 70 }
    const { progress, levelsUp } = gain(near, { kind: 'elite', foe: 'chief' })
    expect([progress.level, progress.exp, levelsUp]).toEqual([2, 20, 1])
  })

  test('levels unlock zones: Dungeon at 3, Neon City at 6', () => {
    const at = (level: number) => gain({ ...FRESH, level, exp: toNext(level) - 1 }, { kind: 'turn' }).progress.unlocked
    expect(at(2)).toEqual(['forest', 'dungeon'])
    expect(at(5)).toEqual(['forest', 'dungeon', 'neon'])
    expect(FRESH.unlocked).toEqual(['forest'])
  })

  test('the zone meter stops at the boss mark', () => {
    let p: Progress = { ...FRESH, zoneMeter: ZONE_BATTLES - 1 }
    for (let i = 0; i < 3; i++) p = gain(p, { kind: 'battle' }).progress
    expect(p.zoneMeter).toBe(ZONE_BATTLES)
  })

  test('the EXP bar is the share of this level done', () => {
    expect(expFraction({ ...FRESH, exp: 30 })).toBe(30 / 75)
  })
})

describe('loading saved progress', () => {
  test('nothing saved starts a fresh level 1 hero', () => {
    expect(loadProgress(undefined)).toEqual({ progress: FRESH })
  })

  test('a save from an older build fills its missing fields', () => {
    const { progress } = loadProgress({ v: 1, exp: 12, level: 4 })
    expect(progress).toEqual({ ...FRESH, exp: 12, level: 4, unlocked: ['forest', 'dungeon'] })
  })

  test('nonsense fields fall back one by one', () => {
    const { progress } = loadProgress({ v: 1, exp: -5, level: 'x', zone: 'moon', zoneMeter: 99, bestiary: { goblin: 3, bad: 'x' }, roadPos: NaN })
    expect(progress).toEqual({ ...FRESH, zoneMeter: ZONE_BATTLES, bestiary: { goblin: 3 } })
  })

  test('a zone he has not unlocked yet is not where he stands', () => {
    expect(loadProgress({ v: 1, level: 2, zone: 'neon' }).progress.zone).toBe('forest')
  })

  test('a version this build does not know is kept aside, and he starts fresh', () => {
    const future = { v: 2, exp: 9000 }
    expect(loadProgress(future)).toEqual({ progress: FRESH, backup: future })
    expect(loadProgress('garbage')).toEqual({ progress: FRESH, backup: 'garbage' })
  })
})
