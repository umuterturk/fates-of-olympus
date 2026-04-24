/**
 * Starter deck generation.
 * 
 * Generates a balanced 18-card starter deck from Deck Group 1 cards,
 * with controlled distribution across energy costs.
 */

import type { CardId } from './types';
import type { CardDef } from './models';
import { getAllCardDefs } from './cards';

// =============================================================================
// Constants
// =============================================================================

/** Total cards in starter deck */
const STARTER_DECK_SIZE = 18;

/**
 * Target distribution of cards by energy cost.
 * Key: energy cost, Value: target number of cards
 */
const TARGET_DISTRIBUTION: Record<number, number> = {
  1: 4,  // 4 cost-1 cards
  2: 4,  // 4 cost-2 cards
  3: 4,  // 4 cost-3 cards
  4: 3,  // 3 cost-4 cards
  5: 2,  // 2 cost-5 cards
  6: 1,  // 1 cost-6 card
};

// =============================================================================
// Seeded Random
// =============================================================================

/**
 * Simple seeded PRNG (mulberry32).
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed += 0x6D2B79F5;
    let t = this.seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [result[i], result[j]] = [result[j]!, result[i]!];
    }
    return result;
  }
}

// =============================================================================
// Starter Deck Generation
// =============================================================================

/**
 * Get all cards from Deck Group 1.
 */
export function getDeckGroup1Cards(): CardDef[] {
  return getAllCardDefs().filter(card => card.deckGroup === 1);
}

/**
 * Generate a balanced starter deck with 18 cards from Deck Group 1.
 * 
 * The deck has a controlled energy distribution:
 * - 4x cost-1 cards
 * - 4x cost-2 cards
 * - 4x cost-3 cards
 * - 3x cost-4 cards
 * - 2x cost-5 cards
 * - 1x cost-6 card
 * 
 * @param seed - Random seed for deterministic generation
 * @returns Array of CardIds for the starter deck
 */
export function generateStarterDeck(seed: number = 12345): CardId[] {
  const rng = new SeededRandom(seed);
  const group1Cards = getDeckGroup1Cards();

  // Group cards by cost
  const byCost: Map<number, CardDef[]> = new Map();
  for (const card of group1Cards) {
    const cost = card.cost;
    if (!byCost.has(cost)) {
      byCost.set(cost, []);
    }
    byCost.get(cost)!.push(card);
  }

  // Shuffle each cost group
  for (const [cost, cards] of byCost.entries()) {
    byCost.set(cost, rng.shuffle(cards));
  }

  // Select cards according to target distribution
  const selectedCards: CardDef[] = [];
  const overflow: CardDef[] = []; // Cards that couldn't fit their tier

  for (const [targetCost, targetCount] of Object.entries(TARGET_DISTRIBUTION)) {
    const cost = parseInt(targetCost, 10);
    const available = byCost.get(cost) ?? [];
    const toTake = Math.min(targetCount, available.length);

    // Take cards for this tier
    for (let i = 0; i < toTake; i++) {
      selectedCards.push(available[i]!);
    }

    // If not enough at this cost, we'll fill from overflow later
    if (toTake < targetCount) {
      // Add remaining slots to be filled
      const remaining = targetCount - toTake;
      for (let i = 0; i < remaining; i++) {
        overflow.push({ cost } as CardDef); // Placeholder to track needed fills
      }
    }

    // Any extras at this cost go to overflow
    if (available.length > targetCount) {
      for (let i = targetCount; i < available.length; i++) {
        overflow.push(available[i]!);
      }
    }
  }

  // Fill any gaps from adjacent costs
  while (selectedCards.length < STARTER_DECK_SIZE) {
    // Find available cards not yet selected
    const selectedIds = new Set(selectedCards.map(c => c.id));
    const available = group1Cards.filter(c => !selectedIds.has(c.id));
    
    if (available.length === 0) break;

    // Prioritize by cost proximity to target distribution
    const shuffled = rng.shuffle(available);
    selectedCards.push(shuffled[0]!);
  }

  // Shuffle final selection for variety
  const finalDeck = rng.shuffle(selectedCards);

  return finalDeck.slice(0, STARTER_DECK_SIZE).map(card => card.id);
}

/**
 * Get the default starter deck IDs.
 * Uses a fixed seed for consistency across all new players.
 */
export function getDefaultStarterDeck(): CardId[] {
  return generateStarterDeck(12345);
}

/**
 * Validate that a starter deck has proper distribution.
 */
export function validateStarterDeck(deckIds: CardId[]): {
  valid: boolean;
  distribution: Record<number, number>;
  issues: string[];
} {
  const cards = getAllCardDefs();
  const cardMap = new Map(cards.map(c => [c.id, c]));
  
  const distribution: Record<number, number> = {};
  const issues: string[] = [];

  for (const id of deckIds) {
    const card = cardMap.get(id);
    if (!card) {
      issues.push(`Unknown card: ${id}`);
      continue;
    }
    distribution[card.cost] = (distribution[card.cost] ?? 0) + 1;
  }

  if (deckIds.length !== STARTER_DECK_SIZE) {
    issues.push(`Deck has ${deckIds.length} cards, expected ${STARTER_DECK_SIZE}`);
  }

  // Check for deck group 1
  for (const id of deckIds) {
    const card = cardMap.get(id);
    if (card && card.deckGroup !== 1) {
      issues.push(`Card ${id} is from deck group ${card.deckGroup}, expected 1`);
    }
  }

  return {
    valid: issues.length === 0,
    distribution,
    issues,
  };
}

// =============================================================================
// Debug Helpers
// =============================================================================

/**
 * Preview starter deck generation for debugging.
 */
export function previewStarterDeck(seed: number = 12345): {
  cardIds: CardId[];
  cards: Array<{ id: CardId; name: string; cost: number; ideology?: string }>;
  distribution: Record<number, number>;
} {
  const cardIds = generateStarterDeck(seed);
  const allCards = getAllCardDefs();
  const cardMap = new Map(allCards.map(c => [c.id, c]));

  const cards = cardIds.map(id => {
    const card = cardMap.get(id)!;
    return {
      id: card.id,
      name: card.name,
      cost: card.cost,
      ideology: card.ideology,
    };
  });

  const distribution: Record<number, number> = {};
  for (const card of cards) {
    distribution[card.cost] = (distribution[card.cost] ?? 0) + 1;
  }

  return { cardIds, cards, distribution };
}
