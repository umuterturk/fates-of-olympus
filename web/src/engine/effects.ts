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
  readonly condition: string; // Various conditions like 'location_full', 'exactly_two_allies_here', 'moved_this_turn', etc.
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

export interface DestroyAndGainPowerEffect {
  readonly type: 'DestroyAndGainPowerEffect';
  readonly destroyTarget: TargetFilter;
  readonly gainTarget: TargetFilter;
}

export interface GlobalOngoingPowerEffect {
  readonly type: 'GlobalOngoingPowerEffect';
  readonly target: TargetFilter;
  readonly amount: Power;
}

export interface MoveAndSelfBuffEffect {
  readonly type: 'MoveAndSelfBuffEffect';
  readonly moveTarget: TargetFilter;
  readonly buffAmount: Power;
}

export interface DestroyAndSelfBuffEffect {
  readonly type: 'DestroyAndSelfBuffEffect';
  readonly destroyTarget: TargetFilter;
  readonly buffAmount: Power;
}

export interface MoveAndBuffEffect {
  readonly type: 'MoveAndBuffEffect';
  readonly moveTarget: TargetFilter;
  readonly buffTarget: TargetFilter;
  readonly buffAmount: Power;
}

export interface MoveAndDebuffDestinationEffect {
  readonly type: 'MoveAndDebuffDestinationEffect';
  readonly debuffAmount: Power;
}

export interface ProtectFromDebuffEffect {
  readonly type: 'ProtectFromDebuffEffect';
  readonly target: TargetFilter;
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
  | AddEnergyNextTurnEffect
  | DestroyAndGainPowerEffect
  | GlobalOngoingPowerEffect
  | MoveAndSelfBuffEffect
  | DestroyAndSelfBuffEffect
  | MoveAndBuffEffect
  | MoveAndDebuffDestinationEffect
  | ProtectFromDebuffEffect;

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
    'ProtectFromDebuffEffect',
  ].includes(effect.type);
}
