import type { RestKind, RpgStats } from '../../types'
import {
  CALL_MS,
  COUNTER_MS,
  DOWN_MS,
  FINISHER_MS,
  FLEE_MS,
  FOE_ENTER_MS,
  LEVEL_UP_MS,
  SKILL_MS,
  VICTORY_MS,
  beatOf,
  questOf,
} from './director'
import type { Beat, Story } from './director'
import { EMPTY, at, grid, line, rect, sprite, write } from './grid'
import type { Grid } from './grid'
import { drawHud, drawable, hudLeft } from './hud'
import { easeOut, lerp, through } from './noise'
import { CAMP } from './places/camp'
import { FOREST } from './places/forest'
import { INN } from './places/inn'
import { PIER } from './places/pier'
import type { Place } from './places/place'
import { CLAWD_COL, COMPACT_BELOW, PACK_MS, camOf, clawdCol, placeWidth, restOf, spotsOnRoad } from './road'
import type { Rest, Spot } from './road'
import { POSES, asleep, cheering, clawd, hurting, idling, sitting, trudging, walking } from './sprites/clawd'
import type { Pose } from './sprites/clawd'
import { drawFoe, drawHp, foeTop } from './sprites/foes'
import { bang, banner, burst, chest, cloud, dust, sparks, sword } from './sprites/fx'

export { CLAWD_COL, COMPACT_BELOW, COMPACT_COL, clawdCol } from './road'
export const HIDDEN_BELOW = 40
// Clawd swings from this far left of the foe, so the sword's arc lands on it.
const REACH = 22

// Non-ASCII characters the road may write; each must be one cell wide (tests check them).
export const ROAD_GLYPHS = ['→', '☐', '…'] as const

const REST_PLACES: Record<RestKind, Place> = { pier: PIER, camp: CAMP, inn: INN }
const SIGNS: Record<RestKind, string> = { pier: '→ Pier', camp: '→ Camp', inn: '→ Inn' }
// The inn's blanket covers him from this pixel row down.
const TUCKED_FROM = 6
const FISH_MS = 7600

// `legMs`: how long each of his steps takes at the pace the road moves.
export type Scene = { width: number; t: number; distance: number; isWalking: boolean; stats: RpgStats; story: Story; trudge?: boolean; legMs?: number }

// Where a foe stands: at most 36 columns past Clawd, and always 14 clear of the HUD.
export const foeX = (width: number, stats: RpgStats) => Math.min(CLAWD_COL + 36, hudLeft(width, stats) - 14)

const isCompact = (s: Scene) => s.width < COMPACT_BELOW
// The sword comes down for the last 45% of each 480 ms swing; the first swing waits for the foe to land.
const swingFrom = (story: Story) => Math.max(story.skill?.at ?? 0, (story.foe?.at ?? 0) + FOE_ENTER_MS)
const isSwinging = (story: Story, t: number) => story.skill !== null && t >= swingFrom(story) && t - swingFrom(story) < SKILL_MS * 0.8
const swingDown = (story: Story, t: number) => (t - swingFrom(story)) % 480 >= 264

// `tucked`: in bed, under the inn's blanket from TUCKED_FROM down.
export type ClawdPlace = { x: number; y: number; pose: Pose; strike: boolean; tucked?: boolean }

function resting(rest: Rest, x: number, t: number, called: boolean): ClawdPlace | null {
  if (rest.phase === 'travel') return null
  if (rest.phase === 'pack') {
    if (rest.kind === 'pier') return { x, y: 1, pose: POSES.stand, strike: false }
    const up = t - rest.since >= PACK_MS / 2
    if (rest.kind === 'inn' && !up) return { x, y: -1, pose: asleep(t), strike: false, tucked: true }
    return { x, y: 1, pose: up ? POSES.stretch : POSES.sit, strike: false }
  }
  if (rest.kind === 'inn') return { x, y: -1, pose: called ? { sit: true, top: 8 } : asleep(t), strike: false, tucked: true }
  if (called) return { x, y: 1, pose: POSES.stand, strike: false }
  return { x, y: 1, pose: rest.kind === 'camp' ? sitting(t) : idling(t), strike: false }
}

// Where Clawd is and how he stands, or null while the ALL-OUT ATTACK cloud hides him.
export function clawdAt(s: Scene): ClawdPlace | null {
  const { t, story } = s
  const beat = beatOf(story, t)
  const home = clawdCol(s.width)
  const walk = s.trudge ? trudging(t, s.legMs) : walking(t, s.legMs)
  const called = story.calledAt !== null && t - story.calledAt < CALL_MS
  const rest = beat === 'idle' || beat === 'walk' ? restOf(story, t, s.distance, s.width) : null
  const still = rest && resting(rest, home, t, called)
  if (still) return still
  const standing = { x: home, y: 1, pose: called ? POSES.stand : s.isWalking ? walk : idling(t), strike: false }
  if (isCompact(s)) {
    if (beat === 'victory') return { x: home, y: 1, pose: cheering(t), strike: false }
    if (beat === 'enemyTurn') return { x: home, y: 1, pose: hurting(t), strike: false }
    return standing
  }
  const fx = foeX(s.width, s.stats)
  const stand = Math.min(CLAWD_COL, fx - REACH)
  switch (beat) {
    case 'encounter': {
      const x = Math.round(lerp(CLAWD_COL, stand, through(t, story.foe?.at ?? story.down?.at ?? t, 400)))
      if (isSwinging(story, t)) return { x: fx - REACH, y: 1, pose: swingDown(story, t) ? POSES.strike : POSES.swing, strike: true }
      return { x, y: 1, pose: POSES.right, strike: false }
    }
    case 'enemyTurn':
      return { x: stand - (t - story.counter!.at < COUNTER_MS / 2 ? 3 : 0), y: 1, pose: hurting(t), strike: false }
    case 'finisher':
      return t - story.down!.at < FINISHER_MS * 0.7 ? null : { x: stand, y: 1, pose: cheering(t), strike: false }
    case 'victory':
      return { x: CLAWD_COL, y: 1, pose: cheering(t), strike: false }
    case 'flee':
      return { x: stand, y: 1, pose: { fx: 1, armL: 8, armR: 10 }, strike: false }
    default:
      return standing
  }
}

function drawFight(g: Grid, s: Scene, beat: Beat, before: number): void {
  const { t, story } = s
  const fx = foeX(s.width, s.stats)
  const foe = story.foe
  if (foe) {
    const y = Math.round(lerp(-8, foeTop(foe.kind), easeOut(through(t, foe.at, FOE_ENTER_MS))))
    const flash = isSwinging(story, t) && swingDown(story, t)
    drawFoe(g, foe.kind, fx, y, t, { flash, elite: foe.elite })
    drawHp(g, fx, y - (foe.elite ? 3 : 2), foe.hp, foe.maxHp)
  }
  const down = story.down
  if (down && beat === 'encounter' && t - down.at < DOWN_MS) burst(g, fx + 3, 6, (t - down.at) / 180, [0xffffff, 0xb6f09c, 0x6fbf4e])
  if (beat === 'finisher' && down) {
    const q = through(t, down.at, FINISHER_MS)
    if (q < 0.7) cloud(g, fx, t)
    else burst(g, fx + 3, 5, (t - down.at - FINISHER_MS * 0.7) / 120, [0xffffff, 0xff9f8a, 0xd6453d], 12)
    banner(g, 'ALL-OUT ATTACK!!', q / 0.7, 0xe5202e, undefined, before)
  }
  if (beat === 'flee' && story.fled) {
    const q = through(t, story.fled.at, FLEE_MS)
    drawFoe(g, story.fled.kind, fx + Math.round(q * 6), Math.round(foeTop(story.fled.kind) - q * 14), t)
  }
  if (story.skill && beat === 'encounter') banner(g, story.skill.name, (t - story.skill.at) / SKILL_MS, 0xe5202e, undefined, before)
  if (beat === 'enemyTurn' && story.counter) banner(g, `COUNTER  ✗${story.counter.n}`, (t - story.counter.at) / COUNTER_MS, 0x000000, 0xff4b4b, before)
}

function caption(g: Grid, text: string, fg: number, before: number): void {
  const room = before - 6
  const chars = [...text]
  write(g, 4, 0, chars.length > room ? chars.slice(0, room - 1).join('') + '…' : text, fg)
}

const spotsOn = (s: Scene): Spot[] => spotsOnRoad(s.story, s.t, s.width)

// Text from any source (a place's sign scrolling past, a caption) never covers his pixels.
function clearOff(g: Grid, me: ClawdPlace): void {
  const solo = grid(g.w)
  clawd(solo, me.x, me.y, me.pose)
  for (const key of [...g.text.keys()]) {
    const x = key % g.w
    const row = Math.floor(key / g.w)
    if (at(solo, x, row * 2) !== EMPTY || at(solo, x, row * 2 + 1) !== EMPTY) g.text.delete(key)
  }
}

function drawRoad(g: Grid, s: Scene, spots: Spot[], cam: number, pw: number): void {
  const { t } = s
  for (let x = 0; x < s.width; x++) {
    const wx = cam + x
    const spot = spots.find(p => wx >= p.from && wx < p.from + pw)
    if (spot) REST_PLACES[spot.kind].col(g, x, wx - spot.from, t, cam, pw)
    else FOREST.col(g, x, wx, t, cam, Number.POSITIVE_INFINITY)
  }
  for (const spot of [...spots].reverse()) {
    const ox = spot.from - cam
    if (ox < s.width && ox + pw > 0) REST_PLACES[spot.kind].props?.(g, ox, t, pw)
  }
}

// A signpost just before each rest spot; its name stays clear of Clawd and out of the compact view.
function drawSigns(g: Grid, s: Scene, spots: Spot[], cam: number, me: ClawdPlace | null): void {
  for (const spot of spots) {
    const x = spot.from - 12 - cam
    if (x < -4 || x > s.width) continue
    rect(g, x, 6, 1, 4, 0x6b4a2b)
    rect(g, x - 2, 5, 6, 2, 0x8a5a2b)
    const label = SIGNS[spot.kind]
    const end = x - 1 + label.length
    const clear = !me || end < me.x - 1 || x - 1 > me.x + 16
    if (!isCompact(s) && clear && x - 1 >= 0 && end <= s.width) write(g, x - 1, 1, label, 0xe9e6df)
  }
}

// At the pier: rod out, the line to a bobbing float, and now and then a fish pulled in.
function fishing(g: Grid, x: number, t: number): void {
  line(g, x + 15, 4, x + 20, 0, 0xa0714a)
  const k = t % FISH_MS
  const float = x + 34
  const dip = k > 4800 && k < 5600
  const y = dip ? 9 : 7 + (Math.floor(t / 1200) % 2 === 1 ? 0 : -1)
  line(g, x + 20, 0, float, y, 0x6b7390, 2)
  if (dip) {
    g.px[7 * g.w + float - 1] = 0xf4f4f4
    g.px[7 * g.w + float + 1] = 0xf4f4f4
  } else {
    sprite(g, float, y - 1, ['R', 'W'], { R: 0xff4b4b, W: 0xf4f4f4 })
  }
  if (k > 5600 && k < 7000) {
    const q = through(k, 5600, 1400)
    sprite(g, Math.round(lerp(float, x + 18, q)), Math.round(lerp(7, 0, q)), ['GGG', 'GGTT'], { G: 0xc8d0e8, T: 0x9aa0b2 })
  }
}

function restCaption(s: Scene, rest: Rest | null): [string, number] | null {
  if (!rest || rest.phase !== 'rest') return null
  if (rest.kind === 'pier') return ['waiting for you…', 0x7fd1ff]
  if (rest.kind === 'camp') return ['idle · warming up', 0xffb27a]
  return [s.story.trip?.compactAt !== null ? 'z Z  ·  HP refilling' : 'z Z', 0x9be38a]
}

export function frame(s: Scene): Grid {
  const g = grid(s.width)
  const { t, story } = s
  const cam = camOf(s.distance, s.width)
  const pw = placeWidth(s.width)
  const spots = spotsOn(s)
  drawRoad(g, s, spots, cam, pw)
  const beat = beatOf(story, t)
  const me = clawdAt(s)
  drawSigns(g, s, spots, cam, me)
  const rest = beat === 'idle' || beat === 'walk' ? restOf(story, t, s.distance, s.width) : null
  const called = story.calledAt !== null && t - story.calledAt < CALL_MS
  if (!isCompact(s)) drawFight(g, s, beat, me?.x ?? Math.min(CLAWD_COL, foeX(s.width, s.stats) - REACH))
  if (me) {
    clawd(g, me.x, me.y, me.pose)
    if (me.strike) sword(g, me.x, 1, me.pose === POSES.strike)
    if (beat === 'enemyTurn') sparks(g, me.x, 1, t)
    if (beat === 'flee') dust(g, me.x, t)
    if (rest?.phase === 'rest' && rest.kind === 'pier' && !called) fishing(g, me.x, t)
    if (me.tucked) INN.front?.(g, me.x - CLAWD_COL, t, pw)
    if (called) bang(g, me.x, t)
  }
  if (beat === 'victory' && story.victory && !isCompact(s)) {
    const fx = foeX(s.width, s.stats)
    chest(g, Math.max(CLAWD_COL + 18, fx - 4), 4, t - story.victory.at > 400, t)
    if (t - story.victory.at > 600) caption(g, `◆ ${drawable(story.victory.loot).join('')} · +${story.victory.gained} EXP`, 0xffd54f, me?.x ?? CLAWD_COL)
  } else if (!isCompact(s) && me) {
    const quest = questOf(story)
    // The task's own words may hold characters the band can't draw one cell wide.
    const said: [string, number] | null = restCaption(s, rest) ?? (quest ? [`☐ ${drawable(quest.slice(2)).join('')}`, 0xd7c9a0] : null)
    if (said) caption(g, said[0], said[1], me.x)
  }
  drawHud(g, s.stats)
  if (me) clearOff(g, me)
  if (story.levelUp && t >= story.levelUp.at && t - story.levelUp.at < LEVEL_UP_MS && !isCompact(s)) {
    write(g, hudLeft(s.width, s.stats), 3, `LEVEL UP!  Lv.${story.levelUp.level}`, 0xffd54f)
  }
  return g
}
