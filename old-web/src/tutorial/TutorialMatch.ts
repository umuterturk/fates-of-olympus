/**
 * Scripted tutorial match: fixed hands, opponent plays, and lesson sequence.
 *
 * "The First Trial" - Uses only VANILLA cards (no abilities) so there is no
 * random behaviour: no target selection, no move RNG, purely deterministic.
 */

import type { GameState, PlayerState, PlayCardAction } from '@engine/models';
import type { PlayerAction } from '@engine/models';
import type { CardId, LocationIndex, PlayerId, TurnNumber } from '@engine/types';
import {
  createInitialLocations,
  getPlayer,
  drawCard,
} from '@engine/models';
import { createDeck, getCardDefsFromIds, getDeckCardIds } from '@engine/cards';
import type { TutorialStepConfig } from './tutorialStore';

// =============================================================================
// Constants
// =============================================================================

export const TUTORIAL_SEED = 4242;
export const TUTORIAL_MAX_TURNS = 4 as TurnNumber;

/** Player's deck: all vanilla (no abilities, no random behaviour) */
const TUTORIAL_PLAYER_DECK_ORDER: CardId[] = [
  'hoplite',       // 1 cost, 2 power
  'argive_scout',  // 2 cost, 3 power
  'myrmidon',      // 3 cost, 4 power
  'chimera',       // 4 cost, 6 power
  ...(getDeckCardIds('starter').filter(
    (id) => !['hoplite', 'argive_scout', 'myrmidon', 'chimera'].includes(id)
  ).slice(0, 20)),
];

/** NPC's deck: all vanilla */
const TUTORIAL_NPC_DECK_ORDER: CardId[] = [
  'hoplite',
  'argive_scout',
  'myrmidon',
  ...(getDeckCardIds('starter').filter(
    (id) => !['hoplite', 'argive_scout', 'myrmidon'].includes(id)
  ).slice(0, 21)),
];

// Ensure we have 24 cards each (pad if needed)
function ensureDeckSize(ids: CardId[], size: number): CardId[] {
  if (ids.length >= size) return ids.slice(0, size);
  const filler = getDeckCardIds('starter');
  let i = 0;
  while (ids.length < size) {
    ids.push(filler[i % filler.length]!);
    i++;
  }
  return ids;
}

const PLAYER_DECK_IDS = ensureDeckSize([...TUTORIAL_PLAYER_DECK_ORDER], 24);
const NPC_DECK_IDS = ensureDeckSize([...TUTORIAL_NPC_DECK_ORDER], 24);

// =============================================================================
// Tutorial Game State
// =============================================================================

/**
 * Create the initial game state for the tutorial match.
 * Player has Hoplite, Argive Scout, Myrmidon in hand; deck has Chimera first.
 * NPC has Hoplite, Argive Scout, Myrmidon in hand. All cards are vanilla.
 */
export function createTutorialGameState(): GameState {
  const playerDefs = getCardDefsFromIds(PLAYER_DECK_IDS);
  const npcDefs = getCardDefsFromIds(NPC_DECK_IDS);

  const { deck: playerDeck, nextId } = createDeck(playerDefs, 0, 0);
  const { deck: npcDeck, nextId: nextId1 } = createDeck(npcDefs, 1, nextId);

  let p0: PlayerState = {
    playerId: 0,
    deck: playerDeck,
    hand: [],
    energy: 0,
    maxEnergy: 0,
  };
  let p1: PlayerState = {
    playerId: 1,
    deck: npcDeck,
    hand: [],
    energy: 0,
    maxEnergy: 0,
  };

  for (let i = 0; i < 3; i++) {
    const [newP0] = drawCard(p0);
    p0 = newP0;
    const [newP1] = drawCard(p1);
    p1 = newP1;
  }

  const startingEnergy = 1;
  p0 = { ...p0, energy: startingEnergy, maxEnergy: startingEnergy };
  p1 = { ...p1, energy: startingEnergy, maxEnergy: startingEnergy };

  const state: GameState = {
    turn: 1 as TurnNumber,
    phase: 'PLANNING',
    players: [p0, p1],
    locations: createInitialLocations(),
    result: 'IN_PROGRESS',
    nextInstanceId: nextId1,
    cardsDestroyedThisGame: [],
    cardsMovedThisGame: [],
    cardsMovedThisTurn: [],
    silencedCards: [],
    bonusEnergyNextTurn: [0, 0],
  };

  return state;
}

// =============================================================================
// Scripted NPC Actions
// =============================================================================

/** Scripted plays per turn: [cardId, locationIndex] or null for Pass. All vanilla. */
const NPC_SCRIPT: Readonly<Record<number, { cardId: CardId; location: LocationIndex } | null>> = {
  1: { cardId: 'hoplite', location: 1 },
  2: { cardId: 'argive_scout', location: 2 },
  3: { cardId: 'myrmidon', location: 1 },
  4: null, // Pass
};

/**
 * Return the NPC's scripted action(s) for the current turn.
 * state should be the turn start state (NPC's hand is at start of turn).
 */
export function getScriptedNpcActions(state: GameState): PlayerAction[] {
  const turn = state.turn;
  const script = NPC_SCRIPT[turn as keyof typeof NPC_SCRIPT];
  if (script === null || script === undefined) {
    return [{ type: 'Pass', playerId: 1 as PlayerId }];
  }
  const npc = getPlayer(state, 1);
  const card = npc.hand.find((c) => c.cardDef.id === script.cardId);
  if (!card) {
    return [{ type: 'Pass', playerId: 1 as PlayerId }];
  }
  const action: PlayCardAction = {
    type: 'PlayCard',
    playerId: 1,
    cardInstanceId: card.instanceId,
    location: script.location,
  };
  return [action];
}

// =============================================================================
// Tutorial Steps (prompts)
// =============================================================================

export const TUTORIAL_STEPS: TutorialStepConfig[] = [
  // Turn 1
  {
    id: 'welcome',
    message:
      "Welcome to Fates of Olympus! You'll learn the basics in a short 4-turn game.",
    trigger: 'click_continue',
    dimBackground: false,
  },
  {
    id: 'locations',
    message:
      "The board has 3 locations: Left, Middle, and Right. You win the game by having more total Power than your opponent at 2 of these locations.",
    highlight: 'board',
    trigger: 'click_continue',
    dimBackground: false,
  },
  {
    id: 'hand',
    message:
      "This is your hand. Each turn you'll play one card by dragging it to a location.",
    highlight: 'hand',
    trigger: 'click_continue',
    dimBackground: false,
  },
  {
    id: 'energy',
    message:
      "Your available Energy for this turn is shown here. You spend Energy to play cards — you have 1 Energy on turn 1.",
    highlight: 'energy-indicator',
    trigger: 'click_continue',
    dimBackground: false,
  },
  {
    id: 'card_stats',
    message:
      "Each card shows its Power (top) and Energy cost (bottom). Your first card, Hoplite, has 2 Power and costs 1 Energy.",
    highlight: 'hand-card-slot-0',
    trigger: 'click_continue',
    dimBackground: false,
  },
  {
    id: 'play_hoplite',
    message: "Drag Hoplite to the LEFT location to play it.",
    highlight: 'location-0',
    trigger: 'on_play_card',
  },
  {
    id: 'after_play',
    message:
      "Cards play face-down, then reveal together. Tap 'End Turn' to continue.",
    highlight: 'end-turn-button',
    trigger: 'on_end_turn',
  },
  {
    id: 'resolution_1',
    message:
      "Your Hoplite revealed with 2 Power! The opponent played Hoplite at the middle location.",
    trigger: 'click_continue',
  },
  // Turn 2
  {
    id: 'energy_2',
    message:
      "Turn 2 gives you 2 Energy. Higher-cost cards usually have more Power.",
    trigger: 'click_continue',
  },
  {
    id: 'on_reveal',
    message:
      "Play Argive Scout at the LEFT location to add 3 Power there.",
    trigger: 'click_continue',
  },
  {
    id: 'play_hermes',
    message: "Play Argive Scout at the LEFT location (with Hoplite).",
    highlight: 'location-0',
    trigger: 'on_play_card',
  },
  {
    id: 'after_play_2',
    message: "Tap End Turn to reveal the cards.",
    highlight: 'end-turn-button',
    trigger: 'on_end_turn',
  },
  {
    id: 'resolution_2',
    message:
      "Your left location now has 5 Power total. Win a location by having more power than the opponent.",
    trigger: 'click_continue',
  },
  // Turn 3
  {
    id: 'buff_intro',
    message:
      "Stack power at a location to win it. Play Myrmidon to strengthen your board.",
    trigger: 'click_continue',
  },
  {
    id: 'play_athena',
    message: "Play Myrmidon at the LEFT location.",
    highlight: 'location-0',
    trigger: 'on_play_card',
  },
  {
    id: 'after_play_3',
    message: "Tap End Turn to reveal the cards.",
    highlight: 'end-turn-button',
    trigger: 'on_end_turn',
  },
  {
    id: 'resolution_3',
    message:
      "The opponent played Myrmidon at the middle. You need to win 2 of 3 locations to win the game.",
    trigger: 'click_continue',
  },
  // Turn 4
  {
    id: 'poseidon',
    message:
      "Chimera has 6 Power. Play it to secure a location and claim victory!",
    trigger: 'click_continue',
  },
  {
    id: 'final_play',
    message: "Play Chimera to secure victory.",
    trigger: 'on_play_card',
  },
  {
    id: 'win_condition',
    message: "You won 2 locations! That's all you need to win.",
    trigger: 'click_continue',
  },
  {
    id: 'outro',
    message:
      "You've learned the basics! Explore different card combinations and ideologies.",
    trigger: 'click_continue',
  },
];

export function getTutorialPrompt(stepIndex: number): TutorialStepConfig | undefined {
  return TUTORIAL_STEPS[stepIndex];
}

export function getTutorialStepCount(): number {
  return TUTORIAL_STEPS.length;
}
