/**
 * Seeded Random Number Generator for deterministic game logic.
 * 
 * Uses the Mulberry32 algorithm - a fast, high-quality PRNG that produces
 * identical sequences for identical seeds across all platforms.
 * 
 * CRITICAL: All game logic requiring randomness MUST use this SeededRNG.
 * Using Math.random() will break determinism and cause browser/Firebase divergence.
 */

// =============================================================================
// Mulberry32 Algorithm
// =============================================================================

/**
 * Mulberry32 PRNG step function.
 * Returns the next random 32-bit integer and updates the state.
 */
function mulberry32Step(state: number): { value: number; nextState: number } {
  let t = (state + 0x6D2B79F5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0);
  return { value, nextState: (state + 0x6D2B79F5) | 0 };
}

// =============================================================================
// SeededRNG Class
// =============================================================================

/**
 * Seeded Random Number Generator.
 * 
 * Usage:
 *   const rng = new SeededRNG(12345);
 *   const random = rng.next();        // 0-1 float
 *   const dice = rng.nextInt(1, 6);   // 1-6 integer
 *   const shuffled = rng.shuffle([1, 2, 3, 4]);
 * 
 * For identical seeds, all operations produce identical results.
 */
export class SeededRNG {
  private state: number;
  private readonly initialSeed: number;
  private callCount: number;
  
  /**
   * Create a new SeededRNG with the given seed.
   * @param seed - Any 32-bit integer. Will be converted to unsigned.
   */
  constructor(seed: number) {
    // Ensure seed is a valid 32-bit unsigned integer
    this.initialSeed = seed >>> 0;
    this.state = this.initialSeed;
    this.callCount = 0;
  }
  
  /**
   * Get the initial seed used to create this RNG.
   */
  getSeed(): number {
    return this.initialSeed;
  }
  
  /**
   * Get the current internal state (for debugging/serialization).
   */
  getState(): number {
    return this.state;
  }
  
  /**
   * Get the number of random numbers generated so far.
   */
  getCallCount(): number {
    return this.callCount;
  }
  
  /**
   * Reset the RNG to its initial state.
   */
  reset(): void {
    this.state = this.initialSeed;
    this.callCount = 0;
  }
  
  /**
   * Create a clone of this RNG with the same current state.
   */
  clone(): SeededRNG {
    const clone = new SeededRNG(this.initialSeed);
    clone.state = this.state;
    clone.callCount = this.callCount;
    return clone;
  }
  
  /**
   * Generate the next random number in [0, 1).
   * This is the core method - all other methods use this.
   */
  next(): number {
    const { value, nextState } = mulberry32Step(this.state);
    this.state = nextState;
    this.callCount++;
    // Convert to [0, 1) range
    return value / 0x100000000;
  }
  
  /**
   * Generate a random integer in [min, max] (inclusive).
   * Uses rejection sampling to avoid modulo bias.
   */
  nextInt(min: number, max: number): number {
    if (min > max) {
      throw new Error(`Invalid range: min (${min}) > max (${max})`);
    }
    
    const range = max - min + 1;
    
    // For small ranges, simple modulo is fine (bias is negligible)
    if (range <= 256) {
      return min + Math.floor(this.next() * range);
    }
    
    // For larger ranges, use rejection sampling to avoid bias
    const threshold = 0x100000000 - (0x100000000 % range);
    let value: number;
    do {
      const { value: v, nextState } = mulberry32Step(this.state);
      this.state = nextState;
      this.callCount++;
      value = v;
    } while (value >= threshold);
    
    return min + (value % range);
  }
  
  /**
   * Generate a random boolean with the given probability of true.
   * @param probability - Probability of returning true (0-1). Default 0.5.
   */
  nextBoolean(probability: number = 0.5): boolean {
    return this.next() < probability;
  }
  
  /**
   * Pick a random element from an array.
   * Returns undefined if array is empty.
   */
  pick<T>(array: readonly T[]): T | undefined {
    if (array.length === 0) return undefined;
    const index = this.nextInt(0, array.length - 1);
    return array[index];
  }
  
  /**
   * Shuffle an array in place using Fisher-Yates algorithm.
   * Returns a new shuffled array (does not modify original).
   */
  shuffle<T>(array: readonly T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      // Swap
      const temp = result[i]!;
      result[i] = result[j]!;
      result[j] = temp;
    }
    return result;
  }
  
  /**
   * Select n random elements from an array without replacement.
   * Returns a new array with the selected elements.
   */
  sample<T>(array: readonly T[], n: number): T[] {
    if (n >= array.length) {
      return this.shuffle(array);
    }
    
    // Use partial Fisher-Yates for efficiency
    const result: T[] = [];
    const available = [...array];
    
    for (let i = 0; i < n; i++) {
      const index = this.nextInt(0, available.length - 1);
      result.push(available[index]!);
      // Remove selected element by swapping with last
      available[index] = available[available.length - 1]!;
      available.pop();
    }
    
    return result;
  }
  
  /**
   * Select an element based on weighted probabilities.
   * @param items - Array of items to select from
   * @param weights - Array of weights (must be same length as items)
   * @returns Selected item, or undefined if arrays are empty
   */
  weightedPick<T>(items: readonly T[], weights: readonly number[]): T | undefined {
    if (items.length === 0 || weights.length === 0) return undefined;
    if (items.length !== weights.length) {
      throw new Error('Items and weights arrays must have same length');
    }
    
    const totalWeight = weights.reduce((sum, w) => sum + Math.max(0, w), 0);
    if (totalWeight <= 0) return items[0];
    
    let random = this.next() * totalWeight;
    
    for (let i = 0; i < items.length; i++) {
      random -= Math.max(0, weights[i]!);
      if (random <= 0) {
        return items[i];
      }
    }
    
    // Fallback (should not reach here)
    return items[items.length - 1];
  }
}

// =============================================================================
// Seed Generation Utilities
// =============================================================================

/**
 * Generate a deterministic seed from game parameters.
 * Use this to create consistent seeds for game instances.
 */
export function generateGameSeed(
  gameId: string,
  turnNumber: number,
  additionalEntropy: number = 0
): number {
  // Simple hash combining game ID and turn number
  let hash = 0;
  for (let i = 0; i < gameId.length; i++) {
    const char = gameId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Mix in turn number and entropy
  hash = hash ^ (turnNumber * 0x45d9f3b);
  hash = hash ^ (additionalEntropy * 0x1b873593);
  
  return hash >>> 0; // Ensure unsigned
}

/**
 * Generate a seed from the current timestamp.
 * Use only for non-deterministic scenarios (e.g., deck shuffling in single-player).
 */
export function generateTimestampSeed(): number {
  return Date.now() >>> 0;
}

/**
 * Combine multiple seeds into one.
 * Useful when multiple factors should influence randomness.
 */
export function combineSeeds(...seeds: number[]): number {
  let combined = 0;
  for (const seed of seeds) {
    combined = combined ^ ((seed >>> 0) * 0x45d9f3b);
    combined = (combined << 13) | (combined >>> 19);
    combined = combined * 5 + 0xe6546b64;
  }
  return combined >>> 0;
}

// =============================================================================
// Determinism Verification
// =============================================================================

/**
 * Verify that two RNG instances produce identical sequences.
 * Useful for testing determinism across browser/Firebase.
 */
export function verifyDeterminism(
  rng1: SeededRNG,
  rng2: SeededRNG,
  iterations: number = 1000
): { identical: boolean; divergedAt?: number } {
  for (let i = 0; i < iterations; i++) {
    const v1 = rng1.next();
    const v2 = rng2.next();
    if (v1 !== v2) {
      return { identical: false, divergedAt: i };
    }
  }
  return { identical: true };
}

// =============================================================================
// Global RNG State (for game engine)
// =============================================================================

let globalRng: SeededRNG | null = null;

/**
 * Initialize the global RNG with a seed.
 * Call this at game start with a deterministic seed.
 */
export function initializeGlobalRng(seed: number): void {
  globalRng = new SeededRNG(seed);
}

/**
 * Get the global RNG instance.
 * Throws if not initialized.
 */
export function getGlobalRng(): SeededRNG {
  if (!globalRng) {
    throw new Error('Global RNG not initialized. Call initializeGlobalRng() first.');
  }
  return globalRng;
}

/**
 * Check if global RNG is initialized.
 */
export function isGlobalRngInitialized(): boolean {
  return globalRng !== null;
}

/**
 * Reset the global RNG to its initial state.
 */
export function resetGlobalRng(): void {
  if (globalRng) {
    globalRng.reset();
  }
}
