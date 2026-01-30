/**
 * Game state management using Zustand.
 * 
 * Manages the complete game loop including NPC turns.
 * 
 * Turn flow:
 * 1. Player can play multiple cards (each is applied immediately)
 * 2. Player clicks "Reveal Cards" to pass
 * 3. NPC plays all its cards
 * 4. Turn resolves (cards revealed, effects trigger)
 * 5. Next turn starts
 */

import { create } from 'zustand';
import type { GameState, PlayerAction, CardInstance, PlayCardAction } from '@engine/models';
import type { GameEvent } from '@engine/events';
import type { LocationIndex, PlayerId } from '@engine/types';
import { createGame, resolveTurn, startNextTurn, validateAction } from '@engine/controller';
import { computeGreedyAction } from '../ai/greedy';
import {
  getPlayer,
  withPlayer,
  withLocation,
  getLocation,
  getTotalPower,
  withEnergy,
  removeFromHand,
  spendEnergy,
  addCard,
} from '@engine/models';

/**
 * Apply a card play immediately to the game state.
 * This is used for both player plays (during planning) and when resolving the turn.
 */
function applyCardPlay(
  state: GameState,
  action: PlayCardAction
): GameState {
  const { playerId, cardInstanceId, location: locationIndex } = action;
  const player = getPlayer(state, playerId);

  // Remove card from hand
  const [playerWithoutCard, card] = removeFromHand(player, cardInstanceId);
  if (!card) return state;

  // Spend energy
  const playerSpent = spendEnergy(playerWithoutCard, card.cardDef.cost);
  let newState = withPlayer(state, playerId, playerSpent);

  // Add card to location (unrevealed for player, revealed depends on context)
  const playedCard: CardInstance = {
    ...card,
    revealed: playerId === 0, // Player cards shown immediately, NPC hidden until reveal
  };

  const location = getLocation(newState, locationIndex);
  const newLocation = addCard(location, playedCard, playerId);
  newState = withLocation(newState, locationIndex, newLocation);

  return newState;
}

interface GameStore {
  // State
  gameState: GameState | null;
  /** State before any player actions this turn (used for NPC decisions and turn resolution) */
  turnStartState: GameState | null;
  /** Actions the player has taken this turn */
  playerActions: PlayCardAction[];
  events: GameEvent[];
  /** PowerChanged events to animate - filtered from all events */
  powerChangedEvents: GameEvent[];
  /** CardDestroyed events to animate */
  cardDestroyedEvents: GameEvent[];
  /** Current index for sequentially playing animations */
  currentAnimationIndex: number;
  /** Current index for destruction animations */
  currentDestroyAnimationIndex: number;
  isAnimating: boolean;
  isNpcThinking: boolean;
  /** Location winners for end-game animation */
  locationWinners: readonly (PlayerId | null)[] | null;
  /** Whether to show the game result (delayed until animations complete) */
  showGameResult: boolean;

  // Actions
  initGame: () => void;
  /** Play a card from hand to location (doesn't end the turn) */
  playCard: (cardInstanceId: number, location: LocationIndex) => void;
  /** Move a pending card to a new location, or return to hand (null) */
  moveCard: (cardInstanceId: number, newLocation: LocationIndex | null) => void;
  /** Check if a card is pending (played this turn, can be moved) */
  isPendingCard: (cardInstanceId: number) => boolean;
  /** End the turn - triggers NPC plays and resolution */
  endTurn: () => Promise<void>;
  setAnimating: (isAnimating: boolean) => void;
  /** Advance to next animation */
  nextAnimation: () => void;
  /** Advance to next destroy animation */
  nextDestroyAnimation: () => void;
  /** Clear all pending animations */
  clearAnimations: () => void;
  /** Clear location winners after animation */
  clearLocationWinners: () => void;
  /** Add energy to a player */
  addEnergy: (playerId: PlayerId, amount: number) => void;
  /** Retreat from the game (concede) */
  retreat: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: null,
  turnStartState: null,
  playerActions: [],
  events: [],
  powerChangedEvents: [],
  cardDestroyedEvents: [],
  currentAnimationIndex: 0,
  currentDestroyAnimationIndex: 0,
  isAnimating: false,
  isNpcThinking: false,
  locationWinners: null,
  showGameResult: false,

  initGame: () => {
    const { state, events } = createGame();
    set({
      gameState: state,
      turnStartState: state,
      playerActions: [],
      events,
      powerChangedEvents: [],
      cardDestroyedEvents: [],
      currentAnimationIndex: 0,
      currentDestroyAnimationIndex: 0,
      isAnimating: false,
      isNpcThinking: false,
      locationWinners: null,
      showGameResult: false,
    });
  },

  playCard: (cardInstanceId: number, location: LocationIndex) => {
    const { gameState, playerActions } = get();
    if (!gameState) return;
    if (gameState.result !== 'IN_PROGRESS') return;

    const action: PlayCardAction = {
      type: 'PlayCard',
      playerId: 0,
      cardInstanceId,
      location,
    };

    // Validate the action
    const validation = validateAction(gameState, action);
    if (!validation.valid) {
      console.warn('Invalid action:', validation.reason);
      return;
    }

    // Apply the card play immediately
    const newState = applyCardPlay(gameState, action);

    set({
      gameState: newState,
      playerActions: [...playerActions, action],
    });
  },

  moveCard: (cardInstanceId: number, newLocation: LocationIndex | null) => {
    const { turnStartState, playerActions } = get();
    if (!turnStartState) return;

    // Find the action for this card
    const actionIndex = playerActions.findIndex(a => a.cardInstanceId === cardInstanceId);
    if (actionIndex === -1) return; // Card not found in pending actions

    let newActions: PlayCardAction[];

    if (newLocation === null) {
      // Return to hand - remove the action entirely
      newActions = [
        ...playerActions.slice(0, actionIndex),
        ...playerActions.slice(actionIndex + 1),
      ];
    } else {
      // Move to new location - update the action
      const updatedAction: PlayCardAction = {
        ...playerActions[actionIndex],
        location: newLocation,
      };
      newActions = [
        ...playerActions.slice(0, actionIndex),
        updatedAction,
        ...playerActions.slice(actionIndex + 1),
      ];
    }

    // Rebuild state from turnStartState by replaying updated actions
    let newState = turnStartState;
    for (const action of newActions) {
      newState = applyCardPlay(newState, action);
    }

    set({
      gameState: newState,
      playerActions: newActions,
    });
  },

  isPendingCard: (cardInstanceId: number) => {
    const { playerActions } = get();
    return playerActions.some(a => a.cardInstanceId === cardInstanceId);
  },

  endTurn: async () => {
    const { gameState, turnStartState, playerActions } = get();
    if (!gameState || !turnStartState) return;
    if (gameState.result !== 'IN_PROGRESS') return;

    set({ isNpcThinking: true });

    try {
      // Let NPC make its decisions based on the turn start state
      // NPC plays multiple cards until it passes
      const npcActions: PlayCardAction[] = [];
      let npcState = turnStartState;

      // Small delay before NPC starts "thinking"
      await new Promise(resolve => setTimeout(resolve, 300));

      // NPC plays cards until it passes
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const npcAction = computeGreedyAction(npcState, 1);
        if (npcAction.type === 'Pass') break;

        // Validate and apply NPC action
        const validation = validateAction(npcState, npcAction);
        if (!validation.valid) break;

        npcActions.push(npcAction);
        npcState = applyCardPlay(npcState, npcAction);

        // Small delay between NPC plays for visual effect
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      set({ isNpcThinking: false, isAnimating: true });

      // Now resolve the turn using the original turn start state
      // Process player and NPC actions in pairs
      let resolvedState = turnStartState;
      let allEvents: GameEvent[] = [];

      const maxPlays = Math.max(playerActions.length, npcActions.length);

      for (let i = 0; i < maxPlays; i++) {
        const playerAction: PlayerAction = playerActions[i] ?? { type: 'Pass', playerId: 0 };
        const npcAction: PlayerAction = npcActions[i] ?? { type: 'Pass', playerId: 1 };

        const { state: newState, events } = resolveTurn(resolvedState, playerAction, npcAction);
        resolvedState = newState;
        allEvents = [...allEvents, ...events];
      }

      // If no plays at all, still resolve an empty turn
      if (maxPlays === 0) {
        const { state: newState, events } = resolveTurn(
          resolvedState,
          { type: 'Pass', playerId: 0 },
          { type: 'Pass', playerId: 1 }
        );
        resolvedState = newState;
        allEvents = [...allEvents, ...events];
      }

      // Filter out PowerChanged events that target different cards (buff/debuff effects)
      const powerChangedEvents = allEvents.filter(
        (e): e is GameEvent & { type: 'PowerChanged' } =>
          e.type === 'PowerChanged' &&
          'sourceCardId' in e &&
          'cardInstanceId' in e &&
          (e as { sourceCardId: number; cardInstanceId: number }).sourceCardId !==
          (e as { sourceCardId: number; cardInstanceId: number }).cardInstanceId
      );

      // Filter CardDestroyed events
      const cardDestroyedEvents = allEvents.filter(
        (e): e is GameEvent & { type: 'CardDestroyed' } => e.type === 'CardDestroyed'
      );

      // Calculate current location winners for animation
      const currentLocationWinners = resolvedState.locations.map(loc => {
        const p0 = getTotalPower(loc, 0);
        const p1 = getTotalPower(loc, 1);
        if (p0 > p1) return 0 as PlayerId;
        if (p1 > p0) return 1 as PlayerId;
        return null;
      });

      // Build a pre-animation state that shows ALL cards (including NPC's) revealed
      // This is needed so the animation can find both source and target cards in the DOM
      // We start from turnStartState and add all played cards with revealed=true
      let preAnimationState = turnStartState;
      
      // Apply all player actions with revealed=true
      for (const action of playerActions) {
        const player = getPlayer(preAnimationState, action.playerId);
        const [playerWithoutCard, card] = removeFromHand(player, action.cardInstanceId);
        if (!card) continue;
        
        const playerSpent = spendEnergy(playerWithoutCard, card.cardDef.cost);
        preAnimationState = withPlayer(preAnimationState, action.playerId, playerSpent);
        
        const playedCard: CardInstance = { ...card, revealed: true };
        const location = getLocation(preAnimationState, action.location);
        const newLocation = addCard(location, playedCard, action.playerId);
        preAnimationState = withLocation(preAnimationState, action.location, newLocation);
      }
      
      // Apply all NPC actions with revealed=true
      for (const action of npcActions) {
        const player = getPlayer(preAnimationState, action.playerId);
        const [playerWithoutCard, card] = removeFromHand(player, action.cardInstanceId);
        if (!card) continue;
        
        const playerSpent = spendEnergy(playerWithoutCard, card.cardDef.cost);
        preAnimationState = withPlayer(preAnimationState, action.playerId, playerSpent);
        
        const playedCard: CardInstance = { ...card, revealed: true };
        const location = getLocation(preAnimationState, action.location);
        const newLocation = addCard(location, playedCard, action.playerId);
        preAnimationState = withLocation(preAnimationState, action.location, newLocation);
      }

      // FIRST: Update gameState to show ALL cards (including NPC's) before animations
      // This ensures the animation can find both source and target cards in the DOM
      set({
        gameState: preAnimationState,
        events: allEvents,
        playerActions: [],
        powerChangedEvents,
        cardDestroyedEvents: [],
        currentAnimationIndex: 0,
        currentDestroyAnimationIndex: 0,
      });

      // Wait for buff/debuff animations (approx 2.2s per animation)
      const buffAnimationTime = Math.min(powerChangedEvents.length, 3) * 2200 + 500;
      if (powerChangedEvents.length > 0) {
        await new Promise(resolve => setTimeout(resolve, buffAnimationTime));
      }

      // SECOND: Show destruction animations BEFORE removing cards from state
      if (cardDestroyedEvents.length > 0) {
        console.log('[GameStore] Triggering destruction animations (cards still visible):', cardDestroyedEvents);
        set({ cardDestroyedEvents, currentDestroyAnimationIndex: 0 });
        
        // Small delay to let React re-render with the new events
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Wait for destruction animations (approx 8s per destruction - DEBUG MODE)
        const destroyAnimationTime = Math.min(cardDestroyedEvents.length, 3) * 500 + 100;
        console.log('[GameStore] Waiting for destruction animation:', destroyAnimationTime, 'ms');
        await new Promise(resolve => setTimeout(resolve, destroyAnimationTime));
      }

      // THIRD: NOW update the game state (cards move and disappear)
      set({
        gameState: resolvedState,
        cardDestroyedEvents: [], // Clear destruction events
      });

      // Wait for move animations to complete (they are triggered by the state change and handled by layoutId)
      const moveEvents = allEvents.filter(e => e.type === 'CardMoved');
      if (moveEvents.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 800)); // EVENT_ANIMATIONS.CardMoved is 0.7s
      }

      // NOW trigger point animations
      set({ locationWinners: currentLocationWinners });

      // Wait for point animations to complete
      const pointAnimationTime = 1500;
      await new Promise(resolve => setTimeout(resolve, pointAnimationTime));

      // If game is still in progress, start next turn
      if (resolvedState.result === 'IN_PROGRESS') {
        const { state: nextState, events: nextEvents } = startNextTurn(resolvedState);
        set({
          gameState: nextState,
          turnStartState: nextState,
          events: nextEvents,
          isAnimating: false,
        });
      } else {
        // Game is over - show result after animations complete
        set({ isAnimating: false, showGameResult: true });
      }
    } catch (error) {
      console.error('Error during turn resolution:', error);
      set({
        isNpcThinking: false,
        isAnimating: false,
      });
    }
  },

  setAnimating: (isAnimating: boolean) => {
    set({ isAnimating });
  },

  nextAnimation: () => {
    const { currentAnimationIndex, powerChangedEvents } = get();
    if (currentAnimationIndex < powerChangedEvents.length - 1) {
      set({ currentAnimationIndex: currentAnimationIndex + 1 });
    } else {
      // All animations complete
      set({ powerChangedEvents: [], currentAnimationIndex: 0 });
    }
  },

  nextDestroyAnimation: () => {
    const { currentDestroyAnimationIndex, cardDestroyedEvents } = get();
    if (currentDestroyAnimationIndex < cardDestroyedEvents.length - 1) {
      set({ currentDestroyAnimationIndex: currentDestroyAnimationIndex + 1 });
    } else {
      // All destroy animations complete
      set({ cardDestroyedEvents: [], currentDestroyAnimationIndex: 0 });
    }
  },

  clearAnimations: () => {
    set({ 
      powerChangedEvents: [], 
      currentAnimationIndex: 0,
      cardDestroyedEvents: [],
      currentDestroyAnimationIndex: 0,
    });
  },

  clearLocationWinners: () => {
    set({ locationWinners: null });
  },

  addEnergy: (playerId: PlayerId, amount: number) => {
    const { gameState } = get();
    if (!gameState) return;

    const player = getPlayer(gameState, playerId);
    set({
      gameState: withPlayer(gameState, playerId, withEnergy(player, player.energy + amount)),
    });
  },

  retreat: () => {
    const { gameState } = get();
    if (!gameState || gameState.result !== 'IN_PROGRESS') return;

    set({
      gameState: {
        ...gameState,
        result: 'PLAYER_1_WINS',
      },
      isAnimating: false,
      isNpcThinking: false,
      showGameResult: true,
    });
  },
}));
