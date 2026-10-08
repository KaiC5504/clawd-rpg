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

export type FoeKind = 'goblin' | 'shroom'

// `at` is when it dropped in; `hitAt` the last blow it took.
export type Foe = { kind: FoeKind; hp: number; maxHp: number; elite: boolean; at: number; hitAt: number }

export type RestKind = 'pier' | 'camp' | 'inn'

// A trip to the rest spots, which stand one band apart past `origin` (road pixels, where he stopped).
// `at`: when he went idle; `compactAt`: a compaction that sends him on to the inn; `leftAt`: the
// prompt that called him back.
export type Trip = { origin: number; at: number; compactAt: number | null; leftAt: number | null }

export type QuestTask = { id: string; subject: string; status: 'pending' | 'in_progress' | 'completed' }

// The battle on the band, moved on by session events (hooks/rpg/director.ts). Times are clock ms.
export type Story = {
  // `recent`: when the turn's last three tool calls started, which sets his pace.
  turn: { active: boolean; at: number; files: Record<string, number>; gained: number; foes: number; recent: number[] }
  foe: Foe | null
  skill: { name: string; at: number } | null
  down: { kind: FoeKind; at: number; finisher: boolean } | null
  counter: { n: number; at: number } | null
  victory: { at: number; loot: string; gained: number } | null
  fled: { kind: FoeKind; at: number } | null
  levelUp: { level: number; at: number } | null
  calledAt: number | null
  // Calls still running, by tool_use_id, so each settles once however many hooks report it.
  calls: Record<string, Work>
  // The trip he is on, and the one before it, still drawn while it scrolls away behind him.
  trip: Trip | null
  trail: Trip | null
  tasks: QuestTask[]
}

declare module 'claude-code' {
  interface PluginState {
    'clawd-rpg': {
      isHidden: boolean
      stats: RpgStats
      story: Story
    }
  }
}
