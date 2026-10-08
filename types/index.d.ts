// HP and MP are what's left (1 = full); exp is progress to the next level.
export type RpgStats = { level: number; exp: number; hp: number; mp: number; place: string }

export type WorkKind = 'edit' | 'write' | 'shell' | 'tests' | 'install' | 'mcp' | 'other'

// `passed` / `failed`: test counts, when the runner's output gave them.
export type WorkResult = { ok: boolean; ms: number; passed?: number; failed?: number }

// `cmd`: the program a shell call runs (or the package manager, for installs).
export type Work = {
  id: string
  kind: WorkKind
  startedAt: number
  ext?: string
  removed?: number
  added?: number
  lines?: number
  cmd?: string
  server?: string
  result?: WorkResult
}

declare module 'claude-code' {
  interface PluginState {
    'clawd-rpg': {
      isHidden: boolean
      stats: RpgStats
    }
  }
}
