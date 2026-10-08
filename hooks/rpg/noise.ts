export const mod = (a: number, n: number) => ((a % n) + n) % n

export const on = (t: number, ms: number) => Math.floor(t / ms) % 2 === 1

// Deterministic 0..1 from any number, so every frame is a pure function of time and position.
export function noise(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
export const lerp = (a: number, b: number, q: number) => a + (b - a) * q
export const easeOut = (q: number) => 1 - (1 - clamp01(q)) ** 3
// How far `t` is through the span from `start` lasting `ms`, as 0..1.
export const through = (t: number, start: number, ms: number) => clamp01((t - start) / ms)

export const pick = <T>(items: readonly T[], t: number, ms: number): T => items[Math.floor(t / ms) % items.length]!
