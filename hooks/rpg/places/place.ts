import type { Grid } from '../grid'

// A place paints one column at a time so it fills any width: `lx` is the column within the place,
// `cam` the camera's position (for parallax layers), `pw` the place's own width.
export type Place = {
  col(g: Grid, x: number, lx: number, t: number, cam: number, pw: number): void
}
