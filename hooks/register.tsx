import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { encodeCells } from './rpg/cells'
import { NO_STORY, passGate, step, withLevelUp } from './rpg/director'
import type { HookPayload, Story } from './rpg/director'
import { HIDDEN_BELOW, frame } from './rpg/frame'
import { ROWS } from './rpg/grid'
import { FRESH, bossDue, gain, loadProgress } from './rpg/progress'
import type { Award, Progress } from './rpg/progress'
import { GATE_AFTER, GATE_AHEAD, gateAt, gateClear, moveRoad, reanchor } from './rpg/road'
import type { Motion } from './rpg/road'
import { statsFrom } from './rpg/stats'
import type { Usage } from './rpg/stats'

const RASTER_KEY = 'rpg'
// The width the band was last drawn at, for placing a gate before the band is up.
const USUAL_WIDTH = 179
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
let road = { distance: 0, isWorking: false, frames: 0, width: 0 }
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
  // Another session may have levelled him up or cleared a zone since.
  if (event === 'UserPromptSubmit') progress = (await loadSaved($)) ?? progress
  const now = await $.clock.now()
  const before = await storyNow($)
  const roadAt = Math.floor(road.distance)
  // Where he stands on the road is where a trip to the rest spots sets out from; the zone and a
  // full zone meter come from his progress.
  const { story: next, awards } = step(before, event, { ...payload, roadAt, zone: progress.zone, boss: bossDue(progress) }, now)
  let told = next
  if (awards.length > 0) {
    const levelsUp = await earn($, awards)
    if (levelsUp > 0) told = withLevelUp(told, progress.level, now)
    await refreshStats($)
  }
  // A cleared zone: he walks out through a gate, never a cut.
  if ((event === 'TurnEnded' || event === 'UserPromptSubmit') && told.zone !== progress.zone) {
    const from = event === 'TurnEnded' && told.trip ? told.trip.origin + GATE_AFTER : roadAt + GATE_AHEAD
    told = passGate(told, progress.zone, gateAt(told, now, road.width || USUAL_WIDTH, from))
  } else if (event === 'TurnEnded') {
    told = gateClear(told, now, road.width || USUAL_WIDTH)
  }
  if (told !== before) await update($, story, () => told)
  if (event === 'TurnEnded' && Math.floor(road.distance) !== progress.roadPos) {
    await saveWith($, p => ({ ...p, roadPos: Math.floor(road.distance) }))
  }
}

// He walks while Claude works and nothing stands in his way, and between turns heads for a rest spot.
// `advance`: this is a frame of the timer, so the road moves; a redraw only looks.
// The motion's `distance` is where to draw him.
async function motionNow($: EngineInterface, width: number, now: number, advance: boolean): Promise<Motion> {
  const frames = advance ? ++road.frames : road.frames
  const story = await storyNow($)
  const distance = road.width ? reanchor(story, now, road.distance, road.width, width) : road.distance
  const motion = moveRoad(story, now, distance, width, frames, road.isWorking, (await read($, stats)).mp <= 0)
  if (!advance) return { ...motion, distance }
  road.distance = motion.distance
  road.width = width
  return motion
}

async function cellsNow($: EngineInterface, width: number, now: number, motion: Motion): Promise<string> {
  const s = await read($, stats)
  return encodeCells(frame({ width, t: now, distance: motion.distance, isWalking: motion.isWalking, stats: s, story: await storyNow($), trudge: s.mp <= 0, legMs: motion.legMs }))
}

async function paintFrame($: EngineInterface): Promise<void> {
  const p = painting
  if (!p || isBlitting) return
  isBlitting = true
  try {
    const now = await $.clock.now()
    const cells = await cellsNow($, p.width, now, await motionNow($, p.width, now, true))
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
  road.isWorking = e.props.isWorking
  const now = await $.clock.now()
  const cells = await cellsNow($, width, now, await motionNow($, width, now, false))
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

type Call = { tool?: string; tool_use_id?: string; agentId?: string; consent?: unknown }
type CallResult = { deny?: string; isError?: boolean; text?: string; result?: unknown }

// Every tool call, the main loop's and a subagent's (`agentId`), before it runs. A command's result
// comes straight from the call too; PostToolUse brings the same, and the story settles it once.
async function onCall($: EngineInterface, e: Call, next: (e: Call) => Promise<CallResult>): Promise<CallResult> {
  const { tool, tool_use_id: toolUseId, consent: _consent, agentId, ...input } = e
  const by = agentId === undefined ? {} : { agent_id: agentId }
  await quietly(observe($, 'PreToolUse', { tool_name: tool, tool_input: input, tool_use_id: toolUseId, ...by }))
  const ran = await next(e)
  if ((tool === 'Bash' || tool === 'PowerShell') && ran.deny === undefined) {
    const payload = ran.isError ? { tool_use_id: toolUseId ?? '', error: ran.text ?? '' } : { tool_use_id: toolUseId ?? '', tool_response: ran.result }
    await quietly(observe($, ran.isError ? 'PostToolUseFailure' : 'PostToolUse', payload))
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
  on('tool.call', ($, e, next) => onCall($, e as never, next as never) as never)

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
  on('classic.PostToolUse', async ($, e, next) => {
    await quietly(observe($, 'PostToolUse', e as never))
    return next(e)
  })
  on('classic.PostToolUseFailure', async ($, e, next) => {
    await quietly(observe($, 'PostToolUseFailure', e as never))
    return next(e)
  })
  // A compaction between turns sends him to the inn; the director ignores one mid-turn.
  on('classic.PreCompact', async ($, e, next) => {
    await quietly(observe($, 'Compact', e as never))
    return next(e)
  })
  on('classic.TaskCreated', async ($, e, next) => {
    await quietly(observe($, 'TaskCreated', e as never))
    return next(e)
  })
  on('classic.TaskCompleted', async ($, e, next) => {
    await quietly(observe($, 'TaskCompleted', e as never))
    return next(e)
  })
  on('classic.SubagentStart', async ($, e, next) => {
    await quietly(observe($, 'SubagentStart', e as never))
    return next(e)
  })
  on('classic.SubagentStop', async ($, e, next) => {
    await quietly(observe($, 'SubagentStop', e as never))
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
