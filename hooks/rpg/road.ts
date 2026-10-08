import type { RestKind, Story, Trip } from '../../types'
import { CALL_MS, beatOf } from './director'
import { LEG_STEP_MS } from './sprites/clawd'

export const CLAWD_COL = 50
export const COMPACT_COL = 4
// Below this a fight can't fit left of the HUD, so the band shows Clawd and the place only.
export const COMPACT_BELOW = 100

export const clawdCol = (width: number) => (width < COMPACT_BELOW ? COMPACT_COL : CLAWD_COL)

// clawd-bar's DOZE_AFTER_MS and SLEEP_AFTER_MS: a minute idle he moves on to the campfire, ten to the inn.
export const DOZE_MS = 60_000
export const SLEEP_MS = 600_000
// Reeling in, or getting up, before he walks back to work.
export const PACK_MS = 1200
// Three tool calls inside this window and he hurries.
export const HURRY_WINDOW_MS = 8000

// Paces in road pixels per four frames: whole pixels only, since a fraction scrolls unevenly.
const WALK = 4
const HURRY = 8

const SCHEDULE: readonly [RestKind, number][] = [
  ['pier', 0],
  ['camp', DOZE_MS],
  ['inn', SLEEP_MS],
]

// The rest spots a trip has reached by `now`, in order. A compaction goes straight to the inn, and
// the inn is always the last stop.
export function stopsOf(trip: Trip, now: number): RestKind[] {
  const until = trip.leftAt ?? now
  const due: [RestKind, number][] = SCHEDULE.map(([kind, after]) => [kind, trip.at + after])
  if (trip.compactAt !== null) due.push(['inn', trip.compactAt])
  due.sort((a, b) => a[1] - b[1])
  const stops: RestKind[] = []
  for (const [kind, at] of due) {
    if (at > until || stops.includes(kind)) continue
    stops.push(kind)
    if (kind === 'inn') break
  }
  return stops
}

// A stopped scene fills the band, so a rest spot is one band wide. In the compact view Clawd stands
// further left, so the spot stretches to keep its props where he sits.
export const placeWidth = (width: number) => width + CLAWD_COL - clawdCol(width)

// The road column at the band's left edge, when the camera is at `distance`.
export const camOf = (distance: number, width: number) => Math.floor(distance) + CLAWD_COL - clawdCol(width)

export type Spot = { kind: RestKind; from: number }

export function spotsOf(trip: Trip, now: number, width: number): Spot[] {
  const pw = placeWidth(width)
  return stopsOf(trip, now).map((kind, i) => ({ kind, from: trip.origin + (i + 1) * pw }))
}

// Where the road takes him while he rests: the last spot his trip has reached.
export function goalOf(story: Story, now: number, width: number): Spot | null {
  const trip = story.trip
  if (!trip || trip.leftAt !== null) return null
  return spotsOf(trip, now, width).at(-1) ?? null
}

// The rest spots on the road, the current trip's first. A last-trip spot that overlaps one of
// them is dropped whole, so its props never show inside the place he's at.
export function spotsOnRoad(story: Story, now: number, width: number): Spot[] {
  const pw = placeWidth(width)
  const mine = story.trip ? spotsOf(story.trip, now, width) : []
  const old = story.trail ? spotsOf(story.trail, now, width) : []
  return [...mine, ...old.filter(p => mine.every(q => p.from + pw <= q.from || q.from + pw <= p.from))]
}

export function placeAt(story: Story, wx: number, now: number, width: number): Spot | null {
  const pw = placeWidth(width)
  return spotsOnRoad(story, now, width).find(p => wx >= p.from && wx < p.from + pw) ?? null
}

export type Rest = { kind: RestKind; phase: 'travel' | 'rest' | 'pack'; since: number }

// What resting looks like now: on his way to a spot, there, or packing up after a prompt.
export function restOf(story: Story, now: number, distance: number, width: number): Rest | null {
  const trip = story.trip
  if (!trip) return null
  const d = Math.floor(distance)
  if (trip.leftAt !== null) {
    const left = spotsOf(trip, trip.leftAt, width).at(-1)
    return left && d === left.from && now - trip.leftAt < PACK_MS ? { kind: left.kind, phase: 'pack', since: trip.leftAt } : null
  }
  const goal = goalOf(story, now, width)
  if (!goal) return null
  return { kind: goal.kind, phase: d === goal.from ? 'rest' : 'travel', since: trip.at }
}

// The band changed width under him. Spots stand a band apart, so they all move; if he was at one,
// resting or packing, put him on the same spot at the new width instead of walking him there.
export function reanchor(story: Story, now: number, distance: number, from: number, to: number): number {
  const rest = from === to ? null : restOf(story, now, distance, from)
  if (!rest || rest.phase === 'travel') return distance
  const spot = spotsOf(story.trip!, story.trip!.leftAt ?? now, to).find(p => p.kind === rest.kind)
  return spot?.from ?? distance
}

const isHurried = (story: Story, now: number) => {
  const recent = story.turn.recent ?? []
  return recent.length >= 3 && now - recent[recent.length - 3]! <= HURRY_WINDOW_MS
}

export type Motion = { distance: number; isWalking: boolean; legMs: number }

// One frame of the road: how far the camera moves, given the story and whether Claude is working.
export function moveRoad(story: Story, now: number, distance: number, width: number, frame: number, isWorking: boolean, trudge: boolean): Motion {
  const still: Motion = { distance, isWalking: false, legMs: LEG_STEP_MS }
  const beat = beatOf(story, now)
  if (beat !== 'walk' && beat !== 'idle') return still
  if (story.calledAt !== null && now - story.calledAt < CALL_MS) return still
  if (restOf(story, now, distance, width)?.phase === 'pack') return still
  const goal = isWorking ? null : goalOf(story, now, width)
  if (!isWorking && !goal) return still
  // Past his goal (a resize the timer hasn't caught up with): back onto it, never stranded in the forest.
  if (goal && distance >= goal.from) return { ...still, distance: goal.from }
  let rate = goal || isHurried(story, now) ? HURRY : WALK
  if (trudge) rate /= 2
  const step = Math.floor(((frame + 1) * rate) / 4) - Math.floor((frame * rate) / 4)
  return { distance: goal ? Math.min(goal.from, distance + step) : distance + step, isWalking: true, legMs: (LEG_STEP_MS * WALK) / rate }
}
