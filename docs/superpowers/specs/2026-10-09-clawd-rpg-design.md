# clawd-rpg — design

Date: 2026-10-09 · Status: draft for review · Owner: KaiC

## 1. What it is

clawd-rpg is a Claude Code plugin that turns the band above the prompt into a small side-scrolling
RPG. Clawd — the big 0.3.0 Clawd from clawd-bar — travels a road through themed zones while Claude
works. Real session events drive the game: reading is walking, edits are fights, a failing test is
the enemy's turn, subagents join as a party, a green test run is the finisher, and a finished turn is
a victory with loot and EXP. When Claude is idle, Clawd walks to a rest spot (pier, campfire, inn) and
waits there. He levels up across every session and repo.

It is a new repo and a new product, separate from clawd-bar. clawd-bar stays at 0.7 as it is.

The agreed look is recorded in `docs/sketches/rpg-sketchbook.html` (open it in a browser; the "v3 · The
world" section is the target). The sketches are reference, not code to port.

### Goals
- A game you watch, not numbers you read: every mechanic shows up as animation.
- Feels like one continuous journey: Clawd walks everywhere; scenes never cut.
- Levelling that changes what you see (zones, gear, party, bosses).
- Works at any terminal width.

### Non-goals (slice 1)
- Player input beyond slash commands (clicking the band is a later idea, needs an API check).
- CI races, Clawd on Desk bridge, ntfy pushes (clawd-bar features; may return later as raids).
- Gear and headgear unlocks, bestiary screen, zones beyond the first three (later slices).

## 2. Decisions already made

| Topic | Decision |
|---|---|
| Hero | Big Clawd from clawd-bar 0.3.0 (`D:\Repos\Apps\clawd-bar-backups\installed-0.3.0-20261005-2134\hooks\sprites.ts`), 15 × 9 px, shadow row dropped |
| Clawd's colour | `#de886d`, never changed: not for gear, damage, rarity or silhouettes |
| Band | 5 rows (10 px) × full terminal width, half-block pixels (1 × 2 per cell, each pixel its own colour) |
| Flow | One continuous road; zones reached by journey progress |
| Rest spots | Their own full-width scenes; Clawd walks to them |
| Stopped scenes | Always fill the whole width; two places share the band only mid-walk |
| Band text | No background box: each text cell's background is the scene pixel beneath it |
| HUD | Bottom-right, in-world: `Lv · EXP · HP (context) · MP (5h limit) · ⚑ repo/branch` |
| Party | Subagents are mini Clawds: ~2/3 size, his orange, class gear |
| EXP from | Battles won, bosses/raids, turns completed (not tokens) |
| Level unlocks | Weapons, headgear + capes, zones, party classes + bosses |
| Tempo | 0.5× of the sketch page: ~160 ms frames, ~320 ms leg steps |
| Desktop Code tab | Terminal first; desktop gets short SVG loops per moment (after a spike) |
| Name | clawd-rpg |

## 3. The experience

### 3.1 The road
The world is a road running right, made of places laid end to end:

- **Zones** (where work happens): wide, scrolling, themed, with an enemy roster and a boss.
- **Rest spots** (where idle happens): exactly one band wide, so a stop always fills the screen.
- **Gates** between zones: a portal arch; only ever seen mid-walk.

Every place draws itself column by column for any width: key props are pinned to the left (near
Clawd's spot) or to the right edge, and the gap between fills with more of the place (trees, wall
planks, water). Extras (a table, barrels, a vending machine) appear only when there is room.

Clawd stands at a fixed screen column (≈ 50) while he walks; the camera follows him. When he stops at a
rest spot, the camera lines up exactly on that place.

### 3.2 Session events → what happens

| Claude Code | On the road |
|---|---|
| Thinking, Read, Grep, Glob, WebFetch | Walking through the zone; pace follows activity |
| Edit, Write, non-test Bash, MCP calls | Encounter: an enemy from the zone roster walks in and stops left of the HUD; each call is a skill (banner across the band: Edit → CLAW STRIKE, Write → SCRIBE SLASH, Bash → SHELL SHOCK, MCP → LINK BEAM); 2–4 hits defeat it |
| Test run fails / tool error | Enemy's turn: banner `COUNTER ✗N`, Clawd knocked back (eyes shut, sparks; never recoloured); an elite enemy stands for the failure |
| Fix edits after a failure | Attacks on the elite |
| Test run passes | ALL-OUT ATTACK finisher on the elite / current enemy |
| Subagent starts | A mini Clawd drops in (class from subagent type: Explore → scout, Plan → mage, general-purpose → knight, other → random); a turn with subagents is a raid |
| Subagent finishes | Its class attack lands |
| Turn complete | Victory: chest, loot named after the file most edited (`Blade of scenes.ts`), EXP, level-up flash |
| Waiting for you (right after a turn) | Walks to the **pier** and fishes |
| Idle ≥ 60 s (clawd-bar's `DOZE_AFTER_MS`) | Walks to the zone's rest spot (Forest → campfire, Neon City → ramen stall, Dungeon → crystal room) |
| Idle ≥ 10 min (`SLEEP_AFTER_MS`) | Walks to the **inn**, sleeps in bed |
| Compact | Goes to the inn (walks there if not already); HP refills as context drops |
| New prompt while resting | Packs up (reels in, stands from bed) and walks back into the zone |
| Claude needs you (Notification, Elicitation) | Turns to the camera with `!` wherever he is |
| Interrupt | Skids to a stop, enemy flees |
| 5h limit used up | MP empty, Clawd trudges (slower walk) until it resets |

### 3.3 Progression
- **EXP:** battle won +10, elite (failed test then fixed) +25, raid/boss +60, turn completed +5.
- **Levels:** EXP to next level = 50 + 25 × level. Level shows as `Lv.N` + a 5-cell EXP bar.
- **Zones:** each zone has a progress meter (battles won in it). When it fills (slice 1: 12 battles),
  the next turn is a boss turn; beating the boss sends Clawd through the gate to the next unlocked
  zone. Zones cycle once all unlocked ones are cleared.
- **Unlock levels (slice 1):** Forest Lv.1, Dungeon Lv.3, Neon City Lv.6. Later slices add
  weapon/headgear/cape unlocks and party classes per level.
- Progress is shared across every repo and session.

### 3.4 HUD
Bottom-right of the band, one text row, no box (cells take the floor colour beneath):
`Lv.7 ▰▰▰▱▱  HP █████  MP ████  ⚑ my-app/main`.
HP = 100 − context %; MP = 100 − 5h usage %. As the terminal narrows the HUD drops the repo, then MP.
Enemies always stop at least 14 columns left of the HUD's first cell. A task list, when present,
shows as a quest line in the top-left (`☐ 2/5 fix login`).

### 3.5 Slice 1 places
| Place | Kind | Notes |
|---|---|---|
| Enchanted Forest | zone | goblins, mushrooms; Treant boss |
| Campfire clearing | rest (Forest) | log seat, fire, tent pinned right |
| Dungeon | zone | slimes, skeletons, torches; Merge Hydra boss |
| Crystal room | rest (Dungeon) | save crystal |
| Neon City | zone | rain, neon, glitch drones; mech boss |
| Ramen stall | rest (Neon) | Clawd on a stool, counter in front, steam |
| Lakeside pier | shared rest | fishing; boat and moon pinned right |
| The Crab & Quill inn | shared rest | fireplace, bed with blanket, bar counter pinned right |

### 3.6 Narrow terminals
Below 100 columns the world can't fit a fight left of the HUD. The band then shows a compact view:
Clawd plus the current place's backdrop, no enemies, HUD trimmed to `Lv · HP`. Below 40 columns the
band is hidden.

## 4. Architecture

TypeScript plugin with function hooks (same model as clawd-bar: `hooks/hooks.json` →
`hooks/register.tsx`, no build step, tests via `claude plugin test .`).

```
hooks/
  register.tsx        wiring: events, commands, the AbovePrompt band, timers
  plumbing/           copied from clawd-bar (pure, already tested)
    events.ts           ← pet-state.ts applyEvent and timers (renamed to what it now does)
    work.ts             ← classifyCall / settleCall / testCounts
    activity.ts         ← turn clock, tool and file counts, tasks
    usage.ts            ← context and rate-limit reads
  rpg/
    director.ts       session state + events → Story (current beat, enemies, party, rest stage)
    progress.ts       EXP, levels, zone meters, unlocks; load/save with schema version
    road.ts           place layout along the road, camera, travel between places
    places/           one file per place: col(), props(), front(), roster
    sprites/          clawd.ts (big Clawd, poses), mini.ts, enemies.ts, props.ts
    hud.ts            HUD segments and width trimming
    frame.ts          (story, t, width) → pixel grid + text cells (pure)
    cells.ts          pixel grid → Raster cells: half blocks, text bg = pixel beneath
    svg.ts            desktop loops
types/index.d.ts      plugin state typing (as in clawd-bar)
tests/
```

### Data flow
1. Claude Code events → `plumbing/events.ts` (session facts: working, idle since, turn ended, …).
2. Session facts + events → `rpg/director.ts` reducer → **Story**: the current beat
   (`walk | encounter | enemyTurn | finisher | victory | travel | rest`), enemies and their HP,
   party members, rest stage, Clawd's road position and walk target.
3. Victory/battle outcomes → `rpg/progress.ts` → EXP/level/zone meter, saved to `$.store`.
4. A frame timer (~160 ms) renders `frame.ts(story, now, bodyColumns)` → `cells.ts` → `$.ui.blit` into
   the band's Raster, skipping identical frames (clawd-bar already does this).

The director and frame renderer are pure functions of their inputs, so every behaviour is testable
with a mock clock. Animation is cut between frames, never tweened (house style).

### State
- **Atoms** (session, survive hot reload): story, last painted frame, mode flags.
- **`$.store`** (across sessions): `progress` = `{ v: 1, exp, level, zone, zoneMeter, unlocked,
  bestiary, roadPos }`. Loads with defaults for missing fields (clawd-bar's hot-reload lesson);
  unknown versions are migrated or reset with a backup key.

### Commands
- `/rpg` — show/hide the band.
- `/rpg stats` — level, EXP, zone, bestiary counts as a message.
- `/rpg demo` — plays a scripted session through every beat (like clawd-bar's `/clawd demo`).
- `/rpg doctor` — checks width, Raster support, store health.

## 5. Visual rules (enforced by tests)
1. Big Clawd's body pixels are always `#de886d`; his outline matches the 0.3.0 sprite per pose.
2. Mini Clawds use the same orange; class gear sits outside their body pixels.
3. At rest stops the band contains exactly one place, at every width from 100 to 300 columns.
4. Every text cell's background equals the pixel colour beneath it.
5. No enemy pixel occupies a cell inside the HUD's columns on the HUD row.
6. Each frame is a pure function of (story, time, width).

## 6. Desktop (Code tab)
The Code tab plays pre-built SVG (131,072-character cap, restarts on redraw). Plan: one short loop per
beat (walk, encounter, victory, each rest spot) at a fixed 120-column width, rebuilt when the beat
changes. **Spike first:** measure SVG size of a 120 × 10 loop with ~12 frames; if it exceeds the cap,
drop to fewer frames or a narrower crop.

## 7. Testing
- Director: event sequences → expected beats (failed test → enemyTurn → fix → finisher; subagents →
  party; idle 60 s → rest stage 2; prompt while resting → travel back).
- Progress: EXP math, level thresholds, zone meter → boss → travel, save/load with missing fields.
- Rendering: the six visual rules above, over every beat and widths 100/150/220/300.
- HUD: trimming order by width.
- SVG: every loop under the size cap.
- `claude plugin validate .` and `claude plugin test .` in GitHub Actions (copied from clawd-bar).

## 8. Risks and spikes
| Risk | Check |
|---|---|
| Raster cost at 200+ columns every 160 ms | Spike: blit a 300 × 5 frame in a loop, watch CPU and flicker |
| Raster text cells with arbitrary bg per cell | Spike: one row of text over a gradient |
| Desktop SVG cap | Spike in §6 |
| Event coverage (subagent type, test detection) | Reuse clawd-bar's `work.ts`; add subagent type parsing |
| Two band plugins installed (clawd-bar + clawd-rpg) | README note; `/rpg doctor` warns if clawd-bar's band is also on |

## 9. Repo setup
- `D:\Repos\Apps\clawd-rpg`, public GitHub repo `KaiC5504/clawd-rpg`, MIT licence.
- Plugin manifest, marketplace entry, CI workflow and tsconfig modelled on clawd-bar.
- README with an animated hero image rendered by the plugin's own code (as clawd-bar does).
- Credits: Clawd belongs to Anthropic; unofficial fan project; inspired by clawd-bar.
- No co-author trailers in commits.

## 10. Later slices
- Slice 2: weapon/headgear/cape unlocks drawn outside Clawd's body, bestiary, Sky Isles zone (carpet
  battles), Frost Peak + hot spring.
- Slice 3: Sunken Reef + beach, Volcano + forge, party classes by level, `/rpg travel`, desktop polish.
