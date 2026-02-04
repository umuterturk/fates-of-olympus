/**
 * Ability model - pure data representation of card abilities.
 * 
 * Abilities are immutable data structures that describe:
 * - WHEN they trigger
 * - IF they should apply (condition)
 * - WHAT they target
 * - WHAT effect they produce
 * - HOW LONG the effect lasts
 * - HOW to visualize the effect
 * 
 * Abilities NEVER mutate state directly - they emit events.
 */

import type { InstanceId, LocationIndex } from '../types';
import type {
  Trigger,
  Condition,
  TargetSelector,
  EffectType,
  DurationScope,
  VisualEffectType,
  VisualIntensity,
  Ideology,
} from './types';
import { isEffectValidForIdeology } from './types';

// =============================================================================
// Visual Metadata
// =============================================================================

/**
 * Metadata for UI animation.
 * The engine provides this data; the UI decides how to animate.
 */
export interface VisualMetadata {
  /** Type of visual effect to display */
  readonly visualEffectType: VisualEffectType;
  
  /** Intensity of the effect */
  readonly intensity: VisualIntensity;
  
  /**
   * Entities affected by the visual (filled during timeline generation).
   * Can be card instance IDs or location indices.
   */
  readonly affectedEntities: readonly (InstanceId | LocationIndex)[];
}

/**
 * Create visual metadata with default values.
 */
export function createVisualMetadata(
  visualEffectType: VisualEffectType = 'GLOW',
  intensity: VisualIntensity = 'MEDIUM',
  affectedEntities: readonly (InstanceId | LocationIndex)[] = []
): VisualMetadata {
  return {
    visualEffectType,
    intensity,
    affectedEntities,
  };
}

/**
 * Update visual metadata with new affected entities.
 */
export function withAffectedEntities(
  metadata: VisualMetadata,
  entities: readonly (InstanceId | LocationIndex)[]
): VisualMetadata {
  return {
    ...metadata,
    affectedEntities: entities,
  };
}

// =============================================================================
// Ability Definition
// =============================================================================

/**
 * Core ability interface - immutable data describing a card ability.
 * 
 * This is the primary data structure for the ability system.
 * All fields are required to ensure complete, unambiguous ability definitions.
 */
export interface Ability {
  /** When this ability triggers */
  readonly trigger: Trigger;
  
  /** Condition that must be true for the ability to apply */
  readonly condition: Condition;
  
  /** What entities the effect targets */
  readonly targetSelector: TargetSelector;
  
  /** What effect to apply */
  readonly effect: EffectType;
  
  /** Numeric value for the effect (e.g., power amount) */
  readonly value: number;
  
  /** Additional parameters for complex effects */
  readonly parameters?: AbilityParameters;
  
  /** How long the effect lasts */
  readonly durationScope: DurationScope;
  
  /** Visual hints for UI animation */
  readonly visualMetadata: VisualMetadata;
}

/**
 * Additional parameters for complex effects.
 */
export interface AbilityParameters {
  /** For scaling effects: amount per unit */
  readonly perUnitAmount?: number;
  
  /** For scaling effects: what to count */
  readonly countFilter?: TargetSelector;
  
  /** For compound effects: secondary target */
  readonly secondaryTarget?: TargetSelector;
  
  /** For compound effects: secondary effect value */
  readonly secondaryValue?: number;
  
  /** For move effects: specific destination (if not random) */
  readonly destinationStrategy?: 'FIRST_AVAILABLE' | 'RANDOM' | 'LEFTMOST' | 'RIGHTMOST';
  
  /** For summon effects: base power of summoned entity */
  readonly baseSummonPower?: number;
  
  /** For summon effects: card ID to summon */
  readonly summonCardId?: string;
}

// =============================================================================
// Ability Factory Functions
// =============================================================================

/**
 * Create a simple buff ability.
 */
export function createBuffAbility(
  trigger: Trigger,
  target: TargetSelector,
  amount: number,
  condition: Condition = 'NONE',
  durationScope: DurationScope = 'INSTANT'
): Ability {
  return {
    trigger,
    condition,
    targetSelector: target,
    effect: target === 'SELF' ? 'SELF_BUFF' : 'BUFF_ALLIES_HERE',
    value: amount,
    durationScope,
    visualMetadata: createVisualMetadata('GLOW', amount >= 3 ? 'HIGH' : 'MEDIUM'),
  };
}

/**
 * Create a simple debuff ability.
 */
export function createDebuffAbility(
  trigger: Trigger,
  target: TargetSelector,
  amount: number,
  condition: Condition = 'NONE',
  durationScope: DurationScope = 'INSTANT'
): Ability {
  return {
    trigger,
    condition,
    targetSelector: target,
    effect: target === 'ALL_ENEMIES_HERE' ? 'DEBUFF_ENEMIES_HERE' : 'DEBUFF_ONE_ENEMY_HERE',
    value: amount,
    durationScope,
    visualMetadata: createVisualMetadata('DRAIN', Math.abs(amount) >= 3 ? 'HIGH' : 'MEDIUM'),
  };
}

/**
 * Create a movement ability.
 */
export function createMoveAbility(
  trigger: Trigger,
  target: TargetSelector,
  condition: Condition = 'NONE',
  destinationStrategy: 'FIRST_AVAILABLE' | 'RANDOM' = 'FIRST_AVAILABLE'
): Ability {
  let effect: EffectType;
  if (target === 'SELF') {
    effect = 'MOVE_SELF_TO_OTHER_LOCATION';
  } else if (target === 'ONE_OTHER_ALLY_HERE') {
    effect = 'MOVE_ONE_OTHER_ALLY_FROM_HERE_TO_OTHER_LOCATION';
  } else {
    effect = 'MOVE_ONE_ENEMY_TO_OTHER_LOCATION';
  }
  
  return {
    trigger,
    condition,
    targetSelector: target,
    effect,
    value: 0,
    parameters: { destinationStrategy },
    durationScope: 'INSTANT',
    visualMetadata: createVisualMetadata('RIPPLE', 'MEDIUM'),
  };
}

/**
 * Create a destruction ability.
 */
export function createDestroyAbility(
  trigger: Trigger,
  target: TargetSelector,
  condition: Condition = 'NONE'
): Ability {
  let effect: EffectType;
  if (target === 'SELF') {
    effect = 'DESTROY_SELF';
  } else if (target === 'ONE_OTHER_ALLY_HERE') {
    effect = 'DESTROY_ONE_OTHER_ALLY_HERE';
  } else {
    effect = 'DESTROY_ONE_ENEMY_HERE';
  }
  
  return {
    trigger,
    condition,
    targetSelector: target,
    effect,
    value: 0,
    durationScope: 'INSTANT',
    visualMetadata: createVisualMetadata('SHATTER', 'HIGH'),
  };
}

/**
 * Create a silence ability.
 */
export function createSilenceAbility(
  trigger: Trigger,
  target: TargetSelector = 'ALL_ENEMIES_HERE',
  condition: Condition = 'NONE'
): Ability {
  return {
    trigger,
    condition,
    targetSelector: target,
    effect: 'SILENCE_ENEMY_ONGOING_HERE',
    value: 0,
    durationScope: 'WHILE_IN_PLAY',
    visualMetadata: createVisualMetadata('LOCK', 'MEDIUM'),
  };
}

/**
 * Create a compound destroy-and-buff ability.
 */
export function createDestroyAndBuffAbility(
  trigger: Trigger,
  destroyTarget: TargetSelector,
  buffTarget: TargetSelector,
  buffAmount: number,
  condition: Condition = 'NONE'
): Ability {
  return {
    trigger,
    condition,
    targetSelector: destroyTarget,
    effect: buffTarget === 'SELF' ? 'DESTROY_AND_SELF_BUFF' : 'DESTROY_AND_BUFF',
    value: buffAmount,
    parameters: {
      secondaryTarget: buffTarget,
      secondaryValue: buffAmount,
    },
    durationScope: 'INSTANT',
    visualMetadata: createVisualMetadata('SHATTER', 'HIGH'),
  };
}

/**
 * Create a scaling ongoing power ability.
 */
export function createScalingOngoingAbility(
  target: TargetSelector,
  perUnitAmount: number,
  countFilter: TargetSelector
): Ability {
  return {
    trigger: 'ONGOING',
    condition: 'NONE',
    targetSelector: target,
    effect: 'BUFF_ALLIES_HERE',
    value: 0,
    parameters: {
      perUnitAmount,
      countFilter,
    },
    durationScope: 'WHILE_IN_PLAY',
    visualMetadata: createVisualMetadata('PULSE', 'LOW'),
  };
}

/**
 * Create a steal power ability.
 */
export function createStealPowerAbility(
  trigger: Trigger,
  target: TargetSelector,
  amount: number,
  condition: Condition = 'NONE'
): Ability {
  return {
    trigger,
    condition,
    targetSelector: target,
    effect: 'STEAL_POWER',
    value: amount,
    durationScope: 'INSTANT',
    visualMetadata: createVisualMetadata('DRAIN', 'HIGH'),
  };
}

/**
 * Create a summon spirit ability.
 */
export function createSummonAbility(
  trigger: Trigger,
  basePower: number,
  condition: Condition = 'CONDITIONAL_DESTROYED_THIS_GAME'
): Ability {
  return {
    trigger,
    condition,
    targetSelector: 'LOCATION',
    effect: 'SUMMON_SPIRIT',
    value: basePower,
    parameters: {
      baseSummonPower: basePower,
      summonCardId: 'shade',
    },
    durationScope: 'INSTANT',
    visualMetadata: createVisualMetadata('GLOW', 'HIGH'),
  };
}

/**
 * Create an energy bonus ability.
 */
export function createEnergyBonusAbility(
  trigger: Trigger,
  amount: number
): Ability {
  return {
    trigger,
    condition: 'NONE',
    targetSelector: 'SELF',
    effect: 'ADD_ENERGY_NEXT_TURN',
    value: amount,
    durationScope: 'UNTIL_START_OF_NEXT_TURN',
    visualMetadata: createVisualMetadata('GLOW', 'LOW'),
  };
}

// =============================================================================
// Ability Validation
// =============================================================================

/**
 * Validate that an ability is well-formed.
 */
export function validateAbility(ability: Ability): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check for required fields
  if (!ability.trigger) errors.push('Missing trigger');
  if (!ability.condition) errors.push('Missing condition');
  if (!ability.targetSelector) errors.push('Missing targetSelector');
  if (!ability.effect) errors.push('Missing effect');
  if (ability.value === undefined) errors.push('Missing value');
  if (!ability.durationScope) errors.push('Missing durationScope');
  if (!ability.visualMetadata) errors.push('Missing visualMetadata');
  
  // Validate ONGOING abilities must have WHILE_IN_PLAY duration
  if (ability.trigger === 'ONGOING' && ability.durationScope !== 'WHILE_IN_PLAY') {
    errors.push('ONGOING abilities must have WHILE_IN_PLAY duration scope');
  }
  
  // Validate compound effects have required parameters
  if (ability.effect === 'DESTROY_AND_BUFF' || ability.effect === 'DESTROY_AND_SELF_BUFF') {
    if (!ability.parameters?.secondaryTarget) {
      errors.push('Compound destroy-and-buff effects require secondaryTarget parameter');
    }
  }
  
  // Validate scaling effects have required parameters
  if (ability.parameters?.perUnitAmount !== undefined && !ability.parameters?.countFilter) {
    errors.push('Scaling effects require countFilter parameter');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if an ability is valid for a given ideology.
 */
export function isAbilityValidForIdeology(ability: Ability, ideology: Ideology): boolean {
  return isEffectValidForIdeology(ability.effect, ideology);
}

// =============================================================================
// Ability Serialization
// =============================================================================

/**
 * Convert an ability to a JSON-serializable object.
 */
export function serializeAbility(ability: Ability): object {
  return {
    trigger: ability.trigger,
    condition: ability.condition,
    targetSelector: ability.targetSelector,
    effect: ability.effect,
    value: ability.value,
    parameters: ability.parameters,
    durationScope: ability.durationScope,
    visualMetadata: {
      visualEffectType: ability.visualMetadata.visualEffectType,
      intensity: ability.visualMetadata.intensity,
      // Don't serialize affectedEntities - it's computed at runtime
    },
  };
}

/**
 * Parse an ability from a JSON object.
 */
export function parseAbility(obj: unknown): Ability | null {
  if (typeof obj !== 'object' || obj === null) return null;
  
  const data = obj as Record<string, unknown>;
  
  // Extract required fields with type checking
  const trigger = data.trigger as Trigger;
  const condition = (data.condition as Condition) ?? 'NONE';
  const targetSelector = data.targetSelector as TargetSelector;
  const effect = data.effect as EffectType;
  const value = typeof data.value === 'number' ? data.value : 0;
  const durationScope = (data.durationScope as DurationScope) ?? 'INSTANT';
  
  // Parse visual metadata
  const visualData = data.visualMetadata as Record<string, unknown> | undefined;
  const visualMetadata: VisualMetadata = {
    visualEffectType: (visualData?.visualEffectType as VisualEffectType) ?? 'GLOW',
    intensity: (visualData?.intensity as VisualIntensity) ?? 'MEDIUM',
    affectedEntities: [],
  };
  
  // Parse parameters
  const paramsData = data.parameters as Record<string, unknown> | undefined;
  const parameters: AbilityParameters | undefined = paramsData ? {
    perUnitAmount: paramsData.perUnitAmount as number | undefined,
    countFilter: paramsData.countFilter as TargetSelector | undefined,
    secondaryTarget: paramsData.secondaryTarget as TargetSelector | undefined,
    secondaryValue: paramsData.secondaryValue as number | undefined,
    destinationStrategy: paramsData.destinationStrategy as 'FIRST_AVAILABLE' | 'RANDOM' | 'LEFTMOST' | 'RIGHTMOST' | undefined,
    baseSummonPower: paramsData.baseSummonPower as number | undefined,
    summonCardId: paramsData.summonCardId as string | undefined,
  } : undefined;
  
  const ability: Ability = {
    trigger,
    condition,
    targetSelector,
    effect,
    value,
    parameters,
    durationScope,
    visualMetadata,
  };
  
  const validation = validateAbility(ability);
  if (!validation.valid) {
    console.warn('Invalid ability:', validation.errors);
    return null;
  }
  
  return ability;
}
