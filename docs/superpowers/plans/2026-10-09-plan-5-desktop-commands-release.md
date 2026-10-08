# clawd-rpg Plan 5 — Desktop loops, `/rpg` commands, README art and the release

> Written and built overnight together with plan 4, while KaiC slept, at his request. The design
> talk that normally comes first didn't happen: every call he would have made is listed under
> **Decisions made without KaiC** at the end, with what it costs if he disagrees. Built inline,
> test first, one fresh review of the whole branch at the end.

**Goal:** clawd-rpg is ready to share: the desktop app's Code tab plays short loops of the band,
`/rpg stats`, `/rpg demo` and `/rpg doctor` work, the README shows the game in motion, and it
ships as 1.0.0.

**Architecture:** Three new pure modules. `demo.ts` is a scripted day on the road (every beat,
zone, rest spot, a boss and the party) built from the real director, so `/rpg demo` plays exactly
what a session would show; it never touches saved progress. `desktop.ts` turns any scene into an
SVG loop at a fixed 120 columns (`svg.ts`'s `svgLoop`), sized to stay under the 131,072-character
cap. `report.ts` writes the `/rpg stats` and `/rpg doctor` messages from plain facts.
`register.tsx` routes `/rpg [stats|demo|doctor]`, plays the demo on the band, and draws the Svg on
the desktop and mobile surfaces. `tools/readme-art.ts` renders the README's SVGs with the plugin's
own code.

**Spec:** `docs/superpowers/specs/2026-10-09-clawd-rpg-design.md` (§4 Commands, §6 Desktop, §7, §9).

## Global Constraints

- Desktop Svg: at most 131,072 characters (`SVG_MAX_CHARS`), 120 columns, no tweening (step-end).
- The demo never earns EXP, saves progress or moves the real road.
- Clawd's colour, text-over-pixel and HUD rules hold in every demo frame (same tests as live play).
- Comments sparse, only the why; commits without attribution trailers.

## Review Focus

1. **A desktop redraw mid-loop** must not restart the loop from frame 0 every time (negative
   animation delay, as clawd-bar does). Test: desktop.
2. **The demo started while hidden or below 40 columns**: says how to see it, doesn't throw. Test: mod.
3. **`/rpg stats` with a save from a newer build or a broken store**: still answers. Test: mod.
4. **Every demo scene and every live beat at 120 columns** stays under the Svg cap. Test: desktop.
5. **`/rpg` with unknown arguments** toggles as before rather than failing. Test: mod.

---

### Task 1: `/rpg stats` and `/rpg doctor` messages (`hooks/rpg/report.ts`)

- `statsText(p: Progress): string` — level and EXP to next, zone and its meter (or "boss waiting"),
  zones unlocked and the next unlock, bestiary counts (most met first).
- `doctorText(f: DoctorFacts): string` — band shown/hidden, last width and view (full, compact,
  hidden), frames painting or not, the save (fine / kept a backup / newer build), clawd-bar enabled
  too (its band stacks: `/clawd` hides it).
- Tests: tests/report.test.ts.

### Task 2: the demo (`hooks/rpg/demo.ts`)

- `DEMO: DemoScene[]`, `DEMO_MS`, `demoScene(ms, width): { name, scene: Scene }` — loops.
- Scenes, about 4 s each: forest walk, CLAW STRIKE, COUNTER, ALL-OUT ATTACK, the party joins,
  ARCANE BOLT, the Treant boss, victory and LEVEL UP, the gate into the Dungeon, a Dungeon fight,
  the pier, the crystal room, Neon City, the ramen stall, the inn.
- Tests: every scene draws; the loop covers every beat, every zone, every rest spot, a boss, the
  party and a gate; the visual rules hold in every demo frame at 100, 179 and 300.

### Task 3: desktop loops (`hooks/rpg/desktop.ts`)

- `DESKTOP_COLS = 120`; `desktopLoop(sceneAt: (i) => Scene): string` builds as many 160 ms frames as
  fit under the cap (at most 12, at least 1).
- `desktopKey(scene)`: what the loop shows (beat, rest kind, zone, foe, party size); the loop is
  rebuilt only when it changes.
- `resumeAt(svg, intoMs)`: starts a rebuilt Svg where the loop already was.
- Tests: every demo scene and every beat under the cap; key stable while nothing changes.

### Task 4: wiring

- `/rpg` (toggle), `/rpg stats`, `/rpg demo` (start/stop, loops), `/rpg doctor`; `argumentHint`.
- The band plays the demo while it runs; desktop and mobile draw `<Svg>` loops (live or demo),
  redrawn when the loop's key changes (`$.ui.invalidate('ui.render')` from the 1 s timer).
- Tests (mod): each command's answer; demo on the band, and stopping it; the desktop draws an Svg
  under the cap; unknown args toggle.

### Task 5: README art, README, changelog, 1.0.0

- `tools/readme-art.ts` (bun) writes `docs/readme/*.svg` from the demo scenes.
- README: what it is, the art, install, commands, how it plays, credits. CHANGELOG.md. Version
  1.0.0 in plugin.json. Manual checklist section for plan 5.

---

## Decisions made without KaiC

Each with what it costs if he'd have chosen differently.

1. **Version 1.0.0**, with a `v1.0.0` tag and a GitHub release, since this finishes slice 1 and the
   plan list ends in "release". Cost: a version label; a tag and release are quick to redo.
2. **The SVG encoder changed:** one path of one-pixel strokes per colour instead of a rect per run
   (about a quarter of the size: 12 frames at 120 columns in 35k characters, where the spike's rects
   needed 164k), and the band's text drawn as `<text>` in its cells. Cost: if a surface draws the
   strokes softly, back to rects with fewer frames.
3. **The desktop shows him at the rest spot between turns**, not walking there: it has no frame
   timer, only loops. Cost: the walk to the pier is terminal-only.
4. **The desktop band is about 8 px a column, at most 1400 px wide**, drawn in the sandboxed frame
   (`isInteractive`) as clawd-bar does. Cost: a size tweak.
5. **The demo is 18 scenes, about a minute, built with the real director**, so it always shows what
   the game really does. It has its own HUD (Lv.7, then Lv.8 after the boss), and the real road
   waits while it plays. Cost: scene order and length are taste.
6. **`/rpg` with anything other than stats, demo or doctor toggles the band, as before.**
7. **README pictures:** five loops at 150 columns (battle, party, boss and gate, rest, zones), about
   1.1 MB together. Cost: page weight, or a different selection.

## Final review (fresh reviewer, Opus)

No Critical findings. Fixed, each with a test that failed first:
- Once a desktop or phone had drawn the band and stopped, the 1 s timer asked for a redraw every
  second for the rest of the session: it now asks once per change, and a hidden band stops it.
  Test: mod "a desktop band that has gone away is not redrawn every second".
- With only the desktop showing the band, the road never moved: he stood still through every walk,
  and after a boss stayed in front of the gate. The 1 s timer now walks the road when no terminal
  band paints it. Test: mod "with only the desktop showing the band, he still walks the road".

Deferred minors:
- `resumeAt` adds about 40 characters after the size check (loops measure at most 59.5k of 131k).
- `/rpg doctor`'s "last one N s ago" keeps growing between turns, since identical frames aren't sent.
- `/rpg stats` with a save from a newer build shows this session's in-memory progress without saying so.
- A store that throws at start-up means the 1 s timer never starts (older code; the desktop now
  leans on it too).
- `/rpg stats` lists foes by their ids (`shroom ×3`, `bug ×1`), not their names.
- SVG text relies on `white-space:pre` alone; `xml:space="preserve"` would also cover WebKit.
- Review Focus tests not written as mod tests: a redraw resuming mid-loop, the "widen past 40"
  message, stats with a newer or broken save, live beats at 120 columns (all handled in code).
- `/rpg stat` (a typo) or `/rpg demo stop` hides the band (decision 6).
- Nits: an O(n²) array copy in `strokes`, a literal 50 for `CLAWD_COL` in `altOf`, `ZONE_NAMES` in
  two files, VS Code also gets the Svg but the docs only name the desktop and phone.

