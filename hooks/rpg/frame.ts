import type { RpgStats } from '../../types'
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
} from './director'
import type { Beat, Story } from './director'
import { grid, write } from './grid'
import type { Grid } from './grid'
import { drawHud, drawable, hudLeft } from './hud'
import { easeOut, lerp, through } from './noise'
import { FOREST } from './places/forest'
import { POSES, cheering, clawd, hurting, idling, trudging, walking } from './sprites/clawd'
import type { Pose } from './sprites/clawd'
import { drawFoe, drawHp, foeTop } from './sprites/foes'
import { bang, banner, burst, chest, cloud, dust, sparks, sword } from './sprites/fx'

export const CLAWD_COL = 50
export const COMPACT_COL = 4
// Below this a fight can't fit left of the HUD, so the band shows Clawd and the place only.
export const COMPACT_BELOW = 100
export const HIDDEN_BELOW = 40
// Clawd swings from this far left of the foe, so the sword's arc lands on it.
const REACH = 22

export type Scene = { width: number; t: number; distance: number; isWalking: boolean; stats: RpgStats; story: Story; trudge?: boolean }

export const clawdCol = (width: number) => (width < COMPACT_BELOW ? COMPACT_COL : CLAWD_COL)

// Where a foe stands: at most 36 columns past Clawd, and always 14 clear of the HUD.
export const foeX = (width: number, stats: RpgStats) => Math.min(CLAWD_COL + 36, hudLeft(width, stats) - 14)

const isCompact = (s: Scene) => s.width < COMPACT_BELOW
// The sword comes down for the last 45% of each 480 ms swing; the first swing waits for the foe to land.
const swingFrom = (story: Story) => Math.max(story.skill?.at ?? 0, (story.foe?.at ?? 0) + FOE_ENTER_MS)
const isSwinging = (story: Story, t: number) => story.skill !== null && t >= swingFrom(story) && t - swingFrom(story) < SKILL_MS * 0.8
const swingDown = (story: Story, t: number) => (t - swingFrom(story)) % 480 >= 264

// Where Clawd is and how he stands, or null while the ALL-OUT ATTACK cloud hides him.
export function clawdAt(s: Scene): { x: number; pose: Pose; strike: boolean } | null {
  const { t, story } = s
  const beat = beatOf(story, t)
  const home = clawdCol(s.width)
  const walk = s.trudge ? trudging(t) : walking(t)
  const called = story.calledAt !== null && t - story.calledAt < CALL_MS
  if (isCompact(s)) {
    if (beat === 'victory') return { x: home, pose: cheering(t), strike: false }
    if (beat === 'enemyTurn') return { x: home, pose: hurting(t), strike: false }
    return { x: home, pose: called ? POSES.stand : s.isWalking ? walk : idling(t), strike: false }
  }
  const fx = foeX(s.width, s.stats)
  const stand = Math.min(CLAWD_COL, fx - REACH)
  switch (beat) {
    case 'encounter': {
      const x = Math.round(lerp(CLAWD_COL, stand, through(t, story.foe?.at ?? story.down?.at ?? t, 400)))
      if (isSwinging(story, t)) return { x: fx - REACH, pose: swingDown(story, t) ? POSES.strike : POSES.swing, strike: true }
      return { x, pose: POSES.right, strike: false }
    }
    case 'enemyTurn':
      return { x: stand - (t - story.counter!.at < COUNTER_MS / 2 ? 3 : 0), pose: hurting(t), strike: false }
    case 'finisher':
      return t - story.down!.at < FINISHER_MS * 0.7 ? null : { x: stand, pose: cheering(t), strike: false }
    case 'victory':
      return { x: CLAWD_COL, pose: cheering(t), strike: false }
    case 'flee':
      return { x: stand, pose: { fx: 1, armL: 8, armR: 10 }, strike: false }
    default:
      return { x: home, pose: called ? POSES.stand : s.isWalking ? walk : idling(t), strike: false }
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

export function frame(s: Scene): Grid {
  const g = grid(s.width)
  const { t, story } = s
  const cam = Math.floor(s.distance)
  for (let x = 0; x < s.width; x++) FOREST.col(g, x, x + cam, t, cam, Number.POSITIVE_INFINITY)
  const beat = beatOf(story, t)
  const me = clawdAt(s)
  if (!isCompact(s)) drawFight(g, s, beat, me?.x ?? Math.min(CLAWD_COL, foeX(s.width, s.stats) - REACH))
  if (me) {
    clawd(g, me.x, 1, me.pose)
    if (me.strike) sword(g, me.x, 1, me.pose === POSES.strike)
    if (beat === 'enemyTurn') sparks(g, me.x, 1, t)
    if (beat === 'flee') dust(g, me.x, t)
    if (story.calledAt !== null && t - story.calledAt < CALL_MS) bang(g, me.x, t)
  }
  if (beat === 'victory' && story.victory && !isCompact(s)) {
    const fx = foeX(s.width, s.stats)
    chest(g, Math.max(CLAWD_COL + 18, fx - 4), 4, t - story.victory.at > 400, t)
    if (t - story.victory.at > 600) caption(g, `◆ ${drawable(story.victory.loot).join('')} · +${story.victory.gained} EXP`, 0xffd54f, me?.x ?? CLAWD_COL)
  }
  drawHud(g, s.stats)
  if (story.levelUp && t >= story.levelUp.at && t - story.levelUp.at < LEVEL_UP_MS && !isCompact(s)) {
    write(g, hudLeft(s.width, s.stats), 3, `LEVEL UP!  Lv.${story.levelUp.level}`, 0xffd54f)
  }
  return g
}

