/**
 * Ability system exports.
 * 
 * This module provides the deterministic ability system for the game.
 */

// Types
export * from './types';

// Ability model
export * from './ability';

// Conditions
export * from './conditions';

// Target selectors
export * from './selectors';

// Effects (selective exports to avoid conflicts)
export {
  applyEffect,
  applyOngoingPowerModification,
  describeEffectType,
  type EffectResult,
} from './effects';
