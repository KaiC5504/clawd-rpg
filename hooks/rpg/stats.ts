import type { RpgStats } from '../../types'

export type Usage = { context?: { percent?: number }; rateLimits?: { kind: string; percentUsed: number }[] }

// Level and EXP come from saved progress in plan 2; until then he is a level 1 hero.
export function statsFrom(usage: Usage | null, place: string): RpgStats {
  const ctx = usage?.context?.percent ?? 0
  const fiveHour = usage?.rateLimits?.find(l => l.kind === 'five_hour')?.percentUsed ?? 0
  return { level: 1, exp: 0, hp: 1 - ctx / 100, mp: 1 - fiveHour / 100, place }
}
