// Mulberry32: small, fast, and good enough for fixture data. Chosen over
// Math.random so a given seed always produces the same archive.
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;

  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Mixes an index into a seed so every document gets its own reproducible stream.
export function seedAt(seed: number, index: number): number {
  let hash = (seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  return (hash ^ (hash >>> 16)) >>> 0;
}

// Picks an element deterministically from a non-empty list.
export function pick<T>(random: () => number, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)] as T;
}

// Returns an integer in [min, max].
export function intBetween(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

// Returns a float in [min, max).
export function floatBetween(random: () => number, min: number, max: number): number {
  return min + random() * (max - min);
}

// Reports whether a weighted coin flip came up true.
export function chance(random: () => number, probability: number): boolean {
  return random() < probability;
}
