/**
 * Target selection for the deterministic ability system.
 * 
 * Target selectors determine WHAT entities an effect applies to.
 * All selection uses deterministic tie-breaking rules:
 *   1. Highest/lowest Power as required
 *   2. Earlier played (lower instanceId)
 *   3. Lower slot index
 * 
 * CRITICAL: Selectors are pure functions that NEVER mutate state.
 */

import type { GameState, CardInstance } from '../models';
import type { LocationIndex, PlayerId, InstanceId } from '../types';
import type { TargetSelector, Condition } from './types';
import { SeededRNG } from '../rng';
import {
  getLocation,
  getCards,
  getAllCards,
  getEffectivePower,
  getCardCount,
} from '../models';
import { LOCATION_CAPACITY } from '../types';
import { evaluateTargetCondition } from './conditions';

// =============================================================================
// Core Target Resolution
// =============================================================================

/**
 * Resolve targets for an ability based on the target selector.
 * 
 * @param selector - The target selector to use
 * @param state - Current game state
 * @param sourceCard - The card that owns the ability
 * @param sourceLocation - Location where the source card is
 * @param rng - Seeded RNG for random selections
 * @returns Array of target instance IDs (can be empty if no valid targets)
 */
export function resolveTargets(
  selector: TargetSelector,
  state: GameState,
  sourceCard: CardInstance,
  sourceLocation: LocationIndex,
  rng: SeededRNG
): readonly InstanceId[] {
  const sourcePlayer = sourceCard.owner;
  const enemyPlayer = (1 - sourcePlayer) as PlayerId;
  const location = getLocation(state, sourceLocation);
  
  switch (selector) {
    // =======================================================================
    // Self
    // =======================================================================
    case 'SELF':
      return [sourceCard.instanceId];
    
    // =======================================================================
    // Allies at Same Location
    // =======================================================================
    case 'ONE_OTHER_ALLY_HERE': {
      const allies = getCards(location, sourcePlayer)
        .filter(c => c.instanceId !== sourceCard.instanceId);
      const selected = selectOne(allies, 'FIRST');
      return selected ? [selected.instanceId] : [];
    }
    
    case 'ALL_ALLIES_HERE': {
      const allies = getCards(location, sourcePlayer);
      return sortByDeterministicOrder(allies).map(c => c.instanceId);
    }
    
    case 'ALL_ALLIES_HERE_EXCEPT_SELF': {
      const allies = getCards(location, sourcePlayer)
        .filter(c => c.instanceId !== sourceCard.instanceId);
      return sortByDeterministicOrder(allies).map(c => c.instanceId);
    }
    
    // =======================================================================
    // Enemies at Same Location
    // =======================================================================
    case 'ONE_ENEMY_HERE': {
      const enemies = getCards(location, enemyPlayer);
      const selected = selectOne(enemies, 'FIRST');
      return selected ? [selected.instanceId] : [];
    }
    
    case 'ALL_ENEMIES_HERE': {
      const enemies = getCards(location, enemyPlayer);
      return sortByDeterministicOrder(enemies).map(c => c.instanceId);
    }
    
    case 'HIGHEST_POWER_ENEMY_HERE': {
      const enemies = getCards(location, enemyPlayer);
      const selected = selectOne(enemies, 'HIGHEST_POWER');
      return selected ? [selected.instanceId] : [];
    }
    
    case 'LOWEST_POWER_ENEMY_HERE': {
      const enemies = getCards(location, enemyPlayer);
      const selected = selectOne(enemies, 'LOWEST_POWER');
      return selected ? [selected.instanceId] : [];
    }
    
    // =======================================================================
    // Other Locations
    // =======================================================================
    case 'ONE_ALLY_OTHER_LOCATION': {
      const otherLocations = ([0, 1, 2] as LocationIndex[])
        .filter(idx => idx !== sourceLocation);
      
      for (const locIdx of otherLocations) {
        const loc = getLocation(state, locIdx);
        const allies = getCards(loc, sourcePlayer);
        if (allies.length > 0) {
          const selected = selectOne(allies, 'FIRST');
          return selected ? [selected.instanceId] : [];
        }
      }
      return [];
    }
    
    case 'ALL_ALLIES_OTHER_LOCATIONS': {
      const otherLocations = ([0, 1, 2] as LocationIndex[])
        .filter(idx => idx !== sourceLocation);
      
      const result: CardInstance[] = [];
      for (const locIdx of otherLocations) {
        const loc = getLocation(state, locIdx);
        result.push(...getCards(loc, sourcePlayer));
      }
      return sortByDeterministicOrder(result).map(c => c.instanceId);
    }
    
    case 'ONE_ENEMY_AT_DESTINATION': {
      // This is typically used after a move - find first enemy at destination
      // For now, return empty; actual destination determined at execution time
      return [];
    }
    
    // =======================================================================
    // Location Target
    // =======================================================================
    case 'LOCATION':
      // Return location index as the "target" (special case)
      // The effect will interpret this as targeting the location itself
      return [sourceLocation as unknown as InstanceId];
    
    // =======================================================================
    // Random Target
    // =======================================================================
    case 'RANDOM_VALID_TARGET': {
      // Get all valid targets (all cards except self)
      const allCards: CardInstance[] = [];
      for (const loc of state.locations) {
        allCards.push(...getAllCards(loc));
      }
      const validTargets = allCards.filter(c => c.instanceId !== sourceCard.instanceId);
      
      if (validTargets.length === 0) return [];
      
      const selected = rng.pick(validTargets);
      return selected ? [selected.instanceId] : [];
    }
    
    // =======================================================================
    // Special Filters
    // =======================================================================
    case 'FRIENDLY_WITH_DESTROY_TAG': {
      const allAllies: CardInstance[] = [];
      for (const loc of state.locations) {
        const allies = getCards(loc, sourcePlayer);
        for (const ally of allies) {
          if (ally.cardDef.tags.includes('Destroy')) {
            allAllies.push(ally);
          }
        }
      }
      return sortByDeterministicOrder(allAllies).map(c => c.instanceId);
    }
    
    case 'ENEMY_WITH_BUFF_TAG_HERE': {
      const enemies = getCards(location, enemyPlayer)
        .filter(c => c.cardDef.tags.includes('Buff'));
      return sortByDeterministicOrder(enemies).map(c => c.instanceId);
    }
    
    case 'ENEMY_WITH_ONGOING_HERE': {
      const enemies = getCards(location, enemyPlayer)
        .filter(c => c.cardDef.abilityType === 'ONGOING');
      return sortByDeterministicOrder(enemies).map(c => c.instanceId);
    }
    
    case 'ALLIES_HERE_ARMY_EXCEPT_SELF': {
      // Allied cards with 'Army' type at this location, except self
      // Used by Kouretes: +1 to other Army cards here
      const allies = getCards(location, sourcePlayer)
        .filter(c => c.instanceId !== sourceCard.instanceId && c.cardDef.cardType === 'Army');
      return sortByDeterministicOrder(allies).map(c => c.instanceId);
    }
    
    // =======================================================================
    // Default (unknown selector)
    // =======================================================================
    default: {
      console.warn(`Unknown target selector: ${selector}`);
      return [];
    }
  }
}

// =============================================================================
// Target Selection Strategies
// =============================================================================

type SelectionStrategy = 'FIRST' | 'HIGHEST_POWER' | 'LOWEST_POWER' | 'RANDOM';

/**
 * Select one card from a list using a deterministic strategy.
 */
function selectOne(
  cards: readonly CardInstance[],
  strategy: SelectionStrategy,
  rng?: SeededRNG
): CardInstance | null {
  if (cards.length === 0) return null;
  if (cards.length === 1) return cards[0]!;
  
  const sorted = sortByDeterministicOrder([...cards]);
  
  switch (strategy) {
    case 'FIRST':
      return sorted[0]!;
    
    case 'HIGHEST_POWER': {
      let highest = sorted[0]!;
      for (const card of sorted) {
        if (getEffectivePower(card) > getEffectivePower(highest)) {
          highest = card;
        }
      }
      return highest;
    }
    
    case 'LOWEST_POWER': {
      let lowest = sorted[0]!;
      for (const card of sorted) {
        if (getEffectivePower(card) < getEffectivePower(lowest)) {
          lowest = card;
        }
      }
      return lowest;
    }
    
    case 'RANDOM': {
      if (!rng) return sorted[0]!;
      return rng.pick(sorted) ?? sorted[0]!;
    }
    
    default:
      return sorted[0]!;
  }
}

// =============================================================================
// Deterministic Ordering
// =============================================================================

/**
 * Sort cards by deterministic order.
 * Tie-breaking rules:
 *   1. Lower instanceId (earlier played)
 *   2. This ensures consistent ordering across browser/Firebase
 */
function sortByDeterministicOrder(cards: readonly CardInstance[]): CardInstance[] {
  return [...cards].sort((a, b) => a.instanceId - b.instanceId);
}

/**
 * Sort cards by power with deterministic tie-breaking.
 * @param ascending - If true, sort lowest to highest; otherwise highest to lowest
 */
export function sortByPower(cards: readonly CardInstance[], ascending: boolean = false): CardInstance[] {
  return [...cards].sort((a, b) => {
    const powerDiff = getEffectivePower(a) - getEffectivePower(b);
    if (powerDiff !== 0) {
      return ascending ? powerDiff : -powerDiff;
    }
    // Tie-break by instanceId (lower = earlier played)
    return a.instanceId - b.instanceId;
  });
}

// =============================================================================
// Advanced Target Resolution
// =============================================================================

/**
 * Resolve targets with an additional condition filter.
 */
export function resolveTargetsWithCondition(
  selector: TargetSelector,
  condition: Condition,
  state: GameState,
  sourceCard: CardInstance,
  sourceLocation: LocationIndex,
  rng: SeededRNG
): readonly InstanceId[] {
  // First get all potential targets
  const targetIds = resolveTargets(selector, state, sourceCard, sourceLocation, rng);
  
  if (condition === 'NONE') return targetIds;
  
  // Filter by condition
  const filteredIds: InstanceId[] = [];
  for (const targetId of targetIds) {
    // Find the target card
    let targetCard: CardInstance | null = null;
    let targetLocation: LocationIndex | null = null;
    
    for (const loc of state.locations) {
      const allCards = getAllCards(loc);
      const found = allCards.find(c => c.instanceId === targetId);
      if (found) {
        targetCard = found;
        targetLocation = loc.index;
        break;
      }
    }
    
    if (targetCard && targetLocation !== null) {
      if (evaluateTargetCondition(condition, state, targetCard, targetLocation, sourceCard, sourceLocation)) {
        filteredIds.push(targetId);
      }
    }
  }
  
  return filteredIds;
}

/**
 * Find the best move destination for a card.
 * Returns the first available location that isn't the source.
 */
export function findMoveDestination(
  state: GameState,
  cardOwner: PlayerId,
  sourceLocation: LocationIndex,
  strategy: 'FIRST_AVAILABLE' | 'RANDOM' | 'LEFTMOST' | 'RIGHTMOST' = 'FIRST_AVAILABLE',
  rng?: SeededRNG
): LocationIndex | null {
  const availableLocations: LocationIndex[] = [];
  
  // Check each location (in order: 0, 1, 2 for determinism)
  for (const locIdx of [0, 1, 2] as LocationIndex[]) {
    if (locIdx === sourceLocation) continue;
    
    const loc = getLocation(state, locIdx);
    if (getCardCount(loc, cardOwner) < LOCATION_CAPACITY) {
      availableLocations.push(locIdx);
    }
  }
  
  if (availableLocations.length === 0) return null;
  
  switch (strategy) {
    case 'FIRST_AVAILABLE':
    case 'LEFTMOST':
      return availableLocations[0]!;
    
    case 'RIGHTMOST':
      return availableLocations[availableLocations.length - 1]!;
    
    case 'RANDOM':
      if (!rng) return availableLocations[0]!;
      return rng.pick(availableLocations) ?? availableLocations[0]!;
    
    default:
      return availableLocations[0]!;
  }
}

/**
 * Find the ally card to move to this location (for "move ally here" effects).
 */
export function findAllyToMoveHere(
  state: GameState,
  player: PlayerId,
  targetLocation: LocationIndex,
  rng?: SeededRNG
): { cardId: InstanceId; fromLocation: LocationIndex } | null {
  // Check other locations for allies
  for (const locIdx of [0, 1, 2] as LocationIndex[]) {
    if (locIdx === targetLocation) continue;
    
    const loc = getLocation(state, locIdx);
    const allies = getCards(loc, player);
    
    if (allies.length > 0) {
      // Check if target location has space
      const targetLoc = getLocation(state, targetLocation);
      if (getCardCount(targetLoc, player) >= LOCATION_CAPACITY) continue;
      
      // Select one ally deterministically
      const selected = selectOne(allies, rng ? 'RANDOM' : 'FIRST', rng);
      if (selected) {
        return { cardId: selected.instanceId, fromLocation: locIdx };
      }
    }
  }
  
  return null;
}

// =============================================================================
// Target Validation
// =============================================================================

/**
 * Check if a target selector can find at least one valid target.
 */
export function hasValidTargets(
  selector: TargetSelector,
  state: GameState,
  sourceCard: CardInstance,
  sourceLocation: LocationIndex
): boolean {
  // Create a dummy RNG for validation (won't be used for non-random selectors)
  const dummyRng = new SeededRNG(0);
  const targets = resolveTargets(selector, state, sourceCard, sourceLocation, dummyRng);
  return targets.length > 0;
}

/**
 * Count potential targets for a selector.
 */
export function countPotentialTargets(
  selector: TargetSelector,
  state: GameState,
  sourceCard: CardInstance,
  sourceLocation: LocationIndex
): number {
  const dummyRng = new SeededRNG(0);
  return resolveTargets(selector, state, sourceCard, sourceLocation, dummyRng).length;
}

// =============================================================================
// Target Selector Description (for debugging)
// =============================================================================

/**
 * Get a human-readable description of a target selector.
 */
export function describeTargetSelector(selector: TargetSelector): string {
  const descriptions: Record<TargetSelector, string> = {
    'SELF': 'self',
    'ONE_OTHER_ALLY_HERE': 'one other ally here',
    'ALL_ALLIES_HERE': 'all allies here',
    'ALL_ALLIES_HERE_EXCEPT_SELF': 'all other allies here',
    'ONE_ENEMY_HERE': 'one enemy here',
    'ALL_ENEMIES_HERE': 'all enemies here',
    'HIGHEST_POWER_ENEMY_HERE': 'highest power enemy here',
    'LOWEST_POWER_ENEMY_HERE': 'lowest power enemy here',
    'ONE_ALLY_OTHER_LOCATION': 'one ally at another location',
    'ALL_ALLIES_OTHER_LOCATIONS': 'all allies at other locations',
    'ONE_ENEMY_AT_DESTINATION': 'one enemy at destination',
    'LOCATION': 'this location',
    'RANDOM_VALID_TARGET': 'random target',
    'FRIENDLY_WITH_DESTROY_TAG': 'allies with Destroy tag',
    'ENEMY_WITH_BUFF_TAG_HERE': 'enemies with Buff tag here',
    'ENEMY_WITH_ONGOING_HERE': 'enemies with Ongoing abilities here',
    'ALLIES_HERE_ARMY_EXCEPT_SELF': 'other Army allies here',
    'MOVED_CARD': 'the moved card',
  };
  
  return descriptions[selector] ?? `unknown selector: ${selector}`;
}
