/**
 * Game events for the event log.
 * 
 * Ported from Python engine/events.py
 * These events drive animations in the UI.
 */

import type {
  PlayerId,
  LocationIndex,
  InstanceId,
  TurnNumber,
  Energy,
  Power,
  GameResult,
} from './types';

// =============================================================================
// Event Types (Discriminated Union)
// =============================================================================

export interface GameStartedEvent {
  readonly type: 'GameStarted';
}

export interface GameEndedEvent {
  readonly type: 'GameEnded';
  readonly result: GameResult;
  readonly locationWinners: readonly (PlayerId | null)[];
  readonly locationPowers: readonly (readonly [Power, Power])[];
  readonly totalPower: readonly [Power, Power];
}

export interface TurnStartedEvent {
  readonly type: 'TurnStarted';
  readonly turn: TurnNumber;
}

export interface TurnEndedEvent {
  readonly type: 'TurnEnded';
  readonly turn: TurnNumber;
}

export interface EnergySetEvent {
  readonly type: 'EnergySet';
  readonly playerId: PlayerId;
  readonly energy: Energy;
}

export interface BonusEnergyEvent {
  readonly type: 'BonusEnergy';
  readonly playerId: PlayerId;
  readonly bonus: Energy;
  readonly locationsWon: number;
  readonly newTotal: Energy;
}

export interface EnergySpentEvent {
  readonly type: 'EnergySpent';
  readonly playerId: PlayerId;
  readonly amount: Energy;
  readonly remaining: Energy;
}

export interface CardDrawnEvent {
  readonly type: 'CardDrawn';
  readonly playerId: PlayerId;
  readonly cardInstanceId: InstanceId;
}

export interface CardPlayedEvent {
  readonly type: 'CardPlayed';
  readonly playerId: PlayerId;
  readonly cardInstanceId: InstanceId;
  readonly location: LocationIndex;
}

export interface CardRevealedEvent {
  readonly type: 'CardRevealed';
  readonly cardInstanceId: InstanceId;
  readonly location: LocationIndex;
  readonly playerId: PlayerId;
}

export interface CardMovedEvent {
  readonly type: 'CardMoved';
  readonly cardInstanceId: InstanceId;
  readonly fromLocation: LocationIndex;
  readonly toLocation: LocationIndex;
  readonly sourceCardId: InstanceId;
}

export interface CardDestroyedEvent {
  readonly type: 'CardDestroyed';
  readonly cardInstanceId: InstanceId;
  readonly location: LocationIndex;
  readonly sourceCardId: InstanceId;
}

export interface PowerChangedEvent {
  readonly type: 'PowerChanged';
  readonly cardInstanceId: InstanceId;
  readonly oldPower: Power;
  readonly newPower: Power;
  readonly sourceCardId: InstanceId;
}

export interface PlayerPassedEvent {
  readonly type: 'PlayerPassed';
  readonly playerId: PlayerId;
}

export interface ActionInvalidEvent {
  readonly type: 'ActionInvalid';
  readonly playerId: PlayerId;
  readonly reason: string;
}

// Union of all event types
export type GameEvent =
  | GameStartedEvent
  | GameEndedEvent
  | TurnStartedEvent
  | TurnEndedEvent
  | EnergySetEvent
  | BonusEnergyEvent
  | EnergySpentEvent
  | CardDrawnEvent
  | CardPlayedEvent
  | CardRevealedEvent
  | CardMovedEvent
  | CardDestroyedEvent
  | PowerChangedEvent
  | PlayerPassedEvent
  | ActionInvalidEvent;

// =============================================================================
// Animation Configuration per Event Type
// =============================================================================

export interface AnimationConfig {
  readonly duration: number; // seconds
  readonly delay?: number;
  readonly interruptible: boolean;
}

export const EVENT_ANIMATIONS: Record<GameEvent['type'], AnimationConfig> = {
  GameStarted: { duration: 0.5, interruptible: true },
  GameEnded: { duration: 1.0, interruptible: false },
  TurnStarted: { duration: 0.3, interruptible: true },
  TurnEnded: { duration: 0.2, interruptible: true },
  EnergySet: { duration: 0.3, interruptible: true },
  BonusEnergy: { duration: 0.4, interruptible: true },
  EnergySpent: { duration: 0.2, interruptible: true },
  CardDrawn: { duration: 0.4, interruptible: true },
  CardPlayed: { duration: 0.5, interruptible: false },
  CardRevealed: { duration: 0.6, interruptible: false },
  CardMoved: { duration: 0.7, interruptible: false },
  CardDestroyed: { duration: 0.5, interruptible: false },
  PowerChanged: { duration: 0.4, interruptible: true },
  PlayerPassed: { duration: 0.2, interruptible: true },
  ActionInvalid: { duration: 0.3, interruptible: true },
};
