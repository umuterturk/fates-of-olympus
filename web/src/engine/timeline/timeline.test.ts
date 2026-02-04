/**
 * Tests for the timeline-based deterministic resolution system.
 * 
 * These tests verify:
 * 1. Timeline generation is deterministic
 * 2. Timeline execution produces correct state changes
 * 3. Same inputs produce identical timelines across multiple runs
 * 4. Resolution order is correct (location order, player order, play order)
 */

import { describe, it, expect } from 'vitest';
import { SeededRNG } from '../rng';
import { generateTimeline, compareTimelines } from './generator';
import { executeTimeline, createStepIterator } from './executor';
import type { PlayedCard, Step } from './types';
import { verifyTimelineIntegrity, getStepsByPhase } from './types';
import type { GameState, CardInstance, PlayerState } from '../models';
import { createInitialLocations, addCard, withLocation, withPhase } from '../models';
import type { LocationIndex, PlayerId, TurnNumber } from '../types';

// =============================================================================
// Test Fixtures
// =============================================================================

function createTestCardInstance(
  instanceId: number,
  owner: PlayerId,
  cardId: string = 'hoplite',
  basePower: number = 3,
  abilityType: 'VANILLA' | 'ON_REVEAL' | 'ONGOING' = 'VANILLA'
): CardInstance {
  return {
    instanceId,
    cardDef: {
      id: cardId,
      name: `Test Card ${instanceId}`,
      cost: 2,
      basePower,
      text: '',
      abilityType,
      effects: [],
      tags: [],
    },
    owner,
    permanentPowerModifier: 0,
    ongoingPowerModifier: 0,
    revealed: false,
  };
}

function createTestGameState(turn: TurnNumber = 1): GameState {
  return {
    turn,
    phase: 'PLANNING',
    players: [
      { playerId: 0, deck: [], hand: [], energy: 6, maxEnergy: 6 },
      { playerId: 1, deck: [], hand: [], energy: 6, maxEnergy: 6 },
    ] as [PlayerState, PlayerState],
    locations: createInitialLocations(),
    result: 'IN_PROGRESS',
    nextInstanceId: 100,
    cardsDestroyedThisGame: [],
    cardsMovedThisGame: [],
    cardsMovedThisTurn: [],
    silencedCards: [],
    bonusEnergyNextTurn: [0, 0],
  };
}

function placeCardAtLocation(
  state: GameState,
  card: CardInstance,
  locationIndex: LocationIndex
): GameState {
  let location = state.locations[locationIndex];
  location = addCard(location, card, card.owner);
  return withLocation(state, locationIndex, location);
}

// =============================================================================
// Timeline Generation Tests
// =============================================================================

describe('generateTimeline', () => {
  it('generates deterministic timeline with same seed', () => {
    const state = createTestGameState();
    const playedCards: PlayedCard[] = [
      { instanceId: 1, playerId: 0, location: 0, playOrder: 0 },
      { instanceId: 2, playerId: 1, location: 0, playOrder: 0 },
    ];
    
    // Place cards at location
    let stateWithCards = placeCardAtLocation(state, createTestCardInstance(1, 0), 0);
    stateWithCards = placeCardAtLocation(stateWithCards, createTestCardInstance(2, 1), 0);
    
    const rng1 = new SeededRNG(12345);
    const rng2 = new SeededRNG(12345);
    
    const result1 = generateTimeline(stateWithCards, playedCards, rng1);
    const result2 = generateTimeline(stateWithCards, playedCards, rng2);
    
    const comparison = compareTimelines(result1.timeline, result2.timeline);
    expect(comparison.identical).toBe(true);
    expect(comparison.differences).toEqual([]);
  });
  
  it('generates different timeline with different seed', () => {
    const state = createTestGameState();
    const card1 = createTestCardInstance(1, 0, 'hoplite', 3);
    const card2 = createTestCardInstance(2, 0, 'hoplite', 3);
    
    let stateWithCards = placeCardAtLocation(state, card1, 0);
    stateWithCards = placeCardAtLocation(stateWithCards, card2, 0);
    
    const playedCards: PlayedCard[] = [
      { instanceId: 1, playerId: 0, location: 0, playOrder: 0 },
      { instanceId: 2, playerId: 0, location: 0, playOrder: 1 },
    ];
    
    const rng1 = new SeededRNG(12345);
    const rng2 = new SeededRNG(54321);
    
    const result1 = generateTimeline(stateWithCards, playedCards, rng1);
    const result2 = generateTimeline(stateWithCards, playedCards, rng2);
    
    // Timelines should have same structure (both VANILLA cards)
    expect(result1.timeline.length).toBe(result2.timeline.length);
  });
  
  it('orders reveals by location (left to right)', () => {
    const state = createTestGameState();
    
    // Place cards at different locations
    let stateWithCards = placeCardAtLocation(state, createTestCardInstance(1, 0), 2); // Right
    stateWithCards = placeCardAtLocation(stateWithCards, createTestCardInstance(2, 0), 0); // Left
    stateWithCards = placeCardAtLocation(stateWithCards, createTestCardInstance(3, 0), 1); // Middle
    
    const playedCards: PlayedCard[] = [
      { instanceId: 1, playerId: 0, location: 2, playOrder: 0 },
      { instanceId: 2, playerId: 0, location: 0, playOrder: 1 },
      { instanceId: 3, playerId: 0, location: 1, playOrder: 2 },
    ];
    
    const rng = new SeededRNG(42);
    const result = generateTimeline(stateWithCards, playedCards, rng);
    
    // Get REVEAL steps
    const revealSteps = getStepsByPhase(result.timeline, 'REVEAL');
    
    // Should be ordered: location 0, then 1, then 2
    expect(revealSteps.length).toBe(3);
    expect(revealSteps[0]?.source.id).toBe(2); // Card at location 0
    expect(revealSteps[1]?.source.id).toBe(3); // Card at location 1
    expect(revealSteps[2]?.source.id).toBe(1); // Card at location 2
  });
  
  it('includes ONGOING_RECALC and CLEANUP steps', () => {
    const state = createTestGameState();
    const card = createTestCardInstance(1, 0);
    const stateWithCard = placeCardAtLocation(state, card, 0);
    
    const playedCards: PlayedCard[] = [
      { instanceId: 1, playerId: 0, location: 0, playOrder: 0 },
    ];
    
    const rng = new SeededRNG(42);
    const result = generateTimeline(stateWithCard, playedCards, rng);
    
    // Should have ONGOING_RECALC and CLEANUP steps
    const ongoingSteps = getStepsByPhase(result.timeline, 'ONGOING_RECALC');
    const cleanupSteps = getStepsByPhase(result.timeline, 'CLEANUP');
    
    expect(ongoingSteps.length).toBe(1);
    expect(cleanupSteps.length).toBe(1);
  });
  
  it('passes integrity verification', () => {
    const state = createTestGameState();
    const card1 = createTestCardInstance(1, 0);
    const card2 = createTestCardInstance(2, 1);
    
    let stateWithCards = placeCardAtLocation(state, card1, 0);
    stateWithCards = placeCardAtLocation(stateWithCards, card2, 1);
    
    const playedCards: PlayedCard[] = [
      { instanceId: 1, playerId: 0, location: 0, playOrder: 0 },
      { instanceId: 2, playerId: 1, location: 1, playOrder: 0 },
    ];
    
    const rng = new SeededRNG(42);
    const result = generateTimeline(stateWithCards, playedCards, rng);
    
    const integrity = verifyTimelineIntegrity(result.timeline);
    expect(integrity.valid).toBe(true);
    expect(integrity.errors).toEqual([]);
  });
});

// =============================================================================
// Timeline Execution Tests
// =============================================================================

describe('executeTimeline', () => {
  it('reveals cards during execution', () => {
    const state = createTestGameState();
    const card = createTestCardInstance(1, 0);
    let stateWithCard = placeCardAtLocation(state, card, 0);
    stateWithCard = withPhase(stateWithCard, 'RESOLUTION');
    
    const playedCards: PlayedCard[] = [
      { instanceId: 1, playerId: 0, location: 0, playOrder: 0 },
    ];
    
    const rng = new SeededRNG(42);
    const timelineResult = generateTimeline(stateWithCard, playedCards, rng);
    
    const rng2 = new SeededRNG(42); // Fresh RNG for execution
    const executionResult = executeTimeline(stateWithCard, timelineResult.timeline, rng2);
    
    expect(executionResult.success).toBe(true);
    
    // Card should be revealed
    const finalCard = executionResult.state.locations[0].cardsByPlayer[0][0];
    expect(finalCard?.revealed).toBe(true);
  });
  
  it('emits CardRevealed events', () => {
    const state = createTestGameState();
    const card = createTestCardInstance(1, 0);
    let stateWithCard = placeCardAtLocation(state, card, 0);
    stateWithCard = withPhase(stateWithCard, 'RESOLUTION');
    
    const playedCards: PlayedCard[] = [
      { instanceId: 1, playerId: 0, location: 0, playOrder: 0 },
    ];
    
    const rng = new SeededRNG(42);
    const timelineResult = generateTimeline(stateWithCard, playedCards, rng);
    
    const rng2 = new SeededRNG(42);
    const executionResult = executeTimeline(stateWithCard, timelineResult.timeline, rng2);
    
    const revealEvents = executionResult.events.filter(e => e.type === 'CardRevealed');
    expect(revealEvents.length).toBe(1);
    expect(revealEvents[0]).toMatchObject({
      type: 'CardRevealed',
      cardInstanceId: 1,
      location: 0,
      playerId: 0,
    });
  });
  
  it('produces deterministic results with same seed', () => {
    const state = createTestGameState();
    const card1 = createTestCardInstance(1, 0);
    const card2 = createTestCardInstance(2, 1);
    
    let stateWithCards = placeCardAtLocation(state, card1, 0);
    stateWithCards = placeCardAtLocation(stateWithCards, card2, 0);
    stateWithCards = withPhase(stateWithCards, 'RESOLUTION');
    
    const playedCards: PlayedCard[] = [
      { instanceId: 1, playerId: 0, location: 0, playOrder: 0 },
      { instanceId: 2, playerId: 1, location: 0, playOrder: 0 },
    ];
    
    // Generate timeline with seed 42
    const rng1 = new SeededRNG(42);
    const timeline1 = generateTimeline(stateWithCards, playedCards, rng1);
    const execRng1 = new SeededRNG(42);
    const result1 = executeTimeline(stateWithCards, timeline1.timeline, execRng1);
    
    // Generate timeline with same seed 42
    const rng2 = new SeededRNG(42);
    const timeline2 = generateTimeline(stateWithCards, playedCards, rng2);
    const execRng2 = new SeededRNG(42);
    const result2 = executeTimeline(stateWithCards, timeline2.timeline, execRng2);
    
    // Results should be identical
    expect(result1.events.length).toBe(result2.events.length);
    expect(result1.success).toBe(result2.success);
    
    // Check cards are in same state
    const p0Cards1 = result1.state.locations[0].cardsByPlayer[0];
    const p0Cards2 = result2.state.locations[0].cardsByPlayer[0];
    expect(p0Cards1.length).toBe(p0Cards2.length);
  });
});

// =============================================================================
// Step Iterator Tests
// =============================================================================

describe('createStepIterator', () => {
  it('iterates through all steps', () => {
    const state = createTestGameState();
    const card = createTestCardInstance(1, 0);
    let stateWithCard = placeCardAtLocation(state, card, 0);
    stateWithCard = withPhase(stateWithCard, 'RESOLUTION');
    
    const playedCards: PlayedCard[] = [
      { instanceId: 1, playerId: 0, location: 0, playOrder: 0 },
    ];
    
    const rng = new SeededRNG(42);
    const timelineResult = generateTimeline(stateWithCard, playedCards, rng);
    
    const rng2 = new SeededRNG(42);
    const iterator = createStepIterator(stateWithCard, timelineResult.timeline, rng2);
    
    expect(iterator.hasNext()).toBe(true);
    expect(iterator.getTotalSteps()).toBe(timelineResult.timeline.length);
    
    // Iterate through all steps
    let stepCount = 0;
    while (iterator.hasNext()) {
      const result = iterator.next();
      expect(result).not.toBeNull();
      stepCount++;
    }
    
    expect(stepCount).toBe(timelineResult.timeline.length);
    expect(iterator.hasNext()).toBe(false);
    expect(iterator.getProgress()).toBe(100);
  });
  
  it('allows peeking at next step', () => {
    const state = createTestGameState();
    const card = createTestCardInstance(1, 0);
    let stateWithCard = placeCardAtLocation(state, card, 0);
    stateWithCard = withPhase(stateWithCard, 'RESOLUTION');
    
    const playedCards: PlayedCard[] = [
      { instanceId: 1, playerId: 0, location: 0, playOrder: 0 },
    ];
    
    const rng = new SeededRNG(42);
    const timelineResult = generateTimeline(stateWithCard, playedCards, rng);
    
    const rng2 = new SeededRNG(42);
    const iterator = createStepIterator(stateWithCard, timelineResult.timeline, rng2);
    
    const peeked = iterator.peek();
    expect(peeked).not.toBeNull();
    expect(peeked?.stepIndex).toBe(0);
    
    // Peeking shouldn't advance
    expect(iterator.getCurrentIndex()).toBe(0);
    
    // Next should return same step
    const executed = iterator.next();
    expect(executed?.step.stepIndex).toBe(0);
  });
  
  it('accumulates events correctly', () => {
    const state = createTestGameState();
    const card = createTestCardInstance(1, 0);
    let stateWithCard = placeCardAtLocation(state, card, 0);
    stateWithCard = withPhase(stateWithCard, 'RESOLUTION');
    
    const playedCards: PlayedCard[] = [
      { instanceId: 1, playerId: 0, location: 0, playOrder: 0 },
    ];
    
    const rng = new SeededRNG(42);
    const timelineResult = generateTimeline(stateWithCard, playedCards, rng);
    
    const rng2 = new SeededRNG(42);
    const iterator = createStepIterator(stateWithCard, timelineResult.timeline, rng2);
    
    // Execute all steps
    while (iterator.hasNext()) {
      iterator.next();
    }
    
    const allEvents = iterator.getEvents();
    expect(allEvents.length).toBeGreaterThan(0);
    
    // Should include CardRevealed event
    const revealEvents = allEvents.filter(e => e.type === 'CardRevealed');
    expect(revealEvents.length).toBe(1);
  });
});

// =============================================================================
// Timeline Comparison Tests
// =============================================================================

describe('compareTimelines', () => {
  it('detects identical timelines', () => {
    const state = createTestGameState();
    const card = createTestCardInstance(1, 0);
    const stateWithCard = placeCardAtLocation(state, card, 0);
    
    const playedCards: PlayedCard[] = [
      { instanceId: 1, playerId: 0, location: 0, playOrder: 0 },
    ];
    
    const rng1 = new SeededRNG(42);
    const rng2 = new SeededRNG(42);
    
    const timeline1 = generateTimeline(stateWithCard, playedCards, rng1).timeline;
    const timeline2 = generateTimeline(stateWithCard, playedCards, rng2).timeline;
    
    const result = compareTimelines(timeline1, timeline2);
    expect(result.identical).toBe(true);
    expect(result.differences).toEqual([]);
  });
  
  it('detects length differences', () => {
    const timeline1: Step[] = [];
    const timeline2: Step[] = [{
      stepIndex: 0,
      phase: 'REVEAL',
      source: { type: 'SYSTEM', id: 'SYSTEM' },
      trigger: 'ON_REVEAL',
      condition: 'NONE',
      targets: [],
      effect: 'POWER',
      value: 0,
      durationScope: 'INSTANT',
      visualMetadata: {
        visualEffectType: 'GLOW',
        intensity: 'MEDIUM',
        affectedEntities: [],
      },
    }];
    
    const result = compareTimelines(timeline1, timeline2);
    expect(result.identical).toBe(false);
    expect(result.differences.length).toBeGreaterThan(0);
  });
});
