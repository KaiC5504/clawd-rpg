# clawd-rpg Plan 4 — Zones, bosses and the party

> Written and built overnight while KaiC slept, at his request ("work on plan 4 and plan 5 together").
> The design talk that normally comes first didn't happen: every call he would have made is listed
> under **Decisions made without KaiC** at the end, each with what it costs if he disagrees. Built
> inline (superpowers:executing-plans), test first, one fresh review of the whole branch at the end.

**Goal:** The road gains the Dungeon and Neon City, with their own foes and rest spots (crystal room,
ramen stall); every zone has a boss once its meter fills, beating it sends Clawd through a gate to
the next unlocked zone, and subagents join him as mini Clawds that fight beside him.

**Architecture:** The story learns which zone he walks (`zone`) and where the last gate stands
(`gate`); the road draws each column from the zone it falls in. A trip remembers its zone, so its
middle stop is that zone's rest spot. Bosses are foes with `boss: true`, spawned on a boss turn
(`turn.boss`, set from the zone meter at the prompt). Beating one is a `raid` award that also clears
the zone in `progress.ts`; `register.tsx` then puts a gate on the road ahead. The party comes from
`classic.SubagentStart` / `SubagentStop`, and a subagent's own calls (`tool.call`'s `agentId`) are its
attacks, not Clawd's.

**Spec:** `docs/superpowers/specs/2026-10-09-clawd-rpg-design.md` (§3.1, §3.2, §3.3, §3.5, §5).
Art reference: `docs/sketches/rpg-sketchbook.html`, "v3 · The world" (reference, not code to port).

## Global Constraints

- Clawd's body colour `0xde886d` never changes; mini Clawds use the same orange, gear sits outside
  their body pixels.
- Stopped scenes fill the band with one place, at every width from 100 to 300.
- Text cells take the pixel beneath as background; no text over Clawd's pixels.
- No enemy pixel inside the HUD's columns on the HUD row; foes stop 14+ columns left of the HUD
  (a boss's right edge stays 6 columns clear of it, the same gap an 8-wide foe has today).
- Frames are pure functions of (story, time, width).
- Comments sparse, only the why; commits without attribution trailers.

## Review Focus

1. **A save from plan 3** (story without `zone`, `gate`, `party`; trips without `zone`) must load and
   draw as the forest. Tests: director + frame.
2. **Another session clears the zone** while this one rests: the next prompt walks him through a gate,
   never a cut. Test: director (`passGate` on a prompt).
3. **Background subagents after the turn ended**: SubagentStop with no turn must not spawn a foe or
   reopen the fight. Test: director.
4. **A boss at narrow widths (100–120)**: no boss pixel reaches the HUD. Test: frame visual rules.
5. **Zone order when only some zones are unlocked** (beat the Treant at Lv.2: stays in the forest,
   no gate). Test: progress + mod.

---

### Task 1: Zone art — Dungeon, Neon City, the gate, crystal room, ramen stall

**Files:** create `hooks/rpg/places/dungeon.ts`, `neon.ts`, `crystal.ts`, `ramen.ts`, `gate.ts`;
modify `types/index.d.ts` (`RestKind`), `tests/places.test.ts`.

**Produces:**
- `DUNGEON`, `NEON: Place` (zones: `col` only, any width, parallax on `cam`).
- `CRYSTAL`, `RAMEN: Place` (rest spots: `col`, `props`; ramen also `front`, the counter over his lap).
- `gateCol(g, x, lx, t)`: the portal arch, `GATE_W = 14` columns, drawn over the zone columns.
- `RestKind = 'pier' | 'camp' | 'crystal' | 'ramen' | 'inn'`.

**Tests (places.test.ts):** every new place fills all 10 pixel rows of every column at widths 100,
179, 300 (no holes); the rest spots keep their key prop inside the band at 100 and 300 (crystal's
gem, ramen's awning); the gate's pillars are stone-grey and its middle a purple portal.

### Task 2: Foes and bosses

**Files:** modify `hooks/rpg/sprites/foes.ts`, `types/index.d.ts` (`FoeKind`, `Foe.boss`), tests
`tests/art.test.ts`.

**Produces:**
- `FoeKind` adds `'slime' | 'skeleton' | 'drone' | 'bug' | 'treant' | 'hydra' | 'mech'`.
- `FOES[kind]` for all of them; bosses are 9 px tall (head at pixel row 1) and up to 20 wide.
- `foeTop(kind)`; the drone hovers (top row 2, bobbing a pixel).
- `foeWidth(kind)`.

**Tests:** each look's frames are all the same size as its `w × h`; no foe or boss uses Clawd's orange;
bosses are 9 tall; the drone is off the ground.

### Task 3: Progress — boss award clears the zone

**Files:** modify `hooks/rpg/progress.ts`, `tests/progress.test.ts`.

**Produces:**
- `Award = { kind; foe?: string; boss?: true }`.
- `gain(p, { kind: 'raid', boss: true })`: +60 EXP, zone meter back to 0, `zone` moves to the next
  unlocked zone after the current one (forest → dungeon → neon, cycling; itself if it's the only one).
- `nextZone(p): ZoneId`, `bossDue(p): boolean` (meter full).

**Tests:** boss at Lv.2 stays in the forest with the meter reset; at Lv.3 goes to the dungeon; at Lv.6
from neon cycles to the forest; a level gained by the boss's own EXP counts (Lv.2 → 3 by that award
unlocks the dungeon and he goes there); a plain raid (party) doesn't clear.

### Task 4: Director — zones, bosses, gates, party

**Files:** modify `hooks/rpg/director.ts`, `types/index.d.ts`, `tests/director.test.ts`.

**Produces:**
- `Story.zone: ZoneId`, `Story.gate: { x: number; from: ZoneId } | null`,
  `Story.party: Member[]`, `turn.boss: boolean`, `turn.bossDown: FoeKind | null`, `Trip.zone?: ZoneId`.
- `Member = { id: string; cls: 'knight' | 'mage' | 'scout'; at: number; doneAt: number | null }`.
- `ROSTERS: Record<ZoneId, FoeKind[]>`, `BOSSES: Record<ZoneId, FoeKind>`, `BOSS_HP = 6`.
- `classOf(agentType)`: Explore → scout, Plan → mage, general-purpose → knight, others by a stable hash.
- `passGate(s, to, x)`: gate at road pixel `x`, story and its current trip now in zone `to`.
- `GATE_AFTER = 66` (past a trip's origin), `GATE_AHEAD = 90` (past where he stands, for a prompt).
- Events: `SessionStart` / `UserPromptSubmit` read `payload.zone` and `payload.boss`; `SubagentStart`
  adds a member (turn active only, max 3 drawn but all counted); `SubagentStop` lands its class attack
  (`SHIELD BASH`, `ARCANE BOLT`, `QUICK SHOT`) on the foe; `PreToolUse` with `agent_id` is that
  member's attack (no foe spawned for a subagent's reads); a party turn that ends as an answer earns a
  `raid`; a boss down earns `{ kind: 'raid', boss: true }` and names the loot after the boss.
- `Story.skill.party?: true` so the banner shows in party blue.

**Tests:** forest roster stays goblin/shroom; dungeon/neon spawn their own; a boss turn's first foe is
the zone's boss with 6 HP and later foes are normal once it falls; finisher on a boss; interrupt
lets the boss flee and the next prompt still has `boss`; SubagentStart → member with class;
SubagentStop → banner + hit; subagent PreToolUse edit → party banner, Clawd's skill untouched;
subagent read → nothing; SubagentStop with no turn → nothing; party turn → raid award; prompt with
another zone → gate ahead; story from plan 3 (no zone) loads as forest.

### Task 5: Road and frame — zones on the road, gates, the party, bosses on screen

**Files:** modify `hooks/rpg/road.ts`, `hooks/rpg/frame.ts`, `hooks/rpg/sprites/` (new `mini.ts`),
`hooks/rpg/sprites/fx.ts` (class attacks), tests `tests/road.test.ts`, `tests/frame.test.ts`.

**Produces:**
- `stopsOf` uses the trip's zone: pier, then `NOOK[zone]` (camp / crystal / ramen), then the inn.
- `zoneAt(story, wx)`: the gate's `from` zone left of it, the story's zone from it on.
- Frame: road columns from `zoneAt`; the gate arch with a `→ Dungeon` / `→ Neon City` sign; boss
  name and HP in the top row (`★ TREANT ▮▮▮▮▱▱`); mini Clawds behind him (drop in, walk, cheer, their
  class attack); `foeX` takes the foe's width.
- New rest captions and signs (`→ Crystal`, `→ Ramen`).

**Tests:** frame visual rules over the new beats (boss at 100/150/179/220/300; party walking;
every rest kind at 100–300: band contains only that place); mini Clawd body pixels are all orange;
a gate on the road draws the old zone left and the new one right; trip from plan 3 (no zone) gets
the campfire.

### Task 6: Wiring and the checklist

**Files:** modify `hooks/register.tsx`, `tests/mod.test.tsx`, `docs/manual-testing.md`.

- Prompt/session payloads carry `zone` and `boss` from progress; after a `TurnEnded` (or prompt)
  whose progress zone differs from the story's, `passGate`.
- `tool.call` (every tool) replaces `classic.PreToolUse` as the call observer, so `agentId` arrives;
  Bash/PowerShell results keep settling there.
- `classic.SubagentStart` / `classic.SubagentStop` observed.
- Manual checklist section for plan 4.

**Tests (mod):** a full meter makes the next turn a boss turn, and finishing it saves zone `dungeon`
at Lv.3 with the meter at 0, then walks him through a gate; a SubagentStart draws a mini Clawd;
a rejected edit (tool.call deny) no longer lands a hit.

---

## Decisions made without KaiC

Filled in as they're made, with the cost if he'd have chosen differently.
