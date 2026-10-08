# Manual testing

Everything the automated tests can't see: how the band looks and feels in a real terminal. Run it
once all plans are in, top to bottom. Each plan adds its own section when it lands.

## Setup

1. In Claude Code: `/plugin marketplace add D:\Repos\Apps\clawd-rpg`, then
   `/plugin install clawd-rpg@clawd-rpg` (once; after that `/reload-plugins` re-reads the folder).
2. Turn clawd-bar's band off with `/clawd` so the two don't stack.
3. Check at your usual width first (184-column terminal, band 179 wide), then narrow it.

## Plan 1: the forest band

- [ ] The forest band sits above the prompt, full width, 5 rows; Clawd stands about 50 columns in.
- [ ] Ask for something long ("read every file in this repo and summarise it"): Clawd walks and
      the forest scrolls smoothly, with no hitch or stutter (the scroll fix), no flicker, and typing
      in the prompt stays quick.
- [ ] When Claude stops, Clawd stops walking and idles.
- [ ] HUD at bottom-right: `Lv.1`, the EXP bar, HP and MP bars, `⚑ folder/branch`, with no dark
      box behind it and every glyph drawn (no `?` or empty boxes).
- [ ] HP follows the context used and MP the 5-hour limit used, roughly matching `/context` and
      your usage page.
- [ ] Switch branch (`git switch` in the repo), send a prompt: the HUD shows the new branch.
- [ ] Resize: the band refills the width; below 100 columns Clawd moves to the left edge and the
      HUD shrinks to `Lv.N  HP …`; below 40 the band disappears; widen again and it comes back.
- [ ] `/rpg` hides the band, `/rpg` again brings it back; hidden stays hidden after a restart.
- [ ] Task Manager while Claude works at full width: Claude Code's CPU with the band on vs hidden
      (`/rpg`). Note both numbers; a large gap is worth raising.
- [ ] The Claude desktop app's Code tab shows no band yet (that's plan 5) and nothing breaks there.

## Plan 2: battles and progression

Ask for something that edits a file and runs the tests, e.g. "add a comment to README.md and run
claude plugin test .". To see a failing run, ask Claude to add a deliberately failing test first.

- [ ] An edit: a goblin or mushroom drops from the trees, a red `CLAW STRIKE` banner slides in,
      Clawd steps up and swings, the foe flashes and its HP pips drop. A new file is
      `SCRIBE SLASH`, a command `SHELL SHOCK`.
- [ ] 2–4 hits defeat a foe; the next edit brings the next one down.
- [ ] A failing test run: a black `COUNTER ✗N` banner (N = failed tests), Clawd's eyes shut,
      sparks, and the foe gets a gold crown. Edits alone don't finish a crowned foe.
- [ ] A passing run after that: `ALL-OUT ATTACK!!`, a dust cloud and a burst; the foe goes down.
- [ ] The turn ends: Clawd cheers, a chest opens, `◆ <Loot> of <file> · +N EXP` appears
      top-left, and the HUD's EXP bar grows.
- [ ] A few turns in (75 EXP for level 2): `LEVEL UP!  Lv.2` flashes above the HUD and the HUD
      shows `Lv.2`.
- [ ] Open a second Claude Code window (any repo): it shows the same level.
- [ ] Press Esc mid-fight: the foe leaps up and away, no chest, no EXP added.
- [ ] Claude asks you something (a permission prompt or a question): a `!` shows beside Clawd,
      who faces you.
- [ ] Edit a file with a non-English name (e.g. create `日本語.ts` and ask Claude to change it):
      the loot reads `of ???.ts` and the band keeps drawing.
- [ ] Run `/compact` between turns, then do another turn: fights and victories still work.
- [ ] With the 5-hour limit used up (MP empty), Clawd trudges at half pace.
- [ ] At 100–120 columns, mid-fight: the sword still reaches the foe, and no banner or loot text
      covers Clawd.
- [ ] Throughout: Clawd is always his own orange and no text sits on top of him; foes never
      cover the HUD.
- [ ] Judge the motion: foes drop in, Clawd steps back, banners slide (smooth movement). The spec
      said "cut between frames, never tweened"; say if you'd rather have hard cuts.

Known and left for later (don't count these as failures):
- A failed file read or search with no foe on screen still plays `COUNTER ✗1` at nothing.
- A window already open shows another session's level-up only after `/reload-plugins`.
- An edit you reject at the permission prompt still lands a hit.
- A queued message sent while Claude works may clear the current foe without a victory.
- Subagents' tool calls count as Clawd's hits (the party arrives in plan 4).


## Plan 3: rest spots, pace and the quest line

Rest spots come into view between turns, so most of this is watching the band while you read
Claude's answer or step away.

- [ ] A turn ends: after the victory, Clawd hurries right; a `→ Pier` signpost passes, the lakeside
      pier slides in and stops exactly filling the band. He stands at the end of the jetty with
      his rod out and a bobbing float; now and then the float dips and a fish flies in. Top-left:
      `waiting for you…`.
- [ ] Leave it a minute: he walks on to the campfire and sits on the log by the fire, tent on the
      right. Top-left: `idle · warming up`.
- [ ] Leave it ten minutes: on to the inn, asleep in bed under the red blanket by the fireplace.
      Top-left: `z Z`.
- [ ] `/compact` between turns: he goes straight to the inn, top-left `z Z  ·  HP refilling`, and
      the HUD's HP bar fills as the context drops.
- [ ] Send a prompt while he rests: he reels in (or gets out of bed), then walks right, out of the
      rest spot and back into the forest.
- [ ] Send a prompt while he's still on his way to a spot: no packing up, he goes straight back to
      work.
- [ ] A new Claude Code window: he heads for the pier while waiting for your first prompt.
- [ ] His walk is the waddle: each pair of legs lifts in turn while the arm on that side swings up.
      Out of usage, half pace with both arms hanging.
- [ ] While Claude thinks or reads, a steady walk; when Claude fires off several tool calls in a
      few seconds, he hurries (faster scroll and quicker steps).
- [ ] Out of usage (MP empty), every pace is halved.
- [ ] Ask Claude to plan a few steps as tasks: the top-left reads `☐ 1/4 <the task in progress>`
      while he works, updates as tasks finish, and goes away once all are done.
- [ ] Claude asks you something while he rests: he puts the rod down and turns to you with a `!`
      (in bed he sits up).
- [ ] Resize the window while he rests: the band still shows only the rest spot.
- [ ] Below 100 columns: the rest spots still show, with Clawd at the left; no signpost names or
      captions.
- [ ] Throughout: Clawd is always his own orange; no text sits on him; the band never flickers
      or drops out.
- [ ] Judge the look: at some widths the campfire's tent stands under the HUD text (as in the
      sketch). Say if it should move.

Known and left for later (don't count these as failures):
- The Dungeon's crystal room, Neon City's ramen stall and the gates between zones come with those
  zones in plan 4.

## Plan 4: zones, bosses and the party

A boss needs 12 battles won in a zone, so the boss and gate checks come up after a few working
sessions; `/rpg demo` (plan 5) shows every one of them straight away.

- [ ] Ask Claude to use a subagent ("use an Explore agent to find where X is defined"): a mini Clawd
      in his orange drops in behind him with a class (Explore: green hood and bow, Plan: purple hat
      and staff, general-purpose: helmet and shield), and `SCOUT JOINS!` (or MAGE / KNIGHT) shows
      over its head. Up to three walk behind him.
- [ ] When that subagent finishes, its attack lands on the foe (an arrow, a bolt or a slash), named
      over its head (`QUICK SHOT`, `ARCANE BOLT`, `SHIELD BASH`). A subagent's own reads never
      bring a foe; its edits are its attacks, not Clawd's CLAW STRIKE.
- [ ] A subagent's own todo list doesn't replace your quest line in the top-left.
- [ ] The turn's victory with a party pays 60 EXP more (`+65 EXP` for a turn with no fight).
- [ ] Once the zone meter is full, the next turn that edits brings the boss: Treant in the forest,
      Merge Hydra in the Dungeon, Mech in Neon City. It fills the band's height, its health runs
      along the top row over it, and the top-left reads `★ BOSS · TREANT`. Nothing of it touches
      the HUD, at 179 columns and at 100.
- [ ] The boss takes six blows, or one passing test run; a finished turn also brings it down. The
      loot is the boss's (`◆ Treant Heartwood`).
- [ ] Beating the boss at Lv.3 or more: right after the victory a stone gate with a purple portal
      stands just ahead, `DUNGEON` (or `NEON CITY`) over it; he walks through it to the pier, and
      from then on the road is the new zone. Below Lv.3 he stays in the forest.
- [ ] The Dungeon: brick walls, torches, slimes and skeletons. Neon City: towers, flickering signs,
      rain, drones and glitch bugs.
- [ ] A minute idle in the Dungeon: he sits on a stone bench by the floating save crystal
      (`idle · by the save crystal`). In Neon City: on a stool at the ramen stall under the awning,
      the counter over his lap and a steaming bowl by him (`idle · slurp…`). Signposts read
      `→ Crystal` and `→ Ramen`.
- [ ] A second Claude Code window after the zone changed: its next prompt walks him through a gate
      into the new zone too, no sudden cut.
- [ ] Throughout: Clawd and the mini Clawds are always his orange; no text sits on him.

Known and left for later (don't count these as failures):
- A rejected edit still lands a hit: the call is seen before you answer the permission prompt.
