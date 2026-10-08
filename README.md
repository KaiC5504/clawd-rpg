# clawd-rpg

Clawd, Claude Code's crab, goes on an adventure in the band above your prompt. Your session plays
the game: reading is walking, an edit is a battle, a failing test is the enemy's turn, a passing run
is the finisher, subagents join his party, and a finished turn is a victory with loot named after
the file you worked on. Between turns he walks off to rest: the pier, a campfire, the inn. He levels
up the more you use Claude Code, and new zones open as he does.

<img src="docs/readme/battle.svg" alt="An edit brings a goblin down from the trees and Clawd strikes it with CLAW STRIKE; a failing test is the enemy's turn (COUNTER ✗2) and he's knocked back; a passing run is the ALL-OUT ATTACK that finishes it. The HUD sits bottom-right: level, EXP, HP for context left and MP for usage left.">

Unofficial fan mod. Clawd belongs to Anthropic. Sibling of [clawd-bar](https://github.com/KaiC5504/clawd-bar).

## Install

```
claude plugin marketplace add KaiC5504/clawd-rpg
claude plugin install clawd-rpg@clawd-rpg
```

Then start a new Claude Code session, or run `/reload-plugins` in the one you have open. If you
also use clawd-bar, hide its band with `/clawd` so the two don't stack.

Built and tested on Claude Code 2.1.294, in Windows Terminal at about 180 columns. `/rpg doctor`
checks the setup.

**Update:** `claude plugin marketplace update clawd-rpg`, then
`claude plugin update clawd-rpg@clawd-rpg`, then restart. **Uninstall:**
`claude plugin uninstall clawd-rpg@clawd-rpg`. What changed is in the [changelog](CHANGELOG.md).

## Commands

| Command | What it does |
|---|---|
| `/rpg` | Hide the band, or bring it back (remembered across sessions) |
| `/rpg stats` | His level and EXP, the zone and how close its boss is, what's open, and every foe he's met |
| `/rpg demo` | Plays a scripted day on the road above the prompt: every beat, zone and rest spot. Run it again to stop. It never touches your progress |
| `/rpg doctor` | Is the band up and painting, is the save healthy, is clawd-bar's band on too |

## How your session plays

| Claude Code | On the road |
|---|---|
| Thinking, reading, searching | He walks through the zone; many calls in a few seconds and he hurries |
| An edit, a new file, a command, an MCP tool | A foe drops in and each call is a skill: CLAW STRIKE, SCRIBE SLASH, SHELL SHOCK, LINK BEAM. Two to four hits win the battle |
| A failing test or a tool error | The enemy's turn: COUNTER ✗N, he's knocked back, and an elite stands for the failure |
| A passing test run | ALL-OUT ATTACK finishes the foe |
| A subagent starts | A mini Clawd joins the party: Explore is a scout, Plan a mage, general-purpose a knight. Its edits are its own attacks, and when it's done its class attack lands |
| The turn ends | Victory: a chest, loot named after the file you edited most, EXP |
| Waiting for you | He walks to the pier and fishes |
| A minute idle | On to the zone's rest spot: a campfire, the Dungeon's crystal room, Neon City's ramen stall |
| Ten minutes idle, or `/compact` | The inn: asleep in bed, HP refilling |
| Claude needs you | He turns to you with a `!` |
| You interrupt | He skids to a stop and the foe flees |
| Usage limit used up | MP is empty and he trudges |
| A task list | The quest line in the top-left: `☐ 2/5 fix login` |

<img src="docs/readme/party.svg" alt="Subagents drop in behind Clawd as mini Clawds in his orange, a knight with a helmet and shield and a mage with a hat and staff, each named as it joins; when the mage's subagent finishes, its ARCANE BOLT flies at the foe.">

## Levels, zones and bosses

EXP comes from deeds, not tokens: a battle won +10, an elite (a failing test, then fixed) +25, a
boss or a turn with a party +60, any finished turn +5. Each level needs 50 + 25 × level.

Every zone has a meter of 12 battles. When it's full, the next turn that fights is a boss fight.
Beat the boss and a gate stands on the road; he walks through it into the next zone he has
unlocked, and once he has seen them all the road comes back round to the forest.

| Zone | Opens | Foes | Boss | Rest spot |
|---|---|---|---|---|
| Enchanted Forest | Lv.1 | goblins, mushrooms | Treant | campfire |
| Dungeon | Lv.3 | slimes, skeletons | Merge Hydra | crystal room |
| Neon City | Lv.6 | drones, glitch bugs | Mech | ramen stall |

Progress is shared by every session and repo.

<img src="docs/readme/boss.svg" alt="The Treant fills the band with its health along the top and ★ BOSS · TREANT in the corner; it falls, the chest gives Treant Heartwood and LEVEL UP flashes over the HUD, then Clawd walks through a stone gate with a purple portal into the Dungeon.">

<img src="docs/readme/rest.svg" alt="Between turns: Clawd fishes at the end of a pier under the moon (waiting for you…), turns to you with a ! when Claude needs you, then after a minute sits on a log by the campfire with the tent on the right (idle · warming up).">

<img src="docs/readme/zones.svg" alt="The Dungeon's brick halls and torches with a slime; the crystal room where he sits by the floating save crystal; Neon City's towers and rain with a glitch bug; the ramen stall where he sits at the counter with a steaming bowl; and the inn, asleep under a red blanket by the fireplace (z Z · HP refilling).">

## The band

Five rows of half-block pixels across the whole terminal, redrawn about six times a second. The
HUD sits bottom-right: `Lv.7 ▰▰▰▱▱  HP █████  MP ████  ⚑ repo/branch`. HP is the context left and
MP the 5-hour usage left. As the terminal narrows the HUD drops the repo, then MP; below 100
columns the band shows only Clawd and the place he's in, and below 40 it hides.

The desktop app's Code tab and the phone app play short loops of the same scene.

## Credits

Clawd is Anthropic's. This is an unofficial fan project, not made or endorsed by Anthropic. Every
picture here is drawn by the plugin's own code (`bun run tools/readme-art.ts`).
