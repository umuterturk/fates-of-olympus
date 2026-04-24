/**
 * Tests for game controller functions.
 * 
 * Tests cover:
 * - computeWinner() - game result determination
 * - countLocationsWon() - location counting helper
 * - Perfect win detection logic
 */

import { describe, it, expect } from 'vitest';
import type { GameState, PlayerState, CardInstance, CardDef, LocationState } from './models';
import { createInitialLocations } from './models';
import { computeWinner, countLocationsWon } from './controller';
import type { PlayerId, TurnNumber, InstanceId } from './types';

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
 */
function createTestState(
  locationCards: Array<[CardInstance[], CardInstance[]]>
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
    result: 'IN_PROGRESS',
    nextInstanceId: 1000,
    cardsDestroyedThisGame: [],
    cardsMovedThisGame: [],
    cardsMovedThisTurn: [],
    silencedCards: [],
    bonusEnergyNextTurn: [0, 0],
  };
}

// =============================================================================
// computeWinner Tests
// =============================================================================

describe('computeWinner', () => {
  describe('location-based wins', () => {
    it('should return PLAYER_0_WINS when player 0 wins 2 locations', () => {
      // Player 0 has 5 power at loc 0 and 1, player 1 has 3 power at each
      const state = createTestState([
        [[makeCard(1, 5, 0)], [makeCard(2, 3, 1)]],  // Loc 0: P0 wins (5 > 3)
        [[makeCard(3, 5, 0)], [makeCard(4, 3, 1)]],  // Loc 1: P0 wins (5 > 3)
        [[makeCard(5, 2, 0)], [makeCard(6, 4, 1)]],  // Loc 2: P1 wins (2 < 4)
      ]);

      const result = computeWinner(state);
      
      expect(result.result).toBe('PLAYER_0_WINS');
      expect(result.locationWinners).toEqual([0, 0, 1]);
      expect(result.locationPowers).toEqual([[5, 3], [5, 3], [2, 4]]);
    });

    it('should return PLAYER_0_WINS when player 0 wins all 3 locations (perfect win)', () => {
      const state = createTestState([
        [[makeCard(1, 5, 0)], [makeCard(2, 3, 1)]],  // Loc 0: P0 wins
        [[makeCard(3, 4, 0)], [makeCard(4, 2, 1)]],  // Loc 1: P0 wins
        [[makeCard(5, 6, 0)], [makeCard(6, 1, 1)]],  // Loc 2: P0 wins
      ]);

      const result = computeWinner(state);
      
      expect(result.result).toBe('PLAYER_0_WINS');
      expect(result.locationWinners).toEqual([0, 0, 0]);
      // This is a perfect win - all 3 locations
      expect(result.locationWinners.every(w => w === 0)).toBe(true);
    });

    it('should return PLAYER_1_WINS when player 1 wins 2 locations', () => {
      const state = createTestState([
        [[makeCard(1, 2, 0)], [makeCard(2, 5, 1)]],  // Loc 0: P1 wins
        [[makeCard(3, 3, 0)], [makeCard(4, 6, 1)]],  // Loc 1: P1 wins
        [[makeCard(5, 7, 0)], [makeCard(6, 1, 1)]],  // Loc 2: P0 wins
      ]);

      const result = computeWinner(state);
      
      expect(result.result).toBe('PLAYER_1_WINS');
      expect(result.locationWinners).toEqual([1, 1, 0]);
    });
  });

  describe('tiebreaker by total power', () => {
    it('should use total power when locations are 1-1-1 (P0 wins by total)', () => {
      const state = createTestState([
        [[makeCard(1, 5, 0)], [makeCard(2, 3, 1)]],  // Loc 0: P0 wins (5 > 3)
        [[makeCard(3, 2, 0)], [makeCard(4, 6, 1)]],  // Loc 1: P1 wins (2 < 6)
        [[makeCard(5, 3, 0)], [makeCard(6, 3, 1)]],  // Loc 2: Tie (3 = 3)
      ]);

      const result = computeWinner(state);
      
      // Total: P0 = 5+2+3 = 10, P1 = 3+6+3 = 12
      // P1 has more total power
      expect(result.result).toBe('PLAYER_1_WINS');
      expect(result.locationWinners).toEqual([0, 1, null]);
      expect(result.totalPower).toEqual([10, 12]);
    });

    it('should use total power when locations are 1-1-1 (P1 wins by total)', () => {
      const state = createTestState([
        [[makeCard(1, 8, 0)], [makeCard(2, 3, 1)]],  // Loc 0: P0 wins (8 > 3)
        [[makeCard(3, 2, 0)], [makeCard(4, 4, 1)]],  // Loc 1: P1 wins (2 < 4)
        [[makeCard(5, 5, 0)], [makeCard(6, 5, 1)]],  // Loc 2: Tie (5 = 5)
      ]);

      const result = computeWinner(state);
      
      // Total: P0 = 8+2+5 = 15, P1 = 3+4+5 = 12
      // P0 has more total power
      expect(result.result).toBe('PLAYER_0_WINS');
      expect(result.locationWinners).toEqual([0, 1, null]);
      expect(result.totalPower).toEqual([15, 12]);
    });
  });

  describe('draw conditions', () => {
    it('should return DRAW when 1-1-1 with equal total power', () => {
      const state = createTestState([
        [[makeCard(1, 5, 0)], [makeCard(2, 3, 1)]],  // Loc 0: P0 wins
        [[makeCard(3, 2, 0)], [makeCard(4, 4, 1)]],  // Loc 1: P1 wins
        [[makeCard(5, 3, 0)], [makeCard(6, 3, 1)]],  // Loc 2: Tie
      ]);

      const result = computeWinner(state);
      
      // Total: P0 = 5+2+3 = 10, P1 = 3+4+3 = 10
      expect(result.result).toBe('DRAW');
      expect(result.totalPower).toEqual([10, 10]);
    });

    it('should return DRAW when all locations are tied with equal power', () => {
      const state = createTestState([
        [[makeCard(1, 3, 0)], [makeCard(2, 3, 1)]],  // Loc 0: Tie
        [[makeCard(3, 4, 0)], [makeCard(4, 4, 1)]],  // Loc 1: Tie
        [[makeCard(5, 2, 0)], [makeCard(6, 2, 1)]],  // Loc 2: Tie
      ]);

      const result = computeWinner(state);
      
      expect(result.result).toBe('DRAW');
      expect(result.locationWinners).toEqual([null, null, null]);
    });
  });

  describe('location ties', () => {
    it('should handle location ties correctly (null in locationWinners)', () => {
      const state = createTestState([
        [[makeCard(1, 5, 0)], [makeCard(2, 5, 1)]],  // Loc 0: Tie
        [[makeCard(3, 6, 0)], [makeCard(4, 3, 1)]],  // Loc 1: P0 wins
        [[makeCard(5, 4, 0)], [makeCard(6, 2, 1)]],  // Loc 2: P0 wins
      ]);

      const result = computeWinner(state);
      
      expect(result.result).toBe('PLAYER_0_WINS');
      expect(result.locationWinners).toEqual([null, 0, 0]);
      expect(result.locationPowers[0]).toEqual([5, 5]); // Tied location
    });
  });

  describe('empty locations', () => {
    it('should handle empty locations as ties', () => {
      const state = createTestState([
        [[], []],  // Loc 0: Empty = Tie (0 = 0)
        [[makeCard(1, 5, 0)], []],  // Loc 1: P0 wins (5 > 0)
        [[makeCard(2, 3, 0)], []],  // Loc 2: P0 wins (3 > 0)
      ]);

      const result = computeWinner(state);
      
      expect(result.result).toBe('PLAYER_0_WINS');
      expect(result.locationWinners).toEqual([null, 0, 0]);
      expect(result.locationPowers[0]).toEqual([0, 0]);
    });
  });
});

// =============================================================================
// countLocationsWon Tests
// =============================================================================

describe('countLocationsWon', () => {
  it('should count locations where player 0 is winning', () => {
    const state = createTestState([
      [[makeCard(1, 5, 0)], [makeCard(2, 3, 1)]],  // P0 wins
      [[makeCard(3, 4, 0)], [makeCard(4, 6, 1)]],  // P1 wins
      [[makeCard(5, 7, 0)], [makeCard(6, 2, 1)]],  // P0 wins
    ]);

    expect(countLocationsWon(state, 0)).toBe(2);
    expect(countLocationsWon(state, 1)).toBe(1);
  });

  it('should return 0 when player wins no locations', () => {
    const state = createTestState([
      [[makeCard(1, 1, 0)], [makeCard(2, 5, 1)]],  // P1 wins
      [[makeCard(3, 2, 0)], [makeCard(4, 6, 1)]],  // P1 wins
      [[makeCard(5, 3, 0)], [makeCard(6, 4, 1)]],  // P1 wins
    ]);

    expect(countLocationsWon(state, 0)).toBe(0);
    expect(countLocationsWon(state, 1)).toBe(3);
  });

  it('should not count tied locations as wins', () => {
    const state = createTestState([
      [[makeCard(1, 5, 0)], [makeCard(2, 5, 1)]],  // Tie
      [[makeCard(3, 4, 0)], [makeCard(4, 4, 1)]],  // Tie
      [[makeCard(5, 6, 0)], [makeCard(6, 3, 1)]],  // P0 wins
    ]);

    expect(countLocationsWon(state, 0)).toBe(1);
    expect(countLocationsWon(state, 1)).toBe(0);
  });

  it('should return 3 for perfect win', () => {
    const state = createTestState([
      [[makeCard(1, 5, 0)], [makeCard(2, 3, 1)]],  // P0 wins
      [[makeCard(3, 4, 0)], [makeCard(4, 2, 1)]],  // P0 wins
      [[makeCard(5, 6, 0)], [makeCard(6, 1, 1)]],  // P0 wins
    ]);

    expect(countLocationsWon(state, 0)).toBe(3);
    expect(countLocationsWon(state, 1)).toBe(0);
  });
});

// =============================================================================
// Perfect Win Detection Tests
// =============================================================================

describe('Perfect Win Detection', () => {
  it('should detect perfect win when all locationWinners are player 0', () => {
    const state = createTestState([
      [[makeCard(1, 5, 0)], [makeCard(2, 3, 1)]],
      [[makeCard(3, 4, 0)], [makeCard(4, 2, 1)]],
      [[makeCard(5, 6, 0)], [makeCard(6, 1, 1)]],
    ]);

    const { result, locationWinners } = computeWinner(state);
    
    const playerWon = result === 'PLAYER_0_WINS';
    const isPerfectWin = playerWon && locationWinners.every(w => w === 0);
    
    expect(isPerfectWin).toBe(true);
  });

  it('should NOT be perfect win when player wins 2-1', () => {
    const state = createTestState([
      [[makeCard(1, 5, 0)], [makeCard(2, 3, 1)]],  // P0 wins
      [[makeCard(3, 4, 0)], [makeCard(4, 2, 1)]],  // P0 wins
      [[makeCard(5, 1, 0)], [makeCard(6, 6, 1)]],  // P1 wins
    ]);

    const { result, locationWinners } = computeWinner(state);
    
    const playerWon = result === 'PLAYER_0_WINS';
    const isPerfectWin = playerWon && locationWinners.every(w => w === 0);
    
    expect(playerWon).toBe(true);
    expect(isPerfectWin).toBe(false);
  });

  it('should NOT be perfect win when winning by tiebreaker', () => {
    const state = createTestState([
      [[makeCard(1, 10, 0)], [makeCard(2, 3, 1)]],  // P0 wins big
      [[makeCard(3, 2, 0)], [makeCard(4, 5, 1)]],   // P1 wins
      [[makeCard(5, 4, 0)], [makeCard(6, 4, 1)]],   // Tie
    ]);

    const { result, locationWinners } = computeWinner(state);
    
    // P0: 10+2+4 = 16, P1: 3+5+4 = 12 -> P0 wins by total power
    const playerWon = result === 'PLAYER_0_WINS';
    const isPerfectWin = playerWon && locationWinners.every(w => w === 0);
    
    expect(playerWon).toBe(true);
    expect(isPerfectWin).toBe(false);
    expect(locationWinners).toEqual([0, 1, null]);
  });
});
