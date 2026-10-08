import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const NOW = Date.parse('2026-10-09T10:00:00Z')
const TYPED_RPG = {
  command: 'rpg',
  args: '',
  origin: { kind: 'composer' as const },
  presentation: { isFullscreen: false, columns: 150 },
}

type Usage = { context: { window: number; tokens: number; percent: number }; rateLimits: { kind: string; percentUsed: number }[] }

function fakeSession(
  on: On,
  blits: string[],
  usage: Usage | 'fails' = { context: { window: 200000, tokens: 24000, percent: 12 }, rateLimits: [] },
  repo = { cwd: 'C:/src/my-app', branch: 'main' },
  saved: Record<string, unknown> = {},
) {
  mock.env(on, { USERPROFILE: '/Users/tester' })
  // The plugin's store, kept here so tests can read what was saved.
  const store = new Map<string, unknown>(Object.entries(saved))
  on('store.get', ($, e) => ({ value: store.get(e.key) }))
  on('store.set', ($, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('process.run', () => ({ value: { exitCode: 0, stdout: `${repo.branch}\n`, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('session.id', () => ({ value: 's1' }))
  on('session.cwd', () => ({ value: repo.cwd }))
  on('session.usage', () => {
    if (usage === 'fails') throw new Error('no usage yet')
    return { value: { startedAt: 0, ...usage } }
  })
  on('classic.SessionStart', () => ({}))
  on('classic.UserPromptSubmit', () => ({}))
  on('ui.blit', ($, e) => {
    if ('cells' in e) blits.push(e.cells)
    return { value: {} }
  })
  // What Claude Code shows when the band steps aside.
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text key="beneath">nothing above the prompt</Text>
  })
  return store
}

const band = (bodyColumns: number, isWorking = false) => ({
  component: 'AbovePrompt' as const,
  props: { hasSurvey: false, isWorking, maxRows: 20, bodyColumns, scroll: { offset: 0, bodyRows: 20 }, view: {} },
})

// A base64 Raster of w × 5 cells, 12 bytes a cell.
const cellsFor = (w: number) => Math.ceil((w * 5 * 12) / 3) * 4

// The characters on the band's bottom row, where the HUD lives.
function hudRow(cells: string, w: number): string {
  const words = new Uint32Array(Uint8Array.from(atob(cells), c => c.charCodeAt(0)).buffer)
  let row = ''
  for (let col = 0; col < w; col++) row += String.fromCodePoint(words[(4 * w + col) * 3]!)
  return row
}

// The bottom row's cell at a column as `glyph fg bg`: the ground, two pixels tall.
function groundCell(cells: string, w: number, col: number): string {
  const words = new Uint32Array(Uint8Array.from(atob(cells), c => c.charCodeAt(0)).buffer)
  return Array.from(words.slice((4 * w + col) * 3, (4 * w + col) * 3 + 3)).join(' ')
}

test('the forest scrolls exactly one pixel a frame, so the walk never hitches', async ($, on) => {
  const blits: string[] = []
  const clock = mock.clock(on, { now: NOW })
  fakeSession(on, blits)
  await $.classic.SessionStart({ source: 'startup' })
  await clock.settle()
  const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(150, true) })
  for (let i = 0; i < 24; i++) await clock.advance(160)
  expect(blits.length).toBeGreaterThan(20)
  for (let i = 1; i < blits.length; i++) {
    for (let x = 0; x < 40; x++) expect(groundCell(blits[i]!, 150, x)).toBe(groundCell(blits[i - 1]!, 150, x + 1))
  }
  await t.unmount()
})

for (const [kind, repo] of [
  ['wide', { cwd: 'C:/src/我的项目', branch: 'main' }],
  ['emoji', { cwd: 'C:/src/my-app', branch: 'feat/🚀' }],
  ['combining', { cwd: 'C:/src/cafe\u0301', branch: 'main' }],
] as const) {
  test(`a repo or branch name with ${kind} characters keeps the band`, async ($, on) => {
    const clock = mock.clock(on, { now: NOW })
    fakeSession(on, [], undefined, { ...repo })
    await $.classic.SessionStart({ source: 'startup' })
    await clock.settle()
    const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(200) })
    expect(await t.find({ type: 'Raster', key: 'rpg' })).toBeDefined()
    await t.unmount()
  })
}

test('the desktop redrawing does not stop Clawd walking in the terminal', async ($, on) => {
  const blits: string[] = []
  const clock = mock.clock(on, { now: NOW })
  fakeSession(on, blits)
  await $.classic.SessionStart({ source: 'startup' })
  await clock.settle()
  const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(150, true) })
  await clock.advance(640)
  const d = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'desktop', ...band(150, true) })
  blits.length = 0
  await clock.advance(1600)
  expect(blits.length).toBeGreaterThan(3)
  await d.unmount()
  await t.unmount()
})

test('the HUD follows a branch switch at the next prompt', async ($, on) => {
  const repo = { cwd: 'C:/src/my-app', branch: 'main' }
  const clock = mock.clock(on, { now: NOW })
  fakeSession(on, [], undefined, repo)
  await $.classic.SessionStart({ source: 'startup' })
  await clock.settle()
  const a = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(200) })
  expect(hudRow(String((await a.find({ type: 'Raster', key: 'rpg' }))?.props.cells), 200)).toContain('my-app/main')
  await a.unmount()
  repo.branch = 'feat/x'
  await $.classic.UserPromptSubmit({ prompt: 'carry on' })
  await clock.settle()
  const b = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(200) })
  expect(hudRow(String((await b.find({ type: 'Raster', key: 'rpg' }))?.props.cells), 200)).toContain('my-app/feat/x')
  await b.unmount()
})

test('the band is one 5-row Raster as wide as the terminal, HUD glyphs and all', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  fakeSession(on, [])
  await $.classic.SessionStart({ source: 'startup' })
  await clock.settle()
  for (const w of [40, 100, 160, 300]) {
    const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(w) })
    const r = await t.find({ type: 'Raster', key: 'rpg' })
    expect([r?.props.columns, r?.props.rows]).toEqual([w, 5])
    expect(String(r?.props.cells).length).toBe(cellsFor(w))
    await t.unmount()
  }
})

test('below 40 columns the band steps aside', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  fakeSession(on, [])
  await $.classic.SessionStart({ source: 'startup' })
  await clock.settle()
  const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(39) })
  expect(await t.find({ type: 'Raster' })).toBeUndefined()
  await t.unmount()
})

test('while Claude works he walks: frames are sent every 160 ms, only when they change', async ($, on) => {
  const blits: string[] = []
  const clock = mock.clock(on, { now: NOW })
  fakeSession(on, blits)
  await $.classic.SessionStart({ source: 'startup' })
  await clock.settle()
  const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(150, true) })
  await clock.advance(1600)
  expect(blits.length).toBeGreaterThan(3)
  expect(blits.length).toBeLessThanOrEqual(10)
  expect(new Set(blits).size).toBe(blits.length)
  await t.unmount()
})

test('after a resize the timer paints the new width', async ($, on) => {
  const blits: string[] = []
  const clock = mock.clock(on, { now: NOW })
  fakeSession(on, blits)
  await $.classic.SessionStart({ source: 'startup' })
  await clock.settle()
  const a = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(150, true) })
  await clock.advance(640)
  await a.unmount()
  blits.length = 0
  const b = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(220, true) })
  await clock.advance(640)
  expect(blits.length).toBeGreaterThan(0)
  for (const cells of blits) expect(cells.length).toBe(cellsFor(220))
  await b.unmount()
})

test('with no usage to read, the band still draws', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  fakeSession(on, [], 'fails')
  await $.classic.SessionStart({ source: 'startup' })
  await clock.advance(2000)
  const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(150) })
  expect(await t.find({ type: 'Raster', key: 'rpg' })).toBeDefined()
  await t.unmount()
})

test('/rpg hides the band and brings it back, and remembers', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  fakeSession(on, [])
  await $.classic.SessionStart({ source: 'startup' })
  await clock.settle()
  expect((await $.command.run(TYPED_RPG)).text).toContain('hidden')
  const empty = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(150) })
  expect(await empty.find({ type: 'Raster' })).toBeUndefined()
  await empty.unmount()
  expect((await $.command.run(TYPED_RPG)).text).toContain('back')
  const back = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(150) })
  expect(await back.find({ type: 'Raster', key: 'rpg' })).toBeDefined()
  await back.unmount()
})

test('the desktop gets nothing yet', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  fakeSession(on, [])
  await $.classic.SessionStart({ source: 'startup' })
  await clock.settle()
  const d = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'desktop', ...band(150) })
  expect(await d.find({ type: 'Svg' })).toBeUndefined()
  await d.unmount()
})

test('a broken store never blocks the prompt', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  on('store.get', () => {
    throw new Error('store is gone')
  })
  on('session.cwd', () => ({ value: 'C:/src/my-app' }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: 'main\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000, tokens: 0, percent: 0 }, rateLimits: [] } }))
  on('classic.SessionStart', () => ({}))
  on('classic.UserPromptSubmit', () => ({}))
  const started = await $.classic.SessionStart({ source: 'startup' })
  const submitted = await $.classic.UserPromptSubmit({ prompt: 'hi' })
  await clock.settle()
  expect(started).toEqual({})
  expect(submitted).toEqual({})
})

// KaiC's own terminal is 184 columns, where the band is 179 wide.
const WIDE = 179

const EDIT = { tool: 'Edit', file_path: 'C:/src/my-app/hooks/scenes.ts', old_string: 'a', new_string: 'b' }
const TESTS = { tool: 'Bash', command: 'npm test' }
const DONE = { answer: '', durationMs: 4000, isAborted: false, turnId: 't1', reason: 'answer' } as const

function rowText(cells: string, w: number, row: number): string {
  const words = new Uint32Array(Uint8Array.from(atob(cells), c => c.charCodeAt(0)).buffer)
  let text = ''
  for (let col = 0; col < w; col++) text += String.fromCodePoint(words[(row * w + col) * 3]!)
  return text
}

function colorsIn(cells: string): Set<number> {
  const words = new Uint32Array(Uint8Array.from(atob(cells), c => c.charCodeAt(0)).buffer)
  const seen = new Set<number>()
  for (let i = 0; i < words.length; i += 3) seen.add(words[i + 1]!).add(words[i + 2]!)
  return seen
}

// A session mid-turn: answers for the tools the tests call, and a band mounted at KaiC's width.
async function turn($: Parameters<Parameters<typeof test>[1]>[0], on: On, opts: { blits?: string[]; saved?: Record<string, unknown>; testOutput?: string; usage?: Usage } = {}) {
  const clock = mock.clock(on, { now: NOW })
  const store = fakeSession(on, opts.blits ?? [], opts.usage, undefined, opts.saved)
  on('tool.call', { tool: 'Edit' }, () => ({ result: {} }) as never)
  on('tool.call', { tool: 'Bash' }, () => ({ result: { stdout: opts.testOutput ?? 'Tests  6 passed (6)', stderr: '', interrupted: false } }) as never)
  on('turn.complete', () => ({ text: '' }))
  await $.classic.SessionStart({ source: 'startup' })
  await $.classic.UserPromptSubmit({ prompt: 'fix it' })
  await clock.settle()
  return { clock, store }
}

const raster = async (t: { find: (q: never) => Promise<{ props: { cells: unknown } } | undefined> }) => String((await t.find({ type: 'Raster', key: 'rpg' } as never))?.props.cells)

test('an edit brings a foe down from the trees and Clawd stops walking to fight it', async ($, on) => {
  const blits: string[] = []
  const { clock, store } = await turn($, on, { blits })
  await $.tool.call(EDIT as never)
  const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(WIDE, true) })
  await clock.advance(480)
  expect(rowText(blits.at(-1)!, WIDE, 2)).toContain('CLAW STRIKE')
  await clock.advance(1600)
  const colors = colorsIn(blits.at(-1)!)
  expect(colors.has(0x6fbf4e) || colors.has(0xd6453d)).toBe(true)
  const a = blits.at(-1)!
  await clock.advance(960)
  for (let x = 0; x < 20; x++) expect(groundCell(blits.at(-1)!, WIDE, x)).toBe(groundCell(a, WIDE, x))
  await t.unmount()
})

test('a failing test run is the enemy turn: COUNTER ✗2 crosses the band', async ($, on) => {
  const blits: string[] = []
  const { clock, store } = await turn($, on, { blits, testOutput: 'Tests  2 failed | 3 passed (5)' })
  await $.tool.call(EDIT as never)
  await $.tool.call(TESTS as never)
  const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(WIDE, true) })
  await clock.advance(640)
  expect(rowText(blits.at(-1)!, WIDE, 2)).toContain('COUNTER  ✗2')
  await t.unmount()
})

test('a finished turn is a victory: loot named after the file, and the EXP is saved', async ($, on) => {
  const { clock, store } = await turn($, on)
  await $.tool.call(EDIT as never)
  await $.turn.complete(DONE)
  await clock.advance(1000)
  const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(WIDE, true) })
  expect(rowText(await raster(t), WIDE, 0)).toMatch(/◆ \w+ of scenes\.ts · \+15 EXP/)
  expect(store.get('progress')).toMatchObject({ v: 1, level: 1, exp: 15, zoneMeter: 1 })
  await t.unmount()
})

test('crossing a level flashes LEVEL UP over the HUD, which shows the new level', async ($, on) => {
  const { clock, store } = await turn($, on, { saved: { progress: { v: 1, level: 1, exp: 70 } } })
  await $.tool.call(EDIT as never)
  await $.turn.complete(DONE)
  await clock.advance(500)
  const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(WIDE, true) })
  const cells = await raster(t)
  expect(rowText(cells, WIDE, 3)).toContain('LEVEL UP!  Lv.2')
  expect(rowText(cells, WIDE, 4)).toContain('Lv.2 ')
  await t.unmount()
})

test('his level follows him into every session', async ($, on) => {
  await turn($, on, { saved: { progress: { v: 1, level: 4, exp: 75 } } })
  const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(WIDE) })
  expect(rowText(await raster(t), WIDE, 4)).toContain('Lv.4 ▰▰▰▱▱')
  await t.unmount()
})

test('EXP another session earned meanwhile is kept, not overwritten', async ($, on) => {
  const { clock, store } = await turn($, on, { saved: { progress: { v: 1, level: 1, exp: 10 } } })
  store.set('progress', { v: 1, level: 1, exp: 40 })
  await $.tool.call(EDIT as never)
  await $.turn.complete(DONE)
  await clock.settle()
  expect(store.get('progress')).toMatchObject({ exp: 55 })
})

test('a save this build cannot read is kept aside, and he starts fresh', async ($, on) => {
  const future = { v: 9, exp: 1 }
  const { store } = await turn($, on, { saved: { progress: future } })
  expect(store.get('progressBackup')).toEqual(future)
  expect(store.get('progress')).toMatchObject({ v: 1, level: 1, exp: 0 })
})

test('an interrupt earns nothing: the foe flees', async ($, on) => {
  const { clock, store } = await turn($, on)
  await $.tool.call(EDIT as never)
  await $.turn.complete({ ...DONE, isAborted: true, reason: 'aborted' })
  await clock.settle()
  expect(((store.get('progress')) as { exp?: number } | undefined)?.exp ?? 0).toBe(0)
})

test('where he stopped on the road is saved when the turn ends', async ($, on) => {
  const { clock, store } = await turn($, on)
  const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(WIDE, true) })
  for (let i = 0; i < 10; i++) await clock.advance(160)
  await $.turn.complete(DONE)
  await clock.settle()
  expect(((store.get('progress')) as { roadPos: number }).roadPos).toBeGreaterThanOrEqual(10)
  await t.unmount()
})

test('out of usage he trudges: the road moves every other frame', async ($, on) => {
  const blits: string[] = []
  const { clock, store } = await turn($, on, { blits, usage: { context: { window: 200000, tokens: 0, percent: 0 }, rateLimits: [{ kind: 'five_hour', percentUsed: 100 }] } })
  await clock.advance(1000)
  const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(WIDE, true) })
  // Every other frame is still (no step, no move), so the first one sent comes on the second tick.
  await clock.advance(320)
  const first = blits.at(-1)!
  for (let i = 0; i < 12; i++) await clock.advance(160)
  const shift = Array.from({ length: 20 }, (_, k) => k).find(k => Array.from({ length: 20 }, (_, x) => x).every(x => groundCell(blits.at(-1)!, WIDE, x) === groundCell(first, WIDE, x + k)))
  expect(shift).toBe(6)
  await t.unmount()
})
