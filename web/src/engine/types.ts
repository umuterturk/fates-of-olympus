/**
 * Core type definitions for the game engine.
 * 
 * Ported from Python engine/types.py
 * Uses TypeScript's type system for strong typing.
 */

// =============================================================================
// ID Types (branded types for type safety)
// =============================================================================

/** Unique identifier for card definitions */
export type CardId = string;

/** Unique identifier for card instances in a game */
export type InstanceId = number;

/** Player identifier (0 or 1) */
export type PlayerId = 0 | 1;

/** Location index (0, 1, or 2) */
export type LocationIndex = 0 | 1 | 2;

/** Turn number (1-6) */
export type TurnNumber = 1 | 2 | 3 | 4 | 5 | 6;

/** Energy value */
export type Energy = number;

/** Power value */
export type Power = number;

// =============================================================================
// Constants
// =============================================================================

export const MAX_TURNS = 6;
export const LOCATION_CAPACITY = 4;
export const STARTING_HAND_SIZE = 3;
export const DECK_SIZE = 24;
export const MAX_HAND_SIZE = 7;

// =============================================================================
// Enums
// =============================================================================

export type AbilityType =
  | 'VANILLA'
  | 'ON_REVEAL'
  | 'ONGOING';

export type GamePhase =
  | 'TURN_START'
  | 'PLANNING'
  | 'RESOLUTION'
  | 'TURN_END'
  | 'GAME_OVER';

export type GameResult =
  | 'IN_PROGRESS'
  | 'PLAYER_0_WINS'
  | 'PLAYER_1_WINS'
  | 'DRAW';

// =============================================================================
// Target Filters
// =============================================================================

export type TargetFilter =
  | 'SELF'
  | 'SAME_LOCATION_FRIENDLY'
  | 'SAME_LOCATION_FRIENDLY_EXCEPT_SELF'
  | 'SAME_LOCATION_ENEMY'
  | 'SAME_LOCATION_ALL'
  | 'ALL_FRIENDLY'
  | 'ALL_ENEMY'
  | 'ALL_CARDS'
  | 'OTHER_LOCATIONS_FRIENDLY'
  | 'LEFTMOST_FRIENDLY'
  | 'RIGHTMOST_FRIENDLY'
  | 'ONE_SAME_LOCATION_FRIENDLY'
  | 'ONE_SAME_LOCATION_FRIENDLY_EXCEPT_SELF'
  | 'ONE_SAME_LOCATION_ENEMY'
  | 'ONE_OTHER_LOCATION_FRIENDLY'
  | 'FRIENDLY_WITH_DESTROY_TAG'
  | 'ALL_FRIENDLY_DESTROY_TAGGED'
  | 'SAME_LOCATION_ENEMY_ONGOING'
  | 'SAME_LOCATION_ENEMY_BUFF_TAGGED'
  | 'HIGHEST_POWER_ENEMY_HERE'
  | 'ONE_OTHER_LOCATION_FRIENDLY_TO_HERE'
  | 'ONE_DESTINATION_ENEMY'
  | 'MOVED_CARD';

// =============================================================================
// Card Tags
// =============================================================================

export type CardTag =
  | 'Vanilla'
  | 'On-Reveal'
  | 'Ongoing'
  | 'Move'
  | 'Destroy'
  | 'Buff'
  | 'Debuff'
  | 'Tech'
  | 'Build-Around'
  | 'Drain';

// =============================================================================
// Utility Types
// =============================================================================

/** Tuple type for 3 locations */
export type LocationTuple<T> = readonly [T, T, T];

/** Tuple type for 2 players */
export type PlayerTuple<T> = readonly [T, T];

// =============================================================================
// Helper Functions
// =============================================================================

export function isValidLocationIndex(index: number): index is LocationIndex {
  return index === 0 || index === 1 || index === 2;
}

export function isValidPlayerId(id: number): id is PlayerId {
  return id === 0 || id === 1;
}

export function getOpponentId(playerId: PlayerId): PlayerId {
  return playerId === 0 ? 1 : 0;
}

export function isValidTurnNumber(turn: number): turn is TurnNumber {
  return turn >= 1 && turn <= 6;
}
