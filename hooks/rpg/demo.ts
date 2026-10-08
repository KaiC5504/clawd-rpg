import type { RpgStats, ZoneId } from '../../types'
import { NO_STORY, VICTORY_MS, passGate, step, withLevelUp } from './director'
import type { HookPayload, Story } from './director'
import type { Scene } from './frame'
import { DOZE_MS, GATE_AFTER, goalOf } from './road'

type Event = [string, HookPayload]

// The demo's own clock, far from any real session's, so nothing it shows is mistaken for one.
const T0 = 2_000_000_000
const WALK_AT = 4000
const STATS: RpgStats = { level: 7, exp: 0.62, hp: 0.82, mp: 0.64, place: 'clawd-rpg/main' }
const LEVELLED: RpgStats = { ...STATS, level: 8, exp: 0.08 }

// Events a second apart from `from`; `at` is when the last one happened.
function tell(events: Event[], from: number, story: Story = NO_STORY): { story: Story; at: number } {
  let at = from
  for (const [event, payload] of events) story = step(story, event, payload, (at += 1000)).story
  return { story, at }
}

const start = (zone: ZoneId): Event => ['SessionStart', { source: 'startup', zone, roadAt: 0 }]
const prompt = (boss = false): Event => ['UserPromptSubmit', { boss }]
const edit = (id: string, file = 'scenes.ts'): Event => ['PreToolUse', { tool_name: 'Edit', tool_input: { file_path: `src/${file}` }, tool_use_id: id }]
const testRun = (id: string): Event => ['PreToolUse', { tool_name: 'Bash', tool_input: { command: 'npm test' }, tool_use_id: id }]
const result = (id: string, stdout: string): Event => ['PostToolUse', { tool_use_id: id, tool_response: { stdout, stderr: '' } }]
const joins = (id: string, type: string): Event => ['SubagentStart', { agent_id: id, agent_type: type }]
const leaves = (id: string, type: string): Event => ['SubagentStop', { agent_id: id, agent_type: type }]
const ended = (roadAt: number, reason = 'answer'): Event => ['TurnEnded', { reason, roadAt }]
const task = (id: string, subject: string): Event => ['TaskCreated', { task_id: id, task_subject: subject }]
const taskDone = (id: string, subject: string): Event => ['TaskCompleted', { task_id: id, task_subject: subject }]

// `make` builds a scene's story once for a width; `into` is how far into the scene a frame is.
export type DemoScene = { name: string; ms: number; make: (from: number, width: number) => (into: number) => Scene }

const walking = (story: Story, t0: number, width: number, stats = STATS) => (into: number): Scene => ({
  width,
  t: t0 + into,
  distance: WALK_AT + Math.floor(into / 160),
  isWalking: true,
  stats,
  story,
})

const standing = (story: Story, t0: number, width: number, stats = STATS) => (into: number): Scene => ({ width, t: t0 + into, distance: WALK_AT, isWalking: false, stats, story })

// At the spot his trip has reached by `t0` (the pier, the zone's own spot, the inn).
function restingAt(story: Story, t0: number, width: number, stats = STATS) {
  const distance = goalOf(story, t0, width)?.from ?? 0
  return (into: number): Scene => ({ width, t: t0 + into, distance, isWalking: false, stats, story })
}

function fight(zone: ZoneId, from: number) {
  return tell([start(zone), prompt(), edit('e1')], from)
}

function bossFight(from: number) {
  return tell([start('forest'), prompt(true), edit('e1'), edit('e2')], from)
}

function wonBoss(from: number) {
  const won = tell([start('forest'), prompt(true), edit('e1'), edit('e2'), ended(WALK_AT)], from)
  return { story: withLevelUp(won.story, 8, won.at), at: won.at }
}

function afterTurn(zone: ZoneId, from: number) {
  return tell([start(zone), prompt(), ended(0)], from)
}

export const DEMO: readonly DemoScene[] = [
  {
    name: 'Walking: Claude reads and thinks',
    ms: 4000,
    make: (from, width) => {
      const { story, at } = tell([start('forest'), prompt(), task('1', 'read the spec'), task('2', 'fix the login form'), task('3', 'run the tests'), taskDone('1', 'read the spec')], from)
      return walking(story, at, width)
    },
  },
  {
    name: 'An edit: CLAW STRIKE',
    ms: 3200,
    make: (from, width) => {
      const { story, at } = fight('forest', from)
      return standing(story, at, width)
    },
  },
  {
    name: 'A failing test: the enemy turn',
    ms: 2400,
    make: (from, width) => {
      const { story, at } = tell([start('forest'), prompt(), edit('e1'), testRun('t1'), result('t1', 'Tests  2 failed | 4 passed (6)')], from)
      return standing(story, at, width)
    },
  },
  {
    name: 'Tests pass: ALL-OUT ATTACK',
    ms: 2800,
    make: (from, width) => {
      const events = [start('forest'), prompt(), edit('e1'), testRun('t1'), result('t1', 'Tests  2 failed (2)'), edit('e2'), testRun('t2'), result('t2', 'Tests  6 passed (6)')]
      const { story, at } = tell(events, from)
      return standing(story, at, width)
    },
  },
  {
    name: 'Subagents join the party',
    ms: 3600,
    make: (from, width) => {
      const { story, at } = tell([start('forest'), prompt(), joins('a1', 'general-purpose'), joins('a2', 'Plan'), joins('a3', 'Explore')], from)
      return walking(story, at - 2000, width)
    },
  },
  {
    name: "A subagent's work lands: ARCANE BOLT",
    ms: 2400,
    make: (from, width) => {
      const { story, at } = tell([start('forest'), prompt(), joins('a1', 'general-purpose'), joins('a2', 'Plan'), edit('e1'), leaves('a2', 'Plan')], from)
      return standing(story, at, width)
    },
  },
  {
    name: 'An interrupt: the foe flees',
    ms: 1800,
    make: (from, width) => {
      const { story, at } = tell([start('forest'), prompt(), edit('e1'), ended(WALK_AT, 'aborted')], from)
      return standing(story, at, width)
    },
  },
  {
    name: 'Waiting for you: the pier',
    ms: 4000,
    make: (from, width) => {
      const { story, at } = afterTurn('forest', from)
      return restingAt(story, at + VICTORY_MS + 1000, width)
    },
  },
  {
    name: 'Claude needs you',
    ms: 2000,
    make: (from, width) => {
      const after = afterTurn('forest', from)
      const { story, at } = tell([['Notification', {}]], after.at + VICTORY_MS, after.story)
      return restingAt(story, at, width)
    },
  },
  {
    name: 'A minute idle: the campfire',
    ms: 3600,
    make: (from, width) => {
      const { story, at } = afterTurn('forest', from)
      return restingAt(story, at + DOZE_MS + 1000, width)
    },
  },
  {
    name: 'The zone meter is full: the Treant',
    ms: 4000,
    make: (from, width) => {
      const { story, at } = bossFight(from)
      return standing(story, at - 1000, width)
    },
  },
  {
    name: 'Victory, loot and a level',
    ms: 4400,
    make: (from, width) => {
      const { story, at } = wonBoss(from)
      return standing(story, at, width)
    },
  },
  {
    name: 'Zone clear: through the gate',
    ms: 4000,
    make: (from, width) => {
      const { story, at } = wonBoss(from)
      const crossed = passGate(story, 'dungeon', WALK_AT + GATE_AFTER)
      return (into: number): Scene => ({ width, t: at + VICTORY_MS + into, distance: WALK_AT + Math.floor(into / 80), isWalking: true, stats: LEVELLED, story: crossed })
    },
  },
  {
    name: 'The Dungeon',
    ms: 3200,
    make: (from, width) => {
      const { story, at } = fight('dungeon', from)
      return standing(story, at, width, LEVELLED)
    },
  },
  {
    name: "The Dungeon's crystal room",
    ms: 3600,
    make: (from, width) => {
      const { story, at } = afterTurn('dungeon', from)
      return restingAt(story, at + DOZE_MS + 1000, width, LEVELLED)
    },
  },
  {
    name: 'Neon City',
    ms: 3200,
    make: (from, width) => {
      const { story, at } = fight('neon', from)
      return standing(story, at, width, LEVELLED)
    },
  },
  {
    name: "Neon City's ramen stall",
    ms: 3600,
    make: (from, width) => {
      const { story, at } = afterTurn('neon', from)
      return restingAt(story, at + DOZE_MS + 1000, width, LEVELLED)
    },
  },
  {
    name: 'A compaction: the inn',
    ms: 4000,
    make: (from, width) => {
      const { story, at } = tell([start('neon'), prompt(), ended(0), ['Compact', {}]], from)
      return restingAt(story, at + VICTORY_MS, width, { ...LEVELLED, hp: 0.95 })
    },
  },
]

export const DEMO_MS = DEMO.reduce((n, d) => n + d.ms, 0)

// The demo `ms` in (looping), at a width: the scene's name and what to draw.
export function demoScene(ms: number, width: number): { name: string; scene: Scene } {
  let into = ((ms % DEMO_MS) + DEMO_MS) % DEMO_MS
  for (const [i, d] of DEMO.entries()) {
    if (into < d.ms) return { name: d.name, scene: d.make(T0 + i * 10_000_000, width)(into) }
    into -= d.ms
  }
  return { name: DEMO[0]!.name, scene: DEMO[0]!.make(T0, width)(0) }
}
