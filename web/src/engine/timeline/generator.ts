/**
 * Timeline generator for the deterministic resolution system.
 * 
 * This module generates the complete ResolutionTimeline at the start of Phase B.
 * The timeline is fully pre-computed and immutable - no logic depends on
 * animation timing or UI state.
 * 
 * CRITICAL: generateTimeline() MUST be deterministic.
 * Same inputs (state + playedCards + seed) = identical timeline.
 */

import type { GameState, CardInstance } from '../models';
import type { LocationIndex, PlayerId, TurnNumber } from '../types';
import { SeededRNG } from '../rng';
import { findCardByInstance } from '../models';
import type { Ability } from '../ability/ability';
import { evaluateCondition } from '../ability/conditions';
import { resolveTargets } from '../ability/selectors';
import type { Trigger, EffectType } from '../ability/types';
import type {
  Step,
  PlayedCard,
  ResolutionTimeline,
  TimelineResult,
  StepVisualMetadata,
} from './types';
import {
  createCardSource,
  createRevealStep,
  createEventStep,
  createOngoingRecalcStep,
  createCleanupStep,
  calculateTimelineMetadata,
} from './types';

// =============================================================================
// Timeline Generation
// =============================================================================

/**
 * Generate the complete resolution timeline for a turn.
 * 
 * This is the core function that pre-computes ALL events that will happen
 * during Phase B resolution. The timeline is generated ONCE and is immutable.
 * 
 * @param state - Game state at the start of resolution
 * @param playedCards - Cards played this turn (in play order)
 * @param rng - Seeded RNG for deterministic random selection
 * @returns Complete timeline and metadata
 */
export function generateTimeline(
  state: GameState,
  playedCards: readonly PlayedCard[],
  rng: SeededRNG
): TimelineResult {
  const steps: Step[] = [];
  let stepIndex = 0;
  
  // Sort played cards by reveal order
  const sortedCards = sortByRevealOrder(playedCards, state);
  
  // ==========================================================================
  // Phase 1: Generate REVEAL steps
  // ==========================================================================
  for (const playedCard of sortedCards) {
    const card = findCardByInstance(state, playedCard.instanceId);
    if (!card) continue;
    
    // Create reveal step
    steps.push(createRevealStep(stepIndex++, card, playedCard.location));
    
    // Schedule ON_REVEAL abilities
    if (card.cardDef.abilityType === 'ON_REVEAL') {
      const abilitySteps = generateAbilitySteps(
        state,
        card,
        playedCard.location,
        'ON_REVEAL',
        rng,
        stepIndex
      );
      
      for (const step of abilitySteps) {
        steps.push({ ...step, stepIndex: stepIndex++ });
      }
    }
  }
  
  // ==========================================================================
  // Phase 2: Generate ONGOING_RECALC step
  // ==========================================================================
  steps.push(createOngoingRecalcStep(stepIndex++));
  
  // ==========================================================================
  // Phase 3: Generate CLEANUP step
  // ==========================================================================
  steps.push(createCleanupStep(stepIndex++));
  
  // Calculate metadata
  const metadata = calculateTimelineMetadata(
    steps,
    state.turn as TurnNumber,
    rng.getSeed()
  );
  
  return {
    timeline: steps,
    metadata,
  };
}

// =============================================================================
// Reveal Order Sorting
// =============================================================================

/**
 * Sort played cards by reveal order.
 * 
 * Order rules:
 * 1. Locations: Left (0) → Middle (1) → Right (2)
 * 2. Within location: earlier played first (by playOrder)
 * 3. Tie-break: active player first (alternates each turn)
 */
function sortByRevealOrder(
  playedCards: readonly PlayedCard[],
  state: GameState
): PlayedCard[] {
  // Active player alternates each turn (P0 on odd turns, P1 on even turns)
  const activePlayer = (state.turn % 2 === 1 ? 0 : 1) as PlayerId;
  
  return [...playedCards].sort((a, b) => {
    // First: sort by location (left to right)
    if (a.location !== b.location) {
      return a.location - b.location;
    }
    
    // Second: sort by play order
    if (a.playOrder !== b.playOrder) {
      return a.playOrder - b.playOrder;
    }
    
    // Third: active player first
    if (a.playerId !== b.playerId) {
      return a.playerId === activePlayer ? -1 : 1;
    }
    
    // Fourth: lower instance ID (deterministic tie-break)
    return a.instanceId - b.instanceId;
  });
}

// =============================================================================
// Ability Step Generation
// =============================================================================

/**
 * Generate steps for a card's abilities of a given trigger type.
 */
function generateAbilitySteps(
  state: GameState,
  card: CardInstance,
  location: LocationIndex,
  trigger: Trigger,
  rng: SeededRNG,
  startIndex: number
): Step[] {
  const steps: Step[] = [];
  
  // Get abilities from card effects (legacy format)
  const abilities = parseCardAbilities(card, trigger);
  
  for (const ability of abilities) {
    // Evaluate condition
    if (!evaluateCondition(ability.condition, state, card, location)) {
      continue;
    }
    
    // Resolve targets
    const targets = resolveTargets(
      ability.targetSelector,
      state,
      card,
      location,
      rng
    );
    
    // Skip if no valid targets (unless effect doesn't need targets)
    if (targets.length === 0 && requiresTargets(ability.effect)) {
      continue;
    }
    
    // Create visual metadata
    const visualMetadata: StepVisualMetadata = {
      visualEffectType: ability.visualMetadata.visualEffectType,
      intensity: ability.visualMetadata.intensity,
      affectedEntities: [...targets],
      sourceLocation: location,
    };
    
    // Convert ability parameters to step parameters
    const stepParameters = ability.parameters ? {
      secondaryTarget: ability.parameters.secondaryTarget,
      secondaryValue: ability.parameters.secondaryValue,
      perUnitAmount: ability.parameters.perUnitAmount,
      countFilter: ability.parameters.countFilter,
    } : undefined;
    
    // Create step
    const step = createEventStep(
      startIndex + steps.length,
      createCardSource(card.instanceId, card.owner),
      trigger,
      ability.condition,
      targets,
      ability.effect,
      ability.value,
      ability.durationScope,
      visualMetadata,
      `${card.cardDef.name}: ${ability.effect}`,
      stepParameters
    );
    
    steps.push(step);
  }
  
  return steps;
}

/**
 * Parse card effects into the new Ability format.
 * This bridges the legacy effect system with the new ability system.
 * Exported for use by executeOngoingRecalcStep in executor.ts.
 * 
 * Effects are sorted so that:
 * 1. Buffs and other effects happen first
 * 2. Self-destroy effects happen last
 * This ensures cards like Shade can buff allies before destroying themselves.
 */
export function parseCardAbilities(card: CardInstance, trigger: Trigger): Ability[] {
  const abilities: Ability[] = [];
  
  for (const effect of card.cardDef.effects) {
    // Map legacy effects to new abilities (cast to Record to satisfy type system)
    const ability = mapLegacyEffectToAbility(effect as unknown as Record<string, unknown>, trigger);
    if (ability) {
      abilities.push(ability);
    }
  }
  
  // Sort abilities so DESTROY_SELF happens last
  // This allows cards to apply their effects before destroying themselves
  abilities.sort((a, b) => {
    const aIsDestroySelf = a.effect === 'DESTROY_SELF';
    const bIsDestroySelf = b.effect === 'DESTROY_SELF';
    
    if (aIsDestroySelf && !bIsDestroySelf) return 1;  // a comes after b
    if (!aIsDestroySelf && bIsDestroySelf) return -1; // a comes before b
    return 0; // maintain original order
  });
  
  return abilities;
}

/**
 * Map a legacy effect to a new Ability.
 */
function mapLegacyEffectToAbility(
  effect: Record<string, unknown>,
  trigger: Trigger
): Ability | null {
  switch (effect.type) {
    case 'AddPowerEffect':
      return {
        trigger,
        condition: 'NONE',
        targetSelector: mapTargetFilter(effect.target as string),
        effect: (effect.amount as number) >= 0 ? 'BUFF_ALLIES_HERE' : 'DEBUFF_ENEMIES_HERE',
        value: effect.amount as number,
        durationScope: 'INSTANT',
        visualMetadata: {
          visualEffectType: (effect.amount as number) >= 0 ? 'GLOW' : 'DRAIN',
          intensity: 'MEDIUM',
          affectedEntities: [],
        },
      };
    
    case 'AddOngoingPowerEffect':
      return {
        trigger: 'ONGOING',
        condition: 'NONE',
        targetSelector: mapTargetFilter(effect.target as string),
        effect: 'BUFF_ALLIES_HERE',
        value: effect.amount as number,
        durationScope: 'WHILE_IN_PLAY',
        visualMetadata: {
          visualEffectType: 'PULSE',
          intensity: 'LOW',
          affectedEntities: [],
        },
      };
    
    case 'ConditionalOngoingPowerEffect':
      return {
        trigger: 'ONGOING',
        condition: mapCondition(effect.condition as string),
        targetSelector: mapTargetFilter(effect.target as string),
        effect: (effect.amount as number) >= 0 ? 'BUFF_ALLIES_HERE' : 'DEBUFF_ENEMIES_HERE',
        value: effect.amount as number,
        durationScope: 'WHILE_IN_PLAY',
        visualMetadata: {
          visualEffectType: 'PULSE',
          intensity: 'LOW',
          affectedEntities: [],
        },
      };
    
    case 'MoveCardEffect':
      return {
        trigger,
        condition: 'NONE',
        targetSelector: mapTargetFilter(effect.target as string),
        effect: effect.target === 'SELF' ? 'MOVE_SELF_TO_OTHER_LOCATION' : 'MOVE_ONE_OTHER_ALLY_FROM_HERE_TO_OTHER_LOCATION',
        value: 0,
        durationScope: 'INSTANT',
        visualMetadata: {
          visualEffectType: 'RIPPLE',
          intensity: 'MEDIUM',
          affectedEntities: [],
        },
      };
    
    case 'DestroyCardEffect':
      return {
        trigger,
        condition: 'NONE',
        targetSelector: mapTargetFilter(effect.target as string),
        effect: effect.target === 'SELF' ? 'DESTROY_SELF' : 'DESTROY_ONE_OTHER_ALLY_HERE',
        value: 0,
        durationScope: 'INSTANT',
        visualMetadata: {
          visualEffectType: 'SHATTER',
          intensity: 'HIGH',
          affectedEntities: [],
        },
      };
    
    case 'ConditionalPowerEffect': {
      // Determine effect type based on target and amount
      const targetStr = effect.target as string;
      const amount = effect.amount as number;
      let effectType: import('../ability/types').EffectType;
      
      if (amount < 0) {
        effectType = 'DEBUFF_ONE_ENEMY_HERE';
      } else if (targetStr === 'SELF') {
        effectType = 'SELF_BUFF';
      } else if (targetStr.includes('FRIENDLY') || targetStr.includes('SAME_LOCATION')) {
        effectType = 'BUFF_ALLIES_HERE';
      } else {
        effectType = 'SELF_BUFF';
      }
      
      return {
        trigger,
        condition: mapCondition(effect.condition as string),
        targetSelector: mapTargetFilter(targetStr),
        effect: effectType,
        value: amount,
        durationScope: 'INSTANT',
        visualMetadata: {
          visualEffectType: amount >= 0 ? 'GLOW' : 'DRAIN',
          intensity: 'MEDIUM',
          affectedEntities: [],
        },
      };
    }
    
    case 'StealPowerEffect':
      return {
        trigger,
        condition: 'NONE',
        targetSelector: mapTargetFilter(effect.target as string),
        effect: 'STEAL_POWER',
        value: effect.amount as number,
        durationScope: 'INSTANT',
        visualMetadata: {
          visualEffectType: 'DRAIN',
          intensity: 'HIGH',
          affectedEntities: [],
        },
      };
    
    case 'SilenceOngoingEffect':
      return {
        trigger: 'ONGOING',
        condition: 'NONE',
        targetSelector: mapTargetFilter(effect.target as string),
        effect: 'SILENCE_ENEMY_ONGOING_HERE',
        value: 0,
        durationScope: 'WHILE_IN_PLAY',
        visualMetadata: {
          visualEffectType: 'LOCK',
          intensity: 'MEDIUM',
          affectedEntities: [],
        },
      };
    
    case 'ScalingPowerEffect':
      return {
        trigger,
        condition: 'NONE',
        targetSelector: 'SELF',
        effect: 'GAIN_DESTROYED_CARD_POWER',
        value: effect.per_destroyed_amount as number ?? effect.perDestroyedAmount as number ?? 2,
        durationScope: 'INSTANT',
        visualMetadata: {
          visualEffectType: 'GLOW',
          intensity: 'HIGH',
          affectedEntities: [],
        },
      };
    
    case 'ScalingOngoingPowerEffect':
      return {
        trigger: 'ONGOING',
        condition: 'NONE',
        targetSelector: mapTargetFilter(effect.target as string),
        effect: 'BUFF_ALLIES_HERE',
        value: 0, // Scaling value computed dynamically
        parameters: {
          perUnitAmount: effect.per_card_amount as number ?? effect.perCardAmount as number ?? 1,
          countFilter: mapTargetFilter(effect.count_filter as string ?? effect.countFilter as string),
        },
        durationScope: 'WHILE_IN_PLAY',
        visualMetadata: {
          visualEffectType: 'PULSE',
          intensity: 'MEDIUM',
          affectedEntities: [],
        },
      };
    
    case 'ReviveEffect':
      return {
        trigger,
        condition: 'CONDITIONAL_DESTROYED_THIS_GAME',
        targetSelector: 'LOCATION',
        effect: 'SUMMON_SPIRIT',
        value: effect.base_spirit_power as number ?? effect.baseSpiritPower as number ?? 2,
        durationScope: 'INSTANT',
        visualMetadata: {
          visualEffectType: 'GLOW',
          intensity: 'HIGH',
          affectedEntities: [],
        },
      };
    
    case 'DestroyAndBuffEffect':
      return {
        trigger,
        condition: 'NONE',
        targetSelector: mapTargetFilter(effect.destroy_target as string ?? effect.destroyTarget as string),
        effect: 'DESTROY_AND_BUFF',
        value: effect.buff_amount as number ?? effect.buffAmount as number ?? 0,
        parameters: {
          secondaryTarget: mapTargetFilter(effect.buff_target as string ?? effect.buffTarget as string),
          secondaryValue: effect.buff_amount as number ?? effect.buffAmount as number ?? 0,
        },
        durationScope: 'INSTANT',
        visualMetadata: {
          visualEffectType: 'SHATTER',
          intensity: 'HIGH',
          affectedEntities: [],
        },
      };
    
    case 'DestroyAndSelfBuffEffect':
      return {
        trigger,
        condition: 'NONE',
        targetSelector: mapTargetFilter(effect.destroy_target as string ?? effect.destroyTarget as string),
        effect: 'DESTROY_AND_SELF_BUFF',
        value: effect.buff_amount as number ?? effect.buffAmount as number ?? 0,
        durationScope: 'INSTANT',
        visualMetadata: {
          visualEffectType: 'SHATTER',
          intensity: 'HIGH',
          affectedEntities: [],
        },
      };
    
    case 'MoveAndBuffEffect':
      return {
        trigger,
        condition: 'NONE',
        targetSelector: mapTargetFilter(effect.move_target as string ?? effect.moveTarget as string),
        effect: 'MOVE_AND_BUFF',
        value: effect.buff_amount as number ?? effect.buffAmount as number ?? 0,
        parameters: {
          secondaryTarget: mapTargetFilter(effect.buff_target as string ?? effect.buffTarget as string),
        },
        durationScope: 'INSTANT',
        visualMetadata: {
          visualEffectType: 'RIPPLE',
          intensity: 'MEDIUM',
          affectedEntities: [],
        },
      };
    
    case 'AddEnergyNextTurnEffect':
      return {
        trigger,
        condition: 'NONE',
        targetSelector: 'SELF',
        effect: 'ADD_ENERGY_NEXT_TURN',
        value: effect.amount as number,
        durationScope: 'UNTIL_START_OF_NEXT_TURN',
        visualMetadata: {
          visualEffectType: 'GLOW',
          intensity: 'LOW',
          affectedEntities: [],
        },
      };
    
    case 'DestroyAndGainPowerEffect':
      return {
        trigger,
        condition: 'NONE',
        targetSelector: mapTargetFilter(effect.destroy_target as string ?? effect.destroyTarget as string),
        effect: 'DESTROY_AND_SELF_BUFF',
        value: 0, // Power gained from destroyed card (computed at execution time)
        parameters: {
          secondaryTarget: mapTargetFilter(effect.gain_target as string ?? effect.gainTarget as string ?? 'SELF'),
        },
        durationScope: 'INSTANT',
        visualMetadata: {
          visualEffectType: 'SHATTER',
          intensity: 'HIGH',
          affectedEntities: [],
        },
      };
    
    case 'GlobalOngoingPowerEffect':
      return {
        trigger: 'ONGOING',
        condition: 'NONE',
        targetSelector: mapTargetFilter(effect.target as string),
        effect: 'BUFF_DESTROY_CARDS_GLOBAL',
        value: effect.amount as number,
        durationScope: 'WHILE_IN_PLAY',
        visualMetadata: {
          visualEffectType: 'PULSE',
          intensity: 'MEDIUM',
          affectedEntities: [],
        },
      };
    
    case 'MoveAndSelfBuffEffect':
      return {
        trigger,
        condition: 'NONE',
        targetSelector: mapTargetFilter(effect.move_target as string ?? effect.moveTarget as string),
        effect: 'MOVE_AND_BUFF',
        value: effect.buff_amount as number ?? effect.buffAmount as number ?? 0,
        parameters: {
          secondaryTarget: 'SELF',
        },
        durationScope: 'INSTANT',
        visualMetadata: {
          visualEffectType: 'RIPPLE',
          intensity: 'MEDIUM',
          affectedEntities: [],
        },
      };
    
    case 'MoveAndDebuffDestinationEffect':
      return {
        trigger,
        condition: 'NONE',
        targetSelector: 'SELF', // The card being moved
        effect: 'MOVE_SELF_AND_DEBUFF_DESTINATION',
        value: effect.debuff_amount as number ?? effect.debuffAmount as number ?? -1,
        durationScope: 'INSTANT',
        visualMetadata: {
          visualEffectType: 'RIPPLE',
          intensity: 'MEDIUM',
          affectedEntities: [],
        },
      };
    
    default:
      console.warn(`Unknown effect type: ${effect.type}`);
      return null;
  }
}

/**
 * Map legacy target filter to new TargetSelector.
 */
function mapTargetFilter(target: string | undefined): import('../ability/types').TargetSelector {
  if (!target) return 'SELF';
  
  const mapping: Record<string, import('../ability/types').TargetSelector> = {
    'SELF': 'SELF',
    // SAME_LOCATION_FRIENDLY includes self - used by cards that say "your cards here"
    'SAME_LOCATION_FRIENDLY': 'ALL_ALLIES_HERE',
    // SAME_LOCATION_FRIENDLY_EXCEPT_SELF excludes self - used by cards that say "other cards here"
    'SAME_LOCATION_FRIENDLY_EXCEPT_SELF': 'ALL_ALLIES_HERE_EXCEPT_SELF',
    'SAME_LOCATION_ENEMY': 'ALL_ENEMIES_HERE',
    // ONE_SAME_LOCATION_FRIENDLY always excludes self (picks ONE other ally)
    'ONE_SAME_LOCATION_FRIENDLY': 'ONE_OTHER_ALLY_HERE',
    'ONE_SAME_LOCATION_FRIENDLY_EXCEPT_SELF': 'ONE_OTHER_ALLY_HERE',
    'ONE_SAME_LOCATION_ENEMY': 'ONE_ENEMY_HERE',
    'ALL_FRIENDLY': 'ALL_ALLIES_HERE',
    'ALL_ENEMY': 'ALL_ENEMIES_HERE',
    'OTHER_LOCATIONS_FRIENDLY': 'ALL_ALLIES_OTHER_LOCATIONS',
    'ONE_OTHER_LOCATION_FRIENDLY': 'ONE_ALLY_OTHER_LOCATION',
    'HIGHEST_POWER_ENEMY_HERE': 'HIGHEST_POWER_ENEMY_HERE',
    'SAME_LOCATION_ENEMY_BUFF_TAGGED': 'ENEMY_WITH_BUFF_TAG_HERE',
    'SAME_LOCATION_ENEMY_ONGOING': 'ENEMY_WITH_ONGOING_HERE',
    'ONE_OTHER_LOCATION_FRIENDLY_TO_HERE': 'ONE_ALLY_OTHER_LOCATION',
    'ALL_FRIENDLY_DESTROY_TAGGED': 'FRIENDLY_WITH_DESTROY_TAG',
    'ONE_DESTINATION_ENEMY': 'ONE_ENEMY_AT_DESTINATION',
    'MOVED_CARD': 'MOVED_CARD', // Keep as special marker - the moved card becomes the buff target
    // Empty slot counting for Dionysus
    'EMPTY_SLOTS_HERE': 'LOCATION',
  };
  
  return mapping[target] ?? 'SELF';
}

/**
 * Map legacy condition to new Condition.
 */
function mapCondition(condition: string | undefined): import('../ability/types').Condition {
  if (!condition) return 'NONE';
  
  const mapping: Record<string, import('../ability/types').Condition> = {
    'location_full': 'CONDITIONAL_LOCATION_FULL',
    'only_card_here': 'CONDITIONAL_ONLY_CARD_HERE',
    'destroyed_this_game': 'CONDITIONAL_DESTROYED_THIS_GAME',
    'moved_this_game': 'CONDITIONAL_MOVED_THIS_GAME',
    'moved_this_turn': 'CONDITIONAL_MOVED_BY_YOU_THIS_TURN',
    'has_empty_slot': 'CONDITIONAL_EMPTY_SLOT_HERE',
    'empty_slot_here': 'CONDITIONAL_EMPTY_SLOT_HERE',
    'exactly_one_other_ally_here': 'CONDITIONAL_EXACTLY_ONE_OTHER_ALLY_HERE',
    'exactly_two_allies_here': 'CONDITIONAL_EXACTLY_TWO_ALLIES_HERE',
    'enemy_more_cards_here': 'CONDITIONAL_ENEMY_MORE_CARDS_HERE',
    'enemy_highest_power_here': 'CONDITIONAL_ENEMY_HIGHEST_POWER_HERE',
    'enemy_3plus_here': 'CONDITIONAL_ENEMY_3PLUS_HERE',
    'losing_location': 'CONDITIONAL_LOSING_LOCATION',
  };
  
  return mapping[condition] ?? 'NONE';
}

/**
 * Check if an effect type requires targets.
 */
function requiresTargets(effect: EffectType): boolean {
  const noTargetEffects: EffectType[] = [
    'ADD_ENERGY_NEXT_TURN',
    'SUMMON_SPIRIT',
  ];
  
  return !noTargetEffects.includes(effect);
}

// =============================================================================
// Timeline Verification
// =============================================================================

/**
 * Verify that two timelines are identical (for determinism testing).
 */
export function compareTimelines(
  timeline1: ResolutionTimeline,
  timeline2: ResolutionTimeline
): { identical: boolean; differences: string[] } {
  const differences: string[] = [];
  
  if (timeline1.length !== timeline2.length) {
    differences.push(`Length mismatch: ${timeline1.length} vs ${timeline2.length}`);
    return { identical: false, differences };
  }
  
  for (let i = 0; i < timeline1.length; i++) {
    const step1 = timeline1[i]!;
    const step2 = timeline2[i]!;
    
    if (step1.phase !== step2.phase) {
      differences.push(`Step ${i}: phase mismatch (${step1.phase} vs ${step2.phase})`);
    }
    if (step1.effect !== step2.effect) {
      differences.push(`Step ${i}: effect mismatch (${step1.effect} vs ${step2.effect})`);
    }
    if (step1.value !== step2.value) {
      differences.push(`Step ${i}: value mismatch (${step1.value} vs ${step2.value})`);
    }
    if (JSON.stringify(step1.targets) !== JSON.stringify(step2.targets)) {
      differences.push(`Step ${i}: targets mismatch`);
    }
  }
  
  return {
    identical: differences.length === 0,
    differences,
  };
}
