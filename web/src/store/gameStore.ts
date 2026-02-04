/**
 * Game state management using Zustand.
 * 
 * Manages the complete game loop including NPC turns.
 * Uses the DETERMINISTIC ability system for consistent behavior
 * across browser/Firebase/replays.
 * 
 * Turn flow:
 * 1. Player can play multiple cards (each is applied immediately)
 * 2. Player clicks "Reveal Cards" to pass
 * 3. NPC plays all its cards
 * 4. Turn resolves using pre-computed timeline (cards revealed, effects trigger)
 * 5. Next turn starts
 */

import { create } from 'zustand';
import type { GameState, PlayerAction, CardInstance, PlayCardAction } from '@engine/models';
import type { GameEvent } from '@engine/events';
import type { LocationIndex, PlayerId } from '@engine/types';
import {
  createGameWithSeed,
  resolveTurnDeterministic,
  startNextTurn,
  validateAction,
  type DeterministicResolutionResult,
} from '@engine/controller';
import { SeededRNG, generateGameSeed, generateTimestampSeed } from '@engine/rng';
import type { ResolutionTimeline } from '@engine/timeline/types';
import { computeGreedyAction } from '../ai/greedy';
import {
  getPlayer,
  withPlayer,
  withLocation,
  getLocation,
  getTotalPower,
  withEnergy,
  withHand,
  removeFromHand,
  spendEnergy,
  addCard,
} from '@engine/models';
import { getCardDef, createCardInstance, getAllCardDefs } from '@engine/cards';
import type { CardId } from '@engine/types';

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
  /** NPC card instance IDs that have been revealed (for staggered animation) */
  revealedNpcCardIds: Set<number>;
  /** All NPC card IDs that need to be revealed this turn (used to hide them initially) */
  pendingNpcCardIds: Set<number>;
  
  // Deterministic system state
  /** Seeded RNG for deterministic game behavior */
  rng: SeededRNG | null;
  /** Game seed for replay/debugging */
  gameSeed: number | null;
  /** Current resolution timeline (for debugging/replay) */
  currentTimeline: ResolutionTimeline | null;
  
  // Debug state
  /** Persistent debug energy bonus (added each turn) */
  debugEnergyBonus: number;

  // Actions
  initGame: () => void;
  /** Initialize game with a specific seed (for testing/replay) */
  initGameWithSeed: (seed: number) => void;
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
  
  // ==========================================================================
  // Debug Functions (for testing)
  // ==========================================================================
  
  /** Add a specific card to player's hand by card ID (e.g., 'ares', 'zeus') */
  debugAddCardToHand: (cardId: CardId, playerId?: PlayerId) => void;
  /** Replace player's entire hand with specific cards */
  debugSetHand: (cardIds: CardId[], playerId?: PlayerId) => void;
  /** Get all available card IDs for debugging */
  debugGetAllCardIds: () => CardId[];
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
  revealedNpcCardIds: new Set(),
  pendingNpcCardIds: new Set(),
  rng: null,
  gameSeed: null,
  currentTimeline: null,
  debugEnergyBonus: 0,

  initGame: () => {
    // Generate a timestamp-based seed for single-player games
    const seed = generateTimestampSeed();
    get().initGameWithSeed(seed);
  },

  initGameWithSeed: (seed: number) => {
    const { state, events, rng: newRng } = createGameWithSeed(seed);
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
      revealedNpcCardIds: new Set(),
      pendingNpcCardIds: new Set(),
      rng: newRng,
      gameSeed: seed,
      currentTimeline: null,
      debugEnergyBonus: 0, // Reset debug bonus on new game
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
    const { gameState, turnStartState, playerActions, gameSeed } = get();
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

      // Create a deterministic RNG for this turn resolution
      // Seed is based on game seed + turn number for reproducibility
      const turnRng = new SeededRNG(
        generateGameSeed(String(gameSeed ?? 0), turnStartState.turn)
      );

      // Now resolve the turn using the DETERMINISTIC system
      // Process player and NPC actions in pairs
      let resolvedState = turnStartState;
      let allEvents: GameEvent[] = [];
      let lastTimeline: ResolutionTimeline | null = null;

      const maxPlays = Math.max(playerActions.length, npcActions.length);

      for (let i = 0; i < maxPlays; i++) {
        const playerAction: PlayerAction = playerActions[i] ?? { type: 'Pass', playerId: 0 };
        const npcAction: PlayerAction = npcActions[i] ?? { type: 'Pass', playerId: 1 };

        // Use deterministic resolution with pre-computed timeline
        const result: DeterministicResolutionResult = resolveTurnDeterministic(
          resolvedState,
          playerAction,
          npcAction,
          turnRng
        );
        
        resolvedState = result.state;
        allEvents = [...allEvents, ...result.events];
        lastTimeline = result.timeline;
        
        if (!result.success) {
          console.error('Turn resolution failed:', result.error);
        }
      }

      // If no plays at all, still resolve an empty turn
      if (maxPlays === 0) {
        const result: DeterministicResolutionResult = resolveTurnDeterministic(
          resolvedState,
          { type: 'Pass', playerId: 0 },
          { type: 'Pass', playerId: 1 },
          turnRng
        );
        resolvedState = result.state;
        allEvents = [...allEvents, ...result.events];
        lastTimeline = result.timeline;
      }
      
      // Store the timeline for debugging/replay
      set({ currentTimeline: lastTimeline });

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
      
      // Track NPC card IDs for staggered reveal animation
      const npcCardIds = npcActions.map(a => a.cardInstanceId);
      
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
      // Set pendingNpcCardIds so we know which cards are new and need reveal animation
      // Clear revealedNpcCardIds so NPC cards start hidden (will be revealed one by one)
      // NOTE: Don't set powerChangedEvents yet - wait until NPC cards are revealed
      set({
        gameState: preAnimationState,
        events: allEvents,
        playerActions: [],
        powerChangedEvents: [], // Don't trigger buff/debuff animations yet
        cardDestroyedEvents: [],
        currentAnimationIndex: 0,
        currentDestroyAnimationIndex: 0,
        pendingNpcCardIds: new Set(npcCardIds), // Cards that need reveal animation
        revealedNpcCardIds: new Set(), // Start with no NPC cards revealed
      });

      // Reveal NPC cards one by one with staggered animation
      for (const cardId of npcCardIds) {
        await new Promise(resolve => setTimeout(resolve, 400));
        set(state => ({
          revealedNpcCardIds: new Set([...state.revealedNpcCardIds, cardId])
        }));
      }
      
      // Wait for the last card's fly-in animation to complete (spring animation ~500ms)
      if (npcCardIds.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 600));
      }
      
      // Clear pending NPC cards after reveal animation completes
      set({ pendingNpcCardIds: new Set() });

      // NOW trigger buff/debuff animations after all NPC cards are visible
      if (powerChangedEvents.length > 0) {
        set({ powerChangedEvents, currentAnimationIndex: 0 });
        
        // Wait for buff/debuff animations (approx 2.2s per animation)
        const buffAnimationTime = Math.min(powerChangedEvents.length, 3) * 2200 + 500;
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
        
        // Apply debug energy bonus if set
        const { debugEnergyBonus } = get();
        let finalNextState = nextState;
        if (debugEnergyBonus > 0) {
          const player = getPlayer(nextState, 0);
          finalNextState = withPlayer(nextState, 0, withEnergy(player, player.energy + debugEnergyBonus));
        }
        
        set({
          gameState: finalNextState,
          turnStartState: finalNextState,
          events: nextEvents,
          isAnimating: false,
          revealedNpcCardIds: new Set(), // Reset for next turn
          pendingNpcCardIds: new Set(),
        });
      } else {
        // Game is over - show result after animations complete
        set({ isAnimating: false, showGameResult: true, revealedNpcCardIds: new Set(), pendingNpcCardIds: new Set() });
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
    const { gameState, turnStartState, debugEnergyBonus } = get();
    if (!gameState) return;

    const player = getPlayer(gameState, playerId);
    const newGameState = withPlayer(gameState, playerId, withEnergy(player, player.energy + amount));
    
    // Also update turnStartState so changes persist through turn resolution
    let newTurnStartState = turnStartState;
    if (turnStartState) {
      const turnStartPlayer = getPlayer(turnStartState, playerId);
      newTurnStartState = withPlayer(turnStartState, playerId, withEnergy(turnStartPlayer, turnStartPlayer.energy + amount));
    }
    
    // For player 0, also set the persistent debug energy bonus
    const newDebugBonus = playerId === 0 ? debugEnergyBonus + amount : debugEnergyBonus;
    
    set({
      gameState: newGameState,
      turnStartState: newTurnStartState,
      debugEnergyBonus: newDebugBonus,
    });
    
    console.log(`[Debug] Added ${amount} energy. Persistent bonus is now +${newDebugBonus}`);
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

  // ==========================================================================
  // Debug Functions
  // ==========================================================================

  debugAddCardToHand: (cardId: CardId, playerId: PlayerId = 0) => {
    const { gameState, turnStartState } = get();
    if (!gameState) {
      console.warn('[Debug] No game state');
      return;
    }

    const cardDef = getCardDef(cardId);
    if (!cardDef) {
      console.warn(`[Debug] Card not found: ${cardId}`);
      console.log('[Debug] Available cards:', getAllCardDefs().map(c => c.id).join(', '));
      return;
    }

    // Create a new card instance with a unique ID
    const newCard = createCardInstance(cardDef, playerId, gameState.nextInstanceId);
    const player = getPlayer(gameState, playerId);
    const newHand = [...player.hand, newCard];
    
    const newGameState = {
      ...withPlayer(gameState, playerId, withHand(player, newHand)),
      nextInstanceId: gameState.nextInstanceId + 1,
    };

    // Also update turnStartState if it exists (so the card can be played)
    let newTurnStartState = turnStartState;
    if (turnStartState) {
      const turnStartPlayer = getPlayer(turnStartState, playerId);
      const turnStartNewHand = [...turnStartPlayer.hand, newCard];
      newTurnStartState = {
        ...withPlayer(turnStartState, playerId, withHand(turnStartPlayer, turnStartNewHand)),
        nextInstanceId: turnStartState.nextInstanceId + 1,
      };
    }

    set({ 
      gameState: newGameState,
      turnStartState: newTurnStartState,
    });
    console.log(`[Debug] Added ${cardDef.name} (${cardId}) to Player ${playerId}'s hand`);
  },

  debugSetHand: (cardIds: CardId[], playerId: PlayerId = 0) => {
    const { gameState, turnStartState } = get();
    if (!gameState) {
      console.warn('[Debug] No game state');
      return;
    }

    const newCards: CardInstance[] = [];
    let nextId = gameState.nextInstanceId;

    for (const cardId of cardIds) {
      const cardDef = getCardDef(cardId);
      if (!cardDef) {
        console.warn(`[Debug] Card not found: ${cardId}`);
        continue;
      }
      newCards.push(createCardInstance(cardDef, playerId, nextId));
      nextId++;
    }

    const player = getPlayer(gameState, playerId);
    const newGameState = {
      ...withPlayer(gameState, playerId, withHand(player, newCards)),
      nextInstanceId: nextId,
    };

    // Also update turnStartState if it exists
    let newTurnStartState = turnStartState;
    if (turnStartState) {
      const turnStartPlayer = getPlayer(turnStartState, playerId);
      newTurnStartState = {
        ...withPlayer(turnStartState, playerId, withHand(turnStartPlayer, newCards)),
        nextInstanceId: nextId,
      };
    }

    set({ 
      gameState: newGameState,
      turnStartState: newTurnStartState,
    });
    console.log(`[Debug] Set Player ${playerId}'s hand to:`, cardIds);
  },

  debugGetAllCardIds: () => {
    return getAllCardDefs().map(c => c.id);
  },
}));

// =============================================================================
// Debug Console Helpers
// =============================================================================

// Expose debug functions on window for easy console access
if (typeof window !== 'undefined') {
  const debug = {
    /** Add a card to player's hand: debug.addCard('ares') */
    addCard: (cardId: string, playerId: PlayerId = 0) => {
      useGameStore.getState().debugAddCardToHand(cardId, playerId);
    },
    /** Set player's entire hand: debug.setHand(['ares', 'zeus', 'hoplite']) */
    setHand: (cardIds: string[], playerId: PlayerId = 0) => {
      useGameStore.getState().debugSetHand(cardIds, playerId);
    },
    /** Add energy (persists across turns): debug.addEnergy(10) */
    addEnergy: (amount: number, playerId: PlayerId = 0) => {
      useGameStore.getState().addEnergy(playerId, amount);
    },
    /** Reset energy bonus to 0 */
    resetEnergy: () => {
      useGameStore.setState({ debugEnergyBonus: 0 });
      console.log('[Debug] Energy bonus reset to 0');
    },
    /** List all available card IDs */
    listCards: () => {
      const cards = useGameStore.getState().debugGetAllCardIds();
      console.log('Available cards:', cards.join(', '));
      return cards;
    },
    /** Get current game state */
    getState: () => useGameStore.getState().gameState,
    /** Get player's hand */
    getHand: (playerId: PlayerId = 0) => {
      const state = useGameStore.getState().gameState;
      if (!state) return [];
      return getPlayer(state, playerId).hand.map(c => ({
        id: c.cardDef.id,
        name: c.cardDef.name,
        cost: c.cardDef.cost,
        power: c.cardDef.basePower,
        instanceId: c.instanceId,
      }));
    },
    /** Get current debug energy bonus */
    getEnergyBonus: () => {
      const bonus = useGameStore.getState().debugEnergyBonus;
      console.log(`[Debug] Current energy bonus: +${bonus}`);
      return bonus;
    },
    /** Show help */
    help: () => {
      console.log(`
Debug Commands:
  debug.addCard('ares')           - Add Ares to your hand
  debug.addCard('zeus', 1)        - Add Zeus to NPC's hand
  debug.setHand(['ares', 'zeus']) - Replace your hand with specific cards
  debug.addEnergy(10)             - Add 10 energy (persists across turns!)
  debug.resetEnergy()             - Reset energy bonus to 0
  debug.getEnergyBonus()          - Show current energy bonus
  debug.listCards()               - Show all available card IDs
  debug.getHand()                 - Show your current hand
  debug.getState()                - Get the full game state
      `);
    },
  };

  (window as unknown as { debug: typeof debug }).debug = debug;
  console.log('[Debug] Debug tools loaded. Type debug.help() for commands.');
}
