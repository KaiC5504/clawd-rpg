import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { encodeCells } from './rpg/cells'
import { HIDDEN_BELOW, frame } from './rpg/frame'
import { ROWS } from './rpg/grid'
import { statsFrom } from './rpg/stats'
import type { Usage } from './rpg/stats'

const RASTER_KEY = 'rpg'
// Half the sketch page's speed, the pace KaiC picked as natural.
const FRAME_MS = 160
const WALK_PX_PER_S = 7
const STATS_MS = 1000

const isHidden = atom({ plugin: 'clawd-rpg', key: 'isHidden' } as const, false)
const stats = atom({ plugin: 'clawd-rpg', key: 'stats' } as const, statsFrom(null, ''))

// Module state: a hot reload starts it over, while the atoms live on in $.state.
let isReady = false
let place = ''
let road = { distance: 0, at: 0, isWalking: false }
let painting: { requestId: string; width: number; painted: string } | null = null
let frameTimer: { cancel: () => void } | null = null

function stopPainting(): void {
  frameTimer?.cancel()
  frameTimer = null
  painting = null
}

function advance(now: number, isWalking: boolean): void {
  const distance = road.isWalking && road.at ? road.distance + (WALK_PX_PER_S * (now - road.at)) / 1000 : road.distance
  road = { distance, at: now, isWalking }
}

async function refreshStats($: EngineInterface): Promise<void> {
  const usage = (await $.session.usage().then(u => u, () => null)) as Usage | null
  const next = statsFrom(usage, place)
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

async function ensureReady($: EngineInterface): Promise<void> {
  if (isReady) return
  isReady = true
  if ((await $.store.get('isHidden')) === true) await update($, isHidden, () => true)
  $.clock.every(STATS_MS, () => void refreshStats($))
  await refreshPlace($).catch(() => undefined)
  await refreshStats($)
}

async function cellsNow($: EngineInterface, width: number, now: number): Promise<string> {
  return encodeCells(frame({ width, t: now, distance: road.distance, isWalking: road.isWalking, stats: await read($, stats) }))
}

async function paintFrame($: EngineInterface): Promise<void> {
  const p = painting
  if (!p) return
  const now = await $.clock.now()
  advance(now, road.isWalking)
  const cells = await cellsNow($, p.width, now)
  if (cells === p.painted) return
  p.painted = cells
  const blitted = await $.ui.blit({ requestId: p.requestId, key: RASTER_KEY, cells })
  // Not mounted any more (hidden, collapsed, resized): rest until the next draw.
  if (blitted.deny !== undefined && painting === p) stopPainting()
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
  const now = await $.clock.now()
  advance(now, e.props.isWorking)
  const cells = await cellsNow($, width, now)
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

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'rpg', description: "Show or hide Clawd's adventure above the prompt" })
    await ensureReady($).catch(() => undefined)
    return next(e)
  })
  // A render hook may not write state, so the band is readied from session events instead; after a
  // /reload-plugins that's the next prompt.
  on('classic.SessionStart', async ($, e, next) => {
    await ensureReady($).catch(() => undefined)
    return next(e)
  })
  // Claude switches branches mid-session, so the HUD's place is re-read at every prompt.
  on('classic.UserPromptSubmit', async ($, e, next) => {
    await ensureReady($)
      .then(() => refreshPlace($))
      .catch(() => undefined)
    return next(e)
  })
  on('command.run', { command: 'rpg' }, async $ => ({ text: await toggle($) }))
  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => drawBand($, e as never, next as never) as never)
}
