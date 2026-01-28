/**
 * Data models for the game engine.
 * 
 * Ported from Python engine/models.py
 * Uses immutable patterns - all updates return new objects.
 */

import type {
  CardId,
  InstanceId,
  PlayerId,
  LocationIndex,
  TurnNumber,
  Energy,
  Power,
  AbilityType,
  GamePhase,
  GameResult,
  CardTag,
  LocationTuple,
  PlayerTuple,
} from './types';
import type { Effect } from './effects';

// =============================================================================
// Card Definitions
// =============================================================================

/**
 * Immutable definition of a card type.
 * This is the "template" - multiple instances can exist in a game.
 */
export interface CardDef {
  readonly id: CardId;
  readonly name: string;
  readonly cost: Energy;
  readonly basePower: Power;
  readonly text: string;
  readonly abilityType: AbilityType;
  readonly effects: readonly Effect[];
  readonly tags: readonly CardTag[];
}

// =============================================================================
// Card Instances
// =============================================================================

/**
 * A specific instance of a card in a game.
 * Each card in deck/hand/board has a unique InstanceId.
 */
export interface CardInstance {
  readonly instanceId: InstanceId;
  readonly cardDef: CardDef;
  readonly owner: PlayerId;
  readonly permanentPowerModifier: Power;
  readonly ongoingPowerModifier: Power;
  readonly revealed: boolean;
}

/** Calculate effective power of a card */
export function getEffectivePower(card: CardInstance): Power {
  return card.cardDef.basePower + card.permanentPowerModifier + card.ongoingPowerModifier;
}

/** Create a new CardInstance with updated ongoing power */
export function withOngoingPower(card: CardInstance, modifier: Power): CardInstance {
  return { ...card, ongoingPowerModifier: modifier };
}

/** Create a new CardInstance with added permanent power */
export function addPermanentPower(card: CardInstance, amount: Power): CardInstance {
  return { ...card, permanentPowerModifier: card.permanentPowerModifier + amount };
}

/** Create a new CardInstance with revealed status */
export function withRevealed(card: CardInstance, revealed: boolean): CardInstance {
  return { ...card, revealed };
}

// =============================================================================
// Player State
// =============================================================================

export interface PlayerState {
  readonly playerId: PlayerId;
  readonly deck: readonly CardInstance[];
  readonly hand: readonly CardInstance[];
  readonly energy: Energy;
  readonly maxEnergy: Energy;
}

/** Create a new PlayerState with updated hand */
export function withHand(player: PlayerState, hand: readonly CardInstance[]): PlayerState {
  return { ...player, hand };
}

/** Create a new PlayerState with updated deck */
export function withDeck(player: PlayerState, deck: readonly CardInstance[]): PlayerState {
  return { ...player, deck };
}

/** Create a new PlayerState with updated energy */
export function withEnergy(player: PlayerState, energy: Energy, maxEnergy?: Energy): PlayerState {
  return { ...player, energy, maxEnergy: maxEnergy ?? player.maxEnergy };
}

/** Draw a card from deck. Returns [newState, drawnCard | null] */
export function drawCard(player: PlayerState): [PlayerState, CardInstance | null] {
  if (player.deck.length === 0) {
    return [player, null];
  }
  const [drawn, ...rest] = player.deck;
  if (!drawn) return [player, null];
  
  return [
    { ...player, deck: rest, hand: [...player.hand, drawn] },
    drawn,
  ];
}

/** Remove a card from hand by instance ID */
export function removeFromHand(
  player: PlayerState,
  instanceId: InstanceId
): [PlayerState, CardInstance | null] {
  const index = player.hand.findIndex(c => c.instanceId === instanceId);
  if (index === -1) return [player, null];
  
  const card = player.hand[index]!;
  const newHand = [...player.hand.slice(0, index), ...player.hand.slice(index + 1)];
  return [{ ...player, hand: newHand }, card];
}

/** Spend energy */
export function spendEnergy(player: PlayerState, amount: Energy): PlayerState {
  return { ...player, energy: player.energy - amount };
}

// =============================================================================
// Location State
// =============================================================================

export interface LocationState {
  readonly index: LocationIndex;
  readonly cardsByPlayer: PlayerTuple<readonly CardInstance[]>;
}

/** Get cards at this location for a player */
export function getCards(location: LocationState, playerId: PlayerId): readonly CardInstance[] {
  return location.cardsByPlayer[playerId];
}

/** Get card count at this location for a player */
export function getCardCount(location: LocationState, playerId: PlayerId): number {
  return location.cardsByPlayer[playerId].length;
}

/** Add a card to this location */
export function addCard(location: LocationState, card: CardInstance, playerId: PlayerId): LocationState {
  const newCards: [readonly CardInstance[], readonly CardInstance[]] = [
    ...location.cardsByPlayer
  ] as [readonly CardInstance[], readonly CardInstance[]];
  newCards[playerId] = [...newCards[playerId], card];
  return { ...location, cardsByPlayer: newCards };
}

/** Remove a card from this location */
export function removeCard(
  location: LocationState,
  instanceId: InstanceId
): [LocationState, CardInstance | null] {
  let removedCard: CardInstance | null = null;
  const newCardsByPlayer: [readonly CardInstance[], readonly CardInstance[]] = [[], []];

  for (const playerId of [0, 1] as PlayerId[]) {
    const filtered: CardInstance[] = [];
    for (const card of location.cardsByPlayer[playerId]) {
      if (card.instanceId === instanceId && !removedCard) {
        removedCard = card;
      } else {
        filtered.push(card);
      }
    }
    newCardsByPlayer[playerId] = filtered;
  }

  return [{ ...location, cardsByPlayer: newCardsByPlayer }, removedCard];
}

/** Update a card in this location */
export function updateCard(location: LocationState, updatedCard: CardInstance): LocationState {
  const newCardsByPlayer: [readonly CardInstance[], readonly CardInstance[]] = [
    location.cardsByPlayer[0].map(c => 
      c.instanceId === updatedCard.instanceId ? updatedCard : c
    ),
    location.cardsByPlayer[1].map(c => 
      c.instanceId === updatedCard.instanceId ? updatedCard : c
    ),
  ];
  return { ...location, cardsByPlayer: newCardsByPlayer };
}

/** Calculate total power at this location for a player */
export function getTotalPower(location: LocationState, playerId: PlayerId): Power {
  return location.cardsByPlayer[playerId].reduce(
    (sum, card) => sum + getEffectivePower(card),
    0
  );
}

/** Get all cards at this location */
export function getAllCards(location: LocationState): readonly CardInstance[] {
  return [...location.cardsByPlayer[0], ...location.cardsByPlayer[1]];
}

// =============================================================================
// Game State
// =============================================================================

export interface GameState {
  readonly turn: TurnNumber;
  readonly phase: GamePhase;
  readonly players: PlayerTuple<PlayerState>;
  readonly locations: LocationTuple<LocationState>;
  readonly result: GameResult;
  readonly nextInstanceId: InstanceId;

  // Tracking for conditional effects
  readonly cardsDestroyedThisGame: readonly InstanceId[];
  readonly cardsMovedThisGame: readonly InstanceId[];
  readonly cardsMovedThisTurn: readonly InstanceId[];
  readonly silencedCards: readonly InstanceId[];
  
  // Bonus energy for next turn (from effects like Iris)
  readonly bonusEnergyNextTurn: PlayerTuple<number>;
}

// State update helpers
export function withPlayer(state: GameState, playerId: PlayerId, player: PlayerState): GameState {
  const players: [PlayerState, PlayerState] = [...state.players] as [PlayerState, PlayerState];
  players[playerId] = player;
  return { ...state, players };
}

export function withLocation(state: GameState, index: LocationIndex, location: LocationState): GameState {
  const locations: [LocationState, LocationState, LocationState] = [...state.locations] as [LocationState, LocationState, LocationState];
  locations[index] = location;
  return { ...state, locations };
}

export function withTurn(state: GameState, turn: TurnNumber): GameState {
  return { ...state, turn };
}

export function withPhase(state: GameState, phase: GamePhase): GameState {
  return { ...state, phase };
}

export function withResult(state: GameState, result: GameResult): GameState {
  return { ...state, result };
}

export function withNextInstanceId(state: GameState, nextId: InstanceId): GameState {
  return { ...state, nextInstanceId: nextId };
}

export function withCardDestroyed(state: GameState, instanceId: InstanceId): GameState {
  return { ...state, cardsDestroyedThisGame: [...state.cardsDestroyedThisGame, instanceId] };
}

export function withCardMoved(state: GameState, instanceId: InstanceId): GameState {
  return {
    ...state,
    cardsMovedThisGame: [...state.cardsMovedThisGame, instanceId],
    cardsMovedThisTurn: [...state.cardsMovedThisTurn, instanceId],
  };
}

export function withSilencedCard(state: GameState, instanceId: InstanceId): GameState {
  if (state.silencedCards.includes(instanceId)) return state;
  return { ...state, silencedCards: [...state.silencedCards, instanceId] };
}

export function clearTurnTracking(state: GameState): GameState {
  return { ...state, cardsMovedThisTurn: [] };
}

export function addBonusEnergyNextTurn(state: GameState, playerId: PlayerId, amount: number): GameState {
  const newBonus: [number, number] = [...state.bonusEnergyNextTurn] as [number, number];
  newBonus[playerId] += amount;
  return { ...state, bonusEnergyNextTurn: newBonus };
}

export function getBonusEnergyNextTurn(state: GameState, playerId: PlayerId): number {
  return state.bonusEnergyNextTurn[playerId];
}

export function clearBonusEnergyNextTurn(state: GameState): GameState {
  return { ...state, bonusEnergyNextTurn: [0, 0] };
}

// Query helpers
export function getPlayer(state: GameState, playerId: PlayerId): PlayerState {
  return state.players[playerId];
}

export function getLocation(state: GameState, index: LocationIndex): LocationState {
  return state.locations[index];
}

export function findCardLocation(state: GameState, instanceId: InstanceId): LocationIndex | null {
  for (const location of state.locations) {
    for (const card of getAllCards(location)) {
      if (card.instanceId === instanceId) return location.index;
    }
  }
  return null;
}

export function findCardByInstance(state: GameState, instanceId: InstanceId): CardInstance | null {
  // Check hands
  for (const player of state.players) {
    for (const card of player.hand) {
      if (card.instanceId === instanceId) return card;
    }
    for (const card of player.deck) {
      if (card.instanceId === instanceId) return card;
    }
  }
  // Check locations
  for (const location of state.locations) {
    for (const card of getAllCards(location)) {
      if (card.instanceId === instanceId) return card;
    }
  }
  return null;
}

export function locationIsFull(state: GameState, locationIdx: LocationIndex, playerId: PlayerId): boolean {
  const LOCATION_CAPACITY = 4; // Inline to avoid circular import
  return getCardCount(state.locations[locationIdx], playerId) >= LOCATION_CAPACITY;
}

export function hasDestroyedCardThisGame(state: GameState): boolean {
  return state.cardsDestroyedThisGame.length > 0;
}

export function hasMovedCardThisGame(state: GameState): boolean {
  return state.cardsMovedThisGame.length > 0;
}

export function hasMovedCardThisTurn(state: GameState): boolean {
  return state.cardsMovedThisTurn.length > 0;
}

export function isSilenced(state: GameState, instanceId: InstanceId): boolean {
  return state.silencedCards.includes(instanceId);
}

// =============================================================================
// Player Actions
// =============================================================================

export interface PlayCardAction {
  readonly type: 'PlayCard';
  readonly playerId: PlayerId;
  readonly cardInstanceId: InstanceId;
  readonly location: LocationIndex;
}

export interface PassAction {
  readonly type: 'Pass';
  readonly playerId: PlayerId;
}

export type PlayerAction = PlayCardAction | PassAction;

// =============================================================================
// Factory Functions
// =============================================================================

export function createEmptyLocation(index: LocationIndex): LocationState {
  return {
    index,
    cardsByPlayer: [[], []],
  };
}

export function createInitialLocations(): LocationTuple<LocationState> {
  return [
    createEmptyLocation(0),
    createEmptyLocation(1),
    createEmptyLocation(2),
  ];
}
