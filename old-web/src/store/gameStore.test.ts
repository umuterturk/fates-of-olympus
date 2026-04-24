/**
 * Tests for gameStore functions.
 * 
 * Tests cover:
 * - processGameEnd() - credit award logic
 * - Credit amounts: Perfect Win = 50, Win = 25, Loss = 10, Retreat = 0
 * - Perfect win detection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useGameStore } from './gameStore';
import { usePlayerStore } from './playerStore';
import type { GameState, PlayerState, CardInstance, CardDef, LocationState } from '@engine/models';
import { createInitialLocations } from '@engine/models';
import type { PlayerId, TurnNumber, InstanceId } from '@engine/types';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a CardInstance for testing.
 */
function makeCard(
  instanceId: number,
  basePower: number,
  owner: PlayerId
): CardInstance {
  const cardDef: CardDef = {
    id: `test_card_${instanceId}`,
    name: `Test Card ${instanceId}`,
    cost: 1,
    basePower,
    text: '',
    abilityType: 'VANILLA',
    effects: [],
    tags: [],
  };
  
  return {
    instanceId: instanceId as InstanceId,
    cardDef,
    owner,
    permanentPowerModifier: 0,
    ongoingPowerModifier: 0,
    revealed: true,
  };
}

/**
 * Create a test game state with cards at specific locations.
 * 
 * @param locationCards - Array of [location0Cards, location1Cards, location2Cards]
 *                        Each locationCards is [player0Cards, player1Cards]
 * @param result - The game result
 */
function createTestState(
  locationCards: Array<[CardInstance[], CardInstance[]]>,
  result: 'IN_PROGRESS' | 'PLAYER_0_WINS' | 'PLAYER_1_WINS' | 'DRAW' = 'IN_PROGRESS'
): GameState {
  const locations = createInitialLocations();
  
  // Add cards to each location (using explicit indexing for TypeScript)
  const updatedLocations: [LocationState, LocationState, LocationState] = [
    {
      ...locations[0],
      cardsByPlayer: [locationCards[0]?.[0] ?? [], locationCards[0]?.[1] ?? []] as [CardInstance[], CardInstance[]],
    },
    {
      ...locations[1],
      cardsByPlayer: [locationCards[1]?.[0] ?? [], locationCards[1]?.[1] ?? []] as [CardInstance[], CardInstance[]],
    },
    {
      ...locations[2],
      cardsByPlayer: [locationCards[2]?.[0] ?? [], locationCards[2]?.[1] ?? []] as [CardInstance[], CardInstance[]],
    },
  ];

  const player0: PlayerState = {
    playerId: 0,
    deck: [],
    hand: [],
    energy: 0,
    maxEnergy: 0,
  };

  const player1: PlayerState = {
    playerId: 1,
    deck: [],
    hand: [],
    energy: 0,
    maxEnergy: 0,
  };

  return {
    turn: 6 as TurnNumber,
    phase: 'GAME_OVER',
    players: [player0, player1],
    locations: updatedLocations,
    result,
    nextInstanceId: 1000,
    cardsDestroyedThisGame: [],
    cardsMovedThisGame: [],
    cardsMovedThisTurn: [],
    silencedCards: [],
    bonusEnergyNextTurn: [0, 0],
  };
}

// Credit constants matching playerStore
const CREDITS_WIN = 25;
const CREDITS_LOSS = 10;
const CREDITS_PERFECT_WIN = 50;

// =============================================================================
// processGameEnd Tests
// =============================================================================

describe('processGameEnd', () => {
  // Mock player store
  let mockAwardGameCredits: ReturnType<typeof vi.fn>;
  let mockUpdateGameStats: ReturnType<typeof vi.fn>;
  
  beforeEach(() => {
    // Reset the game store state
    useGameStore.setState({
      gameState: null,
      animationLocationWinners: null,
      lastGameCredits: null,
      lastGamePerfectWin: false,
    });

    // Create mock functions
    mockAwardGameCredits = vi.fn().mockResolvedValue(0);
    mockUpdateGameStats = vi.fn().mockResolvedValue(undefined);

    // Mock the playerStore's getState to return our mock functions
    vi.spyOn(usePlayerStore, 'getState').mockReturnValue({
      profile: { id: 'test' } as ReturnType<typeof usePlayerStore.getState>['profile'],
      awardGameCredits: mockAwardGameCredits,
      updateGameStats: mockUpdateGameStats,
    } as unknown as ReturnType<typeof usePlayerStore.getState>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('credit awards', () => {
    it('should award 50 credits for perfect win (all 3 locations won)', async () => {
      // Set up game state: player wins all 3 locations
      const gameState = createTestState([
        [[makeCard(1, 5, 0)], [makeCard(2, 3, 1)]],  // P0 wins
        [[makeCard(3, 4, 0)], [makeCard(4, 2, 1)]],  // P0 wins
        [[makeCard(5, 6, 0)], [makeCard(6, 1, 1)]],  // P0 wins
      ], 'PLAYER_0_WINS');

      mockAwardGameCredits.mockResolvedValue(CREDITS_PERFECT_WIN);

      useGameStore.setState({ gameState });
      
      await useGameStore.getState().processGameEnd();

      // Should call awardGameCredits with won=true, isPerfectWin=true
      expect(mockAwardGameCredits).toHaveBeenCalledWith(true, true);
      expect(useGameStore.getState().lastGameCredits).toBe(CREDITS_PERFECT_WIN);
      expect(useGameStore.getState().lastGamePerfectWin).toBe(true);
    });

    it('should award 25 credits for normal win (2-1 or tiebreaker)', async () => {
      // Set up game state: player wins 2-1
      const gameState = createTestState([
        [[makeCard(1, 5, 0)], [makeCard(2, 3, 1)]],  // P0 wins
        [[makeCard(3, 4, 0)], [makeCard(4, 2, 1)]],  // P0 wins
        [[makeCard(5, 1, 0)], [makeCard(6, 6, 1)]],  // P1 wins
      ], 'PLAYER_0_WINS');

      mockAwardGameCredits.mockResolvedValue(CREDITS_WIN);

      useGameStore.setState({ gameState });
      
      await useGameStore.getState().processGameEnd();

      // Should call awardGameCredits with won=true, isPerfectWin=false
      expect(mockAwardGameCredits).toHaveBeenCalledWith(true, false);
      expect(useGameStore.getState().lastGameCredits).toBe(CREDITS_WIN);
      expect(useGameStore.getState().lastGamePerfectWin).toBe(false);
    });

    it('should award 10 credits for loss', async () => {
      // Set up game state: player loses
      const gameState = createTestState([
        [[makeCard(1, 2, 0)], [makeCard(2, 5, 1)]],  // P1 wins
        [[makeCard(3, 1, 0)], [makeCard(4, 4, 1)]],  // P1 wins
        [[makeCard(5, 6, 0)], [makeCard(6, 1, 1)]],  // P0 wins
      ], 'PLAYER_1_WINS');

      mockAwardGameCredits.mockResolvedValue(CREDITS_LOSS);

      useGameStore.setState({ gameState });
      
      await useGameStore.getState().processGameEnd();

      // Should call awardGameCredits with won=false, isPerfectWin=false
      expect(mockAwardGameCredits).toHaveBeenCalledWith(false, false);
      expect(useGameStore.getState().lastGameCredits).toBe(CREDITS_LOSS);
      expect(useGameStore.getState().lastGamePerfectWin).toBe(false);
    });

    it('should award 0 credits for retreat', async () => {
      // Create a game state
      const gameState = createTestState([
        [[makeCard(1, 5, 0)], [makeCard(2, 3, 1)]],
        [[makeCard(3, 4, 0)], [makeCard(4, 2, 1)]],
        [[makeCard(5, 6, 0)], [makeCard(6, 1, 1)]],
      ], 'IN_PROGRESS');

      useGameStore.setState({ gameState });
      
      // Call retreat instead of processGameEnd
      await useGameStore.getState().retreat();

      // retreat should NOT call awardGameCredits at all
      expect(mockAwardGameCredits).not.toHaveBeenCalled();
      expect(useGameStore.getState().lastGameCredits).toBeNull();
    });
  });

  describe('perfect win detection', () => {
    it('should detect perfect win: all 3 locations won by player', async () => {
      const gameState = createTestState([
        [[makeCard(1, 5, 0)], [makeCard(2, 3, 1)]],  // P0 wins
        [[makeCard(3, 4, 0)], [makeCard(4, 2, 1)]],  // P0 wins
        [[makeCard(5, 6, 0)], [makeCard(6, 1, 1)]],  // P0 wins
      ], 'PLAYER_0_WINS');

      useGameStore.setState({ gameState });
      
      await useGameStore.getState().processGameEnd();

      expect(mockAwardGameCredits).toHaveBeenCalledWith(true, true);
    });

    it('should NOT be perfect win: 2-1 win', async () => {
      const gameState = createTestState([
        [[makeCard(1, 5, 0)], [makeCard(2, 3, 1)]],  // P0 wins
        [[makeCard(3, 4, 0)], [makeCard(4, 2, 1)]],  // P0 wins
        [[makeCard(5, 1, 0)], [makeCard(6, 8, 1)]],  // P1 wins
      ], 'PLAYER_0_WINS');

      useGameStore.setState({ gameState });
      
      await useGameStore.getState().processGameEnd();

      expect(mockAwardGameCredits).toHaveBeenCalledWith(true, false);
    });

    it('should NOT be perfect win: win with one tied location', async () => {
      // P0 wins 2 locations, 1 is tied -> not perfect
      const gameState = createTestState([
        [[makeCard(1, 5, 0)], [makeCard(2, 3, 1)]],  // P0 wins
        [[makeCard(3, 4, 0)], [makeCard(4, 2, 1)]],  // P0 wins
        [[makeCard(5, 3, 0)], [makeCard(6, 3, 1)]],  // Tie
      ], 'PLAYER_0_WINS');

      useGameStore.setState({ gameState });
      
      await useGameStore.getState().processGameEnd();

      // A tie at one location means not all locations are won by player
      expect(mockAwardGameCredits).toHaveBeenCalledWith(true, false);
    });

    it('should NOT be perfect win: tiebreaker win (1-1-1 with total power)', async () => {
      // P0 wins 1 location, P1 wins 1, 1 tied, but P0 wins by total power
      const gameState = createTestState([
        [[makeCard(1, 10, 0)], [makeCard(2, 3, 1)]],  // P0 wins big
        [[makeCard(3, 2, 0)], [makeCard(4, 5, 1)]],   // P1 wins
        [[makeCard(5, 4, 0)], [makeCard(6, 4, 1)]],   // Tie
      ], 'PLAYER_0_WINS');  // P0 wins by total: 16 vs 12

      useGameStore.setState({ gameState });
      
      await useGameStore.getState().processGameEnd();

      expect(mockAwardGameCredits).toHaveBeenCalledWith(true, false);
    });
  });

  describe('edge cases', () => {
    it('should not process if game is still in progress', async () => {
      const gameState = createTestState([
        [[makeCard(1, 5, 0)], [makeCard(2, 3, 1)]],
        [[makeCard(3, 4, 0)], [makeCard(4, 2, 1)]],
        [[makeCard(5, 6, 0)], [makeCard(6, 1, 1)]],
      ], 'IN_PROGRESS');

      useGameStore.setState({ gameState });
      
      await useGameStore.getState().processGameEnd();

      expect(mockAwardGameCredits).not.toHaveBeenCalled();
    });

    it('should not process if no game state', async () => {
      useGameStore.setState({ gameState: null });
      
      await useGameStore.getState().processGameEnd();

      expect(mockAwardGameCredits).not.toHaveBeenCalled();
    });

    it('should handle draw result (player did not win)', async () => {
      const gameState = createTestState([
        [[makeCard(1, 5, 0)], [makeCard(2, 5, 1)]],  // Tie
        [[makeCard(3, 4, 0)], [makeCard(4, 4, 1)]],  // Tie
        [[makeCard(5, 3, 0)], [makeCard(6, 3, 1)]],  // Tie
      ], 'DRAW');

      mockAwardGameCredits.mockResolvedValue(CREDITS_LOSS);

      useGameStore.setState({ gameState });
      
      await useGameStore.getState().processGameEnd();

      // Draw counts as a loss for credit purposes
      expect(mockAwardGameCredits).toHaveBeenCalledWith(false, false);
    });
  });
});
