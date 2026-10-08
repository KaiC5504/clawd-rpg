import type { Register } from 'claude-code'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'rpg', description: "Show or hide Clawd's adventure above the prompt" })
    return next(e)
  })
  on('command.run', { command: 'rpg' }, async () => ({ text: 'clawd-rpg is installed.' }))
}
