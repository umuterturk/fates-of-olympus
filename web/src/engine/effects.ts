/**
 * Effect primitives for card abilities.
 * 
 * Ported from Python engine/effects.py
 * Uses discriminated unions for type-safe effect handling.
 */

import type { Power, TargetFilter } from './types';

// =============================================================================
// Effect Types (Discriminated Union)
// =============================================================================

export interface AddPowerEffect {
  readonly type: 'AddPowerEffect';
  readonly target: TargetFilter;
  readonly amount: Power;
}

export interface AddOngoingPowerEffect {
  readonly type: 'AddOngoingPowerEffect';
  readonly target: TargetFilter;
  readonly amount: Power;
}

export interface ConditionalOngoingPowerEffect {
  readonly type: 'ConditionalOngoingPowerEffect';
  readonly target: TargetFilter;
  readonly amount: Power;
  readonly condition: 'location_full';
}

export interface MoveCardEffect {
  readonly type: 'MoveCardEffect';
  readonly target: TargetFilter;
  readonly toOtherLocation: boolean;
  readonly destination?: number;
}

export interface DestroyCardEffect {
  readonly type: 'DestroyCardEffect';
  readonly target: TargetFilter;
}

export interface DestroyAndBuffEffect {
  readonly type: 'DestroyAndBuffEffect';
  readonly destroyTarget: TargetFilter;
  readonly buffTarget: TargetFilter;
  readonly buffAmount: Power;
}

export interface ConditionalPowerEffect {
  readonly type: 'ConditionalPowerEffect';
  readonly target: TargetFilter;
  readonly amount: Power;
  readonly condition: 'only_card_here' | 'destroyed_this_game' | 'moved_this_game' | 'moved_this_turn' | 'has_empty_slot';
}

export interface SilenceOngoingEffect {
  readonly type: 'SilenceOngoingEffect';
  readonly target: TargetFilter;
}

export interface StealPowerEffect {
  readonly type: 'StealPowerEffect';
  readonly target: TargetFilter;
  readonly amount: Power;
}

export interface ScalingOngoingPowerEffect {
  readonly type: 'ScalingOngoingPowerEffect';
  readonly target: TargetFilter;
  readonly perCardAmount: Power;
  readonly countFilter: TargetFilter;
}

export interface ScalingPowerEffect {
  readonly type: 'ScalingPowerEffect';
  readonly target: TargetFilter;
  readonly perDestroyedAmount: Power;
}

export interface ReviveEffect {
  readonly type: 'ReviveEffect';
  readonly baseSpiritPower?: Power;
}

export interface AddEnergyNextTurnEffect {
  readonly type: 'AddEnergyNextTurnEffect';
  readonly amount: number;
}

// Union of all effect types
export type Effect =
  | AddPowerEffect
  | AddOngoingPowerEffect
  | ConditionalOngoingPowerEffect
  | MoveCardEffect
  | DestroyCardEffect
  | DestroyAndBuffEffect
  | ConditionalPowerEffect
  | SilenceOngoingEffect
  | StealPowerEffect
  | ScalingOngoingPowerEffect
  | ScalingPowerEffect
  | ReviveEffect
  | AddEnergyNextTurnEffect;

// =============================================================================
// Effect Type Guards
// =============================================================================

export function isOnRevealEffect(effect: Effect): boolean {
  return [
    'AddPowerEffect',
    'MoveCardEffect',
    'DestroyCardEffect',
    'DestroyAndBuffEffect',
    'ConditionalPowerEffect',
    'StealPowerEffect',
    'ScalingPowerEffect',
    'ReviveEffect',
    'AddEnergyNextTurnEffect',
  ].includes(effect.type);
}

export function isOngoingEffect(effect: Effect): boolean {
  return [
    'AddOngoingPowerEffect',
    'ConditionalOngoingPowerEffect',
    'ScalingOngoingPowerEffect',
    'SilenceOngoingEffect',
  ].includes(effect.type);
}
