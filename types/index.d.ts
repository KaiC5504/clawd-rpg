// HP and MP are what's left (1 = full); exp is progress to the next level.
export type RpgStats = { level: number; exp: number; hp: number; mp: number; place: string }

declare module 'claude-code' {
  interface PluginState {
    'clawd-rpg': {
      isHidden: boolean
      stats: RpgStats
    }
  }
}
