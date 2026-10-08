# Spikes (plan 1)

| Question | Result |
|---|---|
| Desktop SVG: chars for 12 frames at 120 columns (cap 131,072) | 164,064: over the cap. 8 frames at 96 columns: 97,877, which fits. About 12–14k chars a frame, so plan 5 has room for ~9 frames at 120 columns, fewer when wider. |
| Raster at full width every 160 ms: CPU with band on vs hidden, any flicker | Pending KaiC's manual check (plan 1, Task 7, Step 5.5) |
| HUD glyphs ▰ ▱ █ ░ ⚑ … render in KaiC's terminal | The test engine accepts all six in a mounted Raster; real terminal rendering pending KaiC's check |
| Text cells take any background colour | Pending KaiC's check (Step 5.4) |
