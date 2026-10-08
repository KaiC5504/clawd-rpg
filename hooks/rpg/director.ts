import type { Foe, FoeKind, Member, PartyClass, QuestTask, Story, Trip, Work, WorkKind, ZoneId } from '../../types'
import { classifyCall, settleCall } from '../plumbing/work'
import { noise } from './noise'
import { EXP } from './progress'
import type { Award } from './progress'

export type { Foe, FoeKind, Member, PartyClass, QuestTask, Story, Trip, ZoneId }
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

export const ROSTERS: Record<ZoneId, readonly FoeKind[]> = {
  forest: ['goblin', 'shroom'],
  dungeon: ['slime', 'skeleton'],
  neon: ['drone', 'bug'],
}
export const BOSSES: Record<ZoneId, FoeKind> = { forest: 'treant', dungeon: 'hydra', neon: 'mech' }
export const BOSS_HP = 6
const ZONES = Object.keys(ROSTERS) as ZoneId[]

export const SKILLS: Partial<Record<WorkKind, string>> = {
  edit: 'CLAW STRIKE',
  write: 'SCRIBE SLASH',
  shell: 'SHELL SHOCK',
  install: 'SHELL SHOCK',
  mcp: 'LINK BEAM',
}
export const CLASS_SKILLS: Record<PartyClass, string> = { knight: 'SHIELD BASH', mage: 'ARCANE BOLT', scout: 'QUICK SHOT' }

const CLASSES: Readonly<Record<string, PartyClass>> = { Explore: 'scout', Plan: 'mage', 'general-purpose': 'knight' }
const ANY_CLASS = ['knight', 'mage', 'scout'] as const

// Any other agent type gets a class of its own, the same one every time.
export function classOf(agentType: string): PartyClass {
  const known = CLASSES[agentType]
  if (known) return known
  return ANY_CLASS[[...agentType].reduce((h, ch) => (h * 31 + ch.codePointAt(0)!) % 1_000_003, 7) % ANY_CLASS.length]!
}

const TROPHY: Record<FoeKind, string> = {
  goblin: 'Goblin Fang',
  shroom: 'Glow Cap',
  slime: 'Slime Jelly',
  skeleton: 'Old Bone',
  drone: 'Drone Rotor',
  bug: 'Glitch Shard',
  treant: 'Treant Heartwood',
  hydra: 'Hydra Scale',
  mech: 'Mech Core',
}
const FOUND: Record<ZoneId, string> = { forest: 'Forest Herb', dungeon: 'Torch Stub', neon: 'Neon Token' }
const LOOT_WORDS = ['Blade', 'Tome', 'Charm', 'Sigil'] as const

export const NO_STORY: Story = {
  turn: { active: false, at: 0, files: {}, gained: 0, foes: 0, recent: [], boss: false, bossDown: null },
  foe: null,
  skill: null,
  down: null,
  counter: null,
  victory: null,
  fled: null,
  levelUp: null,
  calledAt: null,
  calls: {},
  trip: null,
  trail: null,
  tasks: [],
  zone: 'forest',
  gate: null,
  party: [],
}

const str = (value: unknown) => (typeof value === 'string' ? value : '')
const base = (path: string) => path.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? path
const zoneOf = (value: unknown): ZoneId => (ZONES.includes(value as ZoneId) ? (value as ZoneId) : 'forest')

function spawn(s: Story, now: number): Foe {
  const zone = s.zone ?? 'forest'
  if (s.turn.boss && !s.turn.bossDown) return { kind: BOSSES[zone], hp: BOSS_HP, maxHp: BOSS_HP, elite: false, at: now, hitAt: 0, boss: true }
  const roster = ROSTERS[zone]
  const seed = s.turn.at / 997 + s.turn.foes * 7.3
  const kind = roster[Math.floor(noise(seed) * roster.length)]!
  const maxHp = 2 + Math.floor(noise(seed + 1) * 3)
  return { kind, hp: maxHp, maxHp, elite: false, at: now, hitAt: 0 }
}

// The file edited most this turn names the loot; a turn without edits keeps a trophy from the fight.
export function lootName(files: Record<string, number>, lastFoe: FoeKind | null, zone: ZoneId = 'forest'): string {
  const top = Object.entries(files).sort((a, b) => b[1] - a[1])[0]?.[0]
  if (!top) return lastFoe ? TROPHY[lastFoe] : FOUND[zone]
  const word = LOOT_WORDS[[...top].reduce((n, ch) => n + ch.codePointAt(0)!, 0) % LOOT_WORDS.length]!
  return `${word} of ${top}`
}

function defeat(s: Story, foe: Foe, now: number, finisher: boolean, awards: Award[]): Story {
  const down = { kind: foe.kind, at: now, finisher }
  if (foe.boss) {
    awards.push({ kind: 'raid', foe: foe.kind, boss: true, zone: s.zone ?? 'forest' })
    return { ...s, foe: null, down, turn: { ...s.turn, gained: s.turn.gained + EXP.raid, bossDown: foe.kind } }
  }
  const kind = foe.elite ? 'elite' : 'battle'
  awards.push({ kind, foe: foe.kind })
  return { ...s, foe: null, down, turn: { ...s.turn, gained: s.turn.gained + EXP[kind] } }
}

// A blow on the foe in the way, or on a fresh one if nothing stands there yet.
function hit(s: Story, skill: NonNullable<Story['skill']>, now: number, awards: Award[]): Story {
  const fresh = s.foe === null
  const foe = s.foe ?? spawn(s, now)
  const next: Story = { ...s, skill, turn: { ...s.turn, foes: s.turn.foes + (fresh ? 1 : 0) } }
  // An elite stands for a failing test: only a passing run finishes it.
  const hp = foe.elite ? Math.max(1, foe.hp - 1) : foe.hp - 1
  if (hp <= 0) return defeat(next, foe, now, false, awards)
  return { ...next, foe: { ...foe, hp, hitAt: now } }
}

// `by`: a party member made the call, so the blow is its class skill.
function attack(s: Story, work: Work, path: string, now: number, awards: Award[], by: Member | null): Story {
  const name = SKILLS[work.kind]
  if (!name) return s
  const files = path && (work.kind === 'edit' || work.kind === 'write') ? { ...s.turn.files, [base(path)]: (s.turn.files[base(path)] ?? 0) + 1 } : s.turn.files
  const skill = by ? { name: CLASS_SKILLS[by.cls], at: now, party: true as const, by: by.id } : { name, at: now }
  return hit({ ...s, turn: { ...s.turn, files } }, skill, now, awards)
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
  // A turn the party fought in is a raid.
  if ((s.party ?? []).length > 0) {
    awards.push({ kind: 'raid' })
    won = { ...won, turn: { ...won.turn, gained: won.turn.gained + EXP.raid } }
  }
  awards.push({ kind: 'turn' })
  const gained = won.turn.gained + EXP.turn
  const loot = won.turn.bossDown ? TROPHY[won.turn.bossDown] : lootName(won.turn.files, won.down?.kind ?? null, s.zone ?? 'forest')
  return { ...won, turn: { ...won.turn, gained }, victory: { at: now, loot, gained } }
}

const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0)
const restFrom = (roadAt: unknown, now: number, zone: ZoneId): Trip => ({ origin: num(roadAt), at: now, compactAt: null, leftAt: null, zone })

const taskStatus = (value: unknown): QuestTask['status'] => (value === 'completed' || value === 'in_progress' ? value : 'pending')

// TodoWrite hands over the whole list; TaskUpdate moves one task along, or deletes it.
function plan(tasks: QuestTask[], tool: string, input: HookPayload): QuestTask[] {
  if (tool === 'TodoWrite' && Array.isArray(input.todos)) {
    return (input.todos as HookPayload[]).map((todo, i) => ({ id: `todo-${i}`, subject: str(todo.content), status: taskStatus(todo.status) }))
  }
  if (tool !== 'TaskUpdate') return tasks
  const id = str(input.taskId)
  if (input.status === 'deleted') return tasks.filter(task => task.id !== id)
  return tasks.map(task => (task.id !== id ? task : { ...task, subject: str(input.subject) || task.subject, status: input.status === undefined ? task.status : taskStatus(input.status) }))
}

function created(tasks: QuestTask[], id: string, subject: string): QuestTask[] {
  return !id || tasks.some(task => task.id === id) ? tasks : [...tasks, { id, subject, status: 'pending' }]
}

function completed(tasks: QuestTask[], id: string, subject: string): QuestTask[] {
  if (!tasks.some(task => task.id === id)) return [...tasks, { id, subject, status: 'completed' }]
  return tasks.map(task => (task.id === id ? { ...task, status: 'completed' } : task))
}

function joined(s: Story, id: string, agentType: string, now: number): Story {
  const party = s.party ?? []
  return party.some(m => m.id === id) ? s : { ...s, party: [...party, { id, cls: classOf(agentType), at: now, doneAt: null }] }
}

// Session events in, the story out, plus the deeds that earn EXP.
export function step(s: Story, event: string, payload: HookPayload, now: number): { story: Story; awards: Award[] } {
  const awards: Award[] = []
  const story = ((): Story => {
    switch (event) {
      // A compaction happens mid-turn: the fight goes on through it.
      case 'SessionStart': {
        if (payload.source === 'compact') return s
        const zone = zoneOf(payload.zone)
        return { ...NO_STORY, zone, trip: restFrom(payload.roadAt, now, zone) }
      }
      case 'UserPromptSubmit':
        return {
          ...NO_STORY,
          levelUp: s.levelUp,
          tasks: s.tasks,
          trip: s.trip && { ...s.trip, leftAt: s.trip.leftAt ?? now },
          trail: s.trail,
          zone: s.zone ?? 'forest',
          gate: s.gate ?? null,
          turn: { active: true, at: now, files: {}, gained: 0, foes: 0, recent: [], boss: payload.boss === true, bossDown: null },
        }
      case 'PreToolUse': {
        // Background work after the turn has ended has no turn to close its fight.
        if (!s.turn.active) return s
        const input = typeof payload.tool_input === 'object' && payload.tool_input !== null ? (payload.tool_input as HookPayload) : {}
        const id = str(payload.tool_use_id)
        const tool = str(payload.tool_name)
        const work = classifyCall(tool, input, id, now)
        const recent = [...(s.turn.recent ?? []), now].slice(-3)
        const agent = str(payload.agent_id)
        // A subagent's own todo list isn't the quest.
        const opened: Story = { ...s, calls: { ...s.calls, [id]: work }, tasks: agent ? s.tasks : plan(s.tasks, tool, input), turn: { ...s.turn, recent } }
        const path = str(input.file_path) || str(input.notebook_path)
        if (!agent) return attack(opened, work, path, now, awards, null)
        // One left running from an earlier turn never joined this one: its calls aren't this fight's.
        const member = (s.party ?? []).find(m => m.id === agent)
        return member ? attack(opened, work, path, now, awards, member) : opened
      }
      case 'PostToolUse':
        return settle(s, payload, false, now, awards)
      case 'PostToolUseFailure':
        return settle(s, payload, true, now, awards)
      case 'TurnEnded': {
        const ended = endTurn(s, str(payload.reason), now, awards)
        return ended === s ? s : { ...ended, trip: restFrom(payload.roadAt, now, s.zone ?? 'forest'), trail: s.trip }
      }
      // A compaction between turns sends him to the inn; one mid-turn leaves the fight be.
      case 'Compact':
        return !s.turn.active && s.trip && s.trip.leftAt === null && s.trip.compactAt === null ? { ...s, trip: { ...s.trip, compactAt: now } } : s
      case 'TaskCreated':
        return { ...s, tasks: created(s.tasks, str(payload.task_id), str(payload.task_subject)) }
      case 'TaskCompleted':
        return { ...s, tasks: completed(s.tasks, str(payload.task_id), str(payload.task_subject)) }
      case 'SubagentStart': {
        const id = str(payload.agent_id)
        if (!s.turn.active || !id) return s
        return joined(s, id, str(payload.agent_type), now)
      }
      // Its work done, the member's class attack lands.
      case 'SubagentStop': {
        const id = str(payload.agent_id)
        const member = (s.party ?? []).find(m => m.id === id)
        if (!s.turn.active || !member || member.doneAt !== null) return s
        const party = s.party.map(m => (m.id === id ? { ...m, doneAt: now } : m))
        return hit({ ...s, party }, { name: CLASS_SKILLS[member.cls], at: now, party: true, by: id }, now, awards)
      }
      case 'Notification':
      case 'Elicitation':
        return { ...s, calledAt: now }
      default:
        return s
    }
  })()
  return { story, awards }
}

// The road past `x` is the zone `to`; a trip not yet left rests at that zone's spots.
export function passGate(s: Story, to: ZoneId, x: number): Story {
  return { ...s, zone: to, gate: { x, from: s.zone ?? 'forest' }, trip: s.trip && s.trip.leftAt === null ? { ...s.trip, zone: to } : s.trip }
}

// `☐ 2/5 fix login`: the task list as a quest, led by the task in progress, or the next one up.
export function questOf(s: Story): string | null {
  const tasks = s.tasks ?? []
  const done = tasks.filter(task => task.status === 'completed').length
  const next = tasks.find(task => task.status === 'in_progress') ?? tasks.find(task => task.status === 'pending')
  return next ? `☐ ${done}/${tasks.length} ${next.subject}` : null
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
