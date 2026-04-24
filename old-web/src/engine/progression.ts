/**
 * Progression system for card unlocking.
 * 
 * Manages the unlock path, cost calculation, and card selection
 * based on player's position and ideology choice.
 */

import type { CardId } from './types';
import type { CardDef, CardIdeology } from './models';
import { getAllCardDefs } from './cards';
import type { Ideology } from '@storage/types';

// =============================================================================
// Constants
// =============================================================================

/** Position at which player must choose an ideology */
const IDEOLOGY_CHOICE_POSITION = 5;

/** Percentage of cards from chosen ideology after choice */
const IDEOLOGY_WEIGHT = 0.7; // 70% chosen ideology

/** Cards per "tier" for energy cost balancing */
const CARDS_PER_TIER = 6;

/** Map from selectable ideology to card ideology */
const IDEOLOGY_TO_CARD_IDEOLOGY: Record<Ideology, CardIdeology> = {
  NOMOS: 'NOMOS',
  KATABASIS: 'KATABASIS',
  KINESIS: 'KINESIS',
};

// =============================================================================
// Seeded Random Number Generator
// =============================================================================

/**
 * Simple seeded PRNG for deterministic unlock paths.
 * Uses mulberry32 algorithm.
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  /** Generate a random number between 0 and 1 */
  next(): number {
    this.seed += 0x6D2B79F5;
    let t = this.seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Shuffle an array in place */
  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [result[i], result[j]] = [result[j]!, result[i]!];
    }
    return result;
  }

  /** Pick a random item from an array */
  pick<T>(array: T[]): T | undefined {
    if (array.length === 0) return undefined;
    return array[Math.floor(this.next() * array.length)];
  }
}

// =============================================================================
// Card Filtering
// =============================================================================

/**
 * Get all cards in a specific deck group.
 */
export function getCardsByDeckGroup(deckGroup: number): CardDef[] {
  return getAllCardDefs().filter(card => card.deckGroup === deckGroup);
}

/**
 * Get all cards of a specific ideology.
 */
export function getCardsByIdeology(ideology: CardIdeology): CardDef[] {
  return getAllCardDefs().filter(card => card.ideology === ideology);
}

/**
 * Get cards that are NOT part of a specific ideology (for neutral path).
 * Includes TRANSITIONAL, FRACTURED, and cards from non-selected ideologies.
 */
export function getNonIdeologyCards(excludeIdeologies: CardIdeology[]): CardDef[] {
  return getAllCardDefs().filter(card => 
    !card.ideology || !excludeIdeologies.includes(card.ideology)
  );
}

// =============================================================================
// Unlock Path Generation
// =============================================================================

interface UnlockPathOptions {
  /** Random seed for deterministic generation */
  seed?: number;
  /** Starting deck card IDs (excluded from unlock path) */
  starterDeckIds: CardId[];
  /** Player's chosen ideology (null if not yet chosen) */
  chosenIdeology: Ideology | null;
}

/**
 * Generate an ordered list of cards for the unlock path.
 * 
 * The path is organized as follows:
 * - Positions 0-4: Mixed cards from all ideologies (deck group 1 priority)
 * - Position 5+: If ideology chosen, 70% chosen ideology, 30% other
 * 
 * Cards are ordered by energy cost with "intelligent randomness":
 * - Every ~6 cards, a higher energy card is allowed
 * - Within each tier, cards are shuffled
 */
export function generateUnlockPath(options: UnlockPathOptions): CardId[] {
  const { seed = 42, starterDeckIds, chosenIdeology } = options;
  const rng = new SeededRandom(seed);

  // Get all cards except starter deck
  const starterSet = new Set(starterDeckIds);
  const allCards = getAllCardDefs().filter(card => !starterSet.has(card.id));

  // Separate cards into phases
  const preIdeologyCards: CardDef[] = [];
  const postIdeologyCards: CardDef[] = [];

  // Pre-ideology: Mix of all cards, prioritize deck group 1
  const deckGroup1 = allCards.filter(c => c.deckGroup === 1);
  const deckGroup2And3 = allCards.filter(c => c.deckGroup !== 1);

  // First 5 cards come from deck group 1 (or all if not enough)
  const earlyCards = sortByEnergyCostWithVariance(deckGroup1, rng);
  preIdeologyCards.push(...earlyCards.slice(0, IDEOLOGY_CHOICE_POSITION));

  // Remaining cards for unlock path
  const remainingCards = [
    ...earlyCards.slice(IDEOLOGY_CHOICE_POSITION),
    ...deckGroup2And3,
  ];

  // Post-ideology distribution
  if (chosenIdeology) {
    const cardIdeology = IDEOLOGY_TO_CARD_IDEOLOGY[chosenIdeology];
    
    // Split by ideology
    const ideologyCards = remainingCards.filter(c => c.ideology === cardIdeology);
    const otherCards = remainingCards.filter(c => c.ideology !== cardIdeology);

    // Interleave: 70% ideology, 30% other
    postIdeologyCards.push(...interleaveByWeight(
      sortByEnergyCostWithVariance(ideologyCards, rng),
      sortByEnergyCostWithVariance(otherCards, rng),
      IDEOLOGY_WEIGHT,
      rng
    ));
  } else {
    // No ideology chosen yet - use all remaining cards sorted by cost
    postIdeologyCards.push(...sortByEnergyCostWithVariance(remainingCards, rng));
  }

  return [
    ...preIdeologyCards.map(c => c.id),
    ...postIdeologyCards.map(c => c.id),
  ];
}

/**
 * Sort cards by energy cost with controlled variance.
 * Every CARDS_PER_TIER cards, allow one higher-cost card.
 */
function sortByEnergyCostWithVariance(cards: CardDef[], rng: SeededRandom): CardDef[] {
  // Group cards by cost
  const byCost: Map<number, CardDef[]> = new Map();
  for (const card of cards) {
    const cost = card.cost;
    if (!byCost.has(cost)) {
      byCost.set(cost, []);
    }
    byCost.get(cost)!.push(card);
  }

  // Shuffle within each cost tier
  for (const [cost, costCards] of byCost.entries()) {
    byCost.set(cost, rng.shuffle(costCards));
  }

  // Get sorted cost levels
  const costs = Array.from(byCost.keys()).sort((a, b) => a - b);

  // Build result with controlled variance
  const result: CardDef[] = [];
  let currentTierIndex = 0;
  let cardsInCurrentTier = 0;
  let maxAllowedCost = costs[0] ?? 1;

  while (result.length < cards.length) {
    // Find next card within allowed cost range
    let added = false;

    for (let costIdx = 0; costIdx <= currentTierIndex && costIdx < costs.length; costIdx++) {
      const cost = costs[costIdx]!;
      const available = byCost.get(cost)!;
      
      if (available.length > 0 && cost <= maxAllowedCost) {
        result.push(available.shift()!);
        added = true;
        cardsInCurrentTier++;
        break;
      }
    }

    // If no card added from lower costs, try higher costs
    if (!added) {
      for (let costIdx = currentTierIndex + 1; costIdx < costs.length; costIdx++) {
        const cost = costs[costIdx]!;
        const available = byCost.get(cost)!;
        
        if (available.length > 0) {
          result.push(available.shift()!);
          cardsInCurrentTier++;
          break;
        }
      }
    }

    // Advance tier every CARDS_PER_TIER cards
    if (cardsInCurrentTier >= CARDS_PER_TIER) {
      currentTierIndex = Math.min(currentTierIndex + 1, costs.length - 1);
      maxAllowedCost = costs[currentTierIndex] ?? 6;
      cardsInCurrentTier = 0;
    }
  }

  return result;
}

/**
 * Interleave two card arrays by weight.
 * @param primary - Cards with higher weight (e.g., ideology cards)
 * @param secondary - Cards with lower weight (e.g., other cards)
 * @param primaryWeight - Weight for primary (0-1, e.g., 0.7 for 70%)
 */
function interleaveByWeight(
  primary: CardDef[],
  secondary: CardDef[],
  primaryWeight: number,
  rng: SeededRandom
): CardDef[] {
  const result: CardDef[] = [];
  let primaryIndex = 0;
  let secondaryIndex = 0;

  while (primaryIndex < primary.length || secondaryIndex < secondary.length) {
    const shouldUsePrimary = 
      primaryIndex < primary.length && 
      (secondaryIndex >= secondary.length || rng.next() < primaryWeight);

    if (shouldUsePrimary) {
      result.push(primary[primaryIndex]!);
      primaryIndex++;
    } else if (secondaryIndex < secondary.length) {
      result.push(secondary[secondaryIndex]!);
      secondaryIndex++;
    }
  }

  return result;
}

// =============================================================================
// Get Next Card to Unlock
// =============================================================================

/**
 * Get the next card available for unlock.
 * @param _position - Current unlock path position (unused, kept for API consistency)
 * @param starterDeckIds - IDs of starter deck cards
 * @param unlockedCardIds - IDs of already unlocked cards
 * @param chosenIdeology - Player's chosen ideology (or null)
 * @param seed - Random seed for path generation
 * @returns The next card ID to unlock, or null if all unlocked
 */
export function getNextUnlockCard(
  _position: number,
  starterDeckIds: CardId[],
  unlockedCardIds: CardId[],
  chosenIdeology: Ideology | null,
  seed: number = 42
): CardId | null {
  const path = generateUnlockPath({
    seed,
    starterDeckIds,
    chosenIdeology,
  });

  // Find the first card in the path that isn't already unlocked
  const unlockedSet = new Set(unlockedCardIds);
  for (const cardId of path) {
    if (!unlockedSet.has(cardId)) {
      return cardId;
    }
  }

  return null;
}

/**
 * Get a preview of upcoming cards in the unlock path.
 * @param count - Number of cards to preview
 */
export function getUnlockPathPreview(
  starterDeckIds: CardId[],
  unlockedCardIds: CardId[],
  chosenIdeology: Ideology | null,
  count: number = 5,
  seed: number = 42
): CardId[] {
  const path = generateUnlockPath({
    seed,
    starterDeckIds,
    chosenIdeology,
  });

  const unlockedSet = new Set(unlockedCardIds);
  const preview: CardId[] = [];

  for (const cardId of path) {
    if (!unlockedSet.has(cardId)) {
      preview.push(cardId);
      if (preview.length >= count) break;
    }
  }

  return preview;
}

// =============================================================================
// Exports
// =============================================================================

export { IDEOLOGY_CHOICE_POSITION };
