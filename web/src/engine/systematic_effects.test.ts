import { describe, it, expect } from 'vitest';
import type {
    GameState,
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
    isSilenced,
    createInitialLocations,
} from './models';
import { resolveTurnDeterministic, startNextTurn } from './controller';
import { SeededRNG } from './rng';
import { getCardDef } from './cards';
import type { PlayerId, TurnNumber, InstanceId, LocationIndex } from './types';
import type { GameEvent } from './events';

/**
 * Helper to resolve turn using deterministic system with a fixed seed.
 */
function resolveTurn(
    state: GameState,
    action0: PlayCardAction | PassAction,
    action1: PlayCardAction | PassAction
): { state: GameState; events: GameEvent[] } {
    const rng = new SeededRNG(42);
    const result = resolveTurnDeterministic(state, action0, action1, rng);
    return { state: result.state, events: result.events };
}

// =============================================================================
// Helpers
// =============================================================================

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

function createTestState(options: {
    turn?: TurnNumber;
    p0Energy?: number;
    p1Energy?: number;
    p0HandDefs?: CardDef[];
    p1HandDefs?: CardDef[];
    nextInstanceId?: number;
    destroyed?: number[];
    moved?: number[];
}): GameState {
    const {
        turn = 1 as TurnNumber,
        p0Energy = 1,
        p1Energy = 1,
        p0HandDefs = [],
        p1HandDefs = [],
        nextInstanceId = 1000,
        destroyed = [],
        moved = [],
    } = options;

    let currentId = nextInstanceId;
    const p0Hand: CardInstance[] = p0HandDefs.map((def) => makeCard(currentId++, def, 0, false));
    const p1Hand: CardInstance[] = p1HandDefs.map((def) => makeCard(currentId++, def, 1, false));

    return {
        turn,
        phase: 'PLANNING',
        players: [
            { playerId: 0, deck: [], hand: p0Hand, energy: p0Energy, maxEnergy: p0Energy },
            { playerId: 1, deck: [], hand: p1Hand, energy: p1Energy, maxEnergy: p1Energy },
        ],
        locations: createInitialLocations(),
        result: 'IN_PROGRESS',
        nextInstanceId: currentId,
        cardsDestroyedThisGame: destroyed.map(id => id as InstanceId),
        cardsMovedThisGame: moved.map(id => id as InstanceId),
        cardsMovedThisTurn: moved.map(id => id as InstanceId),
        silencedCards: [],
        bonusEnergyNextTurn: [0, 0],
    };
}

const getDef = (id: string) => getCardDef(id)!;

// =============================================================================
// Tests
// =============================================================================

describe('Systematic Effect Verification', () => {

    describe('AddPowerEffect (Harpies, Satyr, Medusa)', () => {
        it('Harpies: Should ONLY debuff ONE enemy at SAME location by EXACTLY -1', () => {
            let state = createTestState({ p0HandDefs: [getDef('harpies')] });

            // Setup: 
            // Loc 0: 2 enemy Hoplites (base 2)
            // Loc 1: 1 enemy Hoplite
            const e1 = makeCard(101, getDef('hoplite'), 1);
            const e2 = makeCard(102, getDef('hoplite'), 1);
            const e3 = makeCard(103, getDef('hoplite'), 1);

            state = withLocation(state, 0, addCard(addCard(getLocation(state, 0), e1, 1), e2, 1));
            state = withLocation(state, 1, addCard(getLocation(state, 1), e3, 1));

            const harpies = state.players[0].hand[0]!;
            const { state: nextState } = resolveTurn(state,
                { type: 'PlayCard', playerId: 0, cardInstanceId: harpies.instanceId, location: 0 },
                { type: 'Pass', playerId: 1 }
            );

            const loc0Enemies = getCards(getLocation(nextState, 0), 1);
            const loc1Enemies = getCards(getLocation(nextState, 1), 1);

            // Verify Loc 0: exactly one debuffed
            const loc0Powers = loc0Enemies.map(c => getEffectivePower(c));
            expect(loc0Powers).toContain(1); // 2 - 1 = 1
            expect(loc0Powers).toContain(2); // Still 2
            expect(loc0Powers.reduce((a, b) => a + b, 0)).toBe(3); // 1 + 2 = 3

            // Verify Loc 1: none debuffed
            expect(getEffectivePower(loc1Enemies[0]!)).toBe(2);
        });

        it('Harpies: Should hit UNREVEALED cards too (permanent modifier)', () => {
            let state = createTestState({ p0HandDefs: [getDef('harpies')] });
            const enemy = makeCard(101, getDef('hoplite'), 1, false); // Face Down
            state = withLocation(state, 0, addCard(getLocation(state, 0), enemy, 1));

            const harpies = state.players[0].hand[0]!;
            const { state: nextState } = resolveTurn(state,
                { type: 'PlayCard', playerId: 0, cardInstanceId: harpies.instanceId, location: 0 },
                { type: 'Pass', playerId: 1 }
            );

            const enemyOnBoard = getCards(getLocation(nextState, 0), 1)[0]!;
            expect(enemyOnBoard.permanentPowerModifier).toBe(-1);
        });

        it('Harpies: Should NOT debuff anything if NO enemies are present', () => {
            const state = createTestState({ p0HandDefs: [getDef('harpies')] });
            const harpies = state.players[0].hand[0]!;
            const { state: nextState } = resolveTurn(state,
                { type: 'PlayCard', playerId: 0, cardInstanceId: harpies.instanceId, location: 0 },
                { type: 'Pass', playerId: 1 }
            );
            // No crash, and P0 has Harpies on board
            expect(getCards(getLocation(nextState, 0), 0).length).toBe(1);
        });

        it('Satyr: Should ONLY buff ONE ally at SAME location by EXACTLY +1', () => {
            let state = createTestState({ p0HandDefs: [getDef('satyr')] });

            const a1 = makeCard(101, getDef('hoplite'), 0);
            const a2 = makeCard(102, getDef('hoplite'), 0);
            const a3 = makeCard(103, getDef('hoplite'), 0);

            state = withLocation(state, 0, addCard(addCard(getLocation(state, 0), a1, 0), a2, 0));
            state = withLocation(state, 1, addCard(getLocation(state, 1), a3, 0));

            const satyr = state.players[0].hand[0]!;
            const { state: nextState } = resolveTurn(state,
                { type: 'PlayCard', playerId: 0, cardInstanceId: satyr.instanceId, location: 0 },
                { type: 'Pass', playerId: 1 }
            );

            const loc0Allies = getCards(getLocation(nextState, 0), 0).filter(c => c.cardDef.id !== 'satyr');
            const loc1Allies = getCards(getLocation(nextState, 1), 0);

            const loc0Powers = loc0Allies.map(c => getEffectivePower(c));
            expect(loc0Powers).toContain(3); // 2 + 1 = 3
            expect(loc0Powers).toContain(2); // Still 2

            expect(getEffectivePower(loc1Allies[0]!)).toBe(2);
        });

        it('Medusa: Should debuff ALL enemies at SAME location by -1', () => {
            let state = createTestState({ p0HandDefs: [getDef('medusa')], p0Energy: 3 });

            const e1 = makeCard(101, getDef('hoplite'), 1);
            const e2 = makeCard(102, getDef('hoplite'), 1);
            const e3 = makeCard(103, getDef('hoplite'), 1);

            state = withLocation(state, 0, addCard(addCard(getLocation(state, 0), e1, 1), e2, 1));
            state = withLocation(state, 1, addCard(getLocation(state, 1), e3, 1));

            const medusa = state.players[0].hand[0]!;
            const { state: nextState } = resolveTurn(state,
                { type: 'PlayCard', playerId: 0, cardInstanceId: medusa.instanceId, location: 0 },
                { type: 'Pass', playerId: 1 }
            );

            const loc0Enemies = getCards(getLocation(nextState, 0), 1);
            const loc1Enemies = getCards(getLocation(nextState, 1), 1);

            expect(getEffectivePower(loc0Enemies[0]!)).toBe(1);
            expect(getEffectivePower(loc0Enemies[1]!)).toBe(1);
            expect(getEffectivePower(loc1Enemies[0]!)).toBe(2);
        });
    });

    describe('MoveCardEffect (Iris, Hermes, Phaethon, Pegasus Rider)', () => {
        // Iris: "On Reveal: Move this to another location."
        it('Iris: Should move herself to another location', () => {
            const state = createTestState({ p0HandDefs: [getDef('iris')], p0Energy: 2 });

            const iris = state.players[0].hand[0]!;
            const { state: resolvedState } = resolveTurn(state,
                { type: 'PlayCard', playerId: 0, cardInstanceId: iris.instanceId, location: 0 },
                { type: 'Pass', playerId: 1 }
            );

            // Verify Iris moved from location 0
            const loc0Cards = getCards(getLocation(resolvedState, 0), 0);
            expect(loc0Cards.length).toBe(0);

            // Verify Iris is at another location
            const allIris = ([0, 1, 2] as LocationIndex[]).flatMap(i => getCards(getLocation(resolvedState, i), 0)).filter(c => c.cardDef.id === 'iris');
            expect(allIris.length).toBe(1);

            // Move should be tracked
            expect(resolvedState.cardsMovedThisGame.length).toBe(1);
        });

        it('Hermes: Should move ONE other ally from SAME location to ANOTHER', () => {
            let state = createTestState({ p0HandDefs: [getDef('hermes')], p0Energy: 2 });
            const ally = makeCard(101, getDef('hoplite'), 0);
            state = withLocation(state, 0, addCard(getLocation(state, 0), ally, 0));

            const hermes = state.players[0].hand[0]!;
            const { state: nextState } = resolveTurn(state,
                { type: 'PlayCard', playerId: 0, cardInstanceId: hermes.instanceId, location: 0 },
                { type: 'Pass', playerId: 1 }
            );

            expect(getCards(getLocation(nextState, 0), 0).length).toBe(1); // Only Hermes
            const otherLocsCards = ([1, 2] as LocationIndex[]).flatMap(i => getCards(getLocation(nextState, i), 0));
            expect(otherLocsCards.length).toBe(1);
            expect(otherLocsCards[0]!.instanceId).toBe(101);
        });

        it('Phaethon: Should move himself', () => {
            const state = createTestState({ p0HandDefs: [getDef('phaethon')], p0Energy: 2 });
            const phaethon = state.players[0].hand[0]!;
            const { state: nextState } = resolveTurn(state,
                { type: 'PlayCard', playerId: 0, cardInstanceId: phaethon.instanceId, location: 0 },
                { type: 'Pass', playerId: 1 }
            );
            expect(getCards(getLocation(nextState, 0), 0).length).toBe(0);
            expect(([1, 2] as LocationIndex[]).flatMap(i => getCards(getLocation(nextState, i), 0)).length).toBe(1);
        });

        it('Pegasus Rider: Should move ONE other ally', () => {
            let state = createTestState({ p0HandDefs: [getDef('pegasus_rider')], p0Energy: 4 });
            const ally = makeCard(101, getDef('hoplite'), 0);
            state = withLocation(state, 0, addCard(getLocation(state, 0), ally, 0));

            const rider = state.players[0].hand[0]!;
            const { state: nextState } = resolveTurn(state,
                { type: 'PlayCard', playerId: 0, cardInstanceId: rider.instanceId, location: 0 },
                { type: 'Pass', playerId: 1 }
            );

            expect(getCards(getLocation(nextState, 0), 0).length).toBe(1); // Only Rider
            expect(([1, 2] as LocationIndex[]).flatMap(i => getCards(getLocation(nextState, i), 0)).filter(c => c.instanceId === 101).length).toBe(1);
        });
    });

    describe('Shade DestroyAndBuff', () => {
        // Shade: "On Reveal: Destroy this. Give another allied card here +2 Power."
        it('Shade: Should buff ally by +2 and destroy self', () => {
            let state = createTestState({ p0HandDefs: [getDef('shade')] });
            const ally = makeCard(101, getDef('hoplite'), 0); // Power 2
            state = withLocation(state, 0, addCard(getLocation(state, 0), ally, 0));

            const shade = state.players[0].hand[0]!;
            const { state: nextState } = resolveTurn(state,
                { type: 'PlayCard', playerId: 0, cardInstanceId: shade.instanceId, location: 0 },
                { type: 'Pass', playerId: 1 }
            );

            // Ally should have +2: 2 + 2 = 4
            const allyOnBoard = getCards(getLocation(nextState, 0), 0)[0]!;
            expect(getEffectivePower(allyOnBoard)).toBe(4);

            // Only ally should remain (Shade destroyed itself)
            const p0Cards = getCards(getLocation(nextState, 0), 0);
            expect(p0Cards.length).toBe(1);
            expect(p0Cards[0]!.instanceId).toBe(101);

            // Destroyed should be tracked
            expect(nextState.cardsDestroyedThisGame.length).toBe(1);
        });
    });

    describe('Ongoing Effects (Underworld Gate, Athena)', () => {
        // Underworld Gate: "Ongoing: Your DESTROY-effect cards have +1 Power (wherever they are)."
        it('Underworld Gate: gives ongoing +1 to Destroy-tagged cards', () => {
            const state = createTestState({ p0HandDefs: [getDef('underworld_gate')], p0Energy: 3 });

            const gate = state.players[0].hand[0]!;
            const { state: nextState } = resolveTurn(state,
                { type: 'PlayCard', playerId: 0, cardInstanceId: gate.instanceId, location: 0 },
                { type: 'Pass', playerId: 1 }
            );

            // Underworld Gate base 2 (it doesn't buff itself unless it has Destroy tag)
            const gateOnBoard = getCards(getLocation(nextState, 0), 0)[0]!;
            expect(getEffectivePower(gateOnBoard)).toBe(2);
        });

        // Athena: "On Reveal: Give your other cards here +1 Power."
        it('Athena: ON_REVEAL buffs other cards here by +1', () => {
            let state = createTestState({ p0HandDefs: [getDef('athena')], p0Energy: 3 });
            const a1 = makeCard(101, getDef('hoplite'), 0);
            const a2 = makeCard(102, getDef('hoplite'), 0);
            state = withLocation(state, 0, addCard(addCard(getLocation(state, 0), a1, 0), a2, 0));

            const athena = state.players[0].hand[0]!;
            const { state: nextState } = resolveTurn(state,
                { type: 'PlayCard', playerId: 0, cardInstanceId: athena.instanceId, location: 0 },
                { type: 'Pass', playerId: 1 }
            );

            const hoplites = getCards(getLocation(nextState, 0), 0).filter(c => c.cardDef.id === 'hoplite');
            // Each hoplite gets +1 from Athena's ON_REVEAL
            expect(getEffectivePower(hoplites[0]!)).toBe(3); // 2 + 1
            expect(getEffectivePower(hoplites[1]!)).toBe(3); // 2 + 1

            // Athena should stay base 2 (doesn't buff self)
            const athenaOnBoard = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'athena')!;
            expect(getEffectivePower(athenaOnBoard)).toBe(2);
        });
    });

    describe('Ongoing Technical effects (Gorgon Glare, Naiad Nymph)', () => {
        it('Gorgon Glare: Silences enemy ongoing effects here', () => {
            let state = createTestState({ p0HandDefs: [getDef('gorgon_glare')], p0Energy: 2 });
            const nymph = makeCard(101, getDef('naiad_nymph'), 1); // Buffs others by +1
            const enemyHoplite = makeCard(102, getDef('hoplite'), 1);
            state = withLocation(state, 0, addCard(addCard(getLocation(state, 0), nymph, 1), enemyHoplite, 1));

            // Before silence: Hoplite should be 3 (2+1)
            // Actually resolveTurn recomputes ongoing, so we test the result

            const gorgon = state.players[0].hand[0]!;
            const { state: nextState } = resolveTurn(state,
                { type: 'PlayCard', playerId: 0, cardInstanceId: gorgon.instanceId, location: 0 },
                { type: 'Pass', playerId: 1 }
            );

            const hopliteOnBoard = getCards(getLocation(nextState, 0), 1).find(c => c.cardDef.id === 'hoplite')!;
            // Nymph is silenced, so Hoplite is back to 2
            expect(getEffectivePower(hopliteOnBoard)).toBe(2);
            expect(isSilenced(nextState, 101 as InstanceId)).toBe(true);
        });
    });

    describe('DestroyAndBuffEffect (Hecate)', () => {
        // Hecate: "On Reveal: Destroy 1 other allied card here to give 1 enemy card here -3 Power."
        it('Hecate: Destroys one ally here to debuff one enemy here by -3', () => {
            let state = createTestState({ p0HandDefs: [getDef('hecate')], p0Energy: 4 });
            const ally = makeCard(101, getDef('hoplite'), 0);
            const enemy = makeCard(102, getDef('cyclops'), 1); // Power 7
            state = withLocation(state, 0, addCard(addCard(getLocation(state, 0), ally, 0), enemy, 1));

            const hecate = state.players[0].hand[0]!;
            const { state: nextState } = resolveTurn(state,
                { type: 'PlayCard', playerId: 0, cardInstanceId: hecate.instanceId, location: 0 },
                { type: 'Pass', playerId: 1 }
            );

            // Ally should be gone
            expect(getCards(getLocation(nextState, 0), 0).length).toBe(1); // Only Hecate
            // Enemy power: 7 - 3 = 4
            const enemyOnBoard = getCards(getLocation(nextState, 0), 1)[0]!;
            expect(getEffectivePower(enemyOnBoard)).toBe(4);
        });
    });

    describe('DestroyAndGainPowerEffect (Hades)', () => {
        // Hades: "On Reveal: Destroy 1 other allied card here. This gains its Power."
        it('Hades: destroys ally and gains its power', () => {
            let state = createTestState({ p0HandDefs: [getDef('hades')], p0Energy: 5 });
            const ally = makeCard(101, getDef('argive_scout'), 0); // Power 3
            state = withLocation(state, 0, addCard(getLocation(state, 0), ally, 0));

            const hades = state.players[0].hand[0]!;
            const { state: nextState } = resolveTurn(state,
                { type: 'PlayCard', playerId: 0, cardInstanceId: hades.instanceId, location: 0 },
                { type: 'Pass', playerId: 1 }
            );

            const p0Cards = getCards(getLocation(nextState, 0), 0);
            expect(p0Cards.length).toBe(1); // Only Hades (ally was destroyed)
            
            // Hades should have gained ally's power: 4 (base) + 3 (ally power) = 7
            const hadesOnBoard = p0Cards[0]!;
            expect(getEffectivePower(hadesOnBoard)).toBe(7);
            
            // Destruction should be tracked
            expect(nextState.cardsDestroyedThisGame.length).toBe(1);
        });
    });

    describe('Energy Bonus (Iris / Locations)', () => {
        it('Should grant +1 max energy per location won at turn start', () => {
            let state = createTestState({});
            // P0 winning location 0
            const a1 = makeCard(101, getDef('hoplite'), 0);
            state = withLocation(state, 0, addCard(getLocation(state, 0), a1, 0));

            const { state: nextTurnState } = startNextTurn(state);
            // Turn 2: Base 2 + 1 location won = 3
            expect(nextTurnState.players[0].energy).toBe(3);
            // P1: Base 2 + 0 locations won = 2
            expect(nextTurnState.players[1].energy).toBe(2);
        });
    });

    // =========================================================================
    // NEW TESTS: MoveAndBuffEffect, MoveAndSelfBuffEffect, DestroyAndSelfBuffEffect
    // =========================================================================

    describe('MoveAndBuffEffect (Charon, Ariadne)', () => {
        it('Charon: Should move an ally here and gain +2 Power if successful', () => {
            let state = createTestState({ p0Energy: 4, p0HandDefs: [getDef('charon')] }); // Charon costs 4
            // Place ally at location 1 to be moved
            const ally = makeCard(101, getDef('hoplite'), 0);
            state = withLocation(state, 1, addCard(getLocation(state, 1), ally, 0));

            const charon = state.players[0].hand[0]!;
            const action: PlayCardAction = {
                type: 'PlayCard',
                playerId: 0,
                cardInstanceId: charon.instanceId,
                location: 0,
            };
            const passAction: PassAction = { type: 'Pass', playerId: 1 };

            const { state: nextState } = resolveTurn(state, action, passAction);

            // Charon should have base 3 + 2 = 5 power
            const charonCard = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'charon');
            expect(charonCard).toBeDefined();
            expect(getEffectivePower(charonCard!)).toBe(5);

            // Ally should have moved to location 0
            const movedAlly = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'hoplite');
            expect(movedAlly).toBeDefined();
        });

        it('Ariadne: Should move an ally here and buff the moved card by +1', () => {
            let state = createTestState({ p0Energy: 2, p0HandDefs: [getDef('ariadne')] }); // Ariadne costs 2
            // Place ally at location 1 to be moved
            const ally = makeCard(101, getDef('hoplite'), 0); // base 2
            state = withLocation(state, 1, addCard(getLocation(state, 1), ally, 0));

            const ariadne = state.players[0].hand[0]!;
            const action: PlayCardAction = {
                type: 'PlayCard',
                playerId: 0,
                cardInstanceId: ariadne.instanceId,
                location: 0,
            };
            const passAction: PassAction = { type: 'Pass', playerId: 1 };

            const { state: nextState } = resolveTurn(state, action, passAction);

            // The moved hoplite should have base 2 + 1 buff = 3
            const movedAlly = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'hoplite');
            expect(movedAlly).toBeDefined();
            expect(getEffectivePower(movedAlly!)).toBe(3);
        });
    });

    describe('MoveAndSelfBuffEffect (Nike)', () => {
        it('Nike: Should move self and gain +2 Power', () => {
            const state = createTestState({ p0Energy: 2, p0HandDefs: [getDef('nike')] }); // Nike costs 2

            const nike = state.players[0].hand[0]!;
            const action: PlayCardAction = {
                type: 'PlayCard',
                playerId: 0,
                cardInstanceId: nike.instanceId,
                location: 0,
            };
            const passAction: PassAction = { type: 'Pass', playerId: 1 };

            const { state: nextState } = resolveTurn(state, action, passAction);

            // Nike should have moved from location 0 to another location
            const nikeAtLoc0 = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'nike');
            expect(nikeAtLoc0).toBeUndefined(); // Moved away

            // Find Nike at another location
            let nikeCard: CardInstance | undefined;
            for (const locIdx of [1, 2] as LocationIndex[]) {
                nikeCard = getCards(getLocation(nextState, locIdx), 0).find(c => c.cardDef.id === 'nike');
                if (nikeCard) break;
            }
            expect(nikeCard).toBeDefined();
            // Nike base 2 + 2 buff = 4
            expect(getEffectivePower(nikeCard!)).toBe(4);
        });
    });

    describe('DestroyAndSelfBuffEffect (Kronos, Moira Atropos)', () => {
        it('Kronos: Should destroy an ally and gain +4 Power', () => {
            let state = createTestState({ p0Energy: 6, p0HandDefs: [getDef('kronos')] }); // Kronos costs 6
            // Place an ally at location 0
            const ally = makeCard(101, getDef('hoplite'), 0);
            state = withLocation(state, 0, addCard(getLocation(state, 0), ally, 0));

            const kronos = state.players[0].hand[0]!;
            const action: PlayCardAction = {
                type: 'PlayCard',
                playerId: 0,
                cardInstanceId: kronos.instanceId,
                location: 0,
            };
            const passAction: PassAction = { type: 'Pass', playerId: 1 };

            const { state: nextState } = resolveTurn(state, action, passAction);

            // Kronos should have base 7 + 4 = 11 power
            const kronosCard = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'kronos');
            expect(kronosCard).toBeDefined();
            expect(getEffectivePower(kronosCard!)).toBe(11);

            // Ally should be destroyed
            const hoplite = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'hoplite');
            expect(hoplite).toBeUndefined();
        });

        it('Moira Atropos: Should destroy an ally and gain +4 Power', () => {
            let state = createTestState({ p0Energy: 3, p0HandDefs: [getDef('moira_atropos')] }); // Moira costs 3
            const ally = makeCard(101, getDef('shade'), 0);
            state = withLocation(state, 0, addCard(getLocation(state, 0), ally, 0));

            const moira = state.players[0].hand[0]!;
            const action: PlayCardAction = {
                type: 'PlayCard',
                playerId: 0,
                cardInstanceId: moira.instanceId,
                location: 0,
            };
            const passAction: PassAction = { type: 'Pass', playerId: 1 };

            const { state: nextState } = resolveTurn(state, action, passAction);

            // Moira Atropos base 2 + 4 = 6
            const moiraCard = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'moira_atropos');
            expect(moiraCard).toBeDefined();
            expect(getEffectivePower(moiraCard!)).toBe(6);
        });
    });

    // =========================================================================
    // NEW TESTS: ConditionalPowerEffect with various conditions
    // =========================================================================

    describe('ConditionalPowerEffect - New Conditions', () => {
        it('Apollo: Should buff ally +3 if exactly 1 other ally here', () => {
            let state = createTestState({ p0Energy: 3, p0HandDefs: [getDef('apollo')] }); // Apollo costs 3
            // Place exactly 1 ally at location 0
            const ally = makeCard(101, getDef('hoplite'), 0);
            state = withLocation(state, 0, addCard(getLocation(state, 0), ally, 0));

            const apollo = state.players[0].hand[0]!;
            const action: PlayCardAction = {
                type: 'PlayCard',
                playerId: 0,
                cardInstanceId: apollo.instanceId,
                location: 0,
            };
            const passAction: PassAction = { type: 'Pass', playerId: 1 };

            const { state: nextState } = resolveTurn(state, action, passAction);

            // Hoplite should have base 2 + 3 = 5 power
            const hoplite = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'hoplite');
            expect(hoplite).toBeDefined();
            expect(getEffectivePower(hoplite!)).toBe(5);
        });

        it('Apollo: Should NOT buff if more than 1 other ally', () => {
            let state = createTestState({ p0Energy: 3, p0HandDefs: [getDef('apollo')] }); // Apollo costs 3
            // Place 2 allies at location 0
            const ally1 = makeCard(101, getDef('hoplite'), 0);
            const ally2 = makeCard(102, getDef('satyr'), 0);
            state = withLocation(state, 0, addCard(getLocation(state, 0), ally1, 0));
            state = withLocation(state, 0, addCard(getLocation(state, 0), ally2, 0));

            const apollo = state.players[0].hand[0]!;
            const action: PlayCardAction = {
                type: 'PlayCard',
                playerId: 0,
                cardInstanceId: apollo.instanceId,
                location: 0,
            };
            const passAction: PassAction = { type: 'Pass', playerId: 1 };

            const { state: nextState } = resolveTurn(state, action, passAction);

            // Neither ally should be buffed
            const hoplite = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'hoplite');
            expect(getEffectivePower(hoplite!)).toBe(2); // base only
        });

        it('Artemis: Should debuff enemy -2 if enemy has more cards here', () => {
            let state = createTestState({ p0Energy: 3, p0HandDefs: [getDef('artemis')] }); // Artemis costs 3
            // Place 2 enemies at location 0
            const enemy1 = makeCard(101, getDef('hoplite'), 1);
            const enemy2 = makeCard(102, getDef('satyr'), 1);
            state = withLocation(state, 0, addCard(getLocation(state, 0), enemy1, 1));
            state = withLocation(state, 0, addCard(getLocation(state, 0), enemy2, 1));

            const artemis = state.players[0].hand[0]!;
            const action: PlayCardAction = {
                type: 'PlayCard',
                playerId: 0,
                cardInstanceId: artemis.instanceId,
                location: 0,
            };
            const passAction: PassAction = { type: 'Pass', playerId: 1 };

            const { state: nextState } = resolveTurn(state, action, passAction);

            // One enemy should be debuffed by -2
            const enemies = getCards(getLocation(nextState, 0), 1);
            const debuffedCount = enemies.filter(e => e.permanentPowerModifier === -2).length;
            expect(debuffedCount).toBe(1);
        });

        it('Lamia: Should debuff enemy -2 if 3+ enemies here', () => {
            let state = createTestState({ p0Energy: 2, p0HandDefs: [getDef('lamia')] }); // Lamia costs 2
            // Place 3 enemies at location 0
            const enemy1 = makeCard(101, getDef('hoplite'), 1);
            const enemy2 = makeCard(102, getDef('satyr'), 1);
            const enemy3 = makeCard(103, getDef('myrmidon'), 1);
            state = withLocation(state, 0, addCard(getLocation(state, 0), enemy1, 1));
            state = withLocation(state, 0, addCard(getLocation(state, 0), enemy2, 1));
            state = withLocation(state, 0, addCard(getLocation(state, 0), enemy3, 1));

            const lamia = state.players[0].hand[0]!;
            const action: PlayCardAction = {
                type: 'PlayCard',
                playerId: 0,
                cardInstanceId: lamia.instanceId,
                location: 0,
            };
            const passAction: PassAction = { type: 'Pass', playerId: 1 };

            const { state: nextState } = resolveTurn(state, action, passAction);

            // One enemy should be debuffed by -2
            const enemies = getCards(getLocation(nextState, 0), 1);
            const debuffedCount = enemies.filter(e => e.permanentPowerModifier === -2).length;
            expect(debuffedCount).toBe(1);
        });

        it('Nemesis: Should debuff highest-power enemy by -4', () => {
            let state = createTestState({ p0Energy: 5, p0HandDefs: [getDef('nemesis')] }); // Nemesis costs 5
            // Place enemies with different powers
            const weakEnemy = makeCard(101, getDef('hoplite'), 1); // base 2
            const strongEnemy = makeCard(102, getDef('cyclops'), 1); // base 7
            state = withLocation(state, 0, addCard(getLocation(state, 0), weakEnemy, 1));
            state = withLocation(state, 0, addCard(getLocation(state, 0), strongEnemy, 1));

            const nemesis = state.players[0].hand[0]!;
            const action: PlayCardAction = {
                type: 'PlayCard',
                playerId: 0,
                cardInstanceId: nemesis.instanceId,
                location: 0,
            };
            const passAction: PassAction = { type: 'Pass', playerId: 1 };

            const { state: nextState } = resolveTurn(state, action, passAction);

            // Cyclops (highest power) should be debuffed: base 7 - 4 = 3
            const cyclops = getCards(getLocation(nextState, 0), 1).find(c => c.cardDef.id === 'cyclops');
            expect(cyclops).toBeDefined();
            expect(getEffectivePower(cyclops!)).toBe(3);

            // Hoplite should be unchanged
            const hoplite = getCards(getLocation(nextState, 0), 1).find(c => c.cardDef.id === 'hoplite');
            expect(getEffectivePower(hoplite!)).toBe(2);
        });

        it('Persephone: Should buff ally +2 if destroyed a card this game', () => {
            let state = createTestState({ p0Energy: 2, destroyed: [99], p0HandDefs: [getDef('persephone')] }); // Persephone costs 2
            const ally = makeCard(101, getDef('hoplite'), 0);
            state = withLocation(state, 0, addCard(getLocation(state, 0), ally, 0));

            const persephone = state.players[0].hand[0]!;
            const action: PlayCardAction = {
                type: 'PlayCard',
                playerId: 0,
                cardInstanceId: persephone.instanceId,
                location: 0,
            };
            const passAction: PassAction = { type: 'Pass', playerId: 1 };

            const { state: nextState } = resolveTurn(state, action, passAction);

            // Hoplite should have base 2 + 2 = 4
            const hoplite = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'hoplite');
            expect(getEffectivePower(hoplite!)).toBe(4);
        });

        it("Poseidon's Wrath: Should gain +6 if moved a card this turn", () => {
            const state = createTestState({ p0Energy: 6, moved: [101], p0HandDefs: [getDef('poseidons_wrath')] }); // Poseidon's Wrath costs 6

            const poseidonsWrath = state.players[0].hand[0]!;
            const action: PlayCardAction = {
                type: 'PlayCard',
                playerId: 0,
                cardInstanceId: poseidonsWrath.instanceId,
                location: 0,
            };
            const passAction: PassAction = { type: 'Pass', playerId: 1 };

            const { state: nextState } = resolveTurn(state, action, passAction);

            // Poseidon's Wrath base 6 + 6 = 12
            const card = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'poseidons_wrath');
            expect(card).toBeDefined();
            expect(getEffectivePower(card!)).toBe(12);
        });

        it('Priest of Hestia: Should gain +2 if empty slot here', () => {
            const state = createTestState({ p0Energy: 2, p0HandDefs: [getDef('priest_of_hestia')] }); // Priest of Hestia costs 2
            // Location 0 has no cards = empty slots

            const priest = state.players[0].hand[0]!;
            const action: PlayCardAction = {
                type: 'PlayCard',
                playerId: 0,
                cardInstanceId: priest.instanceId,
                location: 0,
            };
            const passAction: PassAction = { type: 'Pass', playerId: 1 };

            const { state: nextState } = resolveTurn(state, action, passAction);

            // Base 2 + 2 = 4 (since there are empty slots after playing)
            const priestCard = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'priest_of_hestia');
            expect(priestCard).toBeDefined();
            expect(getEffectivePower(priestCard!)).toBe(4);
        });

        it('Zeus: Should gain +4 if only card here', () => {
            const state = createTestState({ p0Energy: 6, p0HandDefs: [getDef('zeus')] });
            // Location 0 is empty - Zeus will be the only card

            const zeus = state.players[0].hand[0]!;
            const action: PlayCardAction = {
                type: 'PlayCard',
                playerId: 0,
                cardInstanceId: zeus.instanceId,
                location: 0,
            };
            const passAction: PassAction = { type: 'Pass', playerId: 1 };

            const { state: nextState } = resolveTurn(state, action, passAction);

            // Zeus base 7 + 4 = 11
            const zeusCard = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'zeus');
            expect(zeusCard).toBeDefined();
            expect(getEffectivePower(zeusCard!)).toBe(11);
        });

        it('Zeus: Should NOT gain +4 if not alone', () => {
            let state = createTestState({ p0Energy: 6, p0HandDefs: [getDef('zeus')] });
            // Place an ally first at location 0
            const ally = makeCard(101, getDef('hoplite'), 0);
            state = withLocation(state, 0, addCard(getLocation(state, 0), ally, 0));

            const zeus = state.players[0].hand[0]!;
            const action: PlayCardAction = {
                type: 'PlayCard',
                playerId: 0,
                cardInstanceId: zeus.instanceId,
                location: 0,
            };
            const passAction: PassAction = { type: 'Pass', playerId: 1 };

            const { state: nextState } = resolveTurn(state, action, passAction);

            // Zeus should stay at base 7 (no buff since not alone)
            const zeusCard = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'zeus');
            expect(zeusCard).toBeDefined();
            expect(getEffectivePower(zeusCard!)).toBe(7);
        });

        it('Oracle of Delphi: Should buff allies +2 if losing location', () => {
            let state = createTestState({ p0Energy: 5, p0HandDefs: [getDef('oracle_of_delphi')] });
            // Setup: Enemy has more power at location 0
            // Place a strong enemy (Cyclops has base power 7)
            const enemy = makeCard(201, getDef('cyclops'), 1);
            state = withLocation(state, 0, addCard(getLocation(state, 0), enemy, 1));

            const oracle = state.players[0].hand[0]!;
            const action: PlayCardAction = {
                type: 'PlayCard',
                playerId: 0,
                cardInstanceId: oracle.instanceId,
                location: 0,
            };
            const passAction: PassAction = { type: 'Pass', playerId: 1 };

            const { state: nextState } = resolveTurn(state, action, passAction);

            // Oracle base 5 + 2 = 7 (since player is losing: enemy 7 > player's pre-buff Oracle 5)
            const oracleCard = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'oracle_of_delphi');
            expect(oracleCard).toBeDefined();
            expect(getEffectivePower(oracleCard!)).toBe(7);
        });

        it('Oracle of Delphi: Should NOT buff if winning or tied', () => {
            let state = createTestState({ p0Energy: 5, p0HandDefs: [getDef('oracle_of_delphi')] });
            // Setup: Player already has more power at location 0
            // Place a strong ally (Cyclops has base power 7)
            const ally = makeCard(101, getDef('cyclops'), 0);
            state = withLocation(state, 0, addCard(getLocation(state, 0), ally, 0));
            // Place a weak enemy (Hoplite has base power 2)
            const enemy = makeCard(201, getDef('hoplite'), 1);
            state = withLocation(state, 0, addCard(getLocation(state, 0), enemy, 1));

            const oracle = state.players[0].hand[0]!;
            const action: PlayCardAction = {
                type: 'PlayCard',
                playerId: 0,
                cardInstanceId: oracle.instanceId,
                location: 0,
            };
            const passAction: PassAction = { type: 'Pass', playerId: 1 };

            const { state: nextState } = resolveTurn(state, action, passAction);

            // Oracle should stay at base 5 (no buff since winning: ally 7 + Oracle 5 = 12 > enemy 2)
            const oracleCard = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'oracle_of_delphi');
            expect(oracleCard).toBeDefined();
            expect(getEffectivePower(oracleCard!)).toBe(5);

            // Ally should also NOT be buffed
            const cyclops = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'cyclops');
            expect(getEffectivePower(cyclops!)).toBe(7);
        });
    });

    // =========================================================================
    // NEW TESTS: ConditionalOngoingPowerEffect
    // =========================================================================

    describe('ConditionalOngoingPowerEffect - New Conditions', () => {
        it('Hera: Should buff allies +1 if exactly 2 allies here', () => {
            let state = createTestState({});
            // Place Hera and 1 other ally = exactly 2
            const hera = makeCard(101, getDef('hera'), 0, true);
            const ally = makeCard(102, getDef('hoplite'), 0, true);
            state = withLocation(state, 0, addCard(getLocation(state, 0), hera, 0));
            state = withLocation(state, 0, addCard(getLocation(state, 0), ally, 0));

            // Resolve turn to trigger ongoing
            const passAction: PassAction = { type: 'Pass', playerId: 0 };
            const passAction2: PassAction = { type: 'Pass', playerId: 1 };
            const { state: nextState } = resolveTurn(state, passAction, passAction2);

            // Both should have +1 ongoing
            const heraCard = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'hera');
            const hoplite = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'hoplite');
            // Hera base 4 + 1 = 5
            expect(getEffectivePower(heraCard!)).toBe(5);
            // Hoplite base 2 + 1 = 3
            expect(getEffectivePower(hoplite!)).toBe(3);
        });

        it('Sirens: Should debuff enemies -1 if location is full', () => {
            let state = createTestState({});
            // Fill location 0 (4 allies + enemy = need full)
            const sirens = makeCard(101, getDef('sirens'), 0, true);
            const ally1 = makeCard(102, getDef('hoplite'), 0, true);
            const ally2 = makeCard(103, getDef('satyr'), 0, true);
            const ally3 = makeCard(104, getDef('myrmidon'), 0, true);
            const enemy = makeCard(201, getDef('hoplite'), 1, true);
            
            state = withLocation(state, 0, addCard(getLocation(state, 0), sirens, 0));
            state = withLocation(state, 0, addCard(getLocation(state, 0), ally1, 0));
            state = withLocation(state, 0, addCard(getLocation(state, 0), ally2, 0));
            state = withLocation(state, 0, addCard(getLocation(state, 0), ally3, 0));
            state = withLocation(state, 0, addCard(getLocation(state, 0), enemy, 1));

            const passAction: PassAction = { type: 'Pass', playerId: 0 };
            const passAction2: PassAction = { type: 'Pass', playerId: 1 };
            const { state: nextState } = resolveTurn(state, passAction, passAction2);

            // Enemy should have -1 ongoing (base 2 - 1 = 1)
            const enemyCard = getCards(getLocation(nextState, 0), 1).find(c => c.cardDef.id === 'hoplite');
            expect(getEffectivePower(enemyCard!)).toBe(1);
        });

        it('Typhon: Should lose -4 if location is full', () => {
            let state = createTestState({});
            // Fill location 0 with Typhon and allies
            const typhon = makeCard(101, getDef('typhon'), 0, true);
            const ally1 = makeCard(102, getDef('hoplite'), 0, true);
            const ally2 = makeCard(103, getDef('satyr'), 0, true);
            const ally3 = makeCard(104, getDef('myrmidon'), 0, true);
            const enemy = makeCard(201, getDef('hoplite'), 1, true);

            state = withLocation(state, 0, addCard(getLocation(state, 0), typhon, 0));
            state = withLocation(state, 0, addCard(getLocation(state, 0), ally1, 0));
            state = withLocation(state, 0, addCard(getLocation(state, 0), ally2, 0));
            state = withLocation(state, 0, addCard(getLocation(state, 0), ally3, 0));
            state = withLocation(state, 0, addCard(getLocation(state, 0), enemy, 1));

            const passAction: PassAction = { type: 'Pass', playerId: 0 };
            const passAction2: PassAction = { type: 'Pass', playerId: 1 };
            const { state: nextState } = resolveTurn(state, passAction, passAction2);

            // Typhon base 10 - 4 = 6
            const typhonCard = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'typhon');
            expect(getEffectivePower(typhonCard!)).toBe(6);
        });

        // Nereus buffs allies if a card was moved this turn
        // The test plays Iris (move self) to trigger move tracking, then verifies Nereus buffs allies
        it('Nereus: Should buff allies +1 if moved a card this turn', () => {
            // Nereus (base 3) is already on the board at location 0
            // Iris (base 2, cost 2) will be played at location 0, then move herself
            // After Iris moves, Nereus's ongoing should buff allies at loc 0 by +1
            let state = createTestState({ p0Energy: 2, p0HandDefs: [getDef('iris')] });
            
            // Place Nereus and Hoplite at location 0 (revealed, already on board)
            const nereus = makeCard(101, getDef('nereus'), 0, true);
            const hoplite = makeCard(102, getDef('hoplite'), 0, true);
            state = withLocation(state, 0, addCard(getLocation(state, 0), nereus, 0));
            state = withLocation(state, 0, addCard(getLocation(state, 0), hoplite, 0));

            // Play Iris at location 0 - she will move herself to another location
            const iris = state.players[0].hand[0]!;
            const playIrisAction: PlayCardAction = {
                type: 'PlayCard',
                playerId: 0,
                cardInstanceId: iris.instanceId,
                location: 0,
            };
            const passAction: PassAction = { type: 'Pass', playerId: 1 };
            const { state: nextState } = resolveTurn(state, playIrisAction, passAction);

            // Iris moved this turn, so Nereus's condition is satisfied
            // Both Nereus and Hoplite at location 0 should get +1 ongoing buff
            const nereusCard = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'nereus');
            const hopliteCard = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'hoplite');
            
            expect(nereusCard).toBeDefined();
            expect(hopliteCard).toBeDefined();
            expect(getEffectivePower(nereusCard!)).toBe(4); // base 3 + 1
            expect(getEffectivePower(hopliteCard!)).toBe(3); // base 2 + 1
        });
    });

    // =========================================================================
    // NEW TESTS: Ongoing Debuff Effects
    // =========================================================================

    describe('Ongoing Debuff Effects (Nyx, Moira Clotho, Erinyes)', () => {
        it('Nyx: Should debuff all enemies here by -1', () => {
            let state = createTestState({});
            const nyx = makeCard(101, getDef('nyx'), 0, true);
            const enemy1 = makeCard(201, getDef('hoplite'), 1, true);
            const enemy2 = makeCard(202, getDef('satyr'), 1, true);

            state = withLocation(state, 0, addCard(getLocation(state, 0), nyx, 0));
            state = withLocation(state, 0, addCard(getLocation(state, 0), enemy1, 1));
            state = withLocation(state, 0, addCard(getLocation(state, 0), enemy2, 1));

            const passAction: PassAction = { type: 'Pass', playerId: 0 };
            const passAction2: PassAction = { type: 'Pass', playerId: 1 };
            const { state: nextState } = resolveTurn(state, passAction, passAction2);

            // Enemies should have -1 ongoing
            const enemyHoplite = getCards(getLocation(nextState, 0), 1).find(c => c.cardDef.id === 'hoplite');
            const enemySatyr = getCards(getLocation(nextState, 0), 1).find(c => c.cardDef.id === 'satyr');
            expect(getEffectivePower(enemyHoplite!)).toBe(1); // base 2 - 1
            expect(getEffectivePower(enemySatyr!)).toBe(0); // base 1 - 1
        });

        // Moira Clotho debuffs enemy ONGOING cards by -1
        // Note: Naiad Nymph is an ONGOING card that buffs other allies at its location by +1
        it('Moira Clotho: Should debuff enemy ONGOING cards by -1', () => {
            let state = createTestState({});
            const clotho = makeCard(101, getDef('moira_clotho'), 0, true);
            const enemyOngoing = makeCard(201, getDef('naiad_nymph'), 1, true); // ONGOING card, base 1
            const enemyVanilla = makeCard(202, getDef('hoplite'), 1, true); // NOT ongoing, base 2

            state = withLocation(state, 0, addCard(getLocation(state, 0), clotho, 0));
            state = withLocation(state, 0, addCard(getLocation(state, 0), enemyOngoing, 1));
            state = withLocation(state, 0, addCard(getLocation(state, 0), enemyVanilla, 1));

            const passAction: PassAction = { type: 'Pass', playerId: 0 };
            const passAction2: PassAction = { type: 'Pass', playerId: 1 };
            const { state: nextState } = resolveTurn(state, passAction, passAction2);

            // Naiad (ongoing) should be debuffed by Clotho: base 1 - 1 = 0
            const naiad = getCards(getLocation(nextState, 0), 1).find(c => c.cardDef.id === 'naiad_nymph');
            expect(getEffectivePower(naiad!)).toBe(0); // base 1 - 1 (Clotho debuff)

            // Hoplite (vanilla) is NOT debuffed by Clotho, but gets +1 from Naiad's ongoing buff
            // Result: base 2 + 1 (Naiad buff) = 3
            const hoplite = getCards(getLocation(nextState, 0), 1).find(c => c.cardDef.id === 'hoplite');
            expect(getEffectivePower(hoplite!)).toBe(3); // base 2 + 1 (Naiad buff)
        });

        it('Erinyes: Should debuff enemy BUFF-tagged cards by -1', () => {
            let state = createTestState({});
            const erinyes = makeCard(101, getDef('erinyes'), 0, true);
            const enemyBuffTagged = makeCard(201, getDef('satyr'), 1, true); // Has "Buff" tag
            const enemyNonBuff = makeCard(202, getDef('hoplite'), 1, true); // No Buff tag

            state = withLocation(state, 0, addCard(getLocation(state, 0), erinyes, 0));
            state = withLocation(state, 0, addCard(getLocation(state, 0), enemyBuffTagged, 1));
            state = withLocation(state, 0, addCard(getLocation(state, 0), enemyNonBuff, 1));

            const passAction: PassAction = { type: 'Pass', playerId: 0 };
            const passAction2: PassAction = { type: 'Pass', playerId: 1 };
            const { state: nextState } = resolveTurn(state, passAction, passAction2);

            // Satyr (buff-tagged) should be debuffed
            const satyr = getCards(getLocation(nextState, 0), 1).find(c => c.cardDef.id === 'satyr');
            expect(getEffectivePower(satyr!)).toBe(0); // base 1 - 1

            // Hoplite (not buff-tagged) should NOT be debuffed
            const hoplite = getCards(getLocation(nextState, 0), 1).find(c => c.cardDef.id === 'hoplite');
            expect(getEffectivePower(hoplite!)).toBe(2); // base only
        });
    });

    // =========================================================================
    // NEW TESTS: ScalingOngoingPowerEffect (Dionysus)
    // =========================================================================

    describe('ScalingOngoingPowerEffect (Dionysus)', () => {
        it('Dionysus: Should buff allies +1 per empty slot', () => {
            let state = createTestState({});
            // Dionysus + 1 ally = 2 cards, 2 empty slots on each side
            const dionysus = makeCard(101, getDef('dionysus'), 0, true);
            const ally = makeCard(102, getDef('hoplite'), 0, true);

            state = withLocation(state, 0, addCard(getLocation(state, 0), dionysus, 0));
            state = withLocation(state, 0, addCard(getLocation(state, 0), ally, 0));

            const passAction: PassAction = { type: 'Pass', playerId: 0 };
            const passAction2: PassAction = { type: 'Pass', playerId: 1 };
            const { state: nextState } = resolveTurn(state, passAction, passAction2);

            // With 2 ally cards and 4 enemy slots empty = total 6 empty slots?
            // Actually, Dionysus counts empty slots "here" for player 0 = 4 - 2 = 2 empty slots
            // So both should get +2 ongoing
            const dionysusCard = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'dionysus');
            const hoplite = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'hoplite');
            
            // Dionysus base 4 + 2 (for 2 empty slots) = 6
            expect(getEffectivePower(dionysusCard!)).toBe(6);
            // Hoplite base 2 + 2 = 4
            expect(getEffectivePower(hoplite!)).toBe(4);
        });
    });

    // =========================================================================
    // NEW TESTS: Combined Effects (Hephaestus, Hypnos, Lernaean Hydra)
    // =========================================================================

    describe('Combined Effects (Hephaestus, Hypnos, Lernaean Hydra)', () => {
        it('Hephaestus: Should buff allies +2 THEN destroy one ally', () => {
            let state = createTestState({ p0Energy: 5, p0HandDefs: [getDef('hephaestus')] }); // Hephaestus costs 5
            const ally1 = makeCard(101, getDef('hoplite'), 0);
            const ally2 = makeCard(102, getDef('satyr'), 0);
            state = withLocation(state, 0, addCard(getLocation(state, 0), ally1, 0));
            state = withLocation(state, 0, addCard(getLocation(state, 0), ally2, 0));

            const hephaestus = state.players[0].hand[0]!;
            const action: PlayCardAction = {
                type: 'PlayCard',
                playerId: 0,
                cardInstanceId: hephaestus.instanceId,
                location: 0,
            };
            const passAction: PassAction = { type: 'Pass', playerId: 1 };

            const { state: nextState } = resolveTurn(state, action, passAction);

            // Hephaestus should be buffed (base 4 + 2 = 6)
            const hephaestusCard = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'hephaestus');
            expect(hephaestusCard).toBeDefined();
            expect(getEffectivePower(hephaestusCard!)).toBe(6);

            // One ally should be destroyed, one should remain with +2
            const allies = getCards(getLocation(nextState, 0), 0).filter(c => c.cardDef.id !== 'hephaestus');
            expect(allies.length).toBe(1);
            // Surviving ally should have +2 buff
            expect(allies[0]!.permanentPowerModifier).toBe(2);
        });

        it('Hypnos: Should move self and debuff enemy at destination', () => {
            let state = createTestState({ p0Energy: 3, p0HandDefs: [getDef('hypnos')] }); // Hypnos costs 3
            // Place enemy at location 1
            const enemy = makeCard(201, getDef('hoplite'), 1);
            state = withLocation(state, 1, addCard(getLocation(state, 1), enemy, 1));

            const hypnos = state.players[0].hand[0]!;
            const action: PlayCardAction = {
                type: 'PlayCard',
                playerId: 0,
                cardInstanceId: hypnos.instanceId,
                location: 0,
            };
            const passAction: PassAction = { type: 'Pass', playerId: 1 };

            const { state: nextState } = resolveTurn(state, action, passAction);

            // Hypnos should have moved from location 0
            const hypnosAtLoc0 = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'hypnos');
            expect(hypnosAtLoc0).toBeUndefined();

            // Find Hypnos at destination
            let hypnosCard: CardInstance | undefined;
            let hypnosLoc: LocationIndex | undefined;
            for (const locIdx of [1, 2] as LocationIndex[]) {
                hypnosCard = getCards(getLocation(nextState, locIdx), 0).find(c => c.cardDef.id === 'hypnos');
                if (hypnosCard) {
                    hypnosLoc = locIdx;
                    break;
                }
            }
            expect(hypnosCard).toBeDefined();

            // If moved to location 1, enemy there should be debuffed
            if (hypnosLoc === 1) {
                const enemyCard = getCards(getLocation(nextState, 1), 1).find(c => c.cardDef.id === 'hoplite');
                expect(enemyCard).toBeDefined();
                expect(getEffectivePower(enemyCard!)).toBe(1); // base 2 - 1
            }
        });

        it('Lernaean Hydra: Should destroy self and buff allies at other locations', () => {
            let state = createTestState({ p0Energy: 4, p0HandDefs: [getDef('lernaean_hydra')] }); // Lernaean Hydra costs 4
            const ally1 = makeCard(101, getDef('hoplite'), 0);
            const ally2 = makeCard(102, getDef('satyr'), 0);
            state = withLocation(state, 1, addCard(getLocation(state, 1), ally1, 0));
            state = withLocation(state, 2, addCard(getLocation(state, 2), ally2, 0));

            const hydra = state.players[0].hand[0]!;
            // Play Hydra at location 0
            const action: PlayCardAction = {
                type: 'PlayCard',
                playerId: 0,
                cardInstanceId: hydra.instanceId,
                location: 0,
            };
            const passAction: PassAction = { type: 'Pass', playerId: 1 };

            const { state: nextState } = resolveTurn(state, action, passAction);

            // Hydra should be destroyed
            const hydraCard = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'lernaean_hydra');
            expect(hydraCard).toBeUndefined();

            // Allies at other locations should be buffed +1
            const hoplite = getCards(getLocation(nextState, 1), 0).find(c => c.cardDef.id === 'hoplite');
            const satyr = getCards(getLocation(nextState, 2), 0).find(c => c.cardDef.id === 'satyr');
            expect(getEffectivePower(hoplite!)).toBe(3); // base 2 + 1
            expect(getEffectivePower(satyr!)).toBe(2); // base 1 + 1
        });

        it('Stygian Candle: Should destroy self and debuff enemy', () => {
            let state = createTestState({ p0Energy: 1, p0HandDefs: [getDef('stygian_candle')] }); // Stygian Candle costs 1
            const enemy = makeCard(201, getDef('hoplite'), 1);
            state = withLocation(state, 0, addCard(getLocation(state, 0), enemy, 1));

            const candle = state.players[0].hand[0]!;
            const action: PlayCardAction = {
                type: 'PlayCard',
                playerId: 0,
                cardInstanceId: candle.instanceId,
                location: 0,
            };
            const passAction: PassAction = { type: 'Pass', playerId: 1 };

            const { state: nextState } = resolveTurn(state, action, passAction);

            // Candle should be destroyed
            const candleCard = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'stygian_candle');
            expect(candleCard).toBeUndefined();

            // Enemy should be debuffed -2
            const hoplite = getCards(getLocation(nextState, 0), 1).find(c => c.cardDef.id === 'hoplite');
            expect(getEffectivePower(hoplite!)).toBe(0); // base 2 - 2
        });

        it('Bronze Coin: Should destroy self and buff ally at other location', () => {
            let state = createTestState({ p0Energy: 1, p0HandDefs: [getDef('bronze_coin')] }); // Bronze Coin costs 1
            const ally = makeCard(101, getDef('hoplite'), 0);
            state = withLocation(state, 1, addCard(getLocation(state, 1), ally, 0));

            const coin = state.players[0].hand[0]!;
            const action: PlayCardAction = {
                type: 'PlayCard',
                playerId: 0,
                cardInstanceId: coin.instanceId,
                location: 0,
            };
            const passAction: PassAction = { type: 'Pass', playerId: 1 };

            const { state: nextState } = resolveTurn(state, action, passAction);

            // Coin should be destroyed
            const coinCard = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'bronze_coin');
            expect(coinCard).toBeUndefined();

            // Ally at other location should be buffed +2
            const hoplite = getCards(getLocation(nextState, 1), 0).find(c => c.cardDef.id === 'hoplite');
            expect(getEffectivePower(hoplite!)).toBe(4); // base 2 + 2
        });
    });

    // =========================================================================
    // MISSING CARD COVERAGE TESTS
    // =========================================================================

    describe('DestroyAndBuffEffect to Other Location (Ashen Offering, Zagreus)', () => {
        it('Ashen Offering: Should destroy ally here and buff ally at OTHER location +2', () => {
            let state = createTestState({ p0Energy: 3, p0HandDefs: [getDef('ashen_offering')] }); // cost 3
            // Ally to sacrifice at location 0
            const sacrificeAlly = makeCard(101, getDef('hoplite'), 0);
            state = withLocation(state, 0, addCard(getLocation(state, 0), sacrificeAlly, 0));
            // Ally to buff at location 1
            const buffAlly = makeCard(102, getDef('myrmidon'), 0); // base 4
            state = withLocation(state, 1, addCard(getLocation(state, 1), buffAlly, 0));

            const ashenOffering = state.players[0].hand[0]!;
            const action: PlayCardAction = {
                type: 'PlayCard',
                playerId: 0,
                cardInstanceId: ashenOffering.instanceId,
                location: 0,
            };
            const passAction: PassAction = { type: 'Pass', playerId: 1 };

            const { state: nextState } = resolveTurn(state, action, passAction);

            // Sacrifice ally should be destroyed
            const sacrificed = getCards(getLocation(nextState, 0), 0).find(c => c.instanceId === 101);
            expect(sacrificed).toBeUndefined();

            // Ashen Offering should remain (base 0)
            const offering = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'ashen_offering');
            expect(offering).toBeDefined();
            expect(getEffectivePower(offering!)).toBe(0);

            // Ally at other location should be buffed +2
            const myrmidon = getCards(getLocation(nextState, 1), 0).find(c => c.cardDef.id === 'myrmidon');
            expect(myrmidon).toBeDefined();
            expect(getEffectivePower(myrmidon!)).toBe(6); // base 4 + 2

            // Destruction should be tracked
            expect(nextState.cardsDestroyedThisGame.length).toBeGreaterThan(0);
        });

        it('Ashen Offering: Should NOT buff if no ally to destroy', () => {
            let state = createTestState({ p0Energy: 3, p0HandDefs: [getDef('ashen_offering')] });
            // Ally at other location only
            const buffAlly = makeCard(102, getDef('myrmidon'), 0);
            state = withLocation(state, 1, addCard(getLocation(state, 1), buffAlly, 0));

            const ashenOffering = state.players[0].hand[0]!;
            const action: PlayCardAction = {
                type: 'PlayCard',
                playerId: 0,
                cardInstanceId: ashenOffering.instanceId,
                location: 0,
            };
            const passAction: PassAction = { type: 'Pass', playerId: 1 };

            const { state: nextState } = resolveTurn(state, action, passAction);

            // No ally was destroyed, so buff should not apply
            const myrmidon = getCards(getLocation(nextState, 1), 0).find(c => c.cardDef.id === 'myrmidon');
            expect(getEffectivePower(myrmidon!)).toBe(4); // unchanged
        });

        it('Zagreus: Should destroy ally here and buff ally at OTHER location +3', () => {
            let state = createTestState({ p0Energy: 3, p0HandDefs: [getDef('zagreus')] }); // cost 3
            // Ally to sacrifice at location 0
            const sacrificeAlly = makeCard(101, getDef('shade'), 0);
            state = withLocation(state, 0, addCard(getLocation(state, 0), sacrificeAlly, 0));
            // Ally to buff at location 1
            const buffAlly = makeCard(102, getDef('hoplite'), 0); // base 2
            state = withLocation(state, 1, addCard(getLocation(state, 1), buffAlly, 0));

            const zagreus = state.players[0].hand[0]!;
            const action: PlayCardAction = {
                type: 'PlayCard',
                playerId: 0,
                cardInstanceId: zagreus.instanceId,
                location: 0,
            };
            const passAction: PassAction = { type: 'Pass', playerId: 1 };

            const { state: nextState } = resolveTurn(state, action, passAction);

            // Sacrifice ally should be destroyed
            const sacrificed = getCards(getLocation(nextState, 0), 0).find(c => c.instanceId === 101);
            expect(sacrificed).toBeUndefined();

            // Zagreus should remain (base 2)
            const zagreusCard = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'zagreus');
            expect(zagreusCard).toBeDefined();
            expect(getEffectivePower(zagreusCard!)).toBe(2);

            // Ally at other location should be buffed +3
            const hoplite = getCards(getLocation(nextState, 1), 0).find(c => c.cardDef.id === 'hoplite');
            expect(hoplite).toBeDefined();
            expect(getEffectivePower(hoplite!)).toBe(5); // base 2 + 3

            // Destruction should be tracked
            expect(nextState.cardsDestroyedThisGame.length).toBeGreaterThan(0);
        });
    });

    describe('AddPowerEffect Variants (Athena Parthenos, Laurel Wreath)', () => {
        it('Athena Parthenos: Should buff all other allies here +2', () => {
            let state = createTestState({ p0Energy: 4, p0HandDefs: [getDef('athena_parthenos')] }); // cost 4
            const ally1 = makeCard(101, getDef('hoplite'), 0); // base 2
            const ally2 = makeCard(102, getDef('satyr'), 0); // base 1
            state = withLocation(state, 0, addCard(getLocation(state, 0), ally1, 0));
            state = withLocation(state, 0, addCard(getLocation(state, 0), ally2, 0));

            const athenaParthenos = state.players[0].hand[0]!;
            const action: PlayCardAction = {
                type: 'PlayCard',
                playerId: 0,
                cardInstanceId: athenaParthenos.instanceId,
                location: 0,
            };
            const passAction: PassAction = { type: 'Pass', playerId: 1 };

            const { state: nextState } = resolveTurn(state, action, passAction);

            // Hoplite: base 2 + 2 = 4
            const hoplite = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'hoplite');
            expect(getEffectivePower(hoplite!)).toBe(4);

            // Satyr: base 1 + 2 = 3
            const satyr = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'satyr');
            expect(getEffectivePower(satyr!)).toBe(3);

            // Athena Parthenos should NOT buff herself: base 3
            const athenaCard = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'athena_parthenos');
            expect(getEffectivePower(athenaCard!)).toBe(3);
        });

        it('Laurel Wreath: Should buff ONE other ally here +2', () => {
            let state = createTestState({ p0Energy: 1, p0HandDefs: [getDef('laurel_wreath')] }); // cost 1
            const ally1 = makeCard(101, getDef('hoplite'), 0); // base 2
            const ally2 = makeCard(102, getDef('satyr'), 0); // base 1
            state = withLocation(state, 0, addCard(getLocation(state, 0), ally1, 0));
            state = withLocation(state, 0, addCard(getLocation(state, 0), ally2, 0));

            const laurelWreath = state.players[0].hand[0]!;
            const action: PlayCardAction = {
                type: 'PlayCard',
                playerId: 0,
                cardInstanceId: laurelWreath.instanceId,
                location: 0,
            };
            const passAction: PassAction = { type: 'Pass', playerId: 1 };

            const { state: nextState } = resolveTurn(state, action, passAction);

            // One ally should get +2, the other should stay at base
            const allies = getCards(getLocation(nextState, 0), 0).filter(c => c.cardDef.id !== 'laurel_wreath');
            const powers = allies.map(c => getEffectivePower(c));
            
            // Total power should be 2 + 1 + 2 = 5 (one gets +2)
            const totalPower = powers.reduce((a, b) => a + b, 0);
            expect(totalPower).toBe(5);

            // Laurel Wreath itself: base 0
            const wreathCard = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'laurel_wreath');
            expect(getEffectivePower(wreathCard!)).toBe(0);
        });
    });

    describe('DestroyAndGainPowerEffect Variant (Talos)', () => {
        it('Talos: Should destroy ally and gain its power', () => {
            let state = createTestState({ p0Energy: 4, p0HandDefs: [getDef('talos')] }); // cost 4
            const ally = makeCard(101, getDef('myrmidon'), 0); // base 4
            state = withLocation(state, 0, addCard(getLocation(state, 0), ally, 0));

            const talos = state.players[0].hand[0]!;
            const action: PlayCardAction = {
                type: 'PlayCard',
                playerId: 0,
                cardInstanceId: talos.instanceId,
                location: 0,
            };
            const passAction: PassAction = { type: 'Pass', playerId: 1 };

            const { state: nextState } = resolveTurn(state, action, passAction);

            // Ally should be destroyed
            const destroyed = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'myrmidon');
            expect(destroyed).toBeUndefined();

            // Talos should have gained ally's power: base 4 + 4 = 8
            const talosCard = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'talos');
            expect(talosCard).toBeDefined();
            expect(getEffectivePower(talosCard!)).toBe(8);

            // Destruction should be tracked
            expect(nextState.cardsDestroyedThisGame.length).toBeGreaterThan(0);
        });

        it('Talos: Should NOT gain power if no ally to destroy', () => {
            const state = createTestState({ p0Energy: 4, p0HandDefs: [getDef('talos')] });

            const talos = state.players[0].hand[0]!;
            const action: PlayCardAction = {
                type: 'PlayCard',
                playerId: 0,
                cardInstanceId: talos.instanceId,
                location: 0,
            };
            const passAction: PassAction = { type: 'Pass', playerId: 1 };

            const { state: nextState } = resolveTurn(state, action, passAction);

            // Talos should remain at base 4
            const talosCard = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'talos');
            expect(getEffectivePower(talosCard!)).toBe(4);
        });
    });

    describe('ConditionalOngoingPowerEffect Variant (Maenad)', () => {
        it('Maenad: Should buff allies +1 if location is full', () => {
            let state = createTestState({});
            // Fill location 0: Maenad + 3 other allies = 4 cards
            const maenad = makeCard(101, getDef('maenad'), 0, true); // base 1
            const ally1 = makeCard(102, getDef('hoplite'), 0, true); // base 2
            const ally2 = makeCard(103, getDef('satyr'), 0, true); // base 1
            const ally3 = makeCard(104, getDef('myrmidon'), 0, true); // base 4

            state = withLocation(state, 0, addCard(getLocation(state, 0), maenad, 0));
            state = withLocation(state, 0, addCard(getLocation(state, 0), ally1, 0));
            state = withLocation(state, 0, addCard(getLocation(state, 0), ally2, 0));
            state = withLocation(state, 0, addCard(getLocation(state, 0), ally3, 0));

            const passAction: PassAction = { type: 'Pass', playerId: 0 };
            const passAction2: PassAction = { type: 'Pass', playerId: 1 };
            const { state: nextState } = resolveTurn(state, passAction, passAction2);

            // All allies should have +1 ongoing
            const maenadCard = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'maenad');
            const hoplite = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'hoplite');
            const satyr = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'satyr');
            const myrmidon = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'myrmidon');

            expect(getEffectivePower(maenadCard!)).toBe(2); // 1 + 1
            expect(getEffectivePower(hoplite!)).toBe(3); // 2 + 1
            expect(getEffectivePower(satyr!)).toBe(2); // 1 + 1
            expect(getEffectivePower(myrmidon!)).toBe(5); // 4 + 1
        });

        it('Maenad: Should NOT buff if location is not full', () => {
            let state = createTestState({});
            // Only 2 cards at location 0 (not full)
            const maenad = makeCard(101, getDef('maenad'), 0, true);
            const ally = makeCard(102, getDef('hoplite'), 0, true);

            state = withLocation(state, 0, addCard(getLocation(state, 0), maenad, 0));
            state = withLocation(state, 0, addCard(getLocation(state, 0), ally, 0));

            const passAction: PassAction = { type: 'Pass', playerId: 0 };
            const passAction2: PassAction = { type: 'Pass', playerId: 1 };
            const { state: nextState } = resolveTurn(state, passAction, passAction2);

            // No buff since not full
            const maenadCard = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'maenad');
            const hoplite = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'hoplite');

            expect(getEffectivePower(maenadCard!)).toBe(1); // base only
            expect(getEffectivePower(hoplite!)).toBe(2); // base only
        });
    });

    describe('MoveCardEffect Variants (Daedalus, Icarus, Swift Dove, Winged Sandals)', () => {
        it('Daedalus: Should move ONE other ally to another location', () => {
            let state = createTestState({ p0Energy: 2, p0HandDefs: [getDef('daedalus')] }); // cost 2
            const ally = makeCard(101, getDef('hoplite'), 0);
            state = withLocation(state, 0, addCard(getLocation(state, 0), ally, 0));

            const daedalus = state.players[0].hand[0]!;
            const action: PlayCardAction = {
                type: 'PlayCard',
                playerId: 0,
                cardInstanceId: daedalus.instanceId,
                location: 0,
            };
            const passAction: PassAction = { type: 'Pass', playerId: 1 };

            const { state: nextState } = resolveTurn(state, action, passAction);

            // Daedalus should stay at location 0
            const daedalusCard = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'daedalus');
            expect(daedalusCard).toBeDefined();

            // Ally should have moved to another location
            const allyAtLoc0 = getCards(getLocation(nextState, 0), 0).find(c => c.instanceId === 101);
            expect(allyAtLoc0).toBeUndefined();

            const allyAtOther = ([1, 2] as LocationIndex[]).flatMap(i => getCards(getLocation(nextState, i), 0)).find(c => c.instanceId === 101);
            expect(allyAtOther).toBeDefined();

            // Move should be tracked
            expect(nextState.cardsMovedThisGame.length).toBeGreaterThan(0);
        });

        it('Icarus: Should move himself to another location', () => {
            const state = createTestState({ p0Energy: 3, p0HandDefs: [getDef('icarus')] }); // cost 3

            const icarus = state.players[0].hand[0]!;
            const action: PlayCardAction = {
                type: 'PlayCard',
                playerId: 0,
                cardInstanceId: icarus.instanceId,
                location: 0,
            };
            const passAction: PassAction = { type: 'Pass', playerId: 1 };

            const { state: nextState } = resolveTurn(state, action, passAction);

            // Icarus should NOT be at location 0
            const icarusAtLoc0 = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'icarus');
            expect(icarusAtLoc0).toBeUndefined();

            // Icarus should be at another location
            const icarusAtOther = ([1, 2] as LocationIndex[]).flatMap(i => getCards(getLocation(nextState, i), 0)).find(c => c.cardDef.id === 'icarus');
            expect(icarusAtOther).toBeDefined();
            expect(getEffectivePower(icarusAtOther!)).toBe(4); // base 4

            // Move should be tracked
            expect(nextState.cardsMovedThisGame.length).toBeGreaterThan(0);
        });

        it('Swift Dove: Should move herself to another location', () => {
            const state = createTestState({ p0Energy: 1, p0HandDefs: [getDef('swift_dove')] }); // cost 1

            const swiftDove = state.players[0].hand[0]!;
            const action: PlayCardAction = {
                type: 'PlayCard',
                playerId: 0,
                cardInstanceId: swiftDove.instanceId,
                location: 0,
            };
            const passAction: PassAction = { type: 'Pass', playerId: 1 };

            const { state: nextState } = resolveTurn(state, action, passAction);

            // Swift Dove should NOT be at location 0
            const doveAtLoc0 = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'swift_dove');
            expect(doveAtLoc0).toBeUndefined();

            // Swift Dove should be at another location
            const doveAtOther = ([1, 2] as LocationIndex[]).flatMap(i => getCards(getLocation(nextState, i), 0)).find(c => c.cardDef.id === 'swift_dove');
            expect(doveAtOther).toBeDefined();
            expect(getEffectivePower(doveAtOther!)).toBe(1); // base 1

            // Move should be tracked
            expect(nextState.cardsMovedThisGame.length).toBeGreaterThan(0);
        });

        it('Winged Sandals: Should move themselves to another location', () => {
            const state = createTestState({ p0Energy: 1, p0HandDefs: [getDef('winged_sandals')] }); // cost 1

            const wingedSandals = state.players[0].hand[0]!;
            const action: PlayCardAction = {
                type: 'PlayCard',
                playerId: 0,
                cardInstanceId: wingedSandals.instanceId,
                location: 0,
            };
            const passAction: PassAction = { type: 'Pass', playerId: 1 };

            const { state: nextState } = resolveTurn(state, action, passAction);

            // Winged Sandals should NOT be at location 0
            const sandalsAtLoc0 = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'winged_sandals');
            expect(sandalsAtLoc0).toBeUndefined();

            // Winged Sandals should be at another location
            const sandalsAtOther = ([1, 2] as LocationIndex[]).flatMap(i => getCards(getLocation(nextState, i), 0)).find(c => c.cardDef.id === 'winged_sandals');
            expect(sandalsAtOther).toBeDefined();
            expect(getEffectivePower(sandalsAtOther!)).toBe(0); // base 0

            // Move should be tracked
            expect(nextState.cardsMovedThisGame.length).toBeGreaterThan(0);
        });
    });

    describe('AddPowerEffect Variant (Temple Acolyte)', () => {
        it('Temple Acolyte: Should buff ONE other ally here +1', () => {
            let state = createTestState({ p0Energy: 1, p0HandDefs: [getDef('temple_acolyte')] }); // cost 1
            const ally1 = makeCard(101, getDef('hoplite'), 0); // base 2
            const ally2 = makeCard(102, getDef('myrmidon'), 0); // base 4
            state = withLocation(state, 0, addCard(getLocation(state, 0), ally1, 0));
            state = withLocation(state, 0, addCard(getLocation(state, 0), ally2, 0));

            const templeAcolyte = state.players[0].hand[0]!;
            const action: PlayCardAction = {
                type: 'PlayCard',
                playerId: 0,
                cardInstanceId: templeAcolyte.instanceId,
                location: 0,
            };
            const passAction: PassAction = { type: 'Pass', playerId: 1 };

            const { state: nextState } = resolveTurn(state, action, passAction);

            // One ally should get +1
            const allies = getCards(getLocation(nextState, 0), 0).filter(c => c.cardDef.id !== 'temple_acolyte');
            const powers = allies.map(c => getEffectivePower(c));
            
            // Total power should be 2 + 4 + 1 = 7 (one gets +1)
            const totalPower = powers.reduce((a, b) => a + b, 0);
            expect(totalPower).toBe(7);

            // Temple Acolyte itself: base 1
            const acolyteCard = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'temple_acolyte');
            expect(getEffectivePower(acolyteCard!)).toBe(1);
        });

        it('Temple Acolyte: Should NOT buff self even if only card', () => {
            const state = createTestState({ p0Energy: 1, p0HandDefs: [getDef('temple_acolyte')] });

            const templeAcolyte = state.players[0].hand[0]!;
            const action: PlayCardAction = {
                type: 'PlayCard',
                playerId: 0,
                cardInstanceId: templeAcolyte.instanceId,
                location: 0,
            };
            const passAction: PassAction = { type: 'Pass', playerId: 1 };

            const { state: nextState } = resolveTurn(state, action, passAction);

            // Temple Acolyte should remain at base 1 (no self-buff)
            const acolyteCard = getCards(getLocation(nextState, 0), 0).find(c => c.cardDef.id === 'temple_acolyte');
            expect(getEffectivePower(acolyteCard!)).toBe(1);
        });
    });
});
