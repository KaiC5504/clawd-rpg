import { describe, expect, test } from 'claude-code/testing'

import {
  COUNTER_MS,
  DOWN_MS,
  FINISHER_MS,
  FLEE_MS,
  NO_STORY,
  VICTORY_MS,
  beatOf,
  lootName,
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
