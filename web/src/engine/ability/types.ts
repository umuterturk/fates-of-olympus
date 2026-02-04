/**
 * Type definitions for the deterministic ability system.
 * 
 * All enums are defined as string literal unions for type safety
 * and JSON serialization compatibility.
 */

// Note: Types are imported for JSDoc documentation but not directly used in type definitions
// import type { InstanceId, LocationIndex, PlayerId } from '../types';

// =============================================================================
// Triggers - When abilities activate
// =============================================================================

/**
 * Triggers define WHEN an ability activates.
 */
export type Trigger =
  | 'ON_PLAY'        // When card is played (face-down)
  | 'ON_REVEAL'      // When card is revealed
  | 'ONGOING'        // Continuously while in play (derived, not timed)
  | 'START_OF_TURN'  // At the start of each turn
  | 'END_OF_TURN'    // At the end of each turn
  | 'ON_DESTROYED'   // When this card is destroyed
  | 'ON_MOVED';      // When this card is moved

export const ALL_TRIGGERS: readonly Trigger[] = [
  'ON_PLAY',
  'ON_REVEAL',
  'ONGOING',
  'START_OF_TURN',
  'END_OF_TURN',
  'ON_DESTROYED',
  'ON_MOVED',
] as const;

// =============================================================================
// Conditions - Boolean checks for ability activation
// =============================================================================

/**
 * Conditions are boolean checks evaluated against a state snapshot.
 * They determine IF an ability's effect should apply.
 */
export type Condition =
  | 'NONE'                                    // Always true
  | 'CONDITIONAL_EXACTLY_ONE_OTHER_ALLY_HERE' // Exactly 1 other allied card at this location
  | 'CONDITIONAL_EXACTLY_TWO_ALLIES_HERE'     // Exactly 2 allied cards here (including self)
  | 'CONDITIONAL_ONLY_CARD_HERE'              // This is the only card here for this player
  | 'CONDITIONAL_LOCATION_FULL'               // Player has 4 cards at this location
  | 'CONDITIONAL_EMPTY_SLOT_HERE'             // Player has < 4 cards at this location
  | 'CONDITIONAL_ENEMY_MORE_CARDS_HERE'       // Enemy has more cards here than player
  | 'CONDITIONAL_ENEMY_3PLUS_HERE'            // Enemy has 3+ cards here
  | 'CONDITIONAL_ENEMY_HIGHEST_POWER_HERE'    // Target is the highest power enemy here
  | 'CONDITIONAL_LOSING_LOCATION'             // Player is currently losing this location
  | 'CONDITIONAL_MOVED_BY_YOU_THIS_TURN'      // Card was moved by player this turn
  | 'CONDITIONAL_DESTROYED_THIS_GAME'         // Player has destroyed a card this game
  | 'CONDITIONAL_MOVED_THIS_GAME'             // Player has moved a card this game
  | 'CONDITIONAL_CARD_HAS_BUFF_TAG'           // Target card has the 'Buff' tag
  | 'CONDITIONAL_CARD_HAS_ONGOING';           // Target card has ONGOING ability type

export const ALL_CONDITIONS: readonly Condition[] = [
  'NONE',
  'CONDITIONAL_EXACTLY_ONE_OTHER_ALLY_HERE',
  'CONDITIONAL_EXACTLY_TWO_ALLIES_HERE',
  'CONDITIONAL_ONLY_CARD_HERE',
  'CONDITIONAL_LOCATION_FULL',
  'CONDITIONAL_EMPTY_SLOT_HERE',
  'CONDITIONAL_ENEMY_MORE_CARDS_HERE',
  'CONDITIONAL_ENEMY_3PLUS_HERE',
  'CONDITIONAL_ENEMY_HIGHEST_POWER_HERE',
  'CONDITIONAL_LOSING_LOCATION',
  'CONDITIONAL_MOVED_BY_YOU_THIS_TURN',
  'CONDITIONAL_DESTROYED_THIS_GAME',
  'CONDITIONAL_MOVED_THIS_GAME',
  'CONDITIONAL_CARD_HAS_BUFF_TAG',
  'CONDITIONAL_CARD_HAS_ONGOING',
] as const;

// =============================================================================
// Target Selectors - Who/what the effect applies to
// =============================================================================

/**
 * Target selectors determine WHAT entities an effect applies to.
 * Singular selectors (ONE_*) use deterministic tie-breaking.
 */
export type TargetSelector =
  // Self
  | 'SELF'                          // The card that owns this ability
  
  // Allies at same location
  | 'ONE_OTHER_ALLY_HERE'           // One other allied card at this location
  | 'ALL_ALLIES_HERE'               // All allied cards at this location (including self)
  | 'ALL_ALLIES_HERE_EXCEPT_SELF'   // All allied cards here except self
  
  // Enemies at same location
  | 'ONE_ENEMY_HERE'                // One enemy card at this location
  | 'ALL_ENEMIES_HERE'              // All enemy cards at this location
  | 'HIGHEST_POWER_ENEMY_HERE'      // The highest power enemy card here
  | 'LOWEST_POWER_ENEMY_HERE'       // The lowest power enemy card here
  
  // Other locations
  | 'ONE_ALLY_OTHER_LOCATION'       // One allied card at a different location
  | 'ALL_ALLIES_OTHER_LOCATIONS'    // All allied cards at other locations
  | 'ONE_ENEMY_AT_DESTINATION'      // One enemy at the move destination
  
  // Location itself
  | 'LOCATION'                      // The location itself (for location effects)
  
  // Random (uses seeded RNG)
  | 'RANDOM_VALID_TARGET'           // Random valid target from available options
  
  // Special filters
  | 'FRIENDLY_WITH_DESTROY_TAG'     // Allied cards with 'Destroy' tag
  | 'ENEMY_WITH_BUFF_TAG_HERE'      // Enemy cards with 'Buff' tag at this location
  | 'ENEMY_WITH_ONGOING_HERE'       // Enemy cards with ONGOING ability here
  
  // Special markers for compound effects
  | 'MOVED_CARD';                   // The card that was just moved (used in MoveAndBuffEffect)

export const ALL_TARGET_SELECTORS: readonly TargetSelector[] = [
  'SELF',
  'ONE_OTHER_ALLY_HERE',
  'ALL_ALLIES_HERE',
  'ALL_ALLIES_HERE_EXCEPT_SELF',
  'ONE_ENEMY_HERE',
  'ALL_ENEMIES_HERE',
  'HIGHEST_POWER_ENEMY_HERE',
  'LOWEST_POWER_ENEMY_HERE',
  'ONE_ALLY_OTHER_LOCATION',
  'ALL_ALLIES_OTHER_LOCATIONS',
  'ONE_ENEMY_AT_DESTINATION',
  'LOCATION',
  'RANDOM_VALID_TARGET',
  'FRIENDLY_WITH_DESTROY_TAG',
  'ENEMY_WITH_BUFF_TAG_HERE',
  'ENEMY_WITH_ONGOING_HERE',
  'MOVED_CARD',
] as const;

// =============================================================================
// Effect Types - What the ability does
// =============================================================================

/**
 * Effect types define WHAT happens when an ability activates.
 * Effects NEVER mutate state directly - they emit events.
 */
export type EffectType =
  // Power effects
  | 'POWER'                                  // Generic power modification
  | 'SELF_BUFF'                              // Buff self
  | 'BUFF_OTHER_ALLY_HERE'                   // Buff one other ally here
  | 'BUFF_ALLIES_HERE'                       // Buff all allies here
  | 'BUFF_ALLIES_HERE_EXCEPT_SELF'           // Buff allies here except self
  | 'BUFF_ALLIES_OTHER_LOCATIONS'            // Buff allies at other locations
  | 'BUFF_ONE_ALLY_OTHER_LOCATION'           // Buff one ally at another location
  | 'BUFF_ALLIES_HERE_PER_EMPTY_SLOT'        // Buff based on empty slots
  
  // Debuff effects
  | 'DEBUFF_ONE_ENEMY_HERE'                  // Debuff one enemy here
  | 'DEBUFF_ENEMIES_HERE'                    // Debuff all enemies here
  | 'DEBUFF_ENEMY_BUFF_TAGGED_HERE'          // Debuff enemies with Buff tag here
  | 'DEBUFF_ENEMY_ONGOING_HERE'              // Debuff enemies with ongoing abilities
  
  // Movement effects
  | 'MOVE_SELF_TO_OTHER_LOCATION'            // Move self to another location
  | 'MOVE_ONE_OTHER_ALLY_TO_HERE'            // Move an ally to this location
  | 'MOVE_ONE_OTHER_ALLY_FROM_HERE_TO_OTHER_LOCATION' // Move ally from here to elsewhere
  | 'MOVE_ONE_ENEMY_TO_OTHER_LOCATION'       // Move an enemy to another location
  
  // Destruction effects
  | 'DESTROY_SELF'                           // Destroy this card
  | 'DESTROY_ONE_OTHER_ALLY_HERE'            // Destroy one other ally here
  | 'DESTROY_ONE_ENEMY_HERE'                 // Destroy one enemy here
  
  // Power transfer
  | 'GAIN_DESTROYED_CARD_POWER'              // Gain power from destroyed cards
  | 'STEAL_POWER'                            // Steal power from enemy
  
  // Ability control
  | 'SILENCE_ENEMY_ONGOING_HERE'             // Silence enemy ongoing abilities
  
  // Global/tag-based
  | 'BUFF_DESTROY_CARDS_GLOBAL'              // Buff all Destroy-tagged cards
  
  // Compound effects
  | 'DESTROY_AND_BUFF'                       // Destroy ally, then buff target
  | 'DESTROY_AND_SELF_BUFF'                  // Destroy ally, then buff self
  | 'MOVE_AND_BUFF'                          // Move card, then buff
  | 'MOVE_SELF_AND_DEBUFF_DESTINATION'       // Move self, then debuff enemy at destination
  
  // Energy effects
  | 'ADD_ENERGY_NEXT_TURN'                   // Grant bonus energy next turn
  
  // Summon effects
  | 'SUMMON_SPIRIT';                         // Summon a spirit based on destroyed cards

export const ALL_EFFECT_TYPES: readonly EffectType[] = [
  'POWER',
  'SELF_BUFF',
  'BUFF_OTHER_ALLY_HERE',
  'BUFF_ALLIES_HERE',
  'BUFF_ALLIES_HERE_EXCEPT_SELF',
  'BUFF_ALLIES_OTHER_LOCATIONS',
  'BUFF_ONE_ALLY_OTHER_LOCATION',
  'BUFF_ALLIES_HERE_PER_EMPTY_SLOT',
  'DEBUFF_ONE_ENEMY_HERE',
  'DEBUFF_ENEMIES_HERE',
  'DEBUFF_ENEMY_BUFF_TAGGED_HERE',
  'DEBUFF_ENEMY_ONGOING_HERE',
  'MOVE_SELF_TO_OTHER_LOCATION',
  'MOVE_ONE_OTHER_ALLY_TO_HERE',
  'MOVE_ONE_OTHER_ALLY_FROM_HERE_TO_OTHER_LOCATION',
  'MOVE_ONE_ENEMY_TO_OTHER_LOCATION',
  'DESTROY_SELF',
  'DESTROY_ONE_OTHER_ALLY_HERE',
  'DESTROY_ONE_ENEMY_HERE',
  'GAIN_DESTROYED_CARD_POWER',
  'STEAL_POWER',
  'SILENCE_ENEMY_ONGOING_HERE',
  'BUFF_DESTROY_CARDS_GLOBAL',
  'DESTROY_AND_BUFF',
  'DESTROY_AND_SELF_BUFF',
  'MOVE_AND_BUFF',
  'MOVE_SELF_AND_DEBUFF_DESTINATION',
  'ADD_ENERGY_NEXT_TURN',
  'SUMMON_SPIRIT',
] as const;

// =============================================================================
// Duration Scopes - How long effects last
// =============================================================================

/**
 * Duration scopes define HOW LONG an effect persists.
 * No effect may exist without a declared scope.
 */
export type DurationScope =
  | 'INSTANT'                    // Permanent, one-time application (e.g., permanent buff)
  | 'UNTIL_END_OF_TURN'          // Expires at end of current turn
  | 'UNTIL_START_OF_NEXT_TURN'   // Expires at start of next turn
  | 'WHILE_IN_PLAY'              // Lasts while source card is in play (ongoing)
  | 'UNTIL_DESTROYED';           // Lasts until target is destroyed

export const ALL_DURATION_SCOPES: readonly DurationScope[] = [
  'INSTANT',
  'UNTIL_END_OF_TURN',
  'UNTIL_START_OF_NEXT_TURN',
  'WHILE_IN_PLAY',
  'UNTIL_DESTROYED',
] as const;

// =============================================================================
// Visual Effect Types - Animation hints for UI
// =============================================================================

/**
 * Visual effect types hint to the UI how to animate the effect.
 * The engine NEVER animates - it only provides metadata.
 */
export type VisualEffectType =
  | 'GLOW'     // Glowing highlight (buffs)
  | 'PULSE'    // Pulsing effect (ongoing)
  | 'SHATTER'  // Breaking/shattering (destruction)
  | 'RIPPLE'   // Rippling wave (movement)
  | 'FADE'     // Fading in/out (silence)
  | 'LOCK'     // Lock/chain visual (silence)
  | 'DRAIN';   // Energy drain visual (power steal)

export type VisualIntensity = 'LOW' | 'MEDIUM' | 'HIGH';

// =============================================================================
// Ideology - Card thematic alignment
// =============================================================================

/**
 * Card ideologies for thematic consistency validation.
 * No ability may violate its card's ideology.
 */
export type Ideology =
  | 'LAW_OF_ORDER'    // Exact counts, symmetry, restriction, silence
  | 'PATH_OF_DESCENT' // Destruction as cost, sacrifice, inevitability
  | 'WAY_OF_MOTION'   // Movement, relocation, momentum, instability
  | 'TRANSITIONAL'    // Cards bridging themes
  | 'FRACTURED'       // Chaotic/conflicting themes
  | 'NEUTRAL';        // Vanilla cards with no strong theme

export const ALL_IDEOLOGIES: readonly Ideology[] = [
  'LAW_OF_ORDER',
  'PATH_OF_DESCENT',
  'WAY_OF_MOTION',
  'TRANSITIONAL',
  'FRACTURED',
  'NEUTRAL',
] as const;

// =============================================================================
// Resolution Phase - Timeline step phases
// =============================================================================

/**
 * Phases within the resolution timeline.
 */
export type ResolutionPhase =
  | 'REVEAL'         // Card reveal step
  | 'EVENT'          // Triggered effect step
  | 'ONGOING_RECALC' // Ongoing ability recalculation
  | 'CLEANUP';       // Effect expiration and cleanup

export const ALL_RESOLUTION_PHASES: readonly ResolutionPhase[] = [
  'REVEAL',
  'EVENT',
  'ONGOING_RECALC',
  'CLEANUP',
] as const;

// =============================================================================
// Step Source Types - What triggered a timeline step
// =============================================================================

/**
 * Source types for timeline steps.
 */
export type StepSourceType = 'CARD' | 'LOCATION' | 'SYSTEM';

// =============================================================================
// Helper Type Guards
// =============================================================================

export function isTrigger(value: string): value is Trigger {
  return ALL_TRIGGERS.includes(value as Trigger);
}

export function isCondition(value: string): value is Condition {
  return ALL_CONDITIONS.includes(value as Condition);
}

export function isTargetSelector(value: string): value is TargetSelector {
  return ALL_TARGET_SELECTORS.includes(value as TargetSelector);
}

export function isEffectType(value: string): value is EffectType {
  return ALL_EFFECT_TYPES.includes(value as EffectType);
}

export function isDurationScope(value: string): value is DurationScope {
  return ALL_DURATION_SCOPES.includes(value as DurationScope);
}

export function isIdeology(value: string): value is Ideology {
  return ALL_IDEOLOGIES.includes(value as Ideology);
}

// =============================================================================
// Effect Category Helpers
// =============================================================================

const POWER_EFFECTS: readonly EffectType[] = [
  'POWER',
  'SELF_BUFF',
  'BUFF_OTHER_ALLY_HERE',
  'BUFF_ALLIES_HERE',
  'BUFF_ALLIES_HERE_EXCEPT_SELF',
  'BUFF_ALLIES_OTHER_LOCATIONS',
  'BUFF_ONE_ALLY_OTHER_LOCATION',
  'BUFF_ALLIES_HERE_PER_EMPTY_SLOT',
  'DEBUFF_ONE_ENEMY_HERE',
  'DEBUFF_ENEMIES_HERE',
  'DEBUFF_ENEMY_BUFF_TAGGED_HERE',
  'DEBUFF_ENEMY_ONGOING_HERE',
  'GAIN_DESTROYED_CARD_POWER',
  'STEAL_POWER',
  'BUFF_DESTROY_CARDS_GLOBAL',
];

const MOVEMENT_EFFECTS: readonly EffectType[] = [
  'MOVE_SELF_TO_OTHER_LOCATION',
  'MOVE_ONE_OTHER_ALLY_TO_HERE',
  'MOVE_ONE_OTHER_ALLY_FROM_HERE_TO_OTHER_LOCATION',
  'MOVE_ONE_ENEMY_TO_OTHER_LOCATION',
];

const DESTRUCTION_EFFECTS: readonly EffectType[] = [
  'DESTROY_SELF',
  'DESTROY_ONE_OTHER_ALLY_HERE',
  'DESTROY_ONE_ENEMY_HERE',
];

const COMPOUND_EFFECTS: readonly EffectType[] = [
  'DESTROY_AND_BUFF',
  'DESTROY_AND_SELF_BUFF',
  'MOVE_AND_BUFF',
  'MOVE_SELF_AND_DEBUFF_DESTINATION',
];

export function isPowerEffect(effect: EffectType): boolean {
  return POWER_EFFECTS.includes(effect);
}

export function isMovementEffect(effect: EffectType): boolean {
  return MOVEMENT_EFFECTS.includes(effect);
}

export function isDestructionEffect(effect: EffectType): boolean {
  return DESTRUCTION_EFFECTS.includes(effect);
}

export function isCompoundEffect(effect: EffectType): boolean {
  return COMPOUND_EFFECTS.includes(effect);
}

// =============================================================================
// Ideology Validation Helpers
// =============================================================================

/**
 * Effects allowed for Law of Order ideology.
 * Focus: exact counts, symmetry, restriction, silence.
 */
const LAW_OF_ORDER_EFFECTS: readonly EffectType[] = [
  'POWER',
  'SELF_BUFF',
  'BUFF_OTHER_ALLY_HERE',
  'BUFF_ALLIES_HERE',
  'BUFF_ALLIES_HERE_EXCEPT_SELF',
  'DEBUFF_ONE_ENEMY_HERE',
  'DEBUFF_ENEMIES_HERE',
  'SILENCE_ENEMY_ONGOING_HERE',
];

/**
 * Effects allowed for Path of Descent ideology.
 * Focus: destruction as cost, sacrifice, inevitability.
 */
const PATH_OF_DESCENT_EFFECTS: readonly EffectType[] = [
  'POWER',
  'SELF_BUFF',
  'DESTROY_SELF',
  'DESTROY_ONE_OTHER_ALLY_HERE',
  'DESTROY_ONE_ENEMY_HERE',
  'GAIN_DESTROYED_CARD_POWER',
  'STEAL_POWER',
  'DESTROY_AND_BUFF',
  'DESTROY_AND_SELF_BUFF',
  'SUMMON_SPIRIT',
  'DEBUFF_ONE_ENEMY_HERE',
  'DEBUFF_ENEMIES_HERE',
];

/**
 * Effects allowed for Way of Motion ideology.
 * Focus: movement, relocation, momentum, instability.
 */
const WAY_OF_MOTION_EFFECTS: readonly EffectType[] = [
  'POWER',
  'SELF_BUFF',
  'MOVE_SELF_TO_OTHER_LOCATION',
  'MOVE_ONE_OTHER_ALLY_TO_HERE',
  'MOVE_ONE_OTHER_ALLY_FROM_HERE_TO_OTHER_LOCATION',
  'MOVE_ONE_ENEMY_TO_OTHER_LOCATION',
  'MOVE_AND_BUFF',
  'BUFF_ALLIES_HERE',
  'BUFF_ALLIES_OTHER_LOCATIONS',
];

export function isEffectValidForIdeology(effect: EffectType, ideology: Ideology): boolean {
  switch (ideology) {
    case 'LAW_OF_ORDER':
      return LAW_OF_ORDER_EFFECTS.includes(effect);
    case 'PATH_OF_DESCENT':
      return PATH_OF_DESCENT_EFFECTS.includes(effect);
    case 'WAY_OF_MOTION':
      return WAY_OF_MOTION_EFFECTS.includes(effect);
    case 'TRANSITIONAL':
    case 'FRACTURED':
    case 'NEUTRAL':
      // These ideologies allow all effects
      return true;
  }
}
