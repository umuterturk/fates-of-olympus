import { describe, it, expect } from 'vitest';
import {
    getEffectivePower,
    addCard,
    getCards,
    getLocation,
    withLocation,
    createInitialLocations,
    type GameState,
    type CardDef,
    type CardInstance,
} from './models';
import { resolveTurnDeterministic } from './controller';
import { SeededRNG } from './rng';
import { getCardDef } from './cards';
import type { PlayerId, TurnNumber, InstanceId as TInstanceId } from './types';
import type { PlayCardAction, PassAction } from './models';
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
        instanceId: instanceId as TInstanceId,
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
        cardsDestroyedThisGame: [],
        cardsMovedThisGame: [],
        cardsMovedThisTurn: [],
        silencedCards: [],
        bonusEnergyNextTurn: [0, 0],
    };
}

const HARPIES = () => getCardDef('harpies')!;
const HOPLITE = () => getCardDef('hoplite')!;

describe('Harpies Systematic Verification', () => {
    it('should ONLY debuff ONE enemy at the SAME location and ONLY by -1', () => {
        // Setup state:
        // Loc 0: 2 enemy Hoplites
        // Loc 1: 1 enemy Hoplite
        // Hand: 1 Harpies
        let state = createTestState({
            p0HandDefs: [HARPIES()],
        });

        // Enemy cards
        const enemy1 = makeCard(101, HOPLITE(), 1); // Loc 0
        const enemy2 = makeCard(102, HOPLITE(), 1); // Loc 0
        const enemy3 = makeCard(103, HOPLITE(), 1); // Loc 1

        // Add to state
        state = withLocation(state, 0, addCard(addCard(getLocation(state, 0), enemy1, 1), enemy2, 1));
        state = withLocation(state, 1, addCard(getLocation(state, 1), enemy3, 1));

        const harpies = state.players[0].hand[0]!;
        const action: PlayCardAction = {
            type: 'PlayCard',
            playerId: 0,
            cardInstanceId: harpies.instanceId,
            location: 0,
        };
        const passAction: PassAction = { type: 'Pass', playerId: 1 };

        // RESOLVE
        const { state: newState } = resolveTurn(state, action, passAction);

        // VERIFY
        const loc0Enemies = getCards(getLocation(newState, 0), 1);
        const loc1Enemies = getCards(getLocation(newState, 1), 1);

        // Location 0 verification
        const powers0 = loc0Enemies.map(c => getEffectivePower(c));
        // One should be 1 (2-1), one should be 2 (original)
        expect(powers0).toContain(1);
        expect(powers0).toContain(2);
        expect(powers0.length).toBe(2);

        // Sum should be 3
        const totalPower0 = powers0.reduce((a, b) => a + b, 0);
        expect(totalPower0).toBe(3);

        // Location 1 verification
        const enemyAtLoc1 = loc1Enemies[0]!;
        expect(getEffectivePower(enemyAtLoc1)).toBe(2); // Should remain 2
    });
});
