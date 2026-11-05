/** sfc32: small, fast, seedable PRNG. The simulation never touches Math.random, so runs are reproducible. */
export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: number) {
    this.a = 0x9e3779b9;
    this.b = 0x243f6a88;
    this.c = 0xb7e15162;
    this.d = seed >>> 0;
    for (let i = 0; i < 15; i++) this.next();
  }

  /** Uniform in [0, 1). */
  next(): number {
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return (t >>> 0) / 4294967296;
  }

  int(minInclusive: number, maxInclusive: number): number {
    return minInclusive + Math.floor(this.next() * (maxInclusive - minInclusive + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  normal(mean = 0, sd = 1): number {
    const u = 1 - this.next();
    const v = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** Picks a key of `weights` with probability proportional to its weight. */
  weighted<T>(entries: readonly (readonly [T, number])[]): T {
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let x = this.next() * total;
    for (const [value, w] of entries) {
      x -= w;
      if (x < 0) return value;
    }
    return entries[entries.length - 1]![0];
  }

  /** A child generator, so adding draws in one subsystem does not shift another. */
  fork(label: string): Rng {
    let h = this.d ^ 0x811c9dc5;
    for (let i = 0; i < label.length; i++) h = Math.imul(h ^ label.charCodeAt(i), 0x01000193);
    return new Rng(h >>> 0);
  }
}

/** Zipf–Mandelbrot sampler over ranks 0..n-1: P(r) ∝ 1/(r + 1 + q)^s. */
export class Zipf {
  private readonly cdf: Float64Array;

  constructor(n: number, s: number, q: number) {
    this.cdf = new Float64Array(n);
    let total = 0;
    for (let r = 0; r < n; r++) {
      total += 1 / Math.pow(r + 1 + q, s);
      this.cdf[r] = total;
    }
    for (let r = 0; r < n; r++) this.cdf[r]! /= total;
  }

  sample(rng: Rng): number {
    const x = rng.next();
    let lo = 0;
    let hi = this.cdf.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.cdf[mid]! < x) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }
}

export const logistic = (x: number): number => 1 / (1 + Math.exp(-x));
