# Changelog

## 1.0.0 — 2026-10-09

The first release: the whole of slice 1.

### Added
- The band: five rows of half-block pixels across the full terminal width, with Clawd (the big
  Clawd from clawd-bar 0.3.0) walking a road while Claude works, and a HUD of level, EXP, HP
  (context left), MP (5-hour usage left) and the repo and branch.
- Battles: edits, new files, commands and MCP calls are skills on foes from the zone's roster; a
  failing test is the enemy's turn with an elite, a passing run the ALL-OUT ATTACK; a finished turn
  is a victory with loot named after the file you edited most.
- Progress shared by every session: EXP, levels, a bestiary, and three zones that open by level:
  the Enchanted Forest, the Dungeon (Lv.3) and Neon City (Lv.6).
- Bosses: 12 battles fill a zone's meter, and the next turn that fights meets its boss (Treant,
  Merge Hydra, Mech). Beating it opens a gate to the next zone.
- The party: subagents join as mini Clawds (scout, mage, knight); their own edits are their
  attacks, and their class attack lands when they finish. A turn with a party is a raid.
- Rest between turns: the pier while he waits for you, the zone's own spot after a minute (campfire,
  crystal room, ramen stall), the inn after ten minutes or a compaction. A prompt packs him up and
  walks him back to work.
- Pace follows the session: a busy turn hurries him, an empty usage limit makes him trudge.
- The quest line: your task list in the top-left.
- `/rpg` to hide or show the band, `/rpg stats`, `/rpg demo`, `/rpg doctor`.
- The desktop app's Code tab and the phone app play short loops of the band.
