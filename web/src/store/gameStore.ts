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
  startNextTurnWithSimpleDraw,
  validateAction,
  computeWinner,
  type DeterministicResolutionResult,
} from '@engine/controller';
import { withResult } from '@engine/models';
import {
  createTutorialGameState,
  getScriptedNpcActions,
  TUTORIAL_MAX_TURNS,
  TUTORIAL_SEED,
} from '../tutorial/TutorialMatch';
import { useTutorialStore } from '../tutorial/tutorialStore';
import { SeededRNG, generateGameSeed, generateTimestampSeed } from '@engine/rng';
import type { ResolutionTimeline } from '@engine/timeline/types';
import { computeGreedyAction, getDifficultyForPosition } from '../ai/greedy';
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
import { usePlayerStore } from './playerStore';

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
  /** Location winners for end-game animation (UI-only state, do NOT use for game logic) */
  animationLocationWinners: readonly (PlayerId | null)[] | null;
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

  // Game rewards
  /** Credits earned from the last completed game */
  lastGameCredits: number | null;
  /** Whether the last game was a perfect win */
  lastGamePerfectWin: boolean;

  // Actions
  initGame: () => void;
  /** Initialize game with a specific seed (for testing/replay) */
  initGameWithSeed: (seed: number, playerDeckIds?: CardId[], unlockPosition?: number) => void;
  /** Initialize the scripted tutorial match (fixed hands, 4 turns) */
  initTutorialGame: () => void;
  /** Play a card from hand to location (doesn't end the turn) */
  playCard: (cardInstanceId: number, location: LocationIndex) => void;
  /** Move a pending card to a new location, or return to hand (null) */
  moveCard: (cardInstanceId: number, newLocation: LocationIndex | null) => void;
  /** Check if a card is pending (played this turn, can be moved) */
  isPendingCard: (cardInstanceId: number) => boolean;
  /** End the turn - triggers NPC plays and resolution. Pass { isTutorial: true } when in tutorial. */
  endTurn: (options?: { isTutorial?: boolean }) => Promise<void>;
  setAnimating: (isAnimating: boolean) => void;
  /** Advance to next animation */
  nextAnimation: () => void;
  /** Advance to next destroy animation */
  nextDestroyAnimation: () => void;
  /** Clear all pending animations */
  clearAnimations: () => void;
  /** Clear animation location winners after animation completes */
  clearAnimationLocationWinners: () => void;
  /** Add energy to a player */
  addEnergy: (playerId: PlayerId, amount: number) => void;
  /** Retreat from the game (concede) - no credits awarded */
  retreat: () => Promise<void>;
  /** Process game end and award credits - uses deterministic computeWinner for correctness */
  processGameEnd: () => Promise<void>;
  
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
  animationLocationWinners: null,
  showGameResult: false,
  revealedNpcCardIds: new Set(),
  pendingNpcCardIds: new Set(),
  rng: null,
  gameSeed: null,
  currentTimeline: null,
  debugEnergyBonus: 0,
  lastGameCredits: null,
  lastGamePerfectWin: false,

  initGame: () => {
    // Generate a timestamp-based seed for single-player games
    const seed = generateTimestampSeed();
    
    // Get the player's deck and progression from playerStore
    const playerProfile = usePlayerStore.getState().profile;
    const playerDeckIds = playerProfile?.currentDeckIds;
    const unlockPosition = playerProfile?.unlockPathPosition ?? 0;
    
    get().initGameWithSeed(seed, playerDeckIds, unlockPosition);
  },

  initGameWithSeed: (seed: number, playerDeckIds?: CardId[], unlockPosition: number = 0) => {
    const { state, events, rng: newRng } = createGameWithSeed(seed, playerDeckIds, unlockPosition);
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
      animationLocationWinners: null,
      showGameResult: false,
      revealedNpcCardIds: new Set(),
      pendingNpcCardIds: new Set(),
      rng: newRng,
      gameSeed: seed,
      currentTimeline: null,
      debugEnergyBonus: 0, // Reset debug bonus on new game
      lastGameCredits: null,
      lastGamePerfectWin: false,
    });
  },

  initTutorialGame: () => {
    const state = createTutorialGameState();
    set({
      gameState: state,
      turnStartState: state,
      playerActions: [],
      events: [],
      powerChangedEvents: [],
      cardDestroyedEvents: [],
      currentAnimationIndex: 0,
      currentDestroyAnimationIndex: 0,
      isAnimating: false,
      isNpcThinking: false,
      animationLocationWinners: null,
      showGameResult: false,
      revealedNpcCardIds: new Set(),
      pendingNpcCardIds: new Set(),
      rng: null,
      gameSeed: null,
      currentTimeline: null,
      debugEnergyBonus: 0,
      lastGameCredits: null,
      lastGamePerfectWin: false,
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

  endTurn: async (options?: { isTutorial?: boolean }) => {
    const { gameState, turnStartState, playerActions, gameSeed } = get();
    if (!gameState || !turnStartState) return;
    if (gameState.result !== 'IN_PROGRESS') return;

    const isTutorial = options?.isTutorial ?? false;
    set({ isNpcThinking: true });

    try {
      let npcActions: PlayCardAction[];

      let npcActionsForResolution: PlayerAction[];
      npcActions = [];
      if (isTutorial) {
        npcActionsForResolution = getScriptedNpcActions(turnStartState);
        npcActions = npcActionsForResolution.filter((a): a is PlayCardAction => a.type === 'PlayCard');
      } else {
        const playerProfile = usePlayerStore.getState().profile;
        const unlockPosition = playerProfile?.unlockPathPosition ?? 0;
        const difficulty = getDifficultyForPosition(unlockPosition);
        npcActions = [];
        let npcState = turnStartState;
        await new Promise(resolve => setTimeout(resolve, 300));
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const npcAction = computeGreedyAction(npcState, 1, difficulty);
          if (npcAction.type === 'Pass') break;
          const validation = validateAction(npcState, npcAction);
          if (!validation.valid) break;
          npcActions.push(npcAction);
          npcState = applyCardPlay(npcState, npcAction);
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        npcActionsForResolution = npcActions;
      }

      set({ isNpcThinking: false, isAnimating: true });

      const turnRng = new SeededRNG(
        isTutorial
          ? generateGameSeed(String(TUTORIAL_SEED), turnStartState.turn)
          : generateGameSeed(String(gameSeed ?? 0), turnStartState.turn)
      );

      // Now resolve the turn using the DETERMINISTIC system
      // Process player and NPC actions in pairs
      let resolvedState = turnStartState;
      let allEvents: GameEvent[] = [];
      let lastTimeline: ResolutionTimeline | null = null;

      const maxPlays = Math.max(playerActions.length, npcActionsForResolution.length);

      for (let i = 0; i < maxPlays; i++) {
        const playerAction: PlayerAction = playerActions[i] ?? { type: 'Pass', playerId: 0 };
        const npcAction: PlayerAction = npcActionsForResolution[i] ?? { type: 'Pass', playerId: 1 };

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

      // NOW trigger point animations (UI-only state)
      set({ animationLocationWinners: currentLocationWinners });

      // Wait for point animations to complete
      const pointAnimationTime = 1500;
      await new Promise(resolve => setTimeout(resolve, pointAnimationTime));

      // If game is still in progress, start next turn (or end tutorial at 4 turns)
      const tutorialGameOver = isTutorial && resolvedState.turn >= TUTORIAL_MAX_TURNS;
      const shouldEndGame = resolvedState.result !== 'IN_PROGRESS' || tutorialGameOver;

      if (shouldEndGame) {
        const finalState = tutorialGameOver
          ? withResult(resolvedState, computeWinner(resolvedState).result)
          : resolvedState;
        if (isTutorial) {
          useTutorialStore.getState().advanceStep();
        }
        set({
          gameState: finalState,
          isAnimating: false,
          revealedNpcCardIds: new Set(),
          pendingNpcCardIds: new Set(),
        });
        if (!isTutorial) {
          await get().processGameEnd();
        }
        set({ showGameResult: true });
      } else {
        const { state: nextState, events: nextEvents } = isTutorial
          ? startNextTurnWithSimpleDraw(resolvedState)
          : startNextTurn(resolvedState);

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
          revealedNpcCardIds: new Set(),
          pendingNpcCardIds: new Set(),
        });
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

  clearAnimationLocationWinners: () => {
    set({ animationLocationWinners: null });
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

  retreat: async () => {
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
      lastGameCredits: null, // No credits for retreat
      lastGamePerfectWin: false,
    });

    // Update stats only (no credits for retreating)
    const playerStore = usePlayerStore.getState();
    if (playerStore.profile) {
      await playerStore.updateGameStats(false, false);
      console.log('[GameStore] Player retreated - stats updated, no credits awarded');
    }
  },

  processGameEnd: async () => {
    const { gameState } = get();
    if (!gameState || gameState.result === 'IN_PROGRESS') return;

    // Use deterministic engine function to compute winner and location state
    // This avoids race conditions with animation state and ensures correctness
    const { result, locationWinners } = computeWinner(gameState);

    // Determine if player won
    const playerWon = result === 'PLAYER_0_WINS';
    
    // Check for perfect win (all 3 locations won by player)
    const isPerfectWin = playerWon && locationWinners.every(winner => winner === 0);

    // Award credits through player store
    const playerStore = usePlayerStore.getState();
    if (playerStore.profile) {
      const credits = await playerStore.awardGameCredits(playerWon, isPerfectWin);
      await playerStore.updateGameStats(playerWon, isPerfectWin);

      set({
        lastGameCredits: credits,
        lastGamePerfectWin: isPerfectWin,
      });

      console.log(`[GameStore] Game ended. Won: ${playerWon}, Perfect: ${isPerfectWin}, Credits: ${credits}`);
    }
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
    /** Add credits to player */
    addCredits: async (amount: number) => {
      await usePlayerStore.getState().addCredits(amount);
      const profile = usePlayerStore.getState().profile;
      console.log(`[Debug] Added ${amount} credits. Total: ${profile?.credits ?? 0}`);
    },
    /** Get player profile */
    getProfile: () => {
      const profile = usePlayerStore.getState().profile;
      console.log('[Debug] Player profile:', profile);
      return profile;
    },
    /** Reset all - clears player profile (unlocks, credits, stats) and starts fresh */
    resetAll: async () => {
      // Import dynamically to avoid circular dependencies
      const { getDefaultStarterDeck } = await import('@engine/starterDeck');
      const starterDeck = getDefaultStarterDeck();
      
      // Reset player profile
      await usePlayerStore.getState().resetProfile(starterDeck);
      
      // Reset game state
      useGameStore.setState({
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
        animationLocationWinners: null,
        showGameResult: false,
        revealedNpcCardIds: new Set(),
        pendingNpcCardIds: new Set(),
        rng: null,
        gameSeed: null,
        currentTimeline: null,
        debugEnergyBonus: 0,
        lastGameCredits: null,
        lastGamePerfectWin: false,
      });
      
      console.log('[Debug] All data reset! Player profile and game state cleared.');
      console.log('[Debug] Refresh the page to start fresh.');
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
  debug.addCredits(100)           - Add 100 credits to player
  debug.getProfile()              - Show player profile (credits, unlocks, etc.)
  debug.listCards()               - Show all available card IDs
  debug.getHand()                 - Show your current hand
  debug.getState()                - Get the full game state
  debug.resetAll()                - Reset everything (profile, unlocks, credits, game)
      `);
    },
  };

  (window as unknown as { debug: typeof debug }).debug = debug;
  console.log('[Debug] Debug tools loaded. Type debug.help() for commands.');
}
