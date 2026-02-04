/**
 * Tests for the deterministic ability system.
 * 
 * These tests verify:
 * 1. Determinism: Same inputs produce identical outputs
 * 2. Condition evaluation correctness
 * 3. Target selection with proper tie-breaking
 * 4. Effect application
 * 5. Timeline generation and execution
 */

import { describe, it, expect } from 'vitest';
import { SeededRNG, verifyDeterminism } from '../rng';
import { evaluateCondition, createConditionSnapshot } from './conditions';
import { resolveTargets, findMoveDestination } from './selectors';
import type { GameState, CardInstance, LocationState } from '../models';
import type { LocationIndex, PlayerId, TurnNumber, CardTag } from '../types';

// =============================================================================
// Test Fixtures
// =============================================================================

function createTestCard(
  instanceId: number,
  owner: PlayerId,
  basePower: number = 3,
  abilityType: 'VANILLA' | 'ON_REVEAL' | 'ONGOING' = 'VANILLA',
  tags: string[] = []
): CardInstance {
  return {
    instanceId,
    cardDef: {
      id: `test_card_${instanceId}`,
      name: `Test Card ${instanceId}`,
      cost: 2,
      basePower,
      text: '',
      abilityType,
      effects: [],
      tags: tags as CardTag[],
    },
    owner,
    permanentPowerModifier: 0,
    ongoingPowerModifier: 0,
    revealed: true,
  };
}

function createTestLocation(
  index: LocationIndex,
  p0Cards: CardInstance[] = [],
  p1Cards: CardInstance[] = []
): LocationState {
  return {
    index,
    cardsByPlayer: [p0Cards, p1Cards],
  };
}

function createTestGameState(
  locations: [LocationState, LocationState, LocationState],
  turn: TurnNumber = 1,
  options: Partial<{
    cardsDestroyedThisGame: number[];
    cardsMovedThisGame: number[];
    cardsMovedThisTurn: number[];
    silencedCards: number[];
  }> = {}
): GameState {
  return {
    turn,
    phase: 'PLANNING',
    players: [
      { playerId: 0, deck: [], hand: [], energy: 3, maxEnergy: 3 },
      { playerId: 1, deck: [], hand: [], energy: 3, maxEnergy: 3 },
    ],
    locations,
    result: 'IN_PROGRESS',
    nextInstanceId: 100,
    cardsDestroyedThisGame: options.cardsDestroyedThisGame ?? [],
    cardsMovedThisGame: options.cardsMovedThisGame ?? [],
    cardsMovedThisTurn: options.cardsMovedThisTurn ?? [],
    silencedCards: options.silencedCards ?? [],
    bonusEnergyNextTurn: [0, 0],
  };
}

// =============================================================================
// Seeded RNG Tests
// =============================================================================

describe('SeededRNG', () => {
  it('produces identical sequences for identical seeds', () => {
    const rng1 = new SeededRNG(12345);
    const rng2 = new SeededRNG(12345);
    
    const result = verifyDeterminism(rng1, rng2, 1000);
    expect(result.identical).toBe(true);
  });
  
  it('produces different sequences for different seeds', () => {
    const rng1 = new SeededRNG(12345);
    const rng2 = new SeededRNG(54321);
    
    const values1 = Array.from({ length: 10 }, () => rng1.next());
    const values2 = Array.from({ length: 10 }, () => rng2.next());
    
    expect(values1).not.toEqual(values2);
  });
  
  it('nextInt produces values within range', () => {
    const rng = new SeededRNG(42);
    
    for (let i = 0; i < 100; i++) {
      const value = rng.nextInt(1, 6);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(6);
    }
  });
  
  it('shuffle produces deterministic results', () => {
    const rng1 = new SeededRNG(99);
    const rng2 = new SeededRNG(99);
    
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuffled1 = rng1.shuffle(arr);
    const shuffled2 = rng2.shuffle(arr);
    
    expect(shuffled1).toEqual(shuffled2);
    expect(shuffled1).not.toEqual(arr); // Should be shuffled
  });
  
  it('reset restores initial state', () => {
    const rng = new SeededRNG(12345);
    const first10 = Array.from({ length: 10 }, () => rng.next());
    
    rng.reset();
    const after_reset = Array.from({ length: 10 }, () => rng.next());
    
    expect(first10).toEqual(after_reset);
  });
});

// =============================================================================
// Condition Evaluation Tests
// =============================================================================

describe('evaluateCondition', () => {
  it('NONE always returns true', () => {
    const card = createTestCard(1, 0);
    const state = createTestGameState([
      createTestLocation(0, [card]),
      createTestLocation(1),
      createTestLocation(2),
    ]);
    
    expect(evaluateCondition('NONE', state, card, 0)).toBe(true);
  });
  
  it('CONDITIONAL_ONLY_CARD_HERE returns true when alone', () => {
    const card = createTestCard(1, 0);
    const state = createTestGameState([
      createTestLocation(0, [card]),
      createTestLocation(1),
      createTestLocation(2),
    ]);
    
    expect(evaluateCondition('CONDITIONAL_ONLY_CARD_HERE', state, card, 0)).toBe(true);
  });
  
  it('CONDITIONAL_ONLY_CARD_HERE returns false with allies', () => {
    const card1 = createTestCard(1, 0);
    const card2 = createTestCard(2, 0);
    const state = createTestGameState([
      createTestLocation(0, [card1, card2]),
      createTestLocation(1),
      createTestLocation(2),
    ]);
    
    expect(evaluateCondition('CONDITIONAL_ONLY_CARD_HERE', state, card1, 0)).toBe(false);
  });
  
  it('CONDITIONAL_EXACTLY_ONE_OTHER_ALLY_HERE with exactly 2 allies', () => {
    const card1 = createTestCard(1, 0);
    const card2 = createTestCard(2, 0);
    const state = createTestGameState([
      createTestLocation(0, [card1, card2]),
      createTestLocation(1),
      createTestLocation(2),
    ]);
    
    expect(evaluateCondition('CONDITIONAL_EXACTLY_ONE_OTHER_ALLY_HERE', state, card1, 0)).toBe(true);
  });
  
  it('CONDITIONAL_LOCATION_FULL with 4 cards', () => {
    const cards = [
      createTestCard(1, 0),
      createTestCard(2, 0),
      createTestCard(3, 0),
      createTestCard(4, 0),
    ];
    const state = createTestGameState([
      createTestLocation(0, cards),
      createTestLocation(1),
      createTestLocation(2),
    ]);
    
    expect(evaluateCondition('CONDITIONAL_LOCATION_FULL', state, cards[0]!, 0)).toBe(true);
  });
  
  it('CONDITIONAL_ENEMY_MORE_CARDS_HERE', () => {
    const allyCard = createTestCard(1, 0);
    const enemyCards = [createTestCard(2, 1), createTestCard(3, 1)];
    const state = createTestGameState([
      createTestLocation(0, [allyCard], enemyCards),
      createTestLocation(1),
      createTestLocation(2),
    ]);
    
    expect(evaluateCondition('CONDITIONAL_ENEMY_MORE_CARDS_HERE', state, allyCard, 0)).toBe(true);
  });
  
  it('CONDITIONAL_DESTROYED_THIS_GAME tracks destruction', () => {
    const card = createTestCard(1, 0);
    const stateNoDestroy = createTestGameState([
      createTestLocation(0, [card]),
      createTestLocation(1),
      createTestLocation(2),
    ]);
    
    const stateWithDestroy = createTestGameState([
      createTestLocation(0, [card]),
      createTestLocation(1),
      createTestLocation(2),
    ], 1, { cardsDestroyedThisGame: [99] });
    
    expect(evaluateCondition('CONDITIONAL_DESTROYED_THIS_GAME', stateNoDestroy, card, 0)).toBe(false);
    expect(evaluateCondition('CONDITIONAL_DESTROYED_THIS_GAME', stateWithDestroy, card, 0)).toBe(true);
  });
  
  it('CONDITIONAL_MOVED_THIS_GAME tracks movement', () => {
    const card = createTestCard(1, 0);
    const stateNoMove = createTestGameState([
      createTestLocation(0, [card]),
      createTestLocation(1),
      createTestLocation(2),
    ]);
    
    const stateWithMove = createTestGameState([
      createTestLocation(0, [card]),
      createTestLocation(1),
      createTestLocation(2),
    ], 1, { cardsMovedThisGame: [99] });
    
    expect(evaluateCondition('CONDITIONAL_MOVED_THIS_GAME', stateNoMove, card, 0)).toBe(false);
    expect(evaluateCondition('CONDITIONAL_MOVED_THIS_GAME', stateWithMove, card, 0)).toBe(true);
  });
});

// =============================================================================
// Target Selection Tests
// =============================================================================

describe('resolveTargets', () => {
  it('SELF returns source card', () => {
    const card = createTestCard(1, 0);
    const state = createTestGameState([
      createTestLocation(0, [card]),
      createTestLocation(1),
      createTestLocation(2),
    ]);
    const rng = new SeededRNG(42);
    
    const targets = resolveTargets('SELF', state, card, 0, rng);
    expect(targets).toEqual([1]);
  });
  
  it('ONE_OTHER_ALLY_HERE selects first ally deterministically', () => {
    const card1 = createTestCard(1, 0);
    const card2 = createTestCard(2, 0);
    const card3 = createTestCard(3, 0);
    const state = createTestGameState([
      createTestLocation(0, [card1, card2, card3]),
      createTestLocation(1),
      createTestLocation(2),
    ]);
    const rng = new SeededRNG(42);
    
    const targets = resolveTargets('ONE_OTHER_ALLY_HERE', state, card1, 0, rng);
    expect(targets.length).toBe(1);
    expect(targets[0]).toBe(2); // Should be the first other ally (lowest instanceId)
  });
  
  it('ALL_ALLIES_HERE returns all allies sorted by instanceId', () => {
    const card1 = createTestCard(5, 0);
    const card2 = createTestCard(2, 0);
    const card3 = createTestCard(8, 0);
    const state = createTestGameState([
      createTestLocation(0, [card1, card2, card3]),
      createTestLocation(1),
      createTestLocation(2),
    ]);
    const rng = new SeededRNG(42);
    
    const targets = resolveTargets('ALL_ALLIES_HERE', state, card1, 0, rng);
    expect(targets).toEqual([2, 5, 8]); // Sorted by instanceId
  });
  
  it('ALL_ENEMIES_HERE returns all enemies', () => {
    const allyCard = createTestCard(1, 0);
    const enemy1 = createTestCard(10, 1);
    const enemy2 = createTestCard(11, 1);
    const state = createTestGameState([
      createTestLocation(0, [allyCard], [enemy1, enemy2]),
      createTestLocation(1),
      createTestLocation(2),
    ]);
    const rng = new SeededRNG(42);
    
    const targets = resolveTargets('ALL_ENEMIES_HERE', state, allyCard, 0, rng);
    expect(targets).toEqual([10, 11]);
  });
  
  it('HIGHEST_POWER_ENEMY_HERE selects highest power enemy', () => {
    const allyCard = createTestCard(1, 0, 3);
    const weakEnemy = createTestCard(10, 1, 2);
    const strongEnemy = createTestCard(11, 1, 5);
    const state = createTestGameState([
      createTestLocation(0, [allyCard], [weakEnemy, strongEnemy]),
      createTestLocation(1),
      createTestLocation(2),
    ]);
    const rng = new SeededRNG(42);
    
    const targets = resolveTargets('HIGHEST_POWER_ENEMY_HERE', state, allyCard, 0, rng);
    expect(targets).toEqual([11]); // strongEnemy with power 5
  });
  
  it('ALL_ALLIES_OTHER_LOCATIONS returns allies at other locations', () => {
    const sourceCard = createTestCard(1, 0);
    const allyHere = createTestCard(2, 0);
    const allyLoc1 = createTestCard(3, 0);
    const allyLoc2 = createTestCard(4, 0);
    const state = createTestGameState([
      createTestLocation(0, [sourceCard, allyHere]),
      createTestLocation(1, [allyLoc1]),
      createTestLocation(2, [allyLoc2]),
    ]);
    const rng = new SeededRNG(42);
    
    const targets = resolveTargets('ALL_ALLIES_OTHER_LOCATIONS', state, sourceCard, 0, rng);
    expect(targets).toEqual([3, 4]); // Allies at locations 1 and 2
  });
  
  it('RANDOM_VALID_TARGET returns deterministic result', () => {
    const card = createTestCard(1, 0);
    const other1 = createTestCard(2, 0);
    const other2 = createTestCard(3, 1);
    const state = createTestGameState([
      createTestLocation(0, [card, other1], [other2]),
      createTestLocation(1),
      createTestLocation(2),
    ]);
    
    // Same seed should give same result
    const rng1 = new SeededRNG(42);
    const rng2 = new SeededRNG(42);
    
    const targets1 = resolveTargets('RANDOM_VALID_TARGET', state, card, 0, rng1);
    const targets2 = resolveTargets('RANDOM_VALID_TARGET', state, card, 0, rng2);
    
    expect(targets1).toEqual(targets2);
  });
});

// =============================================================================
// Move Destination Tests
// =============================================================================

describe('findMoveDestination', () => {
  it('finds first available location', () => {
    const card = createTestCard(1, 0);
    const state = createTestGameState([
      createTestLocation(0, [card]),
      createTestLocation(1),
      createTestLocation(2),
    ]);
    
    const dest = findMoveDestination(state, 0, 0, 'FIRST_AVAILABLE');
    expect(dest).toBe(1); // First available after location 0
  });
  
  it('skips full locations', () => {
    const cards = Array.from({ length: 4 }, (_, i) => createTestCard(i + 10, 0));
    const sourceCard = createTestCard(1, 0);
    const state = createTestGameState([
      createTestLocation(0, [sourceCard]),
      createTestLocation(1, cards), // Full
      createTestLocation(2),
    ]);
    
    const dest = findMoveDestination(state, 0, 0, 'FIRST_AVAILABLE');
    expect(dest).toBe(2); // Should skip location 1 (full)
  });
  
  it('returns null when all destinations full', () => {
    const fullCards = Array.from({ length: 4 }, (_, i) => createTestCard(i + 100, 0));
    const sourceCard = createTestCard(1, 0);
    const state = createTestGameState([
      createTestLocation(0, [sourceCard]),
      createTestLocation(1, fullCards),
      createTestLocation(2, fullCards),
    ]);
    
    const dest = findMoveDestination(state, 0, 0, 'FIRST_AVAILABLE');
    expect(dest).toBeNull();
  });
});

// =============================================================================
// Condition Snapshot Tests
// =============================================================================

describe('createConditionSnapshot', () => {
  it('captures all relevant state', () => {
    const allyCards = [createTestCard(1, 0, 3), createTestCard(2, 0, 4)];
    const enemyCards = [createTestCard(3, 1, 5)];
    const state = createTestGameState([
      createTestLocation(0, allyCards, enemyCards),
      createTestLocation(1),
      createTestLocation(2),
    ], 1, {
      cardsDestroyedThisGame: [99, 98],
      cardsMovedThisGame: [97],
      cardsMovedThisTurn: [97],
    });
    
    const snapshot = createConditionSnapshot(state, allyCards[0]!, 0);
    
    expect(snapshot.allyCountHere).toBe(2);
    expect(snapshot.enemyCountHere).toBe(1);
    expect(snapshot.allyPowerHere).toBe(7); // 3 + 4
    expect(snapshot.enemyPowerHere).toBe(5);
    expect(snapshot.cardsDestroyedCount).toBe(2);
    expect(snapshot.cardsMovedThisGameCount).toBe(1);
    expect(snapshot.cardsMovedThisTurnCount).toBe(1);
    expect(snapshot.locationCapacity).toBe(4);
  });
});
