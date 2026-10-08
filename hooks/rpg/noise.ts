export const mod = (a: number, n: number) => ((a % n) + n) % n

export const on = (t: number, ms: number) => Math.floor(t / ms) % 2 === 1

// Deterministic 0..1 from any number, so every frame is a pure function of time and position.
export function noise(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

export const pick = <T>(items: readonly T[], t: number, ms: number): T => items[Math.floor(t / ms) % items.length]!
