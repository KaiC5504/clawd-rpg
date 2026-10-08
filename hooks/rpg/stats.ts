import type { RpgStats } from '../../types'
import { expFraction } from './progress'
import type { Progress } from './progress'

export type Usage = { context?: { percent?: number }; rateLimits?: { kind: string; percentUsed: number }[] }

export function statsFrom(usage: Usage | null, place: string, progress: Progress): RpgStats {
  const ctx = usage?.context?.percent ?? 0
  const fiveHour = usage?.rateLimits?.find(l => l.kind === 'five_hour')?.percentUsed ?? 0
  return { level: progress.level, exp: expFraction(progress), hp: 1 - ctx / 100, mp: 1 - fiveHour / 100, place }
}
