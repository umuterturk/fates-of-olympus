/**
 * Condition evaluation for the deterministic ability system.
 * 
 * Conditions are pure boolean functions evaluated against a state snapshot.
 * They determine IF an ability's effect should apply at scheduling time.
 * 
 * CRITICAL: Conditions are evaluated against a SNAPSHOT at scheduling time.
 * They do NOT re-evaluate during execution.
 */

import type { GameState, CardInstance } from '../models';
import type { LocationIndex, PlayerId } from '../types';
import type { Condition } from './types';
import {
  getLocation,
  getCards,
  getCardCount,
  getTotalPower,
  getEffectivePower,
} from '../models';
import { LOCATION_CAPACITY } from '../types';

// =============================================================================
// Core Condition Evaluator
// =============================================================================

/**
 * Evaluate a condition against the current game state.
 * 
 * @param condition - The condition to evaluate
 * @param state - Current game state (snapshot)
 * @param sourceCard - The card that owns the ability
 * @param sourceLocation - Location where the source card is
 * @returns true if condition is met, false otherwise
 */
export function evaluateCondition(
  condition: Condition,
  state: GameState,
  sourceCard: CardInstance,
  sourceLocation: LocationIndex
): boolean {
  const sourcePlayer = sourceCard.owner;
  const enemyPlayer = (1 - sourcePlayer) as PlayerId;
  const location = getLocation(state, sourceLocation);
  
  switch (condition) {
    // =======================================================================
    // Always True
    // =======================================================================
    case 'NONE':
      return true;
    
    // =======================================================================
    // Ally Count Conditions
    // =======================================================================
    case 'CONDITIONAL_EXACTLY_ONE_OTHER_ALLY_HERE': {
      // Exactly 1 other allied card here (so total count is 2 including self)
      const allyCount = getCardCount(location, sourcePlayer);
      return allyCount === 2;
    }
    
    case 'CONDITIONAL_EXACTLY_TWO_ALLIES_HERE': {
      // Exactly 2 allied cards here (including self if applicable)
      const allyCount = getCardCount(location, sourcePlayer);
      return allyCount === 2;
    }
    
    case 'CONDITIONAL_ONLY_CARD_HERE': {
      // This is the only card here for this player
      const allyCount = getCardCount(location, sourcePlayer);
      return allyCount === 1;
    }
    
    // =======================================================================
    // Location Capacity Conditions
    // =======================================================================
    case 'CONDITIONAL_LOCATION_FULL': {
      // Player has 4 cards at this location
      const allyCount = getCardCount(location, sourcePlayer);
      return allyCount >= LOCATION_CAPACITY;
    }
    
    case 'CONDITIONAL_EMPTY_SLOT_HERE': {
      // Player has < 4 cards at this location (has empty slot)
      const allyCount = getCardCount(location, sourcePlayer);
      return allyCount < LOCATION_CAPACITY;
    }
    
    // =======================================================================
    // Enemy Count Conditions
    // =======================================================================
    case 'CONDITIONAL_ENEMY_MORE_CARDS_HERE': {
      // Enemy has more cards here than player
      const allyCount = getCardCount(location, sourcePlayer);
      const enemyCount = getCardCount(location, enemyPlayer);
      return enemyCount > allyCount;
    }
    
    case 'CONDITIONAL_ENEMY_3PLUS_HERE': {
      // Enemy has 3+ cards here
      const enemyCount = getCardCount(location, enemyPlayer);
      return enemyCount >= 3;
    }
    
    // =======================================================================
    // Power-based Conditions
    // =======================================================================
    case 'CONDITIONAL_ENEMY_HIGHEST_POWER_HERE': {
      // Check if there's an enemy with the highest power at this location
      const enemyCards = getCards(location, enemyPlayer);
      if (enemyCards.length === 0) return false;
      
      // Find highest power among enemies
      const highestPower = Math.max(...enemyCards.map(c => getEffectivePower(c)));
      
      // Check if any enemy has this power
      return enemyCards.some(c => getEffectivePower(c) === highestPower);
    }
    
    case 'CONDITIONAL_LOSING_LOCATION': {
      // Player is currently losing this location (enemy has more power)
      const allyPower = getTotalPower(location, sourcePlayer);
      const enemyPower = getTotalPower(location, enemyPlayer);
      return enemyPower > allyPower;
    }
    
    // =======================================================================
    // Game History Conditions
    // =======================================================================
    case 'CONDITIONAL_MOVED_BY_YOU_THIS_TURN': {
      // Check if a card was moved by this player this turn
      return state.cardsMovedThisTurn.length > 0;
    }
    
    case 'CONDITIONAL_DESTROYED_THIS_GAME': {
      // Check if any card has been destroyed this game
      return state.cardsDestroyedThisGame.length > 0;
    }
    
    case 'CONDITIONAL_MOVED_THIS_GAME': {
      // Check if any card has been moved this game
      return state.cardsMovedThisGame.length > 0;
    }
    
    // =======================================================================
    // Card Property Conditions
    // =======================================================================
    case 'CONDITIONAL_CARD_HAS_BUFF_TAG': {
      // Check if the source card has the 'Buff' tag
      return sourceCard.cardDef.tags.includes('Buff');
    }
    
    case 'CONDITIONAL_CARD_HAS_ONGOING': {
      // Check if the source card has ONGOING ability type
      return sourceCard.cardDef.abilityType === 'ONGOING';
    }
    
    // =======================================================================
    // Default (unknown condition)
    // =======================================================================
    default: {
      // Log warning for unknown conditions in development
      console.warn(`Unknown condition: ${condition}`);
      return false;
    }
  }
}

// =============================================================================
// Specialized Condition Evaluators
// =============================================================================

/**
 * Evaluate a condition for a specific target card (used for target filtering).
 * 
 * @param condition - The condition to evaluate
 * @param state - Current game state
 * @param targetCard - The card being evaluated as a potential target
 * @param targetLocation - Location where the target card is
 * @param sourceCard - The card that owns the ability
 * @param sourceLocation - Location where the source card is
 */
export function evaluateTargetCondition(
  condition: Condition,
  state: GameState,
  targetCard: CardInstance,
  _targetLocation: LocationIndex,
  sourceCard: CardInstance,
  sourceLocation: LocationIndex
): boolean {
  switch (condition) {
    case 'CONDITIONAL_CARD_HAS_BUFF_TAG':
      return targetCard.cardDef.tags.includes('Buff');
    
    case 'CONDITIONAL_CARD_HAS_ONGOING':
      return targetCard.cardDef.abilityType === 'ONGOING';
    
    case 'CONDITIONAL_ENEMY_HIGHEST_POWER_HERE': {
      const enemyPlayer = (1 - sourceCard.owner) as PlayerId;
      const location = getLocation(state, sourceLocation);
      const enemyCards = getCards(location, enemyPlayer);
      
      if (enemyCards.length === 0) return false;
      
      const highestPower = Math.max(...enemyCards.map(c => getEffectivePower(c)));
      return getEffectivePower(targetCard) === highestPower;
    }
    
    default:
      // For non-target-specific conditions, fall back to standard evaluation
      return evaluateCondition(condition, state, sourceCard, sourceLocation);
  }
}

// =============================================================================
// Compound Condition Helpers
// =============================================================================

/**
 * Evaluate multiple conditions with AND logic.
 */
export function evaluateAllConditions(
  conditions: readonly Condition[],
  state: GameState,
  sourceCard: CardInstance,
  sourceLocation: LocationIndex
): boolean {
  return conditions.every(c => evaluateCondition(c, state, sourceCard, sourceLocation));
}

/**
 * Evaluate multiple conditions with OR logic.
 */
export function evaluateAnyCondition(
  conditions: readonly Condition[],
  state: GameState,
  sourceCard: CardInstance,
  sourceLocation: LocationIndex
): boolean {
  return conditions.some(c => evaluateCondition(c, state, sourceCard, sourceLocation));
}

// =============================================================================
// Condition Description Helpers (for debugging/logging)
// =============================================================================

/**
 * Get a human-readable description of a condition.
 */
export function describeCondition(condition: Condition): string {
  const descriptions: Record<Condition, string> = {
    'NONE': 'Always',
    'CONDITIONAL_EXACTLY_ONE_OTHER_ALLY_HERE': 'If exactly 1 other ally here',
    'CONDITIONAL_EXACTLY_TWO_ALLIES_HERE': 'If exactly 2 allies here',
    'CONDITIONAL_ONLY_CARD_HERE': 'If only card here',
    'CONDITIONAL_LOCATION_FULL': 'If location is full',
    'CONDITIONAL_EMPTY_SLOT_HERE': 'If has empty slot here',
    'CONDITIONAL_ENEMY_MORE_CARDS_HERE': 'If enemy has more cards here',
    'CONDITIONAL_ENEMY_3PLUS_HERE': 'If enemy has 3+ cards here',
    'CONDITIONAL_ENEMY_HIGHEST_POWER_HERE': 'If enemy has highest power here',
    'CONDITIONAL_LOSING_LOCATION': 'If losing this location',
    'CONDITIONAL_MOVED_BY_YOU_THIS_TURN': 'If moved a card this turn',
    'CONDITIONAL_DESTROYED_THIS_GAME': 'If destroyed a card this game',
    'CONDITIONAL_MOVED_THIS_GAME': 'If moved a card this game',
    'CONDITIONAL_CARD_HAS_BUFF_TAG': 'If card has Buff tag',
    'CONDITIONAL_CARD_HAS_ONGOING': 'If card has Ongoing ability',
  };
  
  return descriptions[condition] ?? `Unknown condition: ${condition}`;
}

// =============================================================================
// Condition State Snapshot
// =============================================================================

/**
 * Capture a snapshot of all condition-relevant state.
 * Used for debugging and replay verification.
 */
export interface ConditionSnapshot {
  readonly allyCountHere: number;
  readonly enemyCountHere: number;
  readonly allyPowerHere: number;
  readonly enemyPowerHere: number;
  readonly cardsDestroyedCount: number;
  readonly cardsMovedThisGameCount: number;
  readonly cardsMovedThisTurnCount: number;
  readonly locationCapacity: number;
}

/**
 * Create a snapshot of condition-relevant state.
 */
export function createConditionSnapshot(
  state: GameState,
  sourceCard: CardInstance,
  sourceLocation: LocationIndex
): ConditionSnapshot {
  const sourcePlayer = sourceCard.owner;
  const enemyPlayer = (1 - sourcePlayer) as PlayerId;
  const location = getLocation(state, sourceLocation);
  
  return {
    allyCountHere: getCardCount(location, sourcePlayer),
    enemyCountHere: getCardCount(location, enemyPlayer),
    allyPowerHere: getTotalPower(location, sourcePlayer),
    enemyPowerHere: getTotalPower(location, enemyPlayer),
    cardsDestroyedCount: state.cardsDestroyedThisGame.length,
    cardsMovedThisGameCount: state.cardsMovedThisGame.length,
    cardsMovedThisTurnCount: state.cardsMovedThisTurn.length,
    locationCapacity: LOCATION_CAPACITY,
  };
}

/**
 * Evaluate a condition against a snapshot (for replay/verification).
 */
export function evaluateConditionFromSnapshot(
  condition: Condition,
  snapshot: ConditionSnapshot
): boolean {
  switch (condition) {
    case 'NONE':
      return true;
    case 'CONDITIONAL_EXACTLY_ONE_OTHER_ALLY_HERE':
      return snapshot.allyCountHere === 2;
    case 'CONDITIONAL_EXACTLY_TWO_ALLIES_HERE':
      return snapshot.allyCountHere === 2;
    case 'CONDITIONAL_ONLY_CARD_HERE':
      return snapshot.allyCountHere === 1;
    case 'CONDITIONAL_LOCATION_FULL':
      return snapshot.allyCountHere >= snapshot.locationCapacity;
    case 'CONDITIONAL_EMPTY_SLOT_HERE':
      return snapshot.allyCountHere < snapshot.locationCapacity;
    case 'CONDITIONAL_ENEMY_MORE_CARDS_HERE':
      return snapshot.enemyCountHere > snapshot.allyCountHere;
    case 'CONDITIONAL_ENEMY_3PLUS_HERE':
      return snapshot.enemyCountHere >= 3;
    case 'CONDITIONAL_LOSING_LOCATION':
      return snapshot.enemyPowerHere > snapshot.allyPowerHere;
    case 'CONDITIONAL_DESTROYED_THIS_GAME':
      return snapshot.cardsDestroyedCount > 0;
    case 'CONDITIONAL_MOVED_THIS_GAME':
      return snapshot.cardsMovedThisGameCount > 0;
    case 'CONDITIONAL_MOVED_BY_YOU_THIS_TURN':
      return snapshot.cardsMovedThisTurnCount > 0;
    default:
      // Some conditions can't be evaluated from snapshot alone
      return false;
  }
}
