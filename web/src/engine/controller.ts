/**
 * Game Controller - orchestrates game phases
 */

import type {
  GameState,
  PlayerState,
  CardInstance,
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
  updateCard,
  withRevealed,
  findCardByInstance,
  findCardLocation,
  getCards,
  getCardCount,
  getTotalPower,
  addPermanentPower,
  withOngoingPower,
  getAllCards,
  withCardMoved,
  withCardDestroyed,
  removeCard,
  clearTurnTracking,
  getEffectivePower,
  hasMovedCardThisGame,
  hasDestroyedCardThisGame,
  withSilencedCard,
  isSilenced,
  addBonusEnergyNextTurn,
  getBonusEnergyNextTurn,
  clearBonusEnergyNextTurn,
} from './models';
import type { GameEvent } from './events';
import type { PlayerId, LocationIndex, TurnNumber } from './types';
import { MAX_TURNS, LOCATION_CAPACITY, STARTING_HAND_SIZE, MAX_HAND_SIZE, isValidLocationIndex } from './types';
import { getDeckCardDefs, createDeck, shuffleDeckByCost, getCardDef } from './cards';

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
// Turn Resolution
// =============================================================================

export function resolveTurn(
  state: GameState,
  action0: PlayerAction,
  action1: PlayerAction,
): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  let newState = withPhase(state, 'RESOLUTION');

  // Collect cards to reveal
  const playedCards: { card: CardInstance; location: LocationIndex; playerId: PlayerId }[] = [];

  // Process both actions
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

    playedCards.push({ card, location: action.location, playerId: action.playerId });
  }

  // Reveal cards in order (P0 first, then P1)
  playedCards.sort((a, b) => a.playerId - b.playerId);

  for (const { card, location, playerId } of playedCards) {
    const result = revealCard(newState, card, location, playerId);
    newState = result.state;
    events.push(...result.events);
  }

  // Recompute ongoing effects
  const ongoingResult = computeOngoingEffects(newState);
  newState = ongoingResult.state;
  events.push(...ongoingResult.events);

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

  return { state: newState, events };
}

// =============================================================================
// Card Reveal & Effects
// =============================================================================

function revealCard(
  state: GameState,
  card: CardInstance,
  locationIdx: LocationIndex,
  playerId: PlayerId,
): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];

  // Mark card as revealed
  const revealedCard = withRevealed(card, true);
  let location = getLocation(state, locationIdx);
  location = updateCard(location, revealedCard);
  let newState = withLocation(state, locationIdx, location);

  events.push({
    type: 'CardRevealed',
    cardInstanceId: card.instanceId,
    location: locationIdx,
    playerId,
  });

  // Apply ON_REVEAL effects
  if (card.cardDef.abilityType === 'ON_REVEAL') {
    for (const effect of card.cardDef.effects) {
      const result = applyEffect(newState, effect, revealedCard, playerId, locationIdx);
      newState = result.state;
      events.push(...result.events);
    }
  }

  return { state: newState, events };
}

function applyEffect(
  state: GameState,
  effect: import('./effects').Effect,
  sourceCard: CardInstance,
  sourcePlayer: PlayerId,
  sourceLocation: LocationIndex,
): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  let newState = state;

  const resolveTargets = (filter: import('./types').TargetFilter): CardInstance[] => {
    return resolveTargetFilter(newState, filter, sourceCard, sourcePlayer, sourceLocation);
  };

  switch (effect.type) {
    case 'AddPowerEffect': {
      const targets = resolveTargets(effect.target);
      for (const target of targets) {
        const locIdx = findCardLocation(newState, target.instanceId);
        if (locIdx === null) continue;

        const currentTarget = findCardByInstance(newState, target.instanceId);
        if (!currentTarget) continue;

        const oldPower = getEffectivePower(currentTarget);
        const updated = addPermanentPower(currentTarget, effect.amount);
        const newPower = getEffectivePower(updated);

        let loc = getLocation(newState, locIdx);
        loc = updateCard(loc, updated);
        newState = withLocation(newState, locIdx, loc);

        events.push({
          type: 'PowerChanged',
          cardInstanceId: target.instanceId,
          oldPower,
          newPower,
          sourceCardId: sourceCard.instanceId,
        });
      }
      break;
    }

    case 'MoveCardEffect': {
      const targets = resolveTargets(effect.target);
      for (const target of targets) {
        const fromLoc = findCardLocation(newState, target.instanceId);
        if (fromLoc === null) continue;

        // Find destination (first available other location)
        let destLoc: LocationIndex | null = null;
        for (const idx of [0, 1, 2] as LocationIndex[]) {
          if (idx !== fromLoc) {
            const loc = getLocation(newState, idx);
            if (getCardCount(loc, target.owner) < LOCATION_CAPACITY) {
              destLoc = idx;
              break;
            }
          }
        }

        if (destLoc === null) continue;

        // Remove from source
        let sourceLoc = getLocation(newState, fromLoc);
        const [newSourceLoc, removedCard] = removeCard(sourceLoc, target.instanceId);
        if (!removedCard) continue;

        newState = withLocation(newState, fromLoc, newSourceLoc);

        // Add to destination
        let destLocation = getLocation(newState, destLoc);
        destLocation = addCard(destLocation, removedCard, removedCard.owner);
        newState = withLocation(newState, destLoc, destLocation);

        // Track move
        newState = withCardMoved(newState, target.instanceId);

        events.push({
          type: 'CardMoved',
          cardInstanceId: target.instanceId,
          fromLocation: fromLoc,
          toLocation: destLoc,
          sourceCardId: sourceCard.instanceId,
        });
      }
      break;
    }

    case 'DestroyCardEffect': {
      const targets = resolveTargets(effect.target);
      for (const target of targets) {
        const locIdx = findCardLocation(newState, target.instanceId);
        if (locIdx === null) continue;

        let loc = getLocation(newState, locIdx);
        const [newLoc, removed] = removeCard(loc, target.instanceId);
        if (!removed) continue;

        newState = withLocation(newState, locIdx, newLoc);
        newState = withCardDestroyed(newState, target.instanceId);

        events.push({
          type: 'CardDestroyed',
          cardInstanceId: target.instanceId,
          location: locIdx,
          sourceCardId: sourceCard.instanceId,
        });
      }
      break;
    }

    case 'ConditionalPowerEffect': {
      // Check condition
      let conditionMet = false;
      switch (effect.condition) {
        case 'only_card_here': {
          const loc = getLocation(newState, sourceLocation);
          conditionMet = getCardCount(loc, sourcePlayer) === 1;
          break;
        }
        case 'destroyed_this_game':
          conditionMet = hasDestroyedCardThisGame(newState);
          break;
        case 'moved_this_game':
          conditionMet = hasMovedCardThisGame(newState);
          break;
      }

      if (conditionMet) {
        const targets = resolveTargets(effect.target);
        for (const target of targets) {
          const locIdx = findCardLocation(newState, target.instanceId);
          if (locIdx === null) continue;

          const currentTarget = findCardByInstance(newState, target.instanceId);
          if (!currentTarget) continue;

          const oldPower = getEffectivePower(currentTarget);
          const updated = addPermanentPower(currentTarget, effect.amount);
          const newPower = getEffectivePower(updated);

          let loc = getLocation(newState, locIdx);
          loc = updateCard(loc, updated);
          newState = withLocation(newState, locIdx, loc);

          events.push({
            type: 'PowerChanged',
            cardInstanceId: target.instanceId,
            oldPower,
            newPower,
            sourceCardId: sourceCard.instanceId,
          });
        }
      }
      break;
    }

    case 'StealPowerEffect': {
      const targets = resolveTargets(effect.target);
      if (targets.length === 0) break;

      const target = targets[0]!;
      const targetLoc = findCardLocation(newState, target.instanceId);
      if (targetLoc === null) break;

      // Reduce enemy power
      let currentTarget = findCardByInstance(newState, target.instanceId);
      if (!currentTarget) break;

      const oldTargetPower = getEffectivePower(currentTarget);
      const updatedTarget = addPermanentPower(currentTarget, -effect.amount);
      const newTargetPower = getEffectivePower(updatedTarget);

      let loc = getLocation(newState, targetLoc);
      loc = updateCard(loc, updatedTarget);
      newState = withLocation(newState, targetLoc, loc);

      events.push({
        type: 'PowerChanged',
        cardInstanceId: target.instanceId,
        oldPower: oldTargetPower,
        newPower: newTargetPower,
        sourceCardId: sourceCard.instanceId,
      });

      // Increase source power
      const sourceLoc = findCardLocation(newState, sourceCard.instanceId);
      if (sourceLoc !== null) {
        let currentSource = findCardByInstance(newState, sourceCard.instanceId);
        if (currentSource) {
          const oldSourcePower = getEffectivePower(currentSource);
          const updatedSource = addPermanentPower(currentSource, effect.amount);
          const newSourcePower = getEffectivePower(updatedSource);

          let sLoc = getLocation(newState, sourceLoc);
          sLoc = updateCard(sLoc, updatedSource);
          newState = withLocation(newState, sourceLoc, sLoc);

          events.push({
            type: 'PowerChanged',
            cardInstanceId: sourceCard.instanceId,
            oldPower: oldSourcePower,
            newPower: newSourcePower,
            sourceCardId: sourceCard.instanceId,
          });
        }
      }
      break;
    }

    case 'ScalingPowerEffect': {
      const destroyedCount = newState.cardsDestroyedThisGame.length;
      if (destroyedCount === 0) break;

      const bonus = destroyedCount * effect.perDestroyedAmount;
      const targets = resolveTargets(effect.target);

      for (const target of targets) {
        const locIdx = findCardLocation(newState, target.instanceId);
        if (locIdx === null) continue;

        const currentTarget = findCardByInstance(newState, target.instanceId);
        if (!currentTarget) continue;

        const oldPower = getEffectivePower(currentTarget);
        const updated = addPermanentPower(currentTarget, bonus);
        const newPower = getEffectivePower(updated);

        let loc = getLocation(newState, locIdx);
        loc = updateCard(loc, updated);
        newState = withLocation(newState, locIdx, loc);

        events.push({
          type: 'PowerChanged',
          cardInstanceId: target.instanceId,
          oldPower,
          newPower,
          sourceCardId: sourceCard.instanceId,
        });
      }
      break;
    }

    case 'DestroyAndBuffEffect': {
      // First destroy
      const destroyTargets = resolveTargets(effect.destroyTarget);
      if (destroyTargets.length === 0) break;

      const toDestroy = destroyTargets[0]!;
      const destroyLoc = findCardLocation(newState, toDestroy.instanceId);
      if (destroyLoc === null) break;

      let loc = getLocation(newState, destroyLoc);
      const [newLoc, removed] = removeCard(loc, toDestroy.instanceId);
      if (!removed) break;

      newState = withLocation(newState, destroyLoc, newLoc);
      newState = withCardDestroyed(newState, toDestroy.instanceId);

      events.push({
        type: 'CardDestroyed',
        cardInstanceId: toDestroy.instanceId,
        location: destroyLoc,
        sourceCardId: sourceCard.instanceId,
      });

      // Then buff
      const buffTargets = resolveTargetFilter(newState, effect.buffTarget, sourceCard, sourcePlayer, sourceLocation);
      if (buffTargets.length > 0) {
        const target = buffTargets[0]!;
        const targetLoc = findCardLocation(newState, target.instanceId);
        if (targetLoc !== null) {
          const currentTarget = findCardByInstance(newState, target.instanceId);
          if (currentTarget) {
            const oldPower = getEffectivePower(currentTarget);
            const updated = addPermanentPower(currentTarget, effect.buffAmount);
            const newPower = getEffectivePower(updated);

            let tLoc = getLocation(newState, targetLoc);
            tLoc = updateCard(tLoc, updated);
            newState = withLocation(newState, targetLoc, tLoc);

            events.push({
              type: 'PowerChanged',
              cardInstanceId: target.instanceId,
              oldPower,
              newPower,
              sourceCardId: sourceCard.instanceId,
            });
          }
        }
      }
      break;
    }

    case 'ReviveEffect': {
      // Summon spirit if cards destroyed
      if (newState.cardsDestroyedThisGame.length === 0) break;

      const loc = getLocation(newState, sourceLocation);
      if (getCardCount(loc, sourcePlayer) >= LOCATION_CAPACITY) break;

      // Create spirit (use shade as template)
      const spiritDef = getCardDef('shade');
      if (!spiritDef) break;

      const spiritPower = 2 + newState.cardsDestroyedThisGame.length;
      const spirit: CardInstance = {
        instanceId: newState.nextInstanceId,
        cardDef: spiritDef,
        owner: sourcePlayer,
        permanentPowerModifier: spiritPower,
        ongoingPowerModifier: 0,
        revealed: true,
      };

      const newLoc = addCard(loc, spirit, sourcePlayer);
      newState = withLocation(newState, sourceLocation, newLoc);
      newState = { ...newState, nextInstanceId: newState.nextInstanceId + 1 };
      break;
    }

    case 'AddEnergyNextTurnEffect': {
      // Add bonus energy for the next turn
      newState = addBonusEnergyNextTurn(newState, sourcePlayer, effect.amount);
      events.push({
        type: 'BonusEnergy',
        playerId: sourcePlayer,
        bonus: effect.amount,
        locationsWon: 0, // Not from locations, from card effect
        newTotal: getBonusEnergyNextTurn(newState, sourcePlayer),
      });
      break;
    }
  }

  return { state: newState, events };
}

// =============================================================================
// Target Resolution
// =============================================================================

function resolveTargetFilter(
  state: GameState,
  filter: import('./types').TargetFilter,
  sourceCard: CardInstance,
  sourcePlayer: PlayerId,
  sourceLocation: LocationIndex,
): CardInstance[] {
  const enemyPlayer = (1 - sourcePlayer) as PlayerId;

  switch (filter) {
    case 'SELF':
      return [sourceCard];

    case 'SAME_LOCATION_FRIENDLY': {
      const loc = getLocation(state, sourceLocation);
      return getCards(loc, sourcePlayer).filter(c => c.instanceId !== sourceCard.instanceId);
    }

    case 'SAME_LOCATION_ENEMY': {
      const loc = getLocation(state, sourceLocation);
      return [...getCards(loc, enemyPlayer)];
    }

    case 'ONE_SAME_LOCATION_FRIENDLY': {
      const loc = getLocation(state, sourceLocation);
      const cards = getCards(loc, sourcePlayer).filter(c => c.instanceId !== sourceCard.instanceId);
      return cards.length > 0 ? [cards[0]!] : [];
    }

    case 'ONE_SAME_LOCATION_ENEMY': {
      const loc = getLocation(state, sourceLocation);
      const cards = getCards(loc, enemyPlayer);
      return cards.length > 0 ? [cards[0]!] : [];
    }

    case 'ALL_FRIENDLY': {
      const result: CardInstance[] = [];
      for (const loc of state.locations) {
        result.push(...getCards(loc, sourcePlayer).filter(c => c.instanceId !== sourceCard.instanceId));
      }
      return result;
    }

    case 'ALL_ENEMY': {
      const result: CardInstance[] = [];
      for (const loc of state.locations) {
        result.push(...getCards(loc, enemyPlayer));
      }
      return result;
    }

    default:
      return [];
  }
}

// =============================================================================
// Ongoing Effects
// =============================================================================

function computeOngoingEffects(state: GameState): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  let newState = state;

  // Reset all ongoing power modifiers
  for (let locIdx = 0; locIdx < 3; locIdx++) {
    let loc = getLocation(newState, locIdx as LocationIndex);
    const newCardsByPlayer: [readonly CardInstance[], readonly CardInstance[]] = [
      loc.cardsByPlayer[0].map(c => withOngoingPower(c, 0)),
      loc.cardsByPlayer[1].map(c => withOngoingPower(c, 0)),
    ];
    loc = { ...loc, cardsByPlayer: newCardsByPlayer };
    newState = withLocation(newState, locIdx as LocationIndex, loc);
  }

  // Clear silenced cards
  newState = { ...newState, silencedCards: [] };

  // First pass: apply silence effects
  for (const location of newState.locations) {
    for (const card of getAllCards(location)) {
      if (!card.revealed || card.cardDef.abilityType !== 'ONGOING') continue;

      for (const effect of card.cardDef.effects) {
        if (effect.type === 'SilenceOngoingEffect') {
          const enemyPlayer = (1 - card.owner) as PlayerId;
          const targets = getCards(location, enemyPlayer);
          for (const target of targets) {
            newState = withSilencedCard(newState, target.instanceId);
          }
        }
      }
    }
  }

  // Second pass: apply ongoing power effects
  for (const location of newState.locations) {
    for (const card of getAllCards(location)) {
      if (!card.revealed || card.cardDef.abilityType !== 'ONGOING') continue;
      if (isSilenced(newState, card.instanceId)) continue;

      for (const effect of card.cardDef.effects) {
        if (effect.type === 'AddOngoingPowerEffect') {
          const targets = resolveTargetFilter(newState, effect.target, card, card.owner, location.index);
          for (const target of targets) {
            const locIdx = findCardLocation(newState, target.instanceId);
            if (locIdx === null) continue;

            const current = findCardByInstance(newState, target.instanceId);
            if (!current) continue;

            const updated = withOngoingPower(current, current.ongoingPowerModifier + effect.amount);
            let loc = getLocation(newState, locIdx);
            loc = updateCard(loc, updated);
            newState = withLocation(newState, locIdx, loc);
          }
        } else if (effect.type === 'ConditionalOngoingPowerEffect') {
          // Check condition (location_full)
          const loc = getLocation(newState, location.index);
          if (getCardCount(loc, card.owner) < LOCATION_CAPACITY) continue;

          const targets = resolveTargetFilter(newState, effect.target, card, card.owner, location.index);
          for (const target of targets) {
            const locIdx = findCardLocation(newState, target.instanceId);
            if (locIdx === null) continue;

            const current = findCardByInstance(newState, target.instanceId);
            if (!current) continue;

            const updated = withOngoingPower(current, current.ongoingPowerModifier + effect.amount);
            let tLoc = getLocation(newState, locIdx);
            tLoc = updateCard(tLoc, updated);
            newState = withLocation(newState, locIdx, tLoc);
          }
        } else if (effect.type === 'ScalingOngoingPowerEffect') {
          const countCards = resolveTargetFilter(newState, effect.countFilter, card, card.owner, location.index);
          const bonus = countCards.length * effect.perCardAmount;

          if (bonus === 0) continue;

          const targets = resolveTargetFilter(newState, effect.target, card, card.owner, location.index);
          for (const target of targets) {
            const locIdx = findCardLocation(newState, target.instanceId);
            if (locIdx === null) continue;

            const current = findCardByInstance(newState, target.instanceId);
            if (!current) continue;

            const updated = withOngoingPower(current, current.ongoingPowerModifier + bonus);
            let tLoc = getLocation(newState, locIdx);
            tLoc = updateCard(tLoc, updated);
            newState = withLocation(newState, locIdx, tLoc);
          }
        }
      }
    }
  }

  return { state: newState, events };
}

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
