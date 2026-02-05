/**
 * Effect application for the deterministic ability system.
 * 
 * Effects are pure functions that take a game state and a Step,
 * and return a new state plus events. Effects NEVER mutate state directly.
 * 
 * CRITICAL: All effect application is deterministic.
 * Same inputs MUST produce identical outputs.
 */

import type { GameState, CardInstance } from '../models';
import type { GameEvent } from '../events';
import type { LocationIndex, PlayerId, InstanceId, Power } from '../types';
import type { EffectType } from './types';
import type { Step } from '../timeline/types';
import { SeededRNG } from '../rng';
import {
  getLocation,
  withLocation,
  getCardCount,
  getCards,
  updateCard,
  removeCard,
  addCard,
  addPermanentPower,
  withOngoingPower,
  getEffectivePower,
  findCardByInstance,
  findCardLocation,
  withCardDestroyed,
  withCardMoved,
  withSilencedCard,
  addBonusEnergyNextTurn,
  withNextInstanceId,
} from '../models';
import { LOCATION_CAPACITY } from '../types';
import { getCardDef } from '../cards';
import { findMoveDestination, findAllyToMoveHere } from './selectors';

// =============================================================================
// Effect Application Result
// =============================================================================

export interface EffectResult {
  /** Updated game state */
  readonly state: GameState;
  /** Events emitted by this effect */
  readonly events: GameEvent[];
  /** Whether the effect was successfully applied */
  readonly success: boolean;
  /** Reason for failure (if any) */
  readonly failureReason?: string;
}

// =============================================================================
// Core Effect Application
// =============================================================================

/**
 * Apply an effect step from the resolution timeline.
 * 
 * @param state - Current game state
 * @param step - The timeline step to apply
 * @param rng - Seeded RNG for any random elements
 * @returns New state, events, and success status
 */
export function applyEffect(
  state: GameState,
  step: Step,
  rng: SeededRNG
): EffectResult {
  const events: GameEvent[] = [];
  let newState = state;
  
  // Find the source card if it's a card effect
  let sourceCard: CardInstance | null = null;
  let sourceLocation: LocationIndex | null = null;
  
  if (step.source.type === 'CARD') {
    sourceCard = findCardByInstance(state, step.source.id as InstanceId);
    sourceLocation = findCardLocation(state, step.source.id as InstanceId);
    
    if (!sourceCard || sourceLocation === null) {
      return {
        state,
        events: [],
        success: false,
        failureReason: 'Source card not found',
      };
    }
  }
  
  // Apply based on effect type
  switch (step.effect) {
    // =======================================================================
    // Power Effects - Buffs
    // =======================================================================
    case 'POWER':
    case 'SELF_BUFF':
    case 'BUFF_OTHER_ALLY_HERE':
    case 'BUFF_ALLIES_HERE':
    case 'BUFF_ALLIES_HERE_EXCEPT_SELF':
    case 'BUFF_ALLIES_OTHER_LOCATIONS':
    case 'BUFF_ONE_ALLY_OTHER_LOCATION': {
      const result = applyPowerModification(newState, step.targets, step.value, sourceCard?.instanceId, events);
      newState = result.state;
      break;
    }
    
    case 'BUFF_ALLIES_HERE_PER_EMPTY_SLOT': {
      // Value should be calculated based on empty slots
      if (sourceLocation !== null) {
        const loc = getLocation(state, sourceLocation);
        const emptySlots = LOCATION_CAPACITY - getCardCount(loc, sourceCard!.owner);
        const totalValue = step.value * emptySlots;
        const result = applyPowerModification(newState, step.targets, totalValue, sourceCard?.instanceId, events);
        newState = result.state;
      }
      break;
    }
    
    // =======================================================================
    // Power Effects - Debuffs
    // =======================================================================
    case 'DEBUFF_ONE_ENEMY_HERE':
    case 'DEBUFF_ENEMIES_HERE':
    case 'DEBUFF_ENEMY_BUFF_TAGGED_HERE':
    case 'DEBUFF_ENEMY_ONGOING_HERE': {
      // Debuffs use negative value
      const result = applyPowerModification(newState, step.targets, -Math.abs(step.value), sourceCard?.instanceId, events);
      newState = result.state;
      break;
    }
    
    // =======================================================================
    // Movement Effects
    // =======================================================================
    case 'MOVE_SELF_TO_OTHER_LOCATION': {
      if (sourceCard && sourceLocation !== null) {
        const result = applyMoveEffect(newState, sourceCard.instanceId, sourceLocation, rng, events, sourceCard.instanceId);
        newState = result.state;
        if (!result.success) {
          // Emit move failed event
          events.push({
            type: 'MoveFailed' as const,
            cardInstanceId: sourceCard.instanceId,
            reason: result.failureReason === 'No valid destination' ? 'NO_VALID_DESTINATION' : 'DESTINATION_FULL',
          } as GameEvent);
        }
      }
      break;
    }
    
    case 'MOVE_ONE_OTHER_ALLY_FROM_HERE_TO_OTHER_LOCATION': {
      for (const targetId of step.targets) {
        const targetLoc = findCardLocation(newState, targetId);
        if (targetLoc !== null) {
          const result = applyMoveEffect(newState, targetId, targetLoc, rng, events, sourceCard?.instanceId);
          newState = result.state;
        }
      }
      break;
    }
    
    case 'MOVE_ONE_OTHER_ALLY_TO_HERE': {
      if (sourceCard && sourceLocation !== null) {
        const allyInfo = findAllyToMoveHere(newState, sourceCard.owner, sourceLocation, rng);
        if (allyInfo) {
          const result = applyMoveToLocation(newState, allyInfo.cardId, allyInfo.fromLocation, sourceLocation, events, sourceCard.instanceId);
          newState = result.state;
        }
      }
      break;
    }
    
    case 'MOVE_ONE_ENEMY_TO_OTHER_LOCATION': {
      for (const targetId of step.targets) {
        const targetLoc = findCardLocation(newState, targetId);
        if (targetLoc !== null) {
          const result = applyMoveEffect(newState, targetId, targetLoc, rng, events, sourceCard?.instanceId);
          newState = result.state;
        }
      }
      break;
    }
    
    // =======================================================================
    // Destruction Effects
    // =======================================================================
    case 'DESTROY_SELF': {
      if (sourceCard && sourceLocation !== null) {
        const result = applyDestroyEffect(newState, sourceCard.instanceId, sourceLocation, events, sourceCard.instanceId);
        newState = result.state;
      }
      break;
    }
    
    case 'DESTROY_ONE_OTHER_ALLY_HERE':
    case 'DESTROY_ONE_ENEMY_HERE': {
      for (const targetId of step.targets) {
        const targetLoc = findCardLocation(newState, targetId);
        if (targetLoc !== null) {
          const result = applyDestroyEffect(newState, targetId, targetLoc, events, sourceCard?.instanceId);
          newState = result.state;
        }
      }
      break;
    }
    
    // =======================================================================
    // Power Transfer Effects
    // =======================================================================
    case 'GAIN_DESTROYED_CARD_POWER': {
      // Power gained based on destroyed cards count
      const destroyedCount = newState.cardsDestroyedThisGame.length;
      const bonusPower = step.value * destroyedCount;
      if (bonusPower > 0 && sourceCard) {
        const result = applyPowerModification(newState, [sourceCard.instanceId], bonusPower, sourceCard.instanceId, events);
        newState = result.state;
      }
      break;
    }
    
    case 'STEAL_POWER': {
      // Steal power from first target
      if (step.targets.length > 0 && sourceCard) {
        const targetId = step.targets[0]!;
        const result = applyStealPower(newState, sourceCard.instanceId, targetId, step.value, events);
        newState = result.state;
      }
      break;
    }
    
    // =======================================================================
    // Ability Control Effects
    // =======================================================================
    case 'SILENCE_ENEMY_ONGOING_HERE': {
      for (const targetId of step.targets) {
        newState = withSilencedCard(newState, targetId);
      }
      break;
    }
    
    case 'PROTECT_ALLIES_FROM_DEBUFF': {
      // Mark targets as protected from debuffs
      // This is handled during ongoing recalculation - the protection applies 
      // as long as the source card (e.g., Palladium) is in play
      // No immediate state change needed here, protection is checked in debuff effects
      break;
    }
    
    // =======================================================================
    // Global/Tag-based Effects
    // =======================================================================
    case 'BUFF_DESTROY_CARDS_GLOBAL': {
      // Buff all cards with Destroy tag
      const result = applyPowerModification(newState, step.targets, step.value, sourceCard?.instanceId, events);
      newState = result.state;
      break;
    }
    
    // =======================================================================
    // Compound Effects
    // =======================================================================
    case 'DESTROY_AND_BUFF': {
      // Destroy target, then buff secondary target
      // Used by Zagreus, Ashen Offering, Hecate
      if (step.targets.length > 0 && sourceCard && sourceLocation !== null) {
        const targetId = step.targets[0]!;
        const targetLoc = findCardLocation(newState, targetId);
        if (targetLoc !== null) {
          const destroyResult = applyDestroyEffect(newState, targetId, targetLoc, events, sourceCard.instanceId);
          newState = destroyResult.state;
          
          // Only buff if destroy succeeded
          if (destroyResult.success) {
            // Determine buff target based on secondary target
            const secondaryTarget = step.parameters?.secondaryTarget;
            let buffTargetIds: InstanceId[] = [];
            
            if (secondaryTarget === 'SELF') {
              buffTargetIds = [sourceCard.instanceId];
            } else if (secondaryTarget === 'ONE_ALLY_OTHER_LOCATION') {
              // Find an ally at another location
              const otherLocations = ([0, 1, 2] as LocationIndex[]).filter(idx => idx !== sourceLocation);
              for (const locIdx of otherLocations) {
                const loc = getLocation(newState, locIdx);
                const allies = getCards(loc, sourceCard.owner);
                if (allies.length > 0) {
                  buffTargetIds = [allies[0]!.instanceId];
                  break;
                }
              }
            } else if (secondaryTarget === 'ONE_ENEMY_HERE') {
              // Find an enemy at this location
              const enemyPlayer = (1 - sourceCard.owner) as PlayerId;
              const loc = getLocation(newState, sourceLocation);
              const enemies = getCards(loc, enemyPlayer);
              if (enemies.length > 0) {
                buffTargetIds = [enemies[0]!.instanceId];
              }
            }
            
            if (buffTargetIds.length > 0) {
              const buffResult = applyPowerModification(newState, buffTargetIds, step.value, sourceCard.instanceId, events);
              newState = buffResult.state;
            }
          }
        }
      }
      break;
    }
    
    case 'DESTROY_AND_SELF_BUFF': {
      // Destroy target, then buff self
      // If step.value is 0, gain the destroyed card's power (Hades/Talos)
      // Otherwise, buff by step.value (Kronos/Moira Atropos)
      if (step.targets.length > 0 && sourceCard && sourceLocation !== null) {
        const targetId = step.targets[0]!;
        const targetLoc = findCardLocation(newState, targetId);
        if (targetLoc !== null) {
          // Capture target's power before destruction if we need to gain it
          const target = findCardByInstance(newState, targetId);
          const targetPower = target ? getEffectivePower(target) : 0;
          
          const destroyResult = applyDestroyEffect(newState, targetId, targetLoc, events, sourceCard.instanceId);
          newState = destroyResult.state;
          
          // Only buff self if destroy succeeded
          if (destroyResult.success) {
            // If step.value is 0, gain the destroyed card's power
            // Otherwise use the specified buff amount
            const buffAmount = step.value === 0 ? targetPower : step.value;
            if (buffAmount !== 0) {
              const buffResult = applyPowerModification(newState, [sourceCard.instanceId], buffAmount, sourceCard.instanceId, events);
              newState = buffResult.state;
            }
          }
        }
      }
      break;
    }
    
    case 'MOVE_AND_BUFF': {
      // Move, then buff
      // For Nike: move self, buff self (secondaryTarget = 'SELF')
      // For Ariadne: move ally to here, buff the moved card (secondaryTarget = 'MOVED_CARD')
      // For Charon: move ally to here, buff self if moved (secondaryTarget = 'SELF')
      if (step.targets.length > 0 && sourceCard) {
        const targetId = step.targets[0]!;
        const targetLoc = findCardLocation(newState, targetId);
        if (targetLoc !== null) {
          const moveResult = applyMoveEffect(newState, targetId, targetLoc, rng, events, sourceCard.instanceId);
          newState = moveResult.state;
          
          // Only buff if move succeeded
          if (moveResult.success) {
            // Determine buff target based on parameters
            const secondaryTarget = step.parameters?.secondaryTarget;
            let buffTargetId: InstanceId;
            
            if (secondaryTarget === 'SELF' || secondaryTarget === undefined) {
              // Buff the source card (Nike, Charon)
              buffTargetId = sourceCard.instanceId;
            } else if (secondaryTarget === 'MOVED_CARD') {
              // Buff the moved card (Ariadne)
              buffTargetId = targetId;
            } else {
              // For any other target, buff the moved card
              buffTargetId = targetId;
            }
            
            const buffResult = applyPowerModification(newState, [buffTargetId], step.value, sourceCard.instanceId, events);
            newState = buffResult.state;
          }
        }
      }
      break;
    }
    
    case 'MOVE_SELF_AND_DEBUFF_DESTINATION': {
      // Move self, then debuff one enemy at the destination
      // Used by Hypnos: "Move self to another location. Give 1 enemy card there -1 Power."
      if (sourceCard && sourceLocation !== null) {
        // Execute the move first
        const moveResult = applyMoveEffect(newState, sourceCard.instanceId, sourceLocation, rng, events, sourceCard.instanceId);
        newState = moveResult.state;
        
        // Only debuff if move succeeded
        if (moveResult.success) {
          // Find the destination location by locating the moved card
          const newCardLocation = findCardLocation(newState, sourceCard.instanceId);
          
          if (newCardLocation !== null && newCardLocation !== sourceLocation) {
            // Find enemies at the destination
            const enemyPlayer = (1 - sourceCard.owner) as PlayerId;
            const destLoc = getLocation(newState, newCardLocation);
            const enemies = getCards(destLoc, enemyPlayer);
            
            if (enemies.length > 0) {
              // Debuff the first enemy (could use RNG for random selection if needed)
              const targetEnemy = enemies[0]!;
              const debuffResult = applyPowerModification(newState, [targetEnemy.instanceId], step.value, sourceCard.instanceId, events);
              newState = debuffResult.state;
            }
          }
        }
      }
      break;
    }
    
    // =======================================================================
    // Energy Effects
    // =======================================================================
    case 'ADD_ENERGY_NEXT_TURN': {
      if (sourceCard) {
        newState = addBonusEnergyNextTurn(newState, sourceCard.owner, step.value);
        events.push({
          type: 'BonusEnergy',
          playerId: sourceCard.owner,
          bonus: step.value,
          locationsWon: 0,
          newTotal: step.value,
        });
      }
      break;
    }
    
    // =======================================================================
    // Summon Effects
    // =======================================================================
    case 'SUMMON_SPIRIT': {
      if (sourceCard && sourceLocation !== null) {
        const result = applySummonEffect(newState, sourceCard.owner, sourceLocation, step.value, events);
        newState = result.state;
      }
      break;
    }
    
    default:
      console.warn(`Unknown effect type: ${step.effect}`);
  }
  
  return {
    state: newState,
    events,
    success: true,
  };
}

// =============================================================================
// Specific Effect Implementations
// =============================================================================

/**
 * Apply a power modification to target cards.
 */
function applyPowerModification(
  state: GameState,
  targetIds: readonly InstanceId[],
  amount: Power,
  sourceCardId: InstanceId | undefined,
  events: GameEvent[]
): { state: GameState } {
  let newState = state;
  
  for (const targetId of targetIds) {
    const target = findCardByInstance(newState, targetId);
    const targetLoc = findCardLocation(newState, targetId);
    
    if (!target || targetLoc === null) continue;
    
    const oldPower = getEffectivePower(target);
    const updated = addPermanentPower(target, amount);
    const newPower = getEffectivePower(updated);
    
    let loc = getLocation(newState, targetLoc);
    loc = updateCard(loc, updated);
    newState = withLocation(newState, targetLoc, loc);
    
    events.push({
      type: 'PowerChanged',
      cardInstanceId: targetId,
      oldPower,
      newPower,
      sourceCardId: sourceCardId ?? targetId,
    });
  }
  
  return { state: newState };
}

/**
 * Apply ongoing power modification (temporary, recomputed each turn).
 */
export function applyOngoingPowerModification(
  state: GameState,
  targetIds: readonly InstanceId[],
  amount: Power
): GameState {
  let newState = state;
  
  for (const targetId of targetIds) {
    const target = findCardByInstance(newState, targetId);
    const targetLoc = findCardLocation(newState, targetId);
    
    if (!target || targetLoc === null) continue;
    
    const updated = withOngoingPower(target, target.ongoingPowerModifier + amount);
    
    let loc = getLocation(newState, targetLoc);
    loc = updateCard(loc, updated);
    newState = withLocation(newState, targetLoc, loc);
  }
  
  return newState;
}

/**
 * Apply a move effect to a card.
 */
function applyMoveEffect(
  state: GameState,
  cardId: InstanceId,
  fromLocation: LocationIndex,
  rng: SeededRNG,
  events: GameEvent[],
  sourceCardId?: InstanceId
): EffectResult {
  const card = findCardByInstance(state, cardId);
  if (!card) {
    return { state, events: [], success: false, failureReason: 'Card not found' };
  }
  
  // Find destination
  const destLocation = findMoveDestination(state, card.owner, fromLocation, 'FIRST_AVAILABLE', rng);
  if (destLocation === null) {
    return { state, events: [], success: false, failureReason: 'No valid destination' };
  }
  
  return applyMoveToLocation(state, cardId, fromLocation, destLocation, events, sourceCardId);
}

/**
 * Move a card to a specific location.
 */
function applyMoveToLocation(
  state: GameState,
  cardId: InstanceId,
  fromLocation: LocationIndex,
  toLocation: LocationIndex,
  events: GameEvent[],
  sourceCardId?: InstanceId
): EffectResult {
  let newState = state;
  
  // Remove from source
  const sourceLoc = getLocation(newState, fromLocation);
  const [newSourceLoc, removedCard] = removeCard(sourceLoc, cardId);
  if (!removedCard) {
    return { state, events: [], success: false, failureReason: 'Failed to remove card' };
  }
  
  newState = withLocation(newState, fromLocation, newSourceLoc);
  
  // Add to destination
  let destLoc = getLocation(newState, toLocation);
  destLoc = addCard(destLoc, removedCard, removedCard.owner);
  newState = withLocation(newState, toLocation, destLoc);
  
  // Track move
  newState = withCardMoved(newState, cardId);
  
  events.push({
    type: 'CardMoved',
    cardInstanceId: cardId,
    fromLocation,
    toLocation,
    sourceCardId: sourceCardId ?? cardId,
  });
  
  return { state: newState, events, success: true };
}

/**
 * Apply a destroy effect to a card.
 */
function applyDestroyEffect(
  state: GameState,
  cardId: InstanceId,
  location: LocationIndex,
  events: GameEvent[],
  sourceCardId?: InstanceId
): EffectResult {
  let newState = state;
  
  const loc = getLocation(newState, location);
  const [newLoc, removed] = removeCard(loc, cardId);
  
  if (!removed) {
    return { state, events: [], success: false, failureReason: 'Card not found' };
  }
  
  newState = withLocation(newState, location, newLoc);
  newState = withCardDestroyed(newState, cardId);
  
  events.push({
    type: 'CardDestroyed',
    cardInstanceId: cardId,
    location,
    sourceCardId: sourceCardId ?? cardId,
  });
  
  return { state: newState, events, success: true };
}

/**
 * Apply a steal power effect.
 */
function applyStealPower(
  state: GameState,
  stealerId: InstanceId,
  targetId: InstanceId,
  amount: Power,
  events: GameEvent[]
): { state: GameState } {
  let newState = state;
  
  // Debuff target
  const target = findCardByInstance(newState, targetId);
  const targetLoc = findCardLocation(newState, targetId);
  
  if (target && targetLoc !== null) {
    const oldTargetPower = getEffectivePower(target);
    const updatedTarget = addPermanentPower(target, -amount);
    const newTargetPower = getEffectivePower(updatedTarget);
    
    let loc = getLocation(newState, targetLoc);
    loc = updateCard(loc, updatedTarget);
    newState = withLocation(newState, targetLoc, loc);
    
    events.push({
      type: 'PowerChanged',
      cardInstanceId: targetId,
      oldPower: oldTargetPower,
      newPower: newTargetPower,
      sourceCardId: stealerId,
    });
  }
  
  // Buff stealer
  const stealer = findCardByInstance(newState, stealerId);
  const stealerLoc = findCardLocation(newState, stealerId);
  
  if (stealer && stealerLoc !== null) {
    const oldStealerPower = getEffectivePower(stealer);
    const updatedStealer = addPermanentPower(stealer, amount);
    const newStealerPower = getEffectivePower(updatedStealer);
    
    let loc = getLocation(newState, stealerLoc);
    loc = updateCard(loc, updatedStealer);
    newState = withLocation(newState, stealerLoc, loc);
    
    events.push({
      type: 'PowerChanged',
      cardInstanceId: stealerId,
      oldPower: oldStealerPower,
      newPower: newStealerPower,
      sourceCardId: stealerId,
    });
  }
  
  return { state: newState };
}

/**
 * Apply a summon effect.
 */
function applySummonEffect(
  state: GameState,
  owner: PlayerId,
  location: LocationIndex,
  basePower: Power,
  _events: GameEvent[]
): { state: GameState } {
  let newState = state;
  
  const loc = getLocation(newState, location);
  if (getCardCount(loc, owner) >= LOCATION_CAPACITY) {
    return { state: newState };
  }
  
  // Get spirit definition
  const spiritDef = getCardDef('shade');
  if (!spiritDef) {
    return { state: newState };
  }
  
  // Calculate spirit power based on destroyed cards
  const destroyedCount = newState.cardsDestroyedThisGame.length;
  const spiritPower = basePower + destroyedCount;
  
  // Create spirit instance
  const spirit: CardInstance = {
    instanceId: newState.nextInstanceId,
    cardDef: spiritDef,
    owner,
    permanentPowerModifier: spiritPower - spiritDef.basePower,
    ongoingPowerModifier: 0,
    revealed: true,
  };
  
  // Add to location
  const newLoc = addCard(loc, spirit, owner);
  newState = withLocation(newState, location, newLoc);
  newState = withNextInstanceId(newState, newState.nextInstanceId + 1);
  
  return { state: newState };
}

// =============================================================================
// Effect Description (for debugging)
// =============================================================================

/**
 * Get a human-readable description of an effect type.
 */
export function describeEffectType(effect: EffectType): string {
  const descriptions: Record<EffectType, string> = {
    'POWER': 'modify power',
    'SELF_BUFF': 'buff self',
    'BUFF_OTHER_ALLY_HERE': 'buff one ally here',
    'BUFF_ALLIES_HERE': 'buff all allies here',
    'BUFF_ALLIES_HERE_EXCEPT_SELF': 'buff other allies here',
    'BUFF_ALLIES_OTHER_LOCATIONS': 'buff allies elsewhere',
    'BUFF_ONE_ALLY_OTHER_LOCATION': 'buff one ally elsewhere',
    'BUFF_ALLIES_HERE_PER_EMPTY_SLOT': 'buff per empty slot',
    'DEBUFF_ONE_ENEMY_HERE': 'debuff one enemy here',
    'DEBUFF_ENEMIES_HERE': 'debuff all enemies here',
    'DEBUFF_ENEMY_BUFF_TAGGED_HERE': 'debuff Buff-tagged enemies',
    'DEBUFF_ENEMY_ONGOING_HERE': 'debuff Ongoing enemies',
    'MOVE_SELF_TO_OTHER_LOCATION': 'move self',
    'MOVE_ONE_OTHER_ALLY_TO_HERE': 'move ally here',
    'MOVE_ONE_OTHER_ALLY_FROM_HERE_TO_OTHER_LOCATION': 'move ally away',
    'MOVE_ONE_ENEMY_TO_OTHER_LOCATION': 'move enemy',
    'DESTROY_SELF': 'destroy self',
    'DESTROY_ONE_OTHER_ALLY_HERE': 'destroy one ally',
    'DESTROY_ONE_ENEMY_HERE': 'destroy one enemy',
    'GAIN_DESTROYED_CARD_POWER': 'gain power from destroyed',
    'STEAL_POWER': 'steal power',
    'SILENCE_ENEMY_ONGOING_HERE': 'silence enemies',
    'PROTECT_ALLIES_FROM_DEBUFF': 'protect allies from debuffs',
    'BUFF_DESTROY_CARDS_GLOBAL': 'buff Destroy cards',
    'DESTROY_AND_BUFF': 'destroy then buff',
    'DESTROY_AND_SELF_BUFF': 'destroy then self-buff',
    'MOVE_AND_BUFF': 'move then buff',
    'MOVE_SELF_AND_DEBUFF_DESTINATION': 'move self then debuff enemy',
    'ADD_ENERGY_NEXT_TURN': 'add energy next turn',
    'SUMMON_SPIRIT': 'summon spirit',
  };
  
  return descriptions[effect] ?? `unknown effect: ${effect}`;
}
