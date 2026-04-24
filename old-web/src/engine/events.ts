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

// =============================================================================
// New Event Types for Deterministic Ability System
// =============================================================================

/**
 * Emitted when an ability is triggered during resolution.
 */
export interface AbilityTriggeredEvent {
  readonly type: 'AbilityTriggered';
  /** Card that owns the triggered ability */
  readonly sourceCardId: InstanceId;
  /** What triggered the ability */
  readonly trigger: 'ON_PLAY' | 'ON_REVEAL' | 'ONGOING' | 'START_OF_TURN' | 'END_OF_TURN' | 'ON_DESTROYED' | 'ON_MOVED';
  /** Cards affected by the ability */
  readonly targets: readonly InstanceId[];
  /** Effect type applied */
  readonly effect: string;
}

/**
 * Emitted when a move effect fails.
 */
export interface MoveFailedEvent {
  readonly type: 'MoveFailed';
  /** Card that failed to move */
  readonly cardInstanceId: InstanceId;
  /** Reason for failure */
  readonly reason: 'DESTINATION_FULL' | 'NO_VALID_DESTINATION';
}

/**
 * Emitted when location control changes.
 */
export interface LocationStateChangedEvent {
  readonly type: 'LocationStateChanged';
  /** Location that changed */
  readonly locationIndex: LocationIndex;
  /** New winner of the location (null if tied) */
  readonly winnerId: PlayerId | null;
  /** Power values [player0, player1] */
  readonly powers: readonly [Power, Power];
}

/**
 * Emitted at the start of Phase B (Resolution).
 */
export interface ResolutionStartedEvent {
  readonly type: 'ResolutionStarted';
  /** Turn number */
  readonly turn: TurnNumber;
  /** Total steps in the resolution timeline */
  readonly totalSteps: number;
}

/**
 * Emitted at the end of Phase B (Resolution).
 */
export interface ResolutionEndedEvent {
  readonly type: 'ResolutionEnded';
  /** Turn number */
  readonly turn: TurnNumber;
}

/**
 * Emitted during Phase C (Stabilization) when ongoing effects are recalculated.
 */
export interface OngoingRecalculatedEvent {
  readonly type: 'OngoingRecalculated';
  /** Cards whose ongoing modifiers changed */
  readonly affectedCards: readonly InstanceId[];
}

/**
 * Emitted when a card is silenced.
 */
export interface CardSilencedEvent {
  readonly type: 'CardSilenced';
  /** Card that was silenced */
  readonly cardInstanceId: InstanceId;
  /** Card that caused the silence */
  readonly sourceCardId: InstanceId;
}

/**
 * Emitted when a spirit or token is summoned.
 */
export interface CardSummonedEvent {
  readonly type: 'CardSummoned';
  /** Instance ID of the summoned card */
  readonly cardInstanceId: InstanceId;
  /** Location where it was summoned */
  readonly location: LocationIndex;
  /** Player who summoned it */
  readonly playerId: PlayerId;
  /** Card that caused the summon */
  readonly sourceCardId: InstanceId;
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
  | ActionInvalidEvent
  // New events for deterministic ability system
  | AbilityTriggeredEvent
  | MoveFailedEvent
  | LocationStateChangedEvent
  | ResolutionStartedEvent
  | ResolutionEndedEvent
  | OngoingRecalculatedEvent
  | CardSilencedEvent
  | CardSummonedEvent;

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
  PowerChanged: { duration: 1.0, interruptible: false },
  PlayerPassed: { duration: 0.2, interruptible: true },
  ActionInvalid: { duration: 0.3, interruptible: true },
  // New events for deterministic ability system
  AbilityTriggered: { duration: 0.3, interruptible: false },
  MoveFailed: { duration: 0.4, interruptible: true },
  LocationStateChanged: { duration: 0.5, interruptible: true },
  ResolutionStarted: { duration: 0.2, interruptible: true },
  ResolutionEnded: { duration: 0.2, interruptible: true },
  OngoingRecalculated: { duration: 0.3, interruptible: true },
  CardSilenced: { duration: 0.4, interruptible: false },
  CardSummoned: { duration: 0.6, interruptible: false },
};
