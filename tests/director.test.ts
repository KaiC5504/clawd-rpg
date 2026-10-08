import { describe, expect, test } from 'claude-code/testing'

import {
  BOSS_HP,
  COUNTER_MS,
  DOWN_MS,
  FINISHER_MS,
  FLEE_MS,
  NO_STORY,
  ROSTERS,
  VICTORY_MS,
  beatOf,
  classOf,
  lootName,
  passGate,
  questOf,
  step,
  withLevelUp,
} from '../hooks/rpg/director'
import type { HookPayload, Story } from '../hooks/rpg/director'
import type { Award } from '../hooks/rpg/progress'

const T0 = 1_000_000

// Plays events one second apart and collects the awards; `at` is the time of the last event.
function play(events: [string, HookPayload][], from: Story = NO_STORY) {
  let story = from
  const awards: Award[] = []
  let at = T0
  for (const [event, payload] of events) {
    at += 1000
    const r = step(story, event, payload, at)
    story = r.story
    awards.push(...r.awards)
  }
  return { story, awards, at }
}

let ids = 0
const pre = (tool_name: string, tool_input: HookPayload) => ['PreToolUse', { tool_name, tool_input, tool_use_id: `t${++ids}` }] as [string, HookPayload]
const post = (payload: HookPayload, failed = false) => [failed ? 'PostToolUseFailure' : 'PostToolUse', { tool_use_id: `t${ids}`, ...payload }] as [string, HookPayload]
const prompt: [string, HookPayload] = ['UserPromptSubmit', { prompt: 'go' }]
const edit = (file = 'D:/src/app/scenes.ts') => pre('Edit', { file_path: file, old_string: 'a', new_string: 'b' })
const tests = () => pre('Bash', { command: 'npm test' })
const testsFailed = (n: number) => post({ tool_response: { stdout: `Tests  ${n} failed | 4 passed (${n + 4})`, stderr: '' } })
const testsPassed = () => post({ tool_response: { stdout: 'Tests  6 passed (6)', stderr: '' } })
const done: [string, HookPayload] = ['TurnEnded', { reason: 'answer' }]

describe('walking and fighting', () => {
  test('a prompt starts the walk; reading keeps walking', () => {
    const { story, at } = play([prompt, pre('Read', { file_path: 'a.ts' }), pre('Grep', { pattern: 'x' })])
    expect(story.foe).toBeNull()
    expect(beatOf(story, at)).toBe('walk')
  })

  test('an edit brings a foe from the forest roster and lands a skill on it', () => {
    const { story, at } = play([prompt, edit()])
    expect(['goblin', 'shroom']).toContain(story.foe?.kind)
    expect(story.foe!.maxHp).toBeGreaterThanOrEqual(2)
    expect(story.foe!.maxHp).toBeLessThanOrEqual(4)
    expect(story.foe!.hp).toBe(story.foe!.maxHp - 1)
    expect(story.skill).toEqual({ name: 'CLAW STRIKE', at })
    expect(beatOf(story, at)).toBe('encounter')
  })

  test('each kind of call is its own skill', () => {
    const name = (e: [string, HookPayload]) => play([prompt, e]).story.skill?.name
    expect(name(pre('Write', { file_path: 'a.ts', content: 'x' }))).toBe('SCRIBE SLASH')
    expect(name(pre('Bash', { command: 'git status' }))).toBe('SHELL SHOCK')
    expect(name(pre('mcp__github__get_issue', {}))).toBe('LINK BEAM')
    expect(name(pre('Read', { file_path: 'a.ts' }))).toBeUndefined()
  })

  test('two to four blows defeat a foe, which is a battle won', () => {
    const { story, awards, at } = play([prompt, edit(), edit(), edit(), edit()])
    expect(awards.filter(a => a.kind === 'battle').length).toBeGreaterThanOrEqual(1)
    expect(awards[0]!.foe).toBe(story.down!.kind)
    expect(story.turn.gained).toBe(10 * awards.length)
    expect(beatOf(story, at + DOWN_MS)).toBe(story.foe ? 'encounter' : 'walk')
  })
})

describe('tests: the enemy turn and the finisher', () => {
  test('a failing run is the enemy turn: COUNTER with the failure count, and an elite stands', () => {
    const { story, at } = play([prompt, edit(), tests(), testsFailed(3)])
    expect(story.counter).toEqual({ n: 3, at })
    expect(story.foe?.elite).toBe(true)
    expect(beatOf(story, at)).toBe('enemyTurn')
    expect(beatOf(story, at + COUNTER_MS)).toBe('encounter')
  })

  test('fix edits wear the elite down but cannot finish it', () => {
    const { story } = play([prompt, edit(), tests(), testsFailed(1), edit(), edit(), edit(), edit(), edit()])
    expect(story.foe).toMatchObject({ elite: true, hp: 1 })
  })

  test('a passing run is the ALL-OUT ATTACK that finishes the elite', () => {
    const { story, awards, at } = play([prompt, edit(), tests(), testsFailed(2), edit(), tests(), testsPassed()])
    expect(story.foe).toBeNull()
    expect(story.down).toMatchObject({ finisher: true, at })
    expect(awards.at(-1)!.kind).toBe('elite')
    expect(beatOf(story, at)).toBe('finisher')
    expect(beatOf(story, at + FINISHER_MS)).toBe('walk')
  })

  test('a failing run with nothing in the way brings an elite of its own', () => {
    const { story } = play([prompt, tests(), testsFailed(1)])
    expect(story.foe?.elite).toBe(true)
  })

  test('a tool error is a counter too, with no elite', () => {
    const { story, at } = play([prompt, edit(), pre('Bash', { command: 'ls nope' }), post({ error: 'No such file' }, true)])
    expect(story.counter).toEqual({ n: 1, at })
    expect(story.foe?.elite).toBe(false)
  })

  test('a result reported twice settles once', () => {
    const { story } = play([prompt, edit(), tests(), testsFailed(2), testsFailed(2)])
    expect(story.counter?.n).toBe(2)
    expect(Object.keys(story.calls)).not.toContain(`t${ids}`)
  })
})

describe('the end of a turn', () => {
  test('a finished turn is a victory: the foe still standing falls, loot is named after the file edited most', () => {
    const { story, awards, at } = play([prompt, edit('D:/a/band.tsx'), edit('D:/a/scenes.ts'), edit('D:/a/scenes.ts'), done])
    expect(awards.at(-1)).toEqual({ kind: 'turn' })
    expect(story.victory?.loot).toMatch(/ of scenes\.ts$/)
    expect(story.victory?.gained).toBe(awards.reduce((n, a) => n + ({ battle: 10, elite: 25, raid: 60, turn: 5 })[a.kind], 0))
    expect(beatOf(story, at)).toBe('victory')
    expect(beatOf(story, at + VICTORY_MS)).toBe('idle')
  })

  test('an elite left standing at the end flees instead of falling', () => {
    const { story, awards } = play([prompt, edit(), tests(), testsFailed(1), done])
    expect(awards.map(a => a.kind)).toEqual(['turn'])
    expect(story.fled?.kind).toBeDefined()
  })

  test('an interrupt skids him to a stop and the foe flees: no victory, no EXP', () => {
    const { story, awards, at } = play([prompt, edit(), ['TurnEnded', { reason: 'aborted' }]])
    expect(story.victory).toBeNull()
    expect(awards).toEqual([])
    expect(beatOf(story, at)).toBe('flee')
    expect(beatOf(story, at + FLEE_MS)).toBe('idle')
  })

  test('a turn ends once, however many hooks say so', () => {
    const { awards } = play([prompt, done, done, ['TurnEnded', { reason: 'answer' }]])
    expect(awards).toEqual([{ kind: 'turn' }])
  })

  test('a turn with no fight still has a trophy', () => {
    expect(play([prompt, done]).story.victory?.loot).toBe('Forest Herb')
    expect(lootName({}, 'goblin')).toBe('Goblin Fang')
  })
})

describe('everything else', () => {
  test('Claude needing you is a call he answers wherever he is', () => {
    const { story, at } = play([prompt, ['Notification', { message: 'needs approval' }]])
    expect(story.calledAt).toBe(at)
  })

  test('a level-up is kept across the next prompt so its flash can finish', () => {
    const up = withLevelUp(NO_STORY, 4, T0)
    expect(step(up, 'UserPromptSubmit', {}, T0 + 10).story.levelUp).toEqual({ level: 4, at: T0 })
  })

  test('the same events always tell the same story', () => {
    const events = [prompt, edit(), edit(), tests(), testsFailed(1), done]
    expect(play(events).story).toEqual(play(events).story)
  })
})

const ended = (roadAt: number, reason = 'answer'): [string, HookPayload] => ['TurnEnded', { reason, roadAt }]

describe('resting between turns', () => {
  test('a finished turn starts a trip from where he stopped on the road', () => {
    const { story, at } = play([prompt, edit(), ended(340)])
    expect(story.trip).toEqual({ origin: 340, at, compactAt: null, leftAt: null, zone: 'forest' })
  })

  test('an interrupted turn sends him resting too', () => {
    expect(play([prompt, edit(), ended(12, 'aborted')]).story.trip?.origin).toBe(12)
  })

  test('a new session starts him resting where the road left off', () => {
    expect(step(NO_STORY, 'SessionStart', { source: 'startup', roadAt: 90 }, T0).story.trip).toEqual({ origin: 90, at: T0, compactAt: null, leftAt: null, zone: 'forest' })
  })

  test('a prompt calls him back: the trip is left, and kept for the road behind him', () => {
    const { story, at } = play([['SessionStart', { source: 'startup', roadAt: 0 }], prompt])
    expect(story.trip).toMatchObject({ origin: 0, leftAt: at })
    expect(story.turn.active).toBe(true)
  })

  test("the next turn's trip starts where he stopped, and the last one becomes the trail", () => {
    const { story } = play([['SessionStart', { source: 'startup', roadAt: 0 }], prompt, edit(), ended(500)])
    expect(story.trail).toMatchObject({ origin: 0 })
    expect(story.trip).toMatchObject({ origin: 500, leftAt: null })
  })

  test('compacting while he rests sends him on to the inn, once', () => {
    const { story } = play([prompt, ended(0), ['Compact', {}], ['Compact', {}]])
    expect(story.trip?.compactAt).toBe(T0 + 3000)
  })

  test('compacting mid-turn changes nothing', () => {
    const { story } = play([prompt, edit()])
    expect(step(story, 'Compact', {}, T0 + 9000).story).toBe(story)
  })
})

describe('the quest line', () => {
  const created = (id: string, subject: string): [string, HookPayload] => ['TaskCreated', { task_id: id, task_subject: subject }]
  const completed = (id: string): [string, HookPayload] => ['TaskCompleted', { task_id: id, task_subject: '' }]

  test('created and completed tasks make the quest line: done of total, then the next one up', () => {
    const { story } = play([prompt, created('1', 'read the spec'), created('2', 'fix login'), created('3', 'ship it'), completed('1')])
    expect(questOf(story)).toBe('☐ 1/3 fix login')
  })

  test('TodoWrite hands over the whole list, and the task in progress leads', () => {
    const todos = [
      { content: 'read the spec', status: 'completed' },
      { content: 'add tests', status: 'pending' },
      { content: 'fix login', status: 'in_progress' },
    ]
    expect(questOf(play([prompt, pre('TodoWrite', { todos })]).story)).toBe('☐ 1/3 fix login')
  })

  test('TaskUpdate moves a task along, and deleting one drops it', () => {
    const { story } = play([
      prompt,
      created('1', 'a'),
      created('2', 'b'),
      pre('TaskUpdate', { taskId: '2', status: 'in_progress' }),
      pre('TaskUpdate', { taskId: '1', status: 'deleted' }),
    ])
    expect(questOf(story)).toBe('☐ 0/1 b')
  })

  test('with no tasks, or all of them done, there is no quest line', () => {
    expect(questOf(NO_STORY)).toBeNull()
    expect(questOf(play([prompt, created('1', 'a'), completed('1')]).story)).toBeNull()
  })

  test('tasks outlast a prompt but not a new session', () => {
    const { story } = play([prompt, created('1', 'a'), prompt])
    expect(questOf(story)).toBe('☐ 0/1 a')
    expect(questOf(step(story, 'SessionStart', { source: 'clear' }, T0 + 9000).story)).toBeNull()
  })
})

describe('pace', () => {
  test('the last three tool calls are remembered, and a prompt forgets them', () => {
    const { story, at } = play([prompt, edit(), edit(), edit(), edit()])
    expect(story.turn.recent).toEqual([at - 2000, at - 1000, at])
    expect(step(story, 'UserPromptSubmit', {}, at + 1).story.turn.recent).toEqual([])
  })
})

const bossPrompt = (zone = 'forest'): [string, HookPayload] => ['UserPromptSubmit', { prompt: 'go', zone, boss: true }]
const inZone = (zone: string): [string, HookPayload] => ['UserPromptSubmit', { prompt: 'go', zone }]

describe('zones', () => {
  test('each zone sends its own foes', () => {
    const kinds = (zone: string) =>
      new Set(Array.from({ length: 12 }, (_, i) => play([['SessionStart', { source: 'startup', zone }], inZone(zone), ...Array.from({ length: i }, () => pre('Read', {})), edit()]).story.foe?.kind))
    expect([...kinds('forest')].every(k => ROSTERS.forest.includes(k!))).toBe(true)
    expect([...kinds('dungeon')].every(k => ['slime', 'skeleton'].includes(k!))).toBe(true)
    expect([...kinds('neon')].every(k => ['drone', 'bug'].includes(k!))).toBe(true)
  })

  test('a new session starts in the zone his progress is in; the trip there rests at its own spot', () => {
    const { story } = play([['SessionStart', { source: 'startup', zone: 'neon', roadAt: 40 }]])
    expect(story.zone).toBe('neon')
    expect(story.trip?.zone).toBe('neon')
    expect(story.gate).toBeNull()
  })

  test('a story saved before zones existed is in the forest', () => {
    const { zone: _zone, gate: _gate, party: _party, ...old } = NO_STORY
    const { story } = play([prompt, edit()], { ...NO_STORY, ...(old as Story) })
    expect(story.zone).toBe('forest')
    expect(['goblin', 'shroom']).toContain(story.foe?.kind)
  })

  test("a gate stands on the road where he crosses into the next zone, and the trip's spots are the new zone's", () => {
    const { story } = play([prompt, ended(500)])
    const crossed = passGate(story, 'dungeon', 566)
    expect(crossed.zone).toBe('dungeon')
    expect(crossed.gate).toEqual({ x: 566, from: 'forest' })
    expect(crossed.trip?.zone).toBe('dungeon')
  })

  test('the zone and its gate outlast a prompt', () => {
    const crossed = passGate(play([prompt, ended(500)]).story, 'neon', 566)
    const { story } = play([inZone('neon'), edit()], crossed)
    expect(story.zone).toBe('neon')
    expect(story.gate).toEqual({ x: 566, from: 'forest' })
    expect(['drone', 'bug']).toContain(story.foe?.kind)
  })
})

describe('bosses', () => {
  test("on a boss turn the first foe is the zone's boss, with six hit points", () => {
    for (const [zone, boss] of [['forest', 'treant'], ['dungeon', 'hydra'], ['neon', 'mech']] as const) {
      const { story } = play([['SessionStart', { source: 'startup', zone }], bossPrompt(zone), edit()])
      expect(story.foe).toMatchObject({ kind: boss, boss: true, maxHp: BOSS_HP, hp: BOSS_HP - 1 })
    }
  })

  test('six blows bring it down: a raid that clears the zone, and the foes after it are ordinary', () => {
    const { story, awards } = play([bossPrompt(), ...Array.from({ length: 6 }, () => edit()), edit()])
    expect(awards).toContainEqual({ kind: 'raid', foe: 'treant', boss: true })
    expect(story.turn.bossDown).toBe('treant')
    expect(['goblin', 'shroom']).toContain(story.foe?.kind)
  })

  test("a passing run finishes the boss, and the victory's loot is the boss's", () => {
    const { story, awards } = play([bossPrompt(), edit(), tests(), testsFailed(2), edit(), tests(), testsPassed(), done])
    expect(awards).toContainEqual({ kind: 'raid', foe: 'treant', boss: true })
    expect(story.victory?.loot).toBe('Treant Heartwood')
  })

  test('the boss still standing when the turn is done falls too', () => {
    const { awards } = play([['SessionStart', { source: 'startup', zone: 'dungeon' }], bossPrompt('dungeon'), edit(), done])
    expect(awards).toContainEqual({ kind: 'raid', foe: 'hydra', boss: true })
  })

  test('an interrupt lets the boss flee, and the next boss prompt brings it back', () => {
    const first = play([bossPrompt(), edit(), ['TurnEnded', { reason: 'aborted' }]])
    expect(first.awards).toEqual([])
    expect(first.story.fled?.kind).toBe('treant')
    expect(play([bossPrompt(), edit()], first.story).story.foe?.kind).toBe('treant')
  })

  test('not a boss turn: no boss', () => {
    expect(play([prompt, ...Array.from({ length: 8 }, () => edit())]).awards.some(a => a.boss)).toBe(false)
  })
})

const joins = (agent_id: string, agent_type: string): [string, HookPayload] => ['SubagentStart', { agent_id, agent_type }]
const leaves = (agent_id: string, agent_type = 'general-purpose'): [string, HookPayload] => ['SubagentStop', { agent_id, agent_type }]
const theirs = (agent_id: string, tool_name: string, tool_input: HookPayload) =>
  ['PreToolUse', { tool_name, tool_input, tool_use_id: `t${++ids}`, agent_id, agent_type: 'Explore' }] as [string, HookPayload]

describe('the party', () => {
  test('subagents join as mini Clawds with a class from their job', () => {
    const { story } = play([prompt, joins('a1', 'Explore'), joins('a2', 'Plan'), joins('a3', 'general-purpose'), joins('a4', 'code-reviewer')])
    expect(story.party.map(m => m.cls).slice(0, 3)).toEqual(['scout', 'mage', 'knight'])
    expect(['knight', 'mage', 'scout']).toContain(story.party[3]!.cls)
    expect(classOf('code-reviewer')).toBe(classOf('code-reviewer'))
  })

  test('joining twice is joining once', () => {
    expect(play([prompt, joins('a1', 'Explore'), joins('a1', 'Explore')]).story.party).toHaveLength(1)
  })

  test('a subagent finishing lands its class attack on the foe', () => {
    const { story, at } = play([prompt, edit(), joins('a1', 'Plan'), leaves('a1', 'Plan')])
    expect(story.skill).toEqual({ name: 'ARCANE BOLT', at, party: true, by: 'a1' })
    expect(story.party[0]!.doneAt).toBe(at)
  })

  test("a subagent's edit is its own attack, not Clawd's", () => {
    const { story, at } = play([prompt, joins('a1', 'Explore'), theirs('a1', 'Edit', { file_path: 'D:/a/x.ts' })])
    expect(story.skill).toEqual({ name: 'QUICK SHOT', at, party: true, by: 'a1' })
    expect(story.foe).not.toBeNull()
  })

  test("a subagent's reads and plans don't fight or replace the quest", () => {
    const before = play([prompt, ['TaskCreated', { task_id: '1', task_subject: 'mine' }], joins('a1', 'Explore')])
    const { story } = play([theirs('a1', 'Read', { file_path: 'a.ts' }), theirs('a1', 'TodoWrite', { todos: [{ content: 'theirs', status: 'in_progress' }] })], before.story)
    expect(story.foe).toBeNull()
    expect(story.tasks.map(t => t.subject)).toEqual(['mine'])
  })

  test('a subagent that outlives the turn changes nothing when it stops', () => {
    const { story } = play([prompt, joins('a1', 'Explore'), done])
    const later = step(story, 'SubagentStop', { agent_id: 'a1', agent_type: 'Explore' }, T0 + 99_000).story
    expect(later.foe).toBeNull()
    expect(later.skill).toEqual(story.skill)
    expect(step(story, 'SubagentStart', { agent_id: 'a9', agent_type: 'Explore' }, T0 + 99_000).story.party).toEqual(story.party)
  })

  test('a turn with a party is a raid; the next prompt starts with no party', () => {
    const { story, awards } = play([prompt, joins('a1', 'Explore'), done])
    expect(awards).toEqual([{ kind: 'raid' }, { kind: 'turn' }])
    expect(story.victory?.gained).toBe(65)
    expect(play([prompt], story).story.party).toEqual([])
  })
})
