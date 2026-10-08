import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { encodeCells } from './rpg/cells'
import { NO_STORY, beatOf, step, withLevelUp } from './rpg/director'
import type { HookPayload, Story } from './rpg/director'
import { HIDDEN_BELOW, frame } from './rpg/frame'
import { ROWS } from './rpg/grid'
import { FRESH, gain, loadProgress } from './rpg/progress'
import type { Award, Progress } from './rpg/progress'
import { statsFrom } from './rpg/stats'
import type { Usage } from './rpg/stats'

const RASTER_KEY = 'rpg'
// Half the sketch page's speed, the pace KaiC picked as natural. The road moves one whole pixel a
// frame (6.25 px/s): a speed in fractions of a pixel scrolls 1, 1, 1, then 2, which reads as a hitch.
const FRAME_MS = 160
const STATS_MS = 1000

const isHidden = atom({ plugin: 'clawd-rpg', key: 'isHidden' } as const, false)
const stats = atom({ plugin: 'clawd-rpg', key: 'stats' } as const, statsFrom(null, '', FRESH))
const story = atom({ plugin: 'clawd-rpg', key: 'story' } as const, NO_STORY)

// Module state: a hot reload starts it over, while the atoms live on in $.state.
let isReady = false
let place = ''
let progress: Progress = FRESH
let road = { distance: 0, isWalking: false, frames: 0 }
let painting: { requestId: string; width: number; painted: string } | null = null
let frameTimer: { cancel: () => void } | null = null
// A frame still on its way to the terminal: the next tick skips rather than piling blits up.
let isBlitting = false

function stopPainting(): void {
  frameTimer?.cancel()
  frameTimer = null
  painting = null
}

// A story saved by an older build may lack fields this one reads.
const storyNow = async ($: EngineInterface): Promise<Story> => ({ ...NO_STORY, ...(await read($, story)) })

async function refreshStats($: EngineInterface): Promise<void> {
  const usage = (await $.session.usage().then(u => u, () => null)) as Usage | null
  const next = statsFrom(usage, place, progress)
  if (JSON.stringify(next) !== JSON.stringify(await read($, stats))) await update($, stats, () => next)
}

async function refreshPlace($: EngineInterface): Promise<void> {
  const branch = await $.process.run(['git', 'branch', '--show-current'], { timeoutMs: 5000 }).catch(() => null)
  const folder = (await $.session.cwd().catch(() => '')).replace(/\\/g, '/').split('/').pop() ?? ''
  const name = branch?.exitCode === 0 && branch.stdout.trim() ? `${folder}/${branch.stdout.trim()}` : folder
  if (name !== place) {
    place = name
    await refreshStats($)
  }
}

// Progress lives in the store, shared by every session: it is read fresh before each change so
// two sessions earning EXP at once don't overwrite each other. null: a newer build saved it, so
// this session plays on in memory and leaves the save alone.
async function loadSaved($: EngineInterface): Promise<Progress | null> {
  const { progress: loaded, backup, isNewer } = loadProgress(await $.store.get('progress'))
  if (isNewer) return null
  if (backup !== undefined) {
    // The first backup is the one most likely to hold real progress.
    if ((await $.store.get('progressBackup')) === undefined) await $.store.set('progressBackup', backup)
    await $.store.set('progress', loaded)
  }
  return loaded
}

async function saveWith($: EngineInterface, change: (p: Progress) => Progress): Promise<void> {
  const saved = await loadSaved($)
  progress = change(saved ?? progress)
  if (saved) await $.store.set('progress', progress)
}

async function earn($: EngineInterface, awards: Award[]): Promise<number> {
  let levelsUp = 0
  await saveWith($, p => {
    for (const a of awards) {
      const r = gain(p, a)
      p = r.progress
      levelsUp += r.levelsUp
    }
    return p
  })
  return levelsUp
}

async function ensureReady($: EngineInterface): Promise<void> {
  if (isReady) return
  isReady = true
  if ((await $.store.get('isHidden')) === true) await update($, isHidden, () => true)
  progress = (await loadSaved($)) ?? FRESH
  road.distance = progress.roadPos
  $.clock.every(STATS_MS, () => void refreshStats($))
  await refreshPlace($).catch(() => undefined)
  await refreshStats($)
}

// Hooks for parallel tool calls run side by side: each event steps the story only once the one
// before it has landed, or both would step from the same story and one would be lost.
let queue: Promise<void> = Promise.resolve()

function observe($: EngineInterface, event: string, payload: HookPayload): Promise<void> {
  const run = queue.then(() => observeNow($, event, payload))
  queue = run.catch(() => undefined)
  return run
}

async function observeNow($: EngineInterface, event: string, payload: HookPayload): Promise<void> {
  await ensureReady($)
  const now = await $.clock.now()
  const before = await storyNow($)
  const { story: next, awards } = step(before, event, payload, now)
  let told = next
  if (awards.length > 0) {
    const levelsUp = await earn($, awards)
    if (levelsUp > 0) told = withLevelUp(told, progress.level, now)
    await refreshStats($)
  }
  if (told !== before) await update($, story, () => told)
  if (event === 'TurnEnded' && Math.floor(road.distance) !== progress.roadPos) {
    await saveWith($, p => ({ ...p, roadPos: Math.floor(road.distance) }))
  }
}

async function cellsNow($: EngineInterface, width: number, now: number, isWalking: boolean): Promise<string> {
  const s = await read($, stats)
  return encodeCells(frame({ width, t: now, distance: road.distance, isWalking, stats: s, story: await storyNow($), trudge: s.mp <= 0 }))
}

// He walks while Claude works and nothing stands in his way; out of usage he moves every other frame.
async function walkingNow($: EngineInterface, now: number): Promise<boolean> {
  const beat = beatOf(await storyNow($), now)
  return road.isWalking && (beat === 'walk' || beat === 'idle')
}

async function paintFrame($: EngineInterface): Promise<void> {
  const p = painting
  if (!p || isBlitting) return
  isBlitting = true
  try {
    const now = await $.clock.now()
    const isWalking = await walkingNow($, now)
    road.frames++
    if (isWalking && ((await read($, stats)).mp > 0 || road.frames % 2 === 0)) road.distance += 1
    const cells = await cellsNow($, p.width, now, isWalking)
    if (cells === p.painted) return
    p.painted = cells
    const blitted = await $.ui.blit({ requestId: p.requestId, key: RASTER_KEY, cells })
    // Not mounted any more (hidden, collapsed, resized): rest until the next draw.
    if (blitted.deny !== undefined && painting === p) stopPainting()
  } finally {
    isBlitting = false
  }
}

type BandEvent = Parameters<EngineInterface['ui']['resolve']>[0] & {
  requestId: string
  props: { hasSurvey: boolean; isWorking: boolean; bodyColumns: number }
}

async function drawBand($: EngineInterface, e: BandEvent, next: (e: BandEvent) => unknown) {
  const width = Math.min(512, e.props.bodyColumns)
  if (e.props.hasSurvey || e.surface !== 'terminal' || width < HIDDEN_BELOW || (await read($, isHidden))) {
    // The desktop or a phone redrawing must not freeze the terminal's band.
    if (e.surface === 'terminal') stopPainting()
    return next(e)
  }
  road.isWalking = e.props.isWorking
  const now = await $.clock.now()
  const cells = await cellsNow($, width, now, await walkingNow($, now))
  if (!painting || painting.requestId !== e.requestId || painting.width !== width) {
    stopPainting()
    painting = { requestId: e.requestId, width, painted: cells }
    frameTimer = $.clock.every(FRAME_MS, () => void paintFrame($))
  } else {
    painting.painted = cells
  }
  const { Raster } = $.ui.resolve(e as never) as never as { Raster: any }
  return <Raster key={RASTER_KEY} columns={width} rows={ROWS} cells={cells} />
}

async function toggle($: EngineInterface): Promise<string> {
  await ensureReady($)
  const hide = !(await read($, isHidden))
  await update($, isHidden, () => hide)
  await $.store.set('isHidden', hide)
  return hide ? "Clawd's adventure is hidden. /rpg brings it back." : 'Clawd is back on the road.'
}

type Shell = { tool_use_id?: string }
type ShellResult = { deny?: string; isError?: boolean; text?: string; result?: unknown }

// A command's result straight from the call; PostToolUse brings the same, and the story settles it once.
async function onShell($: EngineInterface, e: Shell, next: (e: Shell) => Promise<ShellResult>): Promise<ShellResult> {
  const ran = await next(e)
  if (ran.deny === undefined) {
    const payload = ran.isError ? { tool_use_id: e.tool_use_id ?? '', error: ran.text ?? '' } : { tool_use_id: e.tool_use_id ?? '', tool_response: ran.result }
    await observe($, ran.isError ? 'PostToolUseFailure' : 'PostToolUse', payload).catch(() => undefined)
  }
  return ran
}

const quietly = (work: Promise<void>) => work.catch(() => undefined)

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'rpg', description: "Show or hide Clawd's adventure above the prompt" })
    await quietly(ensureReady($))
    return next(e)
  })
  on('command.run', { command: 'rpg' }, async $ => ({ text: await toggle($) }))
  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => drawBand($, e as never, next as never) as never)
  on('tool.call', { tool: 'Bash' }, ($, e, next) => onShell($, e as never, next as never) as never)
  on('tool.call', { tool: 'PowerShell' }, ($, e, next) => onShell($, e as never, next as never) as never)

  // A render hook may not write state, so the story moves on session events. The turn ends here and
  // not at classic.Stop, which a user's own Stop hook can block to keep Claude working.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined) await quietly(observe($, 'TurnEnded', { reason: e.reason }))
    return result
  })
  on('classic.SessionStart', async ($, e, next) => {
    await quietly(observe($, 'SessionStart', e as never))
    return next(e)
  })
  // Claude switches branches mid-session, so the HUD's place is re-read at every prompt.
  on('classic.UserPromptSubmit', async ($, e, next) => {
    await quietly(observe($, 'UserPromptSubmit', e as never).then(() => refreshPlace($)))
    return next(e)
  })
  on('classic.PreToolUse', async ($, e, next) => {
    // classic.PreToolUse carries the tool call envelope, not the hook's stdin JSON.
    const { tool, tool_use_id: toolUseId, consent: _consent, ...input } = e as unknown as Record<string, unknown>
    await quietly(observe($, 'PreToolUse', { tool_name: tool, tool_input: input, tool_use_id: toolUseId }))
    return next(e)
  })
  on('classic.PostToolUse', async ($, e, next) => {
    await quietly(observe($, 'PostToolUse', e as never))
    return next(e)
  })
  on('classic.PostToolUseFailure', async ($, e, next) => {
    await quietly(observe($, 'PostToolUseFailure', e as never))
    return next(e)
  })
  on('classic.Notification', async ($, e, next) => {
    await quietly(observe($, 'Notification', e as never))
    return next(e)
  })
  on('classic.Elicitation', async ($, e, next) => {
    await quietly(observe($, 'Elicitation', e as never))
    return next(e)
  })
}
