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
import type { LocationIndex } from '@engine/types';
import { createGame, resolveTurn, startNextTurn, validateAction } from '@engine/controller';
import { computeGreedyAction } from '../ai/greedy';
import {
  getPlayer,
  withPlayer,
  withLocation,
  getLocation,
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
  isAnimating: boolean;
  isNpcThinking: boolean;
  
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
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: null,
  turnStartState: null,
  playerActions: [],
  events: [],
  isAnimating: false,
  isNpcThinking: false,

  initGame: () => {
    const { state, events } = createGame();
    set({ 
      gameState: state,
      turnStartState: state,
      playerActions: [],
      events,
      isAnimating: false,
      isNpcThinking: false,
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
      
      set({ 
        gameState: resolvedState, 
        events: allEvents,
        playerActions: [],
      });
      
      // Small delay for animations
      await new Promise(resolve => setTimeout(resolve, 800));
      
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
        set({ isAnimating: false });
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
}));
