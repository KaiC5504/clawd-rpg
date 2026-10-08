import type { Foe, FoeKind, Story, Work, WorkKind } from '../../types'
import { classifyCall, settleCall } from '../plumbing/work'
import { noise } from './noise'
import { EXP } from './progress'
import type { Award } from './progress'

export type { Foe, FoeKind, Story }
export type HookPayload = Record<string, unknown>
export type Beat = 'walk' | 'idle' | 'encounter' | 'enemyTurn' | 'finisher' | 'victory' | 'flee'

export const FOE_ENTER_MS = 800
export const SKILL_MS = 1400
export const DOWN_MS = 1000
export const COUNTER_MS = 2000
export const FINISHER_MS = 2400
export const VICTORY_MS = 4400
export const FLEE_MS = 1600
export const CALL_MS = 6000
export const LEVEL_UP_MS = 3000

export const FOREST_ROSTER: readonly FoeKind[] = ['goblin', 'shroom']

export const SKILLS: Partial<Record<WorkKind, string>> = {
  edit: 'CLAW STRIKE',
  write: 'SCRIBE SLASH',
  shell: 'SHELL SHOCK',
  install: 'SHELL SHOCK',
  mcp: 'LINK BEAM',
}

const TROPHY: Record<FoeKind, string> = { goblin: 'Goblin Fang', shroom: 'Glow Cap' }
const LOOT_WORDS = ['Blade', 'Tome', 'Charm', 'Sigil'] as const

export const NO_STORY: Story = {
  turn: { active: false, at: 0, files: {}, gained: 0, foes: 0 },
  foe: null,
  skill: null,
  down: null,
  counter: null,
  victory: null,
  fled: null,
  levelUp: null,
  calledAt: null,
  calls: {},
}

const str = (value: unknown) => (typeof value === 'string' ? value : '')
const base = (path: string) => path.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? path

function spawn(s: Story, now: number): Foe {
  const seed = s.turn.at / 997 + s.turn.foes * 7.3
  const kind = FOREST_ROSTER[Math.floor(noise(seed) * FOREST_ROSTER.length)]!
  const maxHp = 2 + Math.floor(noise(seed + 1) * 3)
  return { kind, hp: maxHp, maxHp, elite: false, at: now, hitAt: 0 }
}

// The file edited most this turn names the loot; a turn without edits keeps a trophy from the fight.
export function lootName(files: Record<string, number>, lastFoe: FoeKind | null): string {
  const top = Object.entries(files).sort((a, b) => b[1] - a[1])[0]?.[0]
  if (!top) return lastFoe ? TROPHY[lastFoe] : 'Forest Herb'
  const word = LOOT_WORDS[[...top].reduce((n, ch) => n + ch.codePointAt(0)!, 0) % LOOT_WORDS.length]!
  return `${word} of ${top}`
}

function defeat(s: Story, foe: Foe, now: number, finisher: boolean, awards: Award[]): Story {
  const kind = foe.elite ? 'elite' : 'battle'
  awards.push({ kind, foe: foe.kind })
  return { ...s, foe: null, down: { kind: foe.kind, at: now, finisher }, turn: { ...s.turn, gained: s.turn.gained + EXP[kind] } }
}

function attack(s: Story, work: Work, path: string, now: number, awards: Award[]): Story {
  const name = SKILLS[work.kind]
  if (!name) return s
  const files = path && (work.kind === 'edit' || work.kind === 'write') ? { ...s.turn.files, [base(path)]: (s.turn.files[base(path)] ?? 0) + 1 } : s.turn.files
  const fresh = s.foe === null
  const foe = s.foe ?? spawn(s, now)
  const next: Story = { ...s, skill: { name, at: now }, turn: { ...s.turn, files, foes: s.turn.foes + (fresh ? 1 : 0) } }
  // An elite stands for a failing test: only a passing run finishes it.
  const hp = foe.elite ? Math.max(1, foe.hp - 1) : foe.hp - 1
  if (hp <= 0) return defeat(next, foe, now, false, awards)
  return { ...next, foe: { ...foe, hp, hitAt: now } }
}

function settle(s: Story, payload: HookPayload, failed: boolean, now: number, awards: Award[]): Story {
  const id = str(payload.tool_use_id)
  const open = s.calls[id]
  if (!open) return s
  const { [id]: _, ...calls } = s.calls
  const work = settleCall(open, payload, failed, now)
  const next = { ...s, calls }
  if (work.kind !== 'tests') return failed ? { ...next, counter: { n: 1, at: now } } : next
  const result = work.result!
  if (!result.ok || (result.failed ?? 0) > 0) {
    const foe = next.foe ?? spawn(next, now)
    return {
      ...next,
      counter: { n: Math.max(1, result.failed ?? 0), at: now },
      foe: { ...foe, elite: true, hp: Math.max(foe.hp, 2) },
      turn: { ...next.turn, foes: next.turn.foes + (next.foe ? 0 : 1) },
    }
  }
  return next.foe ? defeat(next, next.foe, now, true, awards) : next
}

function endTurn(s: Story, reason: string, now: number, awards: Award[]): Story {
  if (!s.turn.active) return s
  const ended: Story = { ...s, calls: {}, turn: { ...s.turn, active: false } }
  if (reason !== 'answer') return { ...ended, foe: null, fled: s.foe ? { kind: s.foe.kind, at: now } : null }
  let won = ended
  if (won.foe && !won.foe.elite) won = defeat(won, won.foe, now, false, awards)
  else if (won.foe) won = { ...won, foe: null, fled: { kind: won.foe.kind, at: now } }
  awards.push({ kind: 'turn' })
  const gained = won.turn.gained + EXP.turn
  return { ...won, turn: { ...won.turn, gained }, victory: { at: now, loot: lootName(won.turn.files, won.down?.kind ?? null), gained } }
}

// Session events in, the story out, plus the deeds that earn EXP.
export function step(s: Story, event: string, payload: HookPayload, now: number): { story: Story; awards: Award[] } {
  const awards: Award[] = []
  const story = ((): Story => {
    switch (event) {
      // A compaction happens mid-turn: the fight goes on through it.
      case 'SessionStart':
        return payload.source === 'compact' ? s : NO_STORY
      case 'UserPromptSubmit':
        return { ...NO_STORY, levelUp: s.levelUp, turn: { active: true, at: now, files: {}, gained: 0, foes: 0 } }
      case 'PreToolUse': {
        // Background work after the turn has ended has no turn to close its fight.
        if (!s.turn.active) return s
        const input = typeof payload.tool_input === 'object' && payload.tool_input !== null ? (payload.tool_input as HookPayload) : {}
        const id = str(payload.tool_use_id)
        const work = classifyCall(str(payload.tool_name), input, id, now)
        const opened = { ...s, calls: { ...s.calls, [id]: work } }
        return attack(opened, work, str(input.file_path) || str(input.notebook_path), now, awards)
      }
      case 'PostToolUse':
        return settle(s, payload, false, now, awards)
      case 'PostToolUseFailure':
        return settle(s, payload, true, now, awards)
      case 'TurnEnded':
        return endTurn(s, str(payload.reason), now, awards)
      case 'Notification':
      case 'Elicitation':
        return { ...s, calledAt: now }
      default:
        return s
    }
  })()
  return { story, awards }
}

export const withLevelUp = (s: Story, level: number, now: number): Story => ({ ...s, levelUp: { level, at: now } })

const within = (at: number | undefined, ms: number, now: number) => at !== undefined && now >= at && now - at < ms

export function beatOf(s: Story, now: number): Beat {
  if (within(s.fled?.at, FLEE_MS, now)) return 'flee'
  if (within(s.victory?.at, VICTORY_MS, now)) return 'victory'
  if (s.down?.finisher && within(s.down.at, FINISHER_MS, now)) return 'finisher'
  if (within(s.counter?.at, COUNTER_MS, now)) return 'enemyTurn'
  if (s.foe || within(s.down?.at, DOWN_MS, now)) return 'encounter'
  return s.turn.active ? 'walk' : 'idle'
}
