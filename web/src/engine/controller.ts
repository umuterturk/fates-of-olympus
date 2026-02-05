/**
 * Game Controller - orchestrates game phases
 * 
 * This module provides two resolution modes:
 * - Legacy: resolveTurn() - sequential processing (backward compatible)
 * - Deterministic: resolveTurnDeterministic() - timeline-based pre-computation
 * 
 * For new features and Firebase/PvP, use the deterministic mode.
 */

import type {
  GameState,
  PlayerState,
  PlayerAction,
  PlayCardAction,
} from './models';
import {
  createInitialLocations,
  getPlayer,
  getLocation,
  withPlayer,
  withLocation,
  withTurn,
  withPhase,
  withResult,
  drawCard,
  drawCardWeighted,
  spendEnergy,
  removeFromHand,
  addCard,
  getCardCount,
  getTotalPower,
  clearTurnTracking,
  getBonusEnergyNextTurn,
  clearBonusEnergyNextTurn,
} from './models';
import type { GameEvent } from './events';
import type { PlayerId, LocationIndex, TurnNumber } from './types';
import { MAX_TURNS, LOCATION_CAPACITY, STARTING_HAND_SIZE, MAX_HAND_SIZE, isValidLocationIndex } from './types';
import { getDeckCardDefs, createDeck, shuffleDeckByCost, getCardDefsFromIds, getCardsByCostMap, getAllCardDefs } from './cards';
import type { CardDef } from './models';
import type { CardId } from './types';

// Timeline-based deterministic resolution imports
import { SeededRNG, generateGameSeed } from './rng';
import { generateTimeline } from './timeline/generator';
import { executeTimeline, createStepIterator } from './timeline/executor';
import type { PlayedCard, ResolutionTimeline } from './timeline/types';

// =============================================================================
// Game Creation
// =============================================================================

export function createGame(): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];

  // Create decks for both players (shuffled by cost - low cost cards drawn first)
  const p0Defs = shuffleDeckByCost(getDeckCardDefs('starter'));
  const p1Defs = shuffleDeckByCost(getDeckCardDefs('starter'));

  const { deck: deck0, nextId: nextId0 } = createDeck(p0Defs, 0, 0);
  const { deck: deck1, nextId: nextId1 } = createDeck(p1Defs, 1, nextId0);

  // Create player states
  let player0: PlayerState = {
    playerId: 0,
    deck: deck0,
    hand: [],
    energy: 0,
    maxEnergy: 0,
  };

  let player1: PlayerState = {
    playerId: 1,
    deck: deck1,
    hand: [],
    energy: 0,
    maxEnergy: 0,
  };

  // Draw initial hands
  for (let i = 0; i < STARTING_HAND_SIZE; i++) {
    const [newP0, card0] = drawCard(player0);
    player0 = newP0;
    if (card0) {
      events.push({ type: 'CardDrawn', playerId: 0, cardInstanceId: card0.instanceId });
    }

    const [newP1, card1] = drawCard(player1);
    player1 = newP1;
    if (card1) {
      events.push({ type: 'CardDrawn', playerId: 1, cardInstanceId: card1.instanceId });
    }
  }

  const state: GameState = {
    turn: 1 as TurnNumber,
    phase: 'PLANNING',
    players: [player0, player1],
    locations: createInitialLocations(),
    result: 'IN_PROGRESS',
    nextInstanceId: nextId1,
    cardsDestroyedThisGame: [],
    cardsMovedThisGame: [],
    cardsMovedThisTurn: [],
    silencedCards: [],
    bonusEnergyNextTurn: [0, 0],
  };

  // Set energy for turn 1
  const startingEnergy = 1;
  const stateWithEnergy = withPlayer(
    withPlayer(state, 0, { ...player0, energy: startingEnergy, maxEnergy: startingEnergy }),
    1,
    { ...player1, energy: startingEnergy, maxEnergy: startingEnergy }
  );

  events.push({ type: 'GameStarted' });
  events.push({ type: 'TurnStarted', turn: 1 as TurnNumber });
  events.push({ type: 'EnergySet', playerId: 0, energy: startingEnergy });
  events.push({ type: 'EnergySet', playerId: 1, energy: startingEnergy });

  return { state: stateWithEnergy, events };
}

// =============================================================================
// Turn Management
// =============================================================================

/**
 * Count how many locations a player is currently winning.
 * A player wins a location if they have strictly more power than the opponent.
 */
function countLocationsWon(state: GameState, playerId: PlayerId): number {
  const enemyId = (1 - playerId) as PlayerId;
  let count = 0;

  for (const location of state.locations) {
    const playerPower = getTotalPower(location, playerId);
    const enemyPower = getTotalPower(location, enemyId);
    if (playerPower > enemyPower) {
      count++;
    }
  }

  return count;
}

export function startNextTurn(state: GameState): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];

  const newTurn = (state.turn + 1) as TurnNumber;
  if (newTurn > MAX_TURNS) {
    // Game should be over
    return { state, events };
  }

  let newState = withTurn(state, newTurn);
  newState = withPhase(newState, 'PLANNING');
  newState = clearTurnTracking(newState);

  events.push({ type: 'TurnStarted', turn: newTurn });

  // Set energy and draw cards
  for (const playerId of [0, 1] as PlayerId[]) {
    let player = getPlayer(newState, playerId);

    // Base energy = turn number
    const baseEnergy = newTurn;

    // Bonus energy from locations: +1 for each location currently won
    // Use the state from END of previous turn (before this turn's updates)
    const locationsWon = countLocationsWon(state, playerId);
    const locationBonus = locationsWon;

    // Bonus energy from card effects (e.g., Iris)
    const cardEffectBonus = getBonusEnergyNextTurn(state, playerId);

    const totalBonus = locationBonus + cardEffectBonus;
    const totalEnergy = baseEnergy + totalBonus;

    player = { ...player, energy: totalEnergy, maxEnergy: totalEnergy };
    newState = withPlayer(newState, playerId, player);
    events.push({ type: 'EnergySet', playerId, energy: baseEnergy });

    // Emit bonus energy event if player gets bonus from locations
    if (locationBonus > 0) {
      events.push({
        type: 'BonusEnergy',
        playerId,
        bonus: locationBonus,
        locationsWon,
        newTotal: totalEnergy,
      });
    }

    // Emit bonus energy event if player gets bonus from card effects
    if (cardEffectBonus > 0) {
      events.push({
        type: 'BonusEnergy',
        playerId,
        bonus: cardEffectBonus,
        locationsWon: 0, // From card effect, not locations
        newTotal: totalEnergy,
      });
    }

    // Draw cards to fill hand to 4 cards (weighted towards higher cost cards on later turns)
    const TARGET_HAND_SIZE = 4;
    while (player.hand.length < TARGET_HAND_SIZE && player.hand.length < MAX_HAND_SIZE) {
      const [drawnPlayer, card] = drawCardWeighted(player, newTurn);
      if (card) {
        player = drawnPlayer;
        newState = withPlayer(newState, playerId, player);
        events.push({ type: 'CardDrawn', playerId, cardInstanceId: card.instanceId });
      } else {
        // No more cards in deck
        break;
      }
    }
  }

  // Clear bonus energy from card effects (it's been consumed)
  newState = clearBonusEnergyNextTurn(newState);

  return { state: newState, events };
}

// =============================================================================
// Action Validation
// =============================================================================

export interface ValidationResult {
  valid: boolean;
  reason: string;
}

export function validateAction(state: GameState, action: PlayerAction): ValidationResult {
  if (action.type === 'Pass') {
    return { valid: true, reason: '' };
  }

  const { playerId, cardInstanceId, location } = action;

  // Check location is valid
  if (!isValidLocationIndex(location)) {
    return { valid: false, reason: `Invalid location: ${location}` };
  }

  const player = getPlayer(state, playerId);
  const loc = getLocation(state, location);

  // Check card is in hand
  const card = player.hand.find(c => c.instanceId === cardInstanceId);
  if (!card) {
    return { valid: false, reason: 'Card not in hand' };
  }

  // Check energy
  if (card.cardDef.cost > player.energy) {
    return { valid: false, reason: `Not enough energy: need ${card.cardDef.cost}, have ${player.energy}` };
  }

  // Check location capacity
  if (getCardCount(loc, playerId) >= LOCATION_CAPACITY) {
    return { valid: false, reason: `Location ${location} is at capacity` };
  }

  return { valid: true, reason: '' };
}

export function getLegalActions(state: GameState, playerId: PlayerId): PlayerAction[] {
  const actions: PlayerAction[] = [{ type: 'Pass', playerId }];

  const player = getPlayer(state, playerId);
  for (const card of player.hand) {
    for (const locIdx of [0, 1, 2] as LocationIndex[]) {
      const action: PlayCardAction = {
        type: 'PlayCard',
        playerId,
        cardInstanceId: card.instanceId,
        location: locIdx,
      };
      if (validateAction(state, action).valid) {
        actions.push(action);
      }
    }
  }

  return actions;
}

// =============================================================================
// NOTE: Legacy resolveTurn() and its helper functions have been removed.
// All turn resolution now uses resolveTurnDeterministic() which provides
// deterministic behavior through the timeline-based ability system.
// See web/src/engine/timeline/ and web/src/engine/ability/ for the new system.
// =============================================================================

// =============================================================================
// Win Condition
// =============================================================================

export function computeWinner(state: GameState): {
  result: import('./types').GameResult;
  locationWinners: (PlayerId | null)[];
  locationPowers: [number, number][];
  totalPower: [number, number];
} {
  const locationWinners: (PlayerId | null)[] = [];
  const locationPowers: [number, number][] = [];
  let p0Wins = 0;
  let p1Wins = 0;
  let totalP0 = 0;
  let totalP1 = 0;

  for (const location of state.locations) {
    const p0Power = getTotalPower(location, 0);
    const p1Power = getTotalPower(location, 1);
    locationPowers.push([p0Power, p1Power]);
    totalP0 += p0Power;
    totalP1 += p1Power;

    if (p0Power > p1Power) {
      locationWinners.push(0);
      p0Wins++;
    } else if (p1Power > p0Power) {
      locationWinners.push(1);
      p1Wins++;
    } else {
      locationWinners.push(null);
    }
  }

  let result: import('./types').GameResult;
  if (p0Wins >= 2) {
    result = 'PLAYER_0_WINS';
  } else if (p1Wins >= 2) {
    result = 'PLAYER_1_WINS';
  } else if (totalP0 > totalP1) {
    result = 'PLAYER_0_WINS';
  } else if (totalP1 > totalP0) {
    result = 'PLAYER_1_WINS';
  } else {
    result = 'DRAW';
  }

  return { result, locationWinners, locationPowers, totalPower: [totalP0, totalP1] };
}

// =============================================================================
// Deterministic Turn Resolution (Timeline-based)
// =============================================================================

/**
 * Result of deterministic turn resolution.
 */
export interface DeterministicResolutionResult {
  /** Final game state after resolution */
  readonly state: GameState;
  /** All events emitted during resolution */
  readonly events: GameEvent[];
  /** The pre-computed resolution timeline */
  readonly timeline: ResolutionTimeline;
  /** Whether resolution completed successfully */
  readonly success: boolean;
  /** Error message if resolution failed */
  readonly error?: string;
}

/**
 * Resolve a turn using the deterministic timeline system.
 * 
 * This is the new resolution mode that pre-computes all events before
 * executing them. Use this for:
 * - Firebase/PvP games (identical results across clients)
 * - Replays (same inputs = same outputs)
 * - Testing (deterministic assertions)
 * 
 * Phase A (COMMIT):
 *   - Cards are placed face-down at locations
 *   - No abilities trigger
 * 
 * Phase B (RESOLUTION):
 *   - Timeline is generated (pre-computed)
 *   - Timeline is executed step-by-step
 *   - Events are emitted for UI animation
 * 
 * Phase C (STABILIZATION):
 *   - Ongoing abilities are recalculated
 *   - Temporary effects expire
 *   - Location control is recalculated
 * 
 * @param state - Current game state
 * @param action0 - Player 0's action
 * @param action1 - Player 1's action
 * @param rng - Seeded RNG (optional - will be created from game state if not provided)
 */
export function resolveTurnDeterministic(
  state: GameState,
  action0: PlayerAction,
  action1: PlayerAction,
  rng?: SeededRNG
): DeterministicResolutionResult {
  const events: GameEvent[] = [];
  
  // Create RNG if not provided
  const effectiveRng = rng ?? new SeededRNG(generateGameSeed('game', state.turn));
  
  // ==========================================================================
  // PHASE A: COMMIT
  // Place cards face-down at locations. No abilities trigger.
  // ==========================================================================
  
  let newState = withPhase(state, 'RESOLUTION');
  const playedCards: PlayedCard[] = [];
  let playOrder = 0;
  
  // Process both actions - place cards face-down
  for (const action of [action0, action1]) {
    const validation = validateAction(newState, action);
    if (!validation.valid) {
      events.push({ type: 'ActionInvalid', playerId: action.playerId, reason: validation.reason });
      continue;
    }
    
    if (action.type === 'Pass') {
      events.push({ type: 'PlayerPassed', playerId: action.playerId });
      continue;
    }
    
    // PlayCard action
    const player = getPlayer(newState, action.playerId);
    const [playerWithoutCard, card] = removeFromHand(player, action.cardInstanceId);
    
    if (!card) continue;
    
    // Spend energy
    const playerSpent = spendEnergy(playerWithoutCard, card.cardDef.cost);
    newState = withPlayer(newState, action.playerId, playerSpent);
    events.push({
      type: 'EnergySpent',
      playerId: action.playerId,
      amount: card.cardDef.cost,
      remaining: playerSpent.energy,
    });
    
    // Place card at location (unrevealed)
    const location = getLocation(newState, action.location);
    const newLocation = addCard(location, card, action.playerId);
    newState = withLocation(newState, action.location, newLocation);
    
    events.push({
      type: 'CardPlayed',
      playerId: action.playerId,
      cardInstanceId: card.instanceId,
      location: action.location,
    });
    
    // Track played card for timeline generation
    playedCards.push({
      instanceId: card.instanceId,
      playerId: action.playerId,
      location: action.location,
      playOrder: playOrder++,
    });
  }
  
  // ==========================================================================
  // PHASE B: RESOLUTION
  // Generate timeline (pre-computed) and execute it.
  // ==========================================================================
  
  // Emit resolution started event
  events.push({
    type: 'ResolutionStarted',
    turn: state.turn as TurnNumber,
    totalSteps: 0, // Will be updated after generation
  } as GameEvent);
  
  // Generate the resolution timeline
  const timelineResult = generateTimeline(newState, playedCards, effectiveRng);
  
  // Update resolution started event with actual step count
  const resolutionStartedIdx = events.findIndex(e => e.type === 'ResolutionStarted');
  if (resolutionStartedIdx >= 0) {
    events[resolutionStartedIdx] = {
      type: 'ResolutionStarted',
      turn: state.turn as TurnNumber,
      totalSteps: timelineResult.timeline.length,
    } as GameEvent;
  }
  
  // Execute the timeline
  const executionResult = executeTimeline(newState, timelineResult.timeline, effectiveRng);
  newState = executionResult.state;
  events.push(...executionResult.events);
  
  // Emit resolution ended event
  events.push({
    type: 'ResolutionEnded',
    turn: state.turn as TurnNumber,
  } as GameEvent);
  
  // ==========================================================================
  // PHASE C: STABILIZATION
  // Check for game end and transition to next phase.
  // ==========================================================================
  
  // Check for game end
  if (newState.turn >= MAX_TURNS) {
    const { result, locationWinners, locationPowers, totalPower } = computeWinner(newState);
    newState = withResult(newState, result);
    newState = withPhase(newState, 'GAME_OVER');
    events.push({
      type: 'GameEnded',
      result,
      locationWinners,
      locationPowers,
      totalPower,
    });
  } else {
    newState = withPhase(newState, 'TURN_END');
    events.push({ type: 'TurnEnded', turn: newState.turn });
  }
  
  return {
    state: newState,
    events,
    timeline: timelineResult.timeline,
    success: executionResult.success,
    error: executionResult.error,
  };
}

// =============================================================================
// NPC Deck Generation
// =============================================================================

/**
 * Number of card swaps based on difficulty/unlock position.
 * Lower positions = easier = fewer swaps (more similar to player's deck)
 */
function getNpcSwapCount(unlockPosition: number): number {
  if (unlockPosition < 5) return 2;      // Easy: 2 random swaps
  if (unlockPosition < 10) return 4;     // Medium-easy: 4 swaps
  if (unlockPosition < 15) return 6;     // Medium: 6 swaps
  if (unlockPosition < 25) return 8;     // Medium-hard: 8 swaps
  return 10;                              // Hard: 10 swaps (more variety)
}

/**
 * Generate NPC deck based on player's deck with random same-cost card swaps.
 * 
 * This creates a fair matchup where:
 * - NPC has the same deck size as the player
 * - NPC has similar card power distribution (same costs)
 * - NPC has some variety through random swaps
 * - Swap count increases with player progression (harder = more variety)
 * 
 * @param playerDeckIds - The player's current deck card IDs
 * @param swapCount - Number of cards to randomly replace
 * @param rng - Seeded RNG for deterministic swaps
 * @returns Array of CardDefs for the NPC's deck
 */
function generateNpcDeck(
  playerDeckIds: CardId[],
  swapCount: number,
  rng: SeededRNG
): CardDef[] {
  // Get player's deck definitions
  const playerDeck = getCardDefsFromIds(playerDeckIds);
  if (playerDeck.length === 0) {
    // Fallback to starter deck if player deck is empty
    return getDeckCardDefs('starter');
  }

  // Get all cards grouped by cost for finding replacements
  const cardsByCost = getCardsByCostMap();
  const playerCardIds = new Set(playerDeckIds);
  
  // Start with a copy of the player's deck
  const npcDeck = [...playerDeck];
  
  // Track which indices we've already swapped to avoid double-swapping
  const swappedIndices = new Set<number>();
  
  // Perform swaps
  let swapsPerformed = 0;
  let attempts = 0;
  const maxAttempts = swapCount * 3; // Prevent infinite loops
  
  while (swapsPerformed < swapCount && attempts < maxAttempts) {
    attempts++;
    
    // Pick a random card from the deck to swap
    const indexToSwap = Math.floor(rng.next() * npcDeck.length);
    
    // Skip if already swapped this index
    if (swappedIndices.has(indexToSwap)) continue;
    
    const cardToReplace = npcDeck[indexToSwap]!;
    const cost = cardToReplace.cost;
    
    // Find all cards with the same cost that aren't in the current NPC deck
    const currentNpcCardIds = new Set(npcDeck.map(c => c.id));
    const sameCostCards = cardsByCost.get(cost) ?? [];
    const availableReplacements = sameCostCards.filter(
      card => !currentNpcCardIds.has(card.id)
    );
    
    if (availableReplacements.length === 0) continue;
    
    // Pick a random replacement
    const replacementIndex = Math.floor(rng.next() * availableReplacements.length);
    const replacement = availableReplacements[replacementIndex]!;
    
    // Perform the swap
    npcDeck[indexToSwap] = replacement;
    swappedIndices.add(indexToSwap);
    swapsPerformed++;
  }
  
  return npcDeck;
}

/**
 * Create a game with a specific seed for deterministic behavior.
 * 
 * @param seed - Random seed for deterministic behavior
 * @param playerDeckIds - Optional array of card IDs for player 0's deck (uses starter deck if not provided)
 * @param unlockPosition - Player's unlock position for difficulty scaling (defaults to 0)
 */
export function createGameWithSeed(
  seed: number,
  playerDeckIds?: CardId[],
  unlockPosition: number = 0
): { state: GameState; events: GameEvent[]; rng: SeededRNG } {
  const rng = new SeededRNG(seed);
  const events: GameEvent[] = [];
  
  // Create decks for both players (shuffled by cost - low cost cards drawn first)
  // Player 0 uses the provided deck IDs or falls back to starter deck
  const effectivePlayerDeckIds = playerDeckIds && playerDeckIds.length > 0
    ? playerDeckIds
    : getDeckCardDefs('starter').map(c => c.id);
  
  const p0Defs = rng.shuffle(getCardDefsFromIds(effectivePlayerDeckIds));
  
  // NPC deck: based on player's deck with random same-cost swaps
  // Swap count increases with player progression for more variety/challenge
  const swapCount = getNpcSwapCount(unlockPosition);
  const p1Defs = rng.shuffle(generateNpcDeck(effectivePlayerDeckIds, swapCount, rng));
  
  // Sort by cost for early-game playability
  p0Defs.sort((a, b) => a.cost - b.cost);
  p1Defs.sort((a, b) => a.cost - b.cost);
  
  const { deck: deck0, nextId: nextId0 } = createDeck(p0Defs, 0, 0);
  const { deck: deck1, nextId: nextId1 } = createDeck(p1Defs, 1, nextId0);
  
  // Create player states
  let player0: PlayerState = {
    playerId: 0,
    deck: deck0,
    hand: [],
    energy: 0,
    maxEnergy: 0,
  };
  
  let player1: PlayerState = {
    playerId: 1,
    deck: deck1,
    hand: [],
    energy: 0,
    maxEnergy: 0,
  };
  
  // Draw initial hands
  for (let i = 0; i < STARTING_HAND_SIZE; i++) {
    const [newP0, card0] = drawCard(player0);
    player0 = newP0;
    if (card0) {
      events.push({ type: 'CardDrawn', playerId: 0, cardInstanceId: card0.instanceId });
    }
    
    const [newP1, card1] = drawCard(player1);
    player1 = newP1;
    if (card1) {
      events.push({ type: 'CardDrawn', playerId: 1, cardInstanceId: card1.instanceId });
    }
  }
  
  const state: GameState = {
    turn: 1 as TurnNumber,
    phase: 'PLANNING',
    players: [player0, player1],
    locations: createInitialLocations(),
    result: 'IN_PROGRESS',
    nextInstanceId: nextId1,
    cardsDestroyedThisGame: [],
    cardsMovedThisGame: [],
    cardsMovedThisTurn: [],
    silencedCards: [],
    bonusEnergyNextTurn: [0, 0],
  };
  
  // Set energy for turn 1
  const startingEnergy = 1;
  const stateWithEnergy = withPlayer(
    withPlayer(state, 0, { ...player0, energy: startingEnergy, maxEnergy: startingEnergy }),
    1,
    { ...player1, energy: startingEnergy, maxEnergy: startingEnergy }
  );
  
  events.push({ type: 'GameStarted' });
  events.push({ type: 'TurnStarted', turn: 1 as TurnNumber });
  events.push({ type: 'EnergySet', playerId: 0, energy: startingEnergy });
  events.push({ type: 'EnergySet', playerId: 1, energy: startingEnergy });
  
  return { state: stateWithEnergy, events, rng };
}

/**
 * Get a step-by-step iterator for animating resolution.
 * 
 * This allows the UI to execute one step at a time with animation pauses.
 * 
 * @param state - Game state after Phase A (cards placed)
 * @param timeline - Pre-computed resolution timeline
 * @param rng - Seeded RNG
 */
export function createResolutionIterator(
  state: GameState,
  timeline: ResolutionTimeline,
  rng: SeededRNG
) {
  return createStepIterator(state, timeline, rng);
}
