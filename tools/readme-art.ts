// Renders the README's pictures with the plugin's own code: `bun run tools/readme-art.ts`.
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

import { DEMO, demoScene } from '../hooks/rpg/demo'
import { frame } from '../hooks/rpg/frame'
import { svgLoop } from '../hooks/rpg/svg'

const OUT = join(import.meta.dir, '..', 'docs', 'readme')
const WIDTH = 150
const FRAME_MS = 160

const startOf = (name: string) => {
  let from = 0
  for (const d of DEMO) {
    if (d.name === name) return { from, ms: d.ms }
    from += d.ms
  }
  throw new Error(`no demo scene "${name}"`)
}

// Demo time from the start of `first` to the end of `last`, a frame every 160 ms.
function loop(first: string, last: string, step = 1): string {
  const a = startOf(first)
  const b = startOf(last)
  const frames = []
  for (let ms = a.from; ms < b.from + b.ms; ms += FRAME_MS * step) frames.push(frame(demoScene(ms, WIDTH).scene))
  return svgLoop(frames, FRAME_MS * step)
}

const pictures: Record<string, string> = {
  'battle.svg': loop('An edit: CLAW STRIKE', 'Tests pass: ALL-OUT ATTACK'),
  'party.svg': loop('Subagents join the party', "A subagent's work lands: ARCANE BOLT"),
  'boss.svg': loop('The zone meter is full: the Treant', 'Zone clear: through the gate'),
  'rest.svg': loop('Waiting for you: the pier', 'A minute idle: the campfire', 2),
  'zones.svg': loop('The Dungeon', 'A compaction: the inn', 2),
}

mkdirSync(OUT, { recursive: true })
for (const [name, svg] of Object.entries(pictures)) {
  writeFileSync(join(OUT, name), svg)
  console.log(`${name}: ${Math.round(svg.length / 1024)} KB`)
}
