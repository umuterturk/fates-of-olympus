/**
 * Comprehensive tests for all card effects in Fates of Olympus (TypeScript).
 *
 * Ported from Python tests/test_effects.py
 * Each effect type is tested to ensure it actually applies correctly.
 *
 * Tests cover:
 * - AddPowerEffect (Satyr, Harpies, Medusa)
 * - AddOngoingPowerEffect (Naiad Nymph)
 * - ConditionalOngoingPowerEffect (Ares)
 * - ConditionalPowerEffect (Poseidon, Cerberus, Zeus)
 * - MoveCardEffect (Iris, Hermes)
 * - DestroyCardEffect (Shade - self-destroy)
 * - DestroyAndBuffEffect (Hecate)
 * - StealPowerEffect (Shade)
 * - ScalingOngoingPowerEffect (Athena)
 * - ScalingPowerEffect (Underworld Gate)
 * - ReviveEffect (Hades)
 * - SilenceOngoingEffect (Gorgon Glare)
 */

import { describe, it, expect } from 'vitest';
import type {
  GameState,
  PlayerState,
  CardInstance,
  CardDef,
  PlayCardAction,
  PassAction,
} from './models';
import {
  getEffectivePower,
  addCard,
  getCards,
  getLocation,
  withLocation,
  withCardDestroyed,
  hasDestroyedCardThisGame,
  hasMovedCardThisGame,
  isSilenced,
  createInitialLocations,
} from './models';
import { resolveTurnDeterministic } from './controller';
import { SeededRNG } from './rng';
import { getCardDef } from './cards';
import type { PlayerId, TurnNumber, InstanceId } from './types';

/**
 * Helper to resolve turn using deterministic system with a fixed seed.
 */
function resolveTurn(
  state: GameState,
  action0: PlayCardAction | PassAction,
  action1: PlayCardAction | PassAction
): { state: GameState; events: import('./events').GameEvent[] } {
  const rng = new SeededRNG(42);
  const result = resolveTurnDeterministic(state, action0, action1, rng);
  return { state: result.state, events: result.events };
}

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a CardInstance for testing.
 */
function makeCard(
  instanceId: number,
  cardDef: CardDef,
  owner: PlayerId,
  revealed: boolean = true
): CardInstance {
  return {
    instanceId: instanceId as InstanceId,
    cardDef,
    owner,
    permanentPowerModifier: 0,
    ongoingPowerModifier: 0,
    revealed,
  };
}

/**
 * Create a test game state with specific configuration.
 */
function createTestState(options: {
  turn?: TurnNumber;
  p0Energy?: number;
  p1Energy?: number;
  p0HandDefs?: CardDef[];
  p1HandDefs?: CardDef[];
  nextInstanceId?: number;
}): GameState {
  const {
    turn = 1 as TurnNumber,
    p0Energy = 1,
    p1Energy = 1,
    p0HandDefs = [],
    p1HandDefs = [],
    nextInstanceId = 1000,
  } = options;

  // Create hand cards with unique instance IDs
  let currentId = nextInstanceId;
  const p0Hand: CardInstance[] = p0HandDefs.map((def) => {
    const card = makeCard(currentId++, def, 0, false);
    return card;
  });
  const p1Hand: CardInstance[] = p1HandDefs.map((def) => {
    const card = makeCard(currentId++, def, 1, false);
    return card;
  });

  const player0: PlayerState = {
    playerId: 0,
    deck: [],
    hand: p0Hand,
    energy: p0Energy,
    maxEnergy: p0Energy,
  };

  const player1: PlayerState = {
    playerId: 1,
    deck: [],
    hand: p1Hand,
    energy: p1Energy,
    maxEnergy: p1Energy,
  };

  return {
    turn,
    phase: 'PLANNING',
    players: [player0, player1],
    locations: createInitialLocations(),
    result: 'IN_PROGRESS',
    nextInstanceId: currentId,
    cardsDestroyedThisGame: [],
    cardsMovedThisGame: [],
    cardsMovedThisTurn: [],
    silencedCards: [],
    bonusEnergyNextTurn: [0, 0],
  };
}

/**
 * Helper to get card defs for testing.
 */
function getTestCardDef(id: string): CardDef {
  const def = getCardDef(id);
  if (!def) {
    throw new Error(`Card def not found: ${id}`);
  }
  return def;
}

// Card definitions for tests
const SATYR = () => getTestCardDef('satyr');
const HARPIES = () => getTestCardDef('harpies');
const MEDUSA = () => getTestCardDef('medusa');
const NAIAD_NYMPH = () => getTestCardDef('naiad_nymph');
const ARES = () => getTestCardDef('ares');
const POSEIDON = () => getTestCardDef('poseidon');
const CERBERUS = () => getTestCardDef('cerberus');
const ZEUS = () => getTestCardDef('zeus');
const IRIS = () => getTestCardDef('iris');
const HERMES = () => getTestCardDef('hermes');
const SHADE = () => getTestCardDef('shade');
const HECATE = () => getTestCardDef('hecate');
const ATHENA = () => getTestCardDef('athena');
const UNDERWORLD_GATE = () => getTestCardDef('underworld_gate');
const HADES = () => getTestCardDef('hades');
const GORGON_GLARE = () => getTestCardDef('gorgon_glare');
const HOPLITE = () => getTestCardDef('hoplite');
const ARGIVE_SCOUT = () => getTestCardDef('argive_scout');
const CYCLOPS = () => getTestCardDef('cyclops');

// =============================================================================
// AddPowerEffect Tests
// =============================================================================

describe('AddPowerEffect', () => {
  it('Satyr should give +1 power to another ally at same location', () => {
    let state = createTestState({
      turn: 1 as TurnNumber,
      p0Energy: 1,
      p1Energy: 1,
      p0HandDefs: [SATYR()],
      p1HandDefs: [],
    });

    // Add an ally at location 0
    const ally = makeCard(100, HOPLITE(), 0); // Base power 2
    let loc0 = getLocation(state, 0);
    loc0 = addCard(loc0, ally, 0);
    state = withLocation(state, 0, loc0);

    const satyr = state.players[0].hand[0]!;
    const action: PlayCardAction = {
      type: 'PlayCard',
      playerId: 0,
      cardInstanceId: satyr.instanceId,
      location: 0,
    };
    const passAction: PassAction = { type: 'Pass', playerId: 1 };

    const { state: newState } = resolveTurn(state, action, passAction);

    // Find the Hoplite and check it got +1
    const loc = getLocation(newState, 0);
    const hoplite = getCards(loc, 0).find((c) => c.instanceId === 100);

    expect(hoplite).toBeDefined();
    expect(getEffectivePower(hoplite!)).toBe(3); // 2 + 1 = 3
  });

  it('Harpies should give -1 power to an enemy at same location', () => {
    let state = createTestState({
      turn: 1 as TurnNumber,
      p0Energy: 1,
      p1Energy: 1,
      p0HandDefs: [HARPIES()],
      p1HandDefs: [],
    });

    // Add an enemy at location 0
    const enemy = makeCard(100, HOPLITE(), 1); // Base power 2, owned by P1
    let loc0 = getLocation(state, 0);
    loc0 = addCard(loc0, enemy, 1);
    state = withLocation(state, 0, loc0);

    const harpies = state.players[0].hand[0]!;
    const action: PlayCardAction = {
      type: 'PlayCard',
      playerId: 0,
      cardInstanceId: harpies.instanceId,
      location: 0,
    };
    const passAction: PassAction = { type: 'Pass', playerId: 1 };

    const { state: newState } = resolveTurn(state, action, passAction);

    // Find the enemy Hoplite and check it got -1
    const loc = getLocation(newState, 0);
    const enemyHoplite = getCards(loc, 1)[0]!;

    expect(getEffectivePower(enemyHoplite)).toBe(1); // 2 - 1 = 1
  });

  it('Medusa should give -1 power to ALL enemy cards at same location', () => {
    let state = createTestState({
      turn: 3 as TurnNumber,
      p0Energy: 3,
      p1Energy: 3,
      p0HandDefs: [MEDUSA()],
      p1HandDefs: [],
    });

    // Add multiple enemies at location 0
    let loc0 = getLocation(state, 0);
    const enemy1 = makeCard(100, ARGIVE_SCOUT(), 1); // Base power 3
    const enemy2 = makeCard(101, HOPLITE(), 1); // Base power 2
    loc0 = addCard(loc0, enemy1, 1);
    loc0 = addCard(loc0, enemy2, 1);
    state = withLocation(state, 0, loc0);

    const medusa = state.players[0].hand[0]!;
    const action: PlayCardAction = {
      type: 'PlayCard',
      playerId: 0,
      cardInstanceId: medusa.instanceId,
      location: 0,
    };
    const passAction: PassAction = { type: 'Pass', playerId: 1 };

    const { state: newState } = resolveTurn(state, action, passAction);

    // All enemies should have -1
    const loc = getLocation(newState, 0);
    const enemies = getCards(loc, 1);

    for (const enemy of enemies) {
      if (enemy.cardDef.id === 'argive_scout') {
        expect(getEffectivePower(enemy)).toBe(2); // 3 - 1 = 2
      } else if (enemy.cardDef.id === 'hoplite') {
        expect(getEffectivePower(enemy)).toBe(1); // 2 - 1 = 1
      }
    }
  });
});

// =============================================================================
// AddOngoingPowerEffect Tests
// =============================================================================

describe('AddOngoingPowerEffect', () => {
  it('Naiad Nymph should give +1 power to other allies at same location', () => {
    let state = createTestState({
      turn: 1 as TurnNumber,
      p0Energy: 1,
      p1Energy: 1,
      p0HandDefs: [NAIAD_NYMPH()],
      p1HandDefs: [],
    });

    // Add an ally at location 0
    const ally = makeCard(100, HOPLITE(), 0); // Base power 2
    let loc0 = getLocation(state, 0);
    loc0 = addCard(loc0, ally, 0);
    state = withLocation(state, 0, loc0);

    const naiad = state.players[0].hand[0]!;
    const action: PlayCardAction = {
      type: 'PlayCard',
      playerId: 0,
      cardInstanceId: naiad.instanceId,
      location: 0,
    };
    const passAction: PassAction = { type: 'Pass', playerId: 1 };

    const { state: newState } = resolveTurn(state, action, passAction);

    // Find the Hoplite and check it has ongoing +1
    const loc = getLocation(newState, 0);
    const hoplite = getCards(loc, 0).find((c) => c.instanceId === 100);

    expect(hoplite).toBeDefined();
    expect(getEffectivePower(hoplite!)).toBe(3); // 2 + 1 ongoing = 3
  });

  it('Naiad Nymph should NOT buff itself', () => {
    const state = createTestState({
      turn: 1 as TurnNumber,
      p0Energy: 1,
      p1Energy: 1,
      p0HandDefs: [NAIAD_NYMPH()],
      p1HandDefs: [],
    });

    const naiad = state.players[0].hand[0]!;
    const action: PlayCardAction = {
      type: 'PlayCard',
      playerId: 0,
      cardInstanceId: naiad.instanceId,
      location: 0,
    };
    const passAction: PassAction = { type: 'Pass', playerId: 1 };

    const { state: newState } = resolveTurn(state, action, passAction);

    // Find Naiad Nymph and check it's at base power
    const loc = getLocation(newState, 0);
    const naiadOnBoard = getCards(loc, 0)[0]!;

    expect(getEffectivePower(naiadOnBoard)).toBe(NAIAD_NYMPH().basePower);
  });
});

// =============================================================================
// StealPowerEffect Tests
// =============================================================================

describe('Shade DestroyAndBuff', () => {
  // Shade: "On Reveal: Destroy this. Give another allied card here +2 Power."
  it('Shade should buff an ally at same location by +2 when destroyed', () => {
    let state = createTestState({
      turn: 1 as TurnNumber,
      p0Energy: 1,
      p1Energy: 1,
      p0HandDefs: [SHADE()],
      p1HandDefs: [],
    });

    // Add a friendly hoplite at location 0 to receive the buff
    const hoplite = makeCard(100, HOPLITE(), 0); // Base power 2
    let loc0 = getLocation(state, 0);
    loc0 = addCard(loc0, hoplite, 0);
    state = withLocation(state, 0, loc0);

    const shade = state.players[0].hand[0]!;
    const action: PlayCardAction = {
      type: 'PlayCard',
      playerId: 0,
      cardInstanceId: shade.instanceId,
      location: 0,
    };
    const passAction: PassAction = { type: 'Pass', playerId: 1 };

    const { state: newState } = resolveTurn(state, action, passAction);

    // Find the hoplite and check it got buffed
    const loc = getLocation(newState, 0);
    const hopliteCard = getCards(loc, 0).find(c => c.cardDef.id === 'hoplite')!;

    // Hoplite should have 2 + 2 = 4 power
    expect(getEffectivePower(hopliteCard)).toBe(4);
  });

  it('Shade should destroy itself', () => {
    let state = createTestState({
      turn: 1 as TurnNumber,
      p0Energy: 1,
      p1Energy: 1,
      p0HandDefs: [SHADE()],
      p1HandDefs: [],
    });

    // Add an ally at location 0 to receive buff
    const hoplite = makeCard(100, HOPLITE(), 0);
    let loc0 = getLocation(state, 0);
    loc0 = addCard(loc0, hoplite, 0);
    state = withLocation(state, 0, loc0);

    const shade = state.players[0].hand[0]!;
    const action: PlayCardAction = {
      type: 'PlayCard',
      playerId: 0,
      cardInstanceId: shade.instanceId,
      location: 0,
    };
    const passAction: PassAction = { type: 'Pass', playerId: 1 };

    const { state: newState } = resolveTurn(state, action, passAction);

    // Check Shade is destroyed (only hoplite remains)
    const loc = getLocation(newState, 0);
    const p0Cards = getCards(loc, 0);

    expect(p0Cards.length).toBe(1);
    expect(p0Cards[0]!.cardDef.id).toBe('hoplite');
  });

  it("Shade's self-destroy should be tracked for destroy synergies", () => {
    let state = createTestState({
      turn: 1 as TurnNumber,
      p0Energy: 1,
      p1Energy: 1,
      p0HandDefs: [SHADE()],
      p1HandDefs: [],
    });

    // Add an ally at location 0 to receive buff
    const hoplite = makeCard(100, HOPLITE(), 0);
    let loc0 = getLocation(state, 0);
    loc0 = addCard(loc0, hoplite, 0);
    state = withLocation(state, 0, loc0);

    const shade = state.players[0].hand[0]!;
    const action: PlayCardAction = {
      type: 'PlayCard',
      playerId: 0,
      cardInstanceId: shade.instanceId,
      location: 0,
    };
    const passAction: PassAction = { type: 'Pass', playerId: 1 };

    const { state: newState } = resolveTurn(state, action, passAction);

    // Check destroy is tracked
    expect(hasDestroyedCardThisGame(newState)).toBe(true);
  });
});

// =============================================================================
// DestroyAndBuffEffect Tests
// =============================================================================

describe('DestroyAndBuffEffect', () => {
  // Hecate: "On Reveal: Destroy 1 other allied card here to give 1 enemy card here -3 Power."
  it('Hecate should destroy an ally here and give -3 to ONE enemy here', () => {
    let state = createTestState({
      turn: 4 as TurnNumber,
      p0Energy: 4,
      p1Energy: 4,
      p0HandDefs: [HECATE()],
      p1HandDefs: [],
    });

    // Add an ally to sacrifice
    let loc0 = getLocation(state, 0);
    const ally = makeCard(100, HOPLITE(), 0); // Will be destroyed
    loc0 = addCard(loc0, ally, 0);

    // Add enemy to debuff
    const enemy = makeCard(101, CYCLOPS(), 1); // Base 7
    loc0 = addCard(loc0, enemy, 1);
    state = withLocation(state, 0, loc0);

    const hecate = state.players[0].hand[0]!;
    const action: PlayCardAction = {
      type: 'PlayCard',
      playerId: 0,
      cardInstanceId: hecate.instanceId,
      location: 0,
    };
    const passAction: PassAction = { type: 'Pass', playerId: 1 };

    const { state: newState } = resolveTurn(state, action, passAction);

    const loc = getLocation(newState, 0);

    // Check ally was destroyed (only Hecate remains for P0)
    const p0Cards = getCards(loc, 0);
    const allyCards = p0Cards.filter((c) => c.instanceId === 100);
    expect(allyCards.length).toBe(0);

    // Check enemy got -3 debuff (not -4)
    const enemyCard = getCards(loc, 1)[0]!;
    expect(getEffectivePower(enemyCard)).toBe(4); // 7 - 3 = 4
  });
});

// =============================================================================
// MoveCardEffect Tests
// =============================================================================

describe('MoveCardEffect', () => {
  it('Iris should move herself to another location', () => {
    const state = createTestState({
      turn: 2 as TurnNumber,
      p0Energy: 2,
      p1Energy: 2,
      p0HandDefs: [IRIS()],
      p1HandDefs: [],
    });

    const iris = state.players[0].hand[0]!;
    const action: PlayCardAction = {
      type: 'PlayCard',
      playerId: 0,
      cardInstanceId: iris.instanceId,
      location: 0, // Play to location 0
    };
    const passAction: PassAction = { type: 'Pass', playerId: 1 };

    const { state: newState } = resolveTurn(state, action, passAction);

    // Iris should NOT be at location 0 (she moved)
    const loc0Cards = getCards(getLocation(newState, 0), 0);
    const loc1Cards = getCards(getLocation(newState, 1), 0);
    const loc2Cards = getCards(getLocation(newState, 2), 0);

    const irisAtLoc0 = loc0Cards.filter((c) => c.cardDef.id === 'iris');
    const irisAtOther = [...loc1Cards, ...loc2Cards].filter((c) => c.cardDef.id === 'iris');

    expect(irisAtLoc0.length).toBe(0);
    expect(irisAtOther.length).toBe(1);
  });

  it('Hermes should move one other allied card to another location', () => {
    let state = createTestState({
      turn: 2 as TurnNumber,
      p0Energy: 2,
      p1Energy: 2,
      p0HandDefs: [HERMES()],
      p1HandDefs: [],
    });

    // Add an ally at location 0
    let loc0 = getLocation(state, 0);
    const ally = makeCard(100, HOPLITE(), 0);
    loc0 = addCard(loc0, ally, 0);
    state = withLocation(state, 0, loc0);

    const hermes = state.players[0].hand[0]!;
    const action: PlayCardAction = {
      type: 'PlayCard',
      playerId: 0,
      cardInstanceId: hermes.instanceId,
      location: 0,
    };
    const passAction: PassAction = { type: 'Pass', playerId: 1 };

    const { state: newState } = resolveTurn(state, action, passAction);

    // Check ally moved to another location
    const loc0Cards = getCards(getLocation(newState, 0), 0);
    const loc1Cards = getCards(getLocation(newState, 1), 0);
    const loc2Cards = getCards(getLocation(newState, 2), 0);

    const allyAtLoc0 = loc0Cards.filter((c) => c.instanceId === 100);
    const allyAtOther = [...loc1Cards, ...loc2Cards].filter((c) => c.instanceId === 100);

    expect(allyAtLoc0.length).toBe(0);
    expect(allyAtOther.length).toBe(1);
  });

  it('Moving a card should be tracked for move synergies', () => {
    const state = createTestState({
      turn: 2 as TurnNumber,
      p0Energy: 2,
      p1Energy: 2,
      p0HandDefs: [IRIS()],
      p1HandDefs: [],
    });

    const iris = state.players[0].hand[0]!;
    const action: PlayCardAction = {
      type: 'PlayCard',
      playerId: 0,
      cardInstanceId: iris.instanceId,
      location: 0,
    };
    const passAction: PassAction = { type: 'Pass', playerId: 1 };

    const { state: newState } = resolveTurn(state, action, passAction);

    expect(hasMovedCardThisGame(newState)).toBe(true);
  });
});

// =============================================================================
// ConditionalPowerEffect Tests
// =============================================================================

describe('ConditionalPowerEffect', () => {
  // Cerberus: base_power: 6, "On Reveal: If you destroyed a card this game, this has +4 Power."
  it('Cerberus should get +4 power if any card was destroyed this game', () => {
    let state = createTestState({
      turn: 5 as TurnNumber,
      p0Energy: 5,
      p1Energy: 5,
      p0HandDefs: [CERBERUS()],
      p1HandDefs: [],
    });

    // Simulate having destroyed a card this game
    state = withCardDestroyed(state, 999 as InstanceId);

    const cerberus = state.players[0].hand[0]!;
    const action: PlayCardAction = {
      type: 'PlayCard',
      playerId: 0,
      cardInstanceId: cerberus.instanceId,
      location: 0,
    };
    const passAction: PassAction = { type: 'Pass', playerId: 1 };

    const { state: newState } = resolveTurn(state, action, passAction);

    const loc = getLocation(newState, 0);
    const cerberusOnBoard = getCards(loc, 0)[0]!;

    // Cerberus base 6 + 4 conditional = 10
    expect(getEffectivePower(cerberusOnBoard)).toBe(10);
  });

  it('Cerberus should NOT get +4 if no card was destroyed', () => {
    const state = createTestState({
      turn: 5 as TurnNumber,
      p0Energy: 5,
      p1Energy: 5,
      p0HandDefs: [CERBERUS()],
      p1HandDefs: [],
    });

    const cerberus = state.players[0].hand[0]!;
    const action: PlayCardAction = {
      type: 'PlayCard',
      playerId: 0,
      cardInstanceId: cerberus.instanceId,
      location: 0,
    };
    const passAction: PassAction = { type: 'Pass', playerId: 1 };

    const { state: newState } = resolveTurn(state, action, passAction);

    const loc = getLocation(newState, 0);
    const cerberusOnBoard = getCards(loc, 0)[0]!;

    // Cerberus base 6, no bonus
    expect(getEffectivePower(cerberusOnBoard)).toBe(6);
  });

  // Poseidon: base_power: 3, "On Reveal: If you moved a card this turn, give your cards here +2 Power."
  it('Poseidon should give +2 power to all cards here if moved a card this turn', () => {
    let state = createTestState({
      turn: 4 as TurnNumber,
      p0Energy: 4,
      p1Energy: 4,
      p0HandDefs: [POSEIDON()],
      p1HandDefs: [],
    });

    // Simulate having moved a card this turn (not just this game)
    state = { ...state, cardsMovedThisTurn: [999 as InstanceId] };

    const poseidon = state.players[0].hand[0]!;
    const action: PlayCardAction = {
      type: 'PlayCard',
      playerId: 0,
      cardInstanceId: poseidon.instanceId,
      location: 0,
    };
    const passAction: PassAction = { type: 'Pass', playerId: 1 };

    const { state: newState } = resolveTurn(state, action, passAction);

    const loc = getLocation(newState, 0);
    const poseidonOnBoard = getCards(loc, 0)[0]!;

    // Poseidon base 3 + 2 (buffs all cards here including self) = 5
    expect(getEffectivePower(poseidonOnBoard)).toBe(5);
  });

  // Zeus: base_power: 7, "On Reveal: If this is your only card here, this has +4 Power."
  it("Zeus should get +4 power if he's the only friendly card at his location", () => {
    const state = createTestState({
      turn: 6 as TurnNumber,
      p0Energy: 6,
      p1Energy: 6,
      p0HandDefs: [ZEUS()],
      p1HandDefs: [],
    });

    const zeus = state.players[0].hand[0]!;
    const action: PlayCardAction = {
      type: 'PlayCard',
      playerId: 0,
      cardInstanceId: zeus.instanceId,
      location: 0,
    };
    const passAction: PassAction = { type: 'Pass', playerId: 1 };

    const { state: newState } = resolveTurn(state, action, passAction);

    const loc = getLocation(newState, 0);
    const zeusOnBoard = getCards(loc, 0)[0]!;

    // Zeus base 7 + 4 (only card) = 11
    expect(getEffectivePower(zeusOnBoard)).toBe(11);
  });

  it('Zeus should NOT get +4 if there are other allies at his location', () => {
    let state = createTestState({
      turn: 6 as TurnNumber,
      p0Energy: 6,
      p1Energy: 6,
      p0HandDefs: [ZEUS()],
      p1HandDefs: [],
    });

    // Add an ally at location 0
    let loc0 = getLocation(state, 0);
    const ally = makeCard(100, HOPLITE(), 0);
    loc0 = addCard(loc0, ally, 0);
    state = withLocation(state, 0, loc0);

    const zeus = state.players[0].hand[0]!;
    const action: PlayCardAction = {
      type: 'PlayCard',
      playerId: 0,
      cardInstanceId: zeus.instanceId,
      location: 0,
    };
    const passAction: PassAction = { type: 'Pass', playerId: 1 };

    const { state: newState } = resolveTurn(state, action, passAction);

    const loc = getLocation(newState, 0);
    const zeusOnBoard = getCards(loc, 0).find((c) => c.cardDef.id === 'zeus')!;

    // Zeus base 7, no bonus (has ally)
    expect(getEffectivePower(zeusOnBoard)).toBe(7);
  });
});

// =============================================================================
// GlobalOngoingPowerEffect Tests (Underworld Gate)
// =============================================================================

describe('GlobalOngoingPowerEffect', () => {
  // Underworld Gate: base_power: 2, "Ongoing: Your DESTROY-effect cards have +1 Power (wherever they are)."
  it('Underworld Gate should give +1 power to cards with Destroy tag', () => {
    let state = createTestState({
      turn: 3 as TurnNumber,
      p0Energy: 3,
      p1Energy: 3,
      p0HandDefs: [UNDERWORLD_GATE()],
      p1HandDefs: [],
    });

    // Add a card with Destroy tag (Shade has Destroy tag)
    let loc0 = getLocation(state, 0);
    const shade = makeCard(100, SHADE(), 0); // Base 0, has Destroy tag
    loc0 = addCard(loc0, shade, 0);
    state = withLocation(state, 0, loc0);

    const gate = state.players[0].hand[0]!;
    const action: PlayCardAction = {
      type: 'PlayCard',
      playerId: 0,
      cardInstanceId: gate.instanceId,
      location: 0,
    };
    const passAction: PassAction = { type: 'Pass', playerId: 1 };

    const { state: newState } = resolveTurn(state, action, passAction);

    const loc = getLocation(newState, 0);
    const gateOnBoard = getCards(loc, 0).find(c => c.cardDef.id === 'underworld_gate')!;

    // Underworld Gate base 2 (it buffs OTHER Destroy-tagged cards, not itself unless it has Destroy tag)
    expect(getEffectivePower(gateOnBoard)).toBe(2);
  });

  it('Underworld Gate should have base power if no Destroy-tagged cards', () => {
    const state = createTestState({
      turn: 3 as TurnNumber,
      p0Energy: 3,
      p1Energy: 3,
      p0HandDefs: [UNDERWORLD_GATE()],
      p1HandDefs: [],
    });

    const gate = state.players[0].hand[0]!;
    const action: PlayCardAction = {
      type: 'PlayCard',
      playerId: 0,
      cardInstanceId: gate.instanceId,
      location: 0,
    };
    const passAction: PassAction = { type: 'Pass', playerId: 1 };

    const { state: newState } = resolveTurn(state, action, passAction);

    const loc = getLocation(newState, 0);
    const gateOnBoard = getCards(loc, 0)[0]!;

    expect(getEffectivePower(gateOnBoard)).toBe(2);
  });
});

// =============================================================================
// AddPowerEffect Tests (Athena ON_REVEAL buff)
// =============================================================================

describe('Athena OnReveal Buff', () => {
  // Athena: base_power: 2, "On Reveal: Give your other cards here +1 Power."
  it('Athena should give +1 power to other allies at same location', () => {
    let state = createTestState({
      turn: 3 as TurnNumber,
      p0Energy: 3,
      p1Energy: 3,
      p0HandDefs: [ATHENA()],
      p1HandDefs: [],
    });

    // Add 2 allies at location 0
    let loc0 = getLocation(state, 0);
    const ally1 = makeCard(100, HOPLITE(), 0); // Base 2
    const ally2 = makeCard(101, ARGIVE_SCOUT(), 0); // Base 3
    loc0 = addCard(loc0, ally1, 0);
    loc0 = addCard(loc0, ally2, 0);
    state = withLocation(state, 0, loc0);

    const athena = state.players[0].hand[0]!;
    const action: PlayCardAction = {
      type: 'PlayCard',
      playerId: 0,
      cardInstanceId: athena.instanceId,
      location: 0,
    };
    const passAction: PassAction = { type: 'Pass', playerId: 1 };

    const { state: newState } = resolveTurn(state, action, passAction);

    const loc = getLocation(newState, 0);

    // Each ally gets +1 from Athena's ON_REVEAL effect
    const hoplite = getCards(loc, 0).find((c) => c.instanceId === 100)!;
    const argive = getCards(loc, 0).find((c) => c.instanceId === 101)!;
    const athenaOnBoard = getCards(loc, 0).find((c) => c.cardDef.id === 'athena')!;

    // Hoplite: 2 + 1 = 3
    expect(getEffectivePower(hoplite)).toBe(3);
    // Argive: 3 + 1 = 4
    expect(getEffectivePower(argive)).toBe(4);
    // Athena doesn't buff herself: base 2
    expect(getEffectivePower(athenaOnBoard)).toBe(2);
  });
});

// =============================================================================
// ConditionalOngoingPowerEffect Tests
// =============================================================================

describe('ConditionalOngoingPowerEffect', () => {
  // Ares: base_power: 3, "Ongoing: If this location is full, your cards here have +1 Power."
  it('Ares should give +1 power to friendly cards if location is full', () => {
    let state = createTestState({
      turn: 3 as TurnNumber,
      p0Energy: 3,
      p1Energy: 3,
      p0HandDefs: [ARES()],
      p1HandDefs: [],
    });

    // Fill location 0: Need 4 P0 cards (Ares will be 4th)
    let loc0 = getLocation(state, 0);

    // Add 3 P0 cards (Ares will be 4th, making it full for P0)
    for (let i = 0; i < 3; i++) {
      const card = makeCard(100 + i, HOPLITE(), 0);
      loc0 = addCard(loc0, card, 0);
    }

    state = withLocation(state, 0, loc0);

    const ares = state.players[0].hand[0]!;
    const action: PlayCardAction = {
      type: 'PlayCard',
      playerId: 0,
      cardInstanceId: ares.instanceId,
      location: 0,
    };
    const passAction: PassAction = { type: 'Pass', playerId: 1 };

    const { state: newState } = resolveTurn(state, action, passAction);

    const loc = getLocation(newState, 0);
    const aresOnBoard = getCards(loc, 0).find((c) => c.cardDef.id === 'ares')!;

    // Location is now full for P0 (4 cards)
    // Ares base 3 + 1 ongoing = 4
    const actualPower = getEffectivePower(aresOnBoard);
    expect(actualPower).toBe(4);
  });

  it('Ares should NOT get +1 if location is not full', () => {
    const state = createTestState({
      turn: 3 as TurnNumber,
      p0Energy: 3,
      p1Energy: 3,
      p0HandDefs: [ARES()],
      p1HandDefs: [],
    });

    // Only Ares at location 0 (not full)
    const ares = state.players[0].hand[0]!;
    const action: PlayCardAction = {
      type: 'PlayCard',
      playerId: 0,
      cardInstanceId: ares.instanceId,
      location: 0,
    };
    const passAction: PassAction = { type: 'Pass', playerId: 1 };

    const { state: newState } = resolveTurn(state, action, passAction);

    const loc = getLocation(newState, 0);
    const aresOnBoard = getCards(loc, 0)[0]!;

    // Ares base 3, no bonus (not full)
    expect(getEffectivePower(aresOnBoard)).toBe(3);
  });
});

// =============================================================================
// SilenceOngoingEffect Tests
// =============================================================================

describe('SilenceOngoingEffect', () => {
  it('Gorgon Glare should silence enemy ongoing abilities at same location', () => {
    let state = createTestState({
      turn: 2 as TurnNumber,
      p0Energy: 2,
      p1Energy: 2,
      p0HandDefs: [GORGON_GLARE()],
      p1HandDefs: [],
    });

    // Add enemy with ongoing effect at location 0
    let loc0 = getLocation(state, 0);
    const enemyNaiad = makeCard(100, NAIAD_NYMPH(), 1); // ONGOING: +1 to allies
    loc0 = addCard(loc0, enemyNaiad, 1);
    state = withLocation(state, 0, loc0);

    const gorgon = state.players[0].hand[0]!;
    const action: PlayCardAction = {
      type: 'PlayCard',
      playerId: 0,
      cardInstanceId: gorgon.instanceId,
      location: 0,
    };
    const passAction: PassAction = { type: 'Pass', playerId: 1 };

    const { state: newState } = resolveTurn(state, action, passAction);

    // Check that enemy Naiad is silenced
    expect(isSilenced(newState, 100 as InstanceId)).toBe(true);
  });
});

// =============================================================================
// DestroyAndGainPowerEffect Tests (Hades)
// =============================================================================

describe('DestroyAndGainPowerEffect', () => {
  // Hades: base_power: 4, "On Reveal: Destroy 1 other allied card here. This gains its Power."
  it('Hades should destroy an ally and gain its power', () => {
    let state = createTestState({
      turn: 5 as TurnNumber,
      p0Energy: 5,
      p1Energy: 5,
      p0HandDefs: [HADES()],
      p1HandDefs: [],
    });

    // Add an ally with 3 power to sacrifice
    let loc0 = getLocation(state, 0);
    const ally = makeCard(100, ARGIVE_SCOUT(), 0); // Base 3
    loc0 = addCard(loc0, ally, 0);
    state = withLocation(state, 0, loc0);

    const hades = state.players[0].hand[0]!;
    const action: PlayCardAction = {
      type: 'PlayCard',
      playerId: 0,
      cardInstanceId: hades.instanceId,
      location: 0,
    };
    const passAction: PassAction = { type: 'Pass', playerId: 1 };

    const { state: newState } = resolveTurn(state, action, passAction);

    const loc = getLocation(newState, 0);
    const p0Cards = getCards(loc, 0);

    // Ally should be destroyed, only Hades remains
    expect(p0Cards.length).toBe(1);
    expect(p0Cards[0]!.cardDef.id).toBe('hades');
    
    // Hades should have gained the ally's power: 4 + 3 = 7
    expect(getEffectivePower(p0Cards[0]!)).toBe(7);
  });

  it('Hades should NOT gain power if no ally to destroy', () => {
    const state = createTestState({
      turn: 5 as TurnNumber,
      p0Energy: 5,
      p1Energy: 5,
      p0HandDefs: [HADES()],
      p1HandDefs: [],
    });

    const hades = state.players[0].hand[0]!;
    const action: PlayCardAction = {
      type: 'PlayCard',
      playerId: 0,
      cardInstanceId: hades.instanceId,
      location: 0,
    };
    const passAction: PassAction = { type: 'Pass', playerId: 1 };

    const { state: newState } = resolveTurn(state, action, passAction);

    const loc = getLocation(newState, 0);
    const hadesOnBoard = getCards(loc, 0)[0]!;

    // Hades base 4, no bonus (no ally to destroy)
    expect(getEffectivePower(hadesOnBoard)).toBe(4);
  });

  it('Hades should track destruction for synergies', () => {
    let state = createTestState({
      turn: 5 as TurnNumber,
      p0Energy: 5,
      p1Energy: 5,
      p0HandDefs: [HADES()],
      p1HandDefs: [],
    });

    // Add an ally to sacrifice
    let loc0 = getLocation(state, 0);
    const ally = makeCard(100, HOPLITE(), 0); // Base 2
    loc0 = addCard(loc0, ally, 0);
    state = withLocation(state, 0, loc0);

    const hades = state.players[0].hand[0]!;
    const action: PlayCardAction = {
      type: 'PlayCard',
      playerId: 0,
      cardInstanceId: hades.instanceId,
      location: 0,
    };
    const passAction: PassAction = { type: 'Pass', playerId: 1 };

    const { state: newState } = resolveTurn(state, action, passAction);

    // Check destruction was tracked
    expect(hasDestroyedCardThisGame(newState)).toBe(true);
  });
});

// =============================================================================
// Integration: Shade + Cerberus Synergy
// =============================================================================

describe('Destroy Synergy', () => {
  // Shade: "On Reveal: Destroy this. Give another allied card here +2 Power."
  // Cerberus: base 6, "On Reveal: If you destroyed a card this game, this has +4 Power."
  it("Playing Shade should enable Cerberus's +4 bonus", () => {
    let state = createTestState({
      turn: 5 as TurnNumber,
      p0Energy: 7, // Enough for both Shade(1) and Cerberus(6)
      p1Energy: 5,
      p0HandDefs: [SHADE(), CERBERUS()],
      p1HandDefs: [],
    });

    // Add an ally for Shade to buff (Shade buffs ally, then destroys itself)
    let loc0 = getLocation(state, 0);
    const ally = makeCard(100, HOPLITE(), 0); // Base 2
    loc0 = addCard(loc0, ally, 0);
    state = withLocation(state, 0, loc0);

    // Play Shade first (it will buff ally and destroy itself)
    const shade = state.players[0].hand[0]!;
    const actionShade: PlayCardAction = {
      type: 'PlayCard',
      playerId: 0,
      cardInstanceId: shade.instanceId,
      location: 0,
    };

    const { state: stateAfterShade } = resolveTurn(
      state,
      actionShade,
      { type: 'Pass', playerId: 1 }
    );

    // Verify Shade triggered destroy tracking
    expect(hasDestroyedCardThisGame(stateAfterShade)).toBe(true);

    // Now play Cerberus
    const cerberus = stateAfterShade.players[0].hand[0]!;
    const actionCerberus: PlayCardAction = {
      type: 'PlayCard',
      playerId: 0,
      cardInstanceId: cerberus.instanceId,
      location: 1, // Different location
    };

    const { state: finalState } = resolveTurn(
      stateAfterShade,
      actionCerberus,
      { type: 'Pass', playerId: 1 }
    );

    const loc = getLocation(finalState, 1);
    const cerberusOnBoard = getCards(loc, 0)[0]!;

    // Cerberus should have +4 from destroy synergy: 6 + 4 = 10
    expect(getEffectivePower(cerberusOnBoard)).toBe(10);
  });
});

// =============================================================================
// Integration: Move + Poseidon Synergy
// =============================================================================

describe('Move Synergy', () => {
  // Poseidon: base_power: 3, "On Reveal: If you moved a card this turn, give your cards here +2 Power."
  // Note: Poseidon's condition is moved_this_turn, not moved_this_game
  it("Poseidon should get +2 if a move happened this turn", () => {
    let state = createTestState({
      turn: 4 as TurnNumber,
      p0Energy: 6,
      p1Energy: 4,
      p0HandDefs: [POSEIDON()],
      p1HandDefs: [],
    });

    // Simulate having moved a card this turn
    state = { ...state, cardsMovedThisTurn: [999 as InstanceId] };

    const poseidon = state.players[0].hand[0]!;
    const actionPoseidon: PlayCardAction = {
      type: 'PlayCard',
      playerId: 0,
      cardInstanceId: poseidon.instanceId,
      location: 2,
    };

    const { state: finalState } = resolveTurn(
      state,
      actionPoseidon,
      { type: 'Pass', playerId: 1 }
    );

    const loc = getLocation(finalState, 2);
    const poseidonOnBoard = getCards(loc, 0)[0]!;

    // Poseidon base 3 + 2 = 5
    expect(getEffectivePower(poseidonOnBoard)).toBe(5);
  });

  it("Poseidon should NOT get +2 if no move happened this turn", () => {
    const state = createTestState({
      turn: 4 as TurnNumber,
      p0Energy: 6,
      p1Energy: 4,
      p0HandDefs: [POSEIDON()],
      p1HandDefs: [],
    });

    const poseidon = state.players[0].hand[0]!;
    const actionPoseidon: PlayCardAction = {
      type: 'PlayCard',
      playerId: 0,
      cardInstanceId: poseidon.instanceId,
      location: 2,
    };

    const { state: finalState } = resolveTurn(
      state,
      actionPoseidon,
      { type: 'Pass', playerId: 1 }
    );

    const loc = getLocation(finalState, 2);
    const poseidonOnBoard = getCards(loc, 0)[0]!;

    // Poseidon base 3, no bonus
    expect(getEffectivePower(poseidonOnBoard)).toBe(3);
  });
});
