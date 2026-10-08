import { expect, mock, test } from 'claude-code/testing'

const NOW = Date.parse('2026-10-09T10:00:00Z')
const TYPED_RPG = {
  command: 'rpg',
  args: '',
  origin: { kind: 'composer' as const },
  presentation: { isFullscreen: false, columns: 150 },
}

test('/rpg answers once the plugin is loaded', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  on('classic.SessionStart', () => ({}))
  await $.classic.SessionStart({ source: 'startup' })
  await clock.settle()
  expect((await $.command.run(TYPED_RPG)).text).toContain('clawd-rpg')
})
