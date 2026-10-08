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

function fakeSession(on: On, blits: string[], usage: Usage | 'fails' = { context: { window: 200000, tokens: 24000, percent: 12 }, rateLimits: [] }) {
  mock.env(on, { USERPROFILE: '/Users/tester' })
  mock.store(on)
  on('process.run', () => ({ value: { exitCode: 0, stdout: 'main\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('session.id', () => ({ value: 's1' }))
  on('session.cwd', () => ({ value: 'C:/src/my-app' }))
  on('session.usage', () => {
    if (usage === 'fails') throw new Error('no usage yet')
    return { value: { startedAt: 0, ...usage } }
  })
  on('classic.SessionStart', () => ({}))
  on('ui.blit', ($, e) => {
    if ('cells' in e) blits.push(e.cells)
    return { value: {} }
  })
  // What Claude Code shows when the band steps aside.
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text key="beneath">nothing above the prompt</Text>
  })
}

const band = (bodyColumns: number, isWorking = false) => ({
  component: 'AbovePrompt' as const,
  props: { hasSurvey: false, isWorking, maxRows: 20, bodyColumns, scroll: { offset: 0, bodyRows: 20 }, view: {} },
})

// A base64 Raster of w × 5 cells, 12 bytes a cell.
const cellsFor = (w: number) => Math.ceil((w * 5 * 12) / 3) * 4

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
