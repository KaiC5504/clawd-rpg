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

test('the desktop draws the band as a looping Svg, under its size cap', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  fakeSession(on, [])
  await $.classic.SessionStart({ source: 'startup' })
  await clock.settle()
  const d = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'desktop', ...band(150) })
  const svg = await d.find({ type: 'Svg' } as never)
  expect(svg).toBeDefined()
  const props = svg!.props as { source: string; alt: string; isInteractive?: boolean }
  expect(props.source.startsWith('<svg')).toBe(true)
  expect(props.source.length).toBeLessThanOrEqual(131072)
  expect(props.alt.length).toBeGreaterThan(0)
  await d.unmount()
})

const typed = (args: string) => ({ ...TYPED_RPG, args })

test('/rpg stats says his level, zone and bestiary', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  fakeSession(on, [], undefined, undefined, { progress: { v: 1, level: 4, exp: 12, zone: 'dungeon', zoneMeter: 5, bestiary: { slime: 3 } } })
  await $.classic.SessionStart({ source: 'startup' })
  await clock.settle()
  const text = (await $.command.run(typed('stats'))).text
  expect(text).toContain('Clawd · Lv.4 · 12/150 EXP to Lv.5')
  expect(text).toContain('Zone: Dungeon · 5/12 battles to the Merge Hydra')
  expect(text).toContain('Bestiary: slime ×3')
})

test('/rpg doctor checks the band, the save, and whether clawd-bar is on too', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  fakeSession(on, [])
  on('settings.read', () => ({ value: { enabledPlugins: { 'clawd-bar@clawd-bar': true, 'clawd-rpg@clawd-rpg': true } } }))
  await $.classic.SessionStart({ source: 'startup' })
  await clock.settle()
  const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(WIDE) })
  await clock.advance(320)
  const text = (await $.command.run(typed('doctor'))).text
  expect(text).toContain('· Band: shown, last drawn 179 columns wide (full view), painting frames')
  expect(text).toContain('· Save: fine (Lv.1, Enchanted Forest)')
  expect(text).toContain('· clawd-bar: also enabled')
  await t.unmount()
})

test('/rpg demo plays a day on the road on the band, then /rpg demo stops it, leaving progress alone', async ($, on) => {
  const blits: string[] = []
  const clock = mock.clock(on, { now: NOW })
  const store = fakeSession(on, blits)
  await $.classic.SessionStart({ source: 'startup' })
  await clock.settle()
  const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(WIDE) })
  expect((await $.command.run(typed('demo'))).text).toContain('/rpg demo again stops it')
  await clock.advance(800)
  expect(rowText(blits.at(-1)!, WIDE, 0)).toContain('☐ 1/3 fix the login form')
  const seen = new Set<string>()
  for (let ms = 0; ms < 36_000; ms += 160) {
    await clock.advance(160)
    seen.add(rowText(blits.at(-1)!, WIDE, 2))
    seen.add(rowText(blits.at(-1)!, WIDE, 0))
  }
  const all = [...seen].join(' | ')
  for (const words of ['CLAW STRIKE', 'COUNTER', 'ALL-OUT ATTACK', 'ARCANE BOLT', '★ BOSS · TREANT', 'Treant Heartwood']) expect(all).toContain(words)
  expect(store.get('progress')).toBeUndefined()
  expect((await $.command.run(typed('demo'))).text).toContain('stopped')
  await clock.advance(320)
  expect(rowText(blits.at(-1)!, WIDE, 0)).not.toContain('☐')
  await t.unmount()
})

test('/rpg demo while hidden says how to see it; anything else after /rpg toggles as before', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  fakeSession(on, [])
  await $.classic.SessionStart({ source: 'startup' })
  await clock.settle()
  expect((await $.command.run(typed('whatever'))).text).toContain('hidden')
  expect((await $.command.run(typed('demo'))).text).toContain('/rpg brings it back, then /rpg demo')
  expect((await $.command.run(typed(''))).text).toContain('back')
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
  const broken = { exp: 1 }
  const { store } = await turn($, on, { saved: { progress: broken } })
  expect(store.get('progressBackup')).toEqual(broken)
  expect(store.get('progress')).toMatchObject({ v: 1, level: 1, exp: 0 })
})

test('an earlier backup is never replaced by a later one', async ($, on) => {
  const { store } = await turn($, on, { saved: { progress: 'junk', progressBackup: { v: 1, level: 30 } } })
  expect(store.get('progressBackup')).toEqual({ v: 1, level: 30 })
})

test('a save from a newer build is left as it is, and he plays on without saving', async ($, on) => {
  const newer = { v: 2, exp: 9000, level: 40 }
  const { clock, store } = await turn($, on, { saved: { progress: newer } })
  await $.tool.call(EDIT as never)
  await $.turn.complete(DONE)
  await clock.advance(1000)
  expect(store.get('progress')).toEqual(newer)
  expect(store.get('progressBackup')).toBeUndefined()
  const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(WIDE, true) })
  expect(rowText(await raster(t), WIDE, 0)).toContain('+15 EXP')
  await t.unmount()
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

const FOE_COLORS = [0x6fbf4e, 0xd6453d]

test('tool calls running side by side land like the same calls one after another', async ($, on) => {
  const { clock, store } = await turn($, on)
  await Promise.all(Array.from({ length: 6 }, () => $.tool.call(EDIT as never)))
  await $.turn.complete(DONE)
  await clock.settle()
  // Six hits fell the first foe (2-4 HP) and at least one more before the turn was over.
  expect((store.get('progress') as { zoneMeter: number }).zoneMeter).toBeGreaterThanOrEqual(2)
})

test('loot named after a file the terminal cannot draw one cell wide keeps the band', async ($, on) => {
  const { clock } = await turn($, on)
  await $.tool.call({ ...EDIT, file_path: 'C:/src/日本語.ts' } as never)
  await $.turn.complete(DONE)
  await clock.advance(1000)
  const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(WIDE, true) })
  expect(rowText(await raster(t), WIDE, 0)).toContain('of ???.ts')
  await t.unmount()
})

test('compacting mid-turn keeps the fight, and the turn still ends in victory', async ($, on) => {
  const { clock, store } = await turn($, on)
  await $.tool.call(EDIT as never)
  await $.classic.SessionStart({ source: 'compact' })
  await $.tool.call(EDIT as never)
  await $.turn.complete(DONE)
  await clock.settle()
  expect(store.get('progress')).toMatchObject({ exp: 15 })
})

test('a Stop hook that keeps Claude working does not end the fight', async ($, on) => {
  on('classic.Stop', () => ({ block: 'keep going' }) as never)
  const { clock, store } = await turn($, on)
  await $.tool.call(EDIT as never)
  await $.classic.Stop({} as never)
  await clock.settle()
  expect((store.get('progress') as { exp?: number } | undefined)?.exp ?? 0).toBe(0)
  await $.turn.complete(DONE)
  await clock.settle()
  expect(store.get('progress')).toMatchObject({ exp: 15 })
})

test('a tool call after the turn has ended brings no foe', async ($, on) => {
  const blits: string[] = []
  const { clock } = await turn($, on, { blits })
  await $.turn.complete(DONE)
  await clock.advance(6000)
  await $.tool.call(EDIT as never)
  const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(WIDE) })
  await clock.advance(2000)
  const colors = colorsIn(blits.at(-1)!)
  expect(FOE_COLORS.some(c => colors.has(c))).toBe(false)
  await t.unmount()
})

// Lets the frame timer run `ms` of road while the band is mounted.
async function wait(clock: { advance: (ms: number) => Promise<unknown> }, ms: number) {
  for (let left = ms; left > 0; left -= 160) await clock.advance(160)
}

test('after a turn he walks off to the pier, passing its signpost, and fishes there', async ($, on) => {
  const blits: string[] = []
  const { clock } = await turn($, on, { blits })
  await $.turn.complete(DONE)
  const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(WIDE) })
  await wait(clock, 4800 + 160 * 30)
  await t.unmount()
  // A fresh mount goes through the engine's check that every cell is one printable column.
  const midway = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(WIDE) })
  expect(rowText(await raster(midway), WIDE, 1)).toContain('→ Pier')
  await wait(clock, 160 * 70)
  expect(rowText(blits.at(-1)!, WIDE, 0)).toContain('waiting for you…')
  await midway.unmount()
})

test('a minute idle he moves on to the campfire', async ($, on) => {
  const blits: string[] = []
  const { clock } = await turn($, on, { blits })
  await $.turn.complete(DONE)
  const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(WIDE) })
  await wait(clock, 60_000 + 160 * 100)
  expect(rowText(blits.at(-1)!, WIDE, 0)).toContain('idle · warming up')
  await t.unmount()
})

test('compacting between turns takes him to the inn, where HP refills', async ($, on) => {
  on('classic.PreCompact', () => ({}))
  const blits: string[] = []
  const { clock } = await turn($, on, { blits })
  await $.turn.complete(DONE)
  await $.classic.PreCompact({ trigger: 'manual', custom_instructions: null } as never)
  const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(WIDE) })
  await wait(clock, 4800 + 160 * 200)
  expect(rowText(blits.at(-1)!, WIDE, 0)).toContain('z Z  ·  HP refilling')
  await t.unmount()
})

test('a prompt while he rests: he packs up, then walks back to work', async ($, on) => {
  const blits: string[] = []
  const { clock } = await turn($, on, { blits })
  await $.turn.complete(DONE)
  const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(WIDE) })
  await wait(clock, 4800 + 160 * 100)
  await t.unmount()
  await $.classic.UserPromptSubmit({ prompt: 'next' })
  const working = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(WIDE, true) })
  // The pier's shore is its first 12 columns: how many are still on screen says how far he has walked.
  const shore = (cells: string) => Array.from({ length: 12 }, (_, x) => groundCell(cells, WIDE, x)).filter(c => c.split(' ')[1] === String(0x3a3a2a)).length
  await wait(clock, 640)
  const packing = blits.at(-1)!
  expect(shore(packing)).toBe(12)
  expect(rowText(packing, WIDE, 0)).not.toContain('waiting for you')
  await wait(clock, 1200)
  const a = shore(blits.at(-1)!)
  await wait(clock, 160 * 4)
  expect(a - shore(blits.at(-1)!)).toBe(4)
  await working.unmount()
})

test('busy with tool calls, he hurries two pixels a frame', async ($, on) => {
  on('tool.call', { tool: 'Read' }, () => ({ result: {} }) as never)
  const blits: string[] = []
  const { clock } = await turn($, on, { blits })
  for (let i = 0; i < 3; i++) await $.tool.call({ tool: 'Read', file_path: 'C:/src/my-app/README.md' } as never)
  const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(WIDE, true) })
  await wait(clock, 320)
  const a = blits.at(-1)!
  await wait(clock, 160 * 4)
  expect(Array.from({ length: 20 }, (_, x) => groundCell(blits.at(-1)!, WIDE, x))).toEqual(Array.from({ length: 20 }, (_, x) => groundCell(a, WIDE, x + 8)))
  await t.unmount()
})

test('the task list shows as a quest line while he works', async ($, on) => {
  on('classic.TaskCreated', () => ({}))
  on('classic.TaskCompleted', () => ({}))
  const blits: string[] = []
  const { clock } = await turn($, on, { blits })
  await $.classic.TaskCreated({ task_id: '1', task_subject: 'read the spec' } as never)
  await $.classic.TaskCreated({ task_id: '2', task_subject: 'fix login' } as never)
  await $.classic.TaskCompleted({ task_id: '1', task_subject: 'read the spec' } as never)
  const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(WIDE, true) })
  expect(rowText(await raster(t), WIDE, 0)).toContain('☐ 1/2 fix login')
  await clock.advance(160)
  await t.unmount()
})

test('resizing while he sleeps at the inn keeps him in bed, narrower or wider', async ($, on) => {
  on('classic.PreCompact', () => ({}))
  const blits: string[] = []
  const { clock } = await turn($, on, { blits })
  await $.turn.complete(DONE)
  await $.classic.PreCompact({ trigger: 'manual', custom_instructions: null } as never)
  const wide = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(WIDE) })
  await wait(clock, 4800 + 160 * 200)
  await wide.unmount()
  const narrow = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(100) })
  await wait(clock, 160 * 3)
  expect(rowText(blits.at(-1)!, 100, 0)).toContain('z Z  ·  HP refilling')
  await narrow.unmount()
  const back = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(WIDE) })
  await wait(clock, 160 * 3)
  expect(rowText(blits.at(-1)!, WIDE, 0)).toContain('z Z  ·  HP refilling')
  await back.unmount()
})

test('a full zone meter makes the turn a boss fight: TREANT in the top-left', async ($, on) => {
  const { clock } = await turn($, on, { saved: { progress: { v: 1, level: 2, exp: 0, zoneMeter: 12 } } })
  await $.tool.call(EDIT as never)
  await clock.advance(2000)
  const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(WIDE, true) })
  expect(rowText(await raster(t), WIDE, 0)).toContain('★ BOSS · TREANT')
  await t.unmount()
})

test('beating the boss clears the forest: saved in the Dungeon, and he walks out through the gate', async ($, on) => {
  const blits: string[] = []
  const { clock, store } = await turn($, on, { blits, saved: { progress: { v: 1, level: 2, exp: 90, zoneMeter: 12 } } })
  await $.tool.call(EDIT as never)
  await $.turn.complete(DONE)
  expect(store.get('progress')).toMatchObject({ level: 3, zone: 'dungeon', zoneMeter: 0, unlocked: ['forest', 'dungeon'] })
  const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(WIDE) })
  await wait(clock, 1000)
  expect(rowText(blits.at(-1)!, WIDE, 0)).toContain('Treant Heartwood')
  expect(colorsIn(blits.at(-1)!).has(0x6b6f7f)).toBe(true)
  await t.unmount()
})

test('in the Dungeon, the foes are its own', async ($, on) => {
  const blits: string[] = []
  const { clock } = await turn($, on, { blits, saved: { progress: { v: 1, level: 3, exp: 0, zone: 'dungeon', zoneMeter: 0 } } })
  await $.tool.call(EDIT as never)
  const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(WIDE, true) })
  await clock.advance(2000)
  const colors = colorsIn(blits.at(-1)!)
  expect(colors.has(0x7ad15a) || colors.has(0xe9e6df)).toBe(true)
  expect(colors.has(0x6fbf4e)).toBe(false)
  await t.unmount()
})

test('a subagent joins the party as a mini Clawd behind him, and its edits are its own attacks', async ($, on) => {
  on('classic.SubagentStart', () => ({}))
  on('classic.SubagentStop', () => ({}))
  const blits: string[] = []
  const { clock } = await turn($, on, { blits })
  await $.classic.SubagentStart({ agent_id: 'a1', agent_type: 'Plan' } as never)
  const t = await $.ui.mount({ plugin: 'clawd-rpg', surface: 'terminal', ...band(WIDE, true) })
  await clock.advance(640)
  expect(rowText(blits.at(-1)!, WIDE, 0)).toContain('MAGE JOINS!')
  await clock.advance(1280)
  expect(colorsIn(blits.at(-1)!).has(0xffb3f6)).toBe(true)
  await $.classic.SubagentStop({ agent_id: 'a1', agent_type: 'Plan' } as never)
  await clock.advance(320)
  expect(rowText(blits.at(-1)!, WIDE, 0)).toContain('ARCANE BOLT')
  await t.unmount()
})

test("a turn with a party is a raid: 60 EXP more than the turn alone", async ($, on) => {
  on('classic.SubagentStart', () => ({}))
  const { store } = await turn($, on)
  await $.classic.SubagentStart({ agent_id: 'a1', agent_type: 'Explore' } as never)
  await $.turn.complete(DONE)
  expect(store.get('progress')).toMatchObject({ exp: 65 })
})
