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
