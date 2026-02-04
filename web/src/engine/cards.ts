/**
 * Card definitions loaded from cards.json
 */

import type { CardDef, CardInstance } from './models';
import type { CardId, InstanceId, PlayerId, AbilityType, CardTag, TargetFilter } from './types';
import type { Effect } from './effects';

// Import card data (Vite handles JSON imports)
import cardsData from '../../../cards.json';

// =============================================================================
// Card Data Parsing
// =============================================================================

interface RawEffect {
  type: string;
  target?: string;
  amount?: number;
  to_other_location?: boolean;
  destroy_target?: string;
  gain_target?: string;
  move_target?: string;
  buff_target?: string;
  buff_amount?: number;
  debuff_amount?: number;
  condition?: string;
  per_card_amount?: number;
  count_filter?: string;
  per_destroyed_amount?: number;
}

interface RawCard {
  id: string;
  name: string;
  cost: number;
  base_power: number;
  text: string;
  ability_type: string;
  tags: string[];
  effects: RawEffect[];
  ideology?: string;
  deck_group?: number;
}

function parseEffect(raw: RawEffect): Effect {
  switch (raw.type) {
    case 'AddPowerEffect':
      return {
        type: 'AddPowerEffect',
        target: (raw.target ?? 'SELF') as TargetFilter,
        amount: raw.amount ?? 0,
      };
    case 'AddOngoingPowerEffect':
      return {
        type: 'AddOngoingPowerEffect',
        target: (raw.target ?? 'SAME_LOCATION_FRIENDLY') as TargetFilter,
        amount: raw.amount ?? 0,
      };
    case 'ConditionalOngoingPowerEffect':
      return {
        type: 'ConditionalOngoingPowerEffect',
        target: (raw.target ?? 'SAME_LOCATION_FRIENDLY') as TargetFilter,
        amount: raw.amount ?? 0,
        condition: raw.condition ?? 'location_full',
      };
    case 'MoveCardEffect':
      return {
        type: 'MoveCardEffect',
        target: (raw.target ?? 'SELF') as TargetFilter,
        toOtherLocation: raw.to_other_location ?? true,
      };
    case 'DestroyCardEffect':
      return {
        type: 'DestroyCardEffect',
        target: (raw.target ?? 'SELF') as TargetFilter,
      };
    case 'DestroyAndBuffEffect':
      return {
        type: 'DestroyAndBuffEffect',
        destroyTarget: (raw.destroy_target ?? 'ONE_SAME_LOCATION_FRIENDLY') as TargetFilter,
        buffTarget: (raw.buff_target ?? 'ONE_SAME_LOCATION_ENEMY') as TargetFilter,
        buffAmount: raw.buff_amount ?? 0,
      };
    case 'ConditionalPowerEffect':
      return {
        type: 'ConditionalPowerEffect',
        target: (raw.target ?? 'SELF') as TargetFilter,
        amount: raw.amount ?? 0,
        condition: (raw.condition ?? 'only_card_here') as 'only_card_here' | 'destroyed_this_game' | 'moved_this_game',
      };
    case 'SilenceOngoingEffect':
      return {
        type: 'SilenceOngoingEffect',
        target: (raw.target ?? 'SAME_LOCATION_ENEMY') as TargetFilter,
      };
    case 'StealPowerEffect':
      return {
        type: 'StealPowerEffect',
        target: (raw.target ?? 'ONE_SAME_LOCATION_ENEMY') as TargetFilter,
        amount: raw.amount ?? 0,
      };
    case 'ScalingOngoingPowerEffect':
      return {
        type: 'ScalingOngoingPowerEffect',
        target: (raw.target ?? 'SAME_LOCATION_FRIENDLY') as TargetFilter,
        perCardAmount: raw.per_card_amount ?? 1,
        countFilter: (raw.count_filter ?? 'SAME_LOCATION_FRIENDLY') as TargetFilter,
      };
    case 'ScalingPowerEffect':
      return {
        type: 'ScalingPowerEffect',
        target: (raw.target ?? 'SELF') as TargetFilter,
        perDestroyedAmount: raw.per_destroyed_amount ?? 2,
      };
    case 'ReviveEffect':
      return {
        type: 'ReviveEffect',
        baseSpiritPower: 2,
      };
    case 'AddEnergyNextTurnEffect':
      return {
        type: 'AddEnergyNextTurnEffect',
        amount: raw.amount ?? 1,
      };
    case 'DestroyAndGainPowerEffect':
      return {
        type: 'DestroyAndGainPowerEffect',
        destroyTarget: (raw.destroy_target ?? 'ONE_SAME_LOCATION_FRIENDLY') as TargetFilter,
        gainTarget: (raw.gain_target ?? 'SELF') as TargetFilter,
      };
    case 'GlobalOngoingPowerEffect':
      return {
        type: 'GlobalOngoingPowerEffect',
        target: (raw.target ?? 'ALL_FRIENDLY_DESTROY_TAGGED') as TargetFilter,
        amount: raw.amount ?? 0,
      };
    case 'MoveAndSelfBuffEffect':
      return {
        type: 'MoveAndSelfBuffEffect',
        moveTarget: (raw.move_target ?? 'SELF') as TargetFilter,
        buffAmount: raw.buff_amount ?? 0,
      };
    case 'DestroyAndSelfBuffEffect':
      return {
        type: 'DestroyAndSelfBuffEffect',
        destroyTarget: (raw.destroy_target ?? 'ONE_SAME_LOCATION_FRIENDLY') as TargetFilter,
        buffAmount: raw.buff_amount ?? 0,
      };
    case 'MoveAndBuffEffect':
      return {
        type: 'MoveAndBuffEffect',
        moveTarget: (raw.move_target ?? 'ONE_OTHER_LOCATION_FRIENDLY_TO_HERE') as TargetFilter,
        buffTarget: (raw.buff_target ?? 'MOVED_CARD') as TargetFilter,
        buffAmount: raw.buff_amount ?? 0,
      };
    case 'MoveAndDebuffDestinationEffect':
      return {
        type: 'MoveAndDebuffDestinationEffect',
        debuffAmount: raw.debuff_amount ?? -1,
      };
    default:
      // Unknown effect, return a no-op
      return {
        type: 'AddPowerEffect',
        target: 'SELF',
        amount: 0,
      };
  }
}

function parseCard(raw: RawCard): CardDef {
  return {
    id: raw.id as CardId,
    name: raw.name,
    cost: raw.cost,
    basePower: raw.base_power,
    text: raw.text,
    abilityType: raw.ability_type as AbilityType,
    effects: raw.effects.map(parseEffect),
    tags: raw.tags as CardTag[],
    ideology: raw.ideology as CardDef['ideology'],
    deckGroup: raw.deck_group,
  };
}

// =============================================================================
// Card Registry
// =============================================================================

const ALL_CARDS: Map<CardId, CardDef> = new Map();

// Parse all cards on module load
for (const rawCard of cardsData.cards as RawCard[]) {
  const card = parseCard(rawCard);
  ALL_CARDS.set(card.id, card);
}

export function getCardDef(id: CardId): CardDef | undefined {
  return ALL_CARDS.get(id);
}

export function getAllCardDefs(): CardDef[] {
  return Array.from(ALL_CARDS.values());
}

// =============================================================================
// Deck Definitions
// =============================================================================

type DeckName = 'starter' | 'destroy' | 'move';

const DECKS: Record<DeckName, CardId[]> = cardsData.decks as Record<DeckName, CardId[]>;

export function getDeckCardIds(deckName: DeckName): CardId[] {
  return DECKS[deckName] ?? DECKS.starter;
}

export function getDeckCardDefs(deckName: DeckName): CardDef[] {
  const ids = getDeckCardIds(deckName);
  const defs: CardDef[] = [];
  for (const id of ids) {
    const def = getCardDef(id);
    if (def) defs.push(def);
  }
  return defs;
}

// =============================================================================
// Card Instance Creation
// =============================================================================

export function createCardInstance(
  cardDef: CardDef,
  owner: PlayerId,
  instanceId: InstanceId,
): CardInstance {
  return {
    instanceId,
    cardDef,
    owner,
    permanentPowerModifier: 0,
    ongoingPowerModifier: 0,
    revealed: false,
  };
}

export function createDeck(
  cardDefs: CardDef[],
  owner: PlayerId,
  startInstanceId: InstanceId,
): { deck: CardInstance[]; nextId: InstanceId } {
  const deck: CardInstance[] = [];
  let nextId = startInstanceId;
  
  for (const def of cardDefs) {
    deck.push(createCardInstance(def, owner, nextId));
    nextId++;
  }
  
  return { deck, nextId };
}

// Shuffle deck (Fisher-Yates)
export function shuffleDeck<T>(deck: T[]): T[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}

/**
 * Shuffle deck with cost-based ordering.
 * Lower cost cards appear earlier in the deck so players can play cards
 * in early turns. Cards are shuffled within cost tiers, then stacked.
 * 
 * Special rule: At least 2 cost-1 cards must be in the first 3 positions
 * (starting hand) to ensure playable options on turn 1.
 * 
 * This ensures:
 * - Turn 1: At least 2 playable cards (cost 1)
 * - Turn 2-3: Mostly 1-2 cost cards
 * - Turn 4-5: Mostly 3-4 cost cards  
 * - Turn 6: Higher cost cards
 */
export function shuffleDeckByCost(cardDefs: CardDef[]): CardDef[] {
  // Separate cost-1 cards from the rest
  const cost1Cards: CardDef[] = [];
  const cost2Cards: CardDef[] = [];
  const tier2: CardDef[] = []; // Cost 3-4 (mid game)
  const tier3: CardDef[] = []; // Cost 5-6 (late game)
  
  for (const card of cardDefs) {
    if (card.cost === 1) {
      cost1Cards.push(card);
    } else if (card.cost === 2) {
      cost2Cards.push(card);
    } else if (card.cost <= 4) {
      tier2.push(card);
    } else {
      tier3.push(card);
    }
  }
  
  // Shuffle each group independently
  const shuffledCost1 = shuffleDeck(cost1Cards);
  const shuffledCost2 = shuffleDeck(cost2Cards);
  const shuffledTier2 = shuffleDeck(tier2);
  const shuffledTier3 = shuffleDeck(tier3);
  
  // Ensure at least 2 cost-1 cards are at the top
  // Take first 2 cost-1 cards (or all if less than 2)
  const guaranteedCost1 = shuffledCost1.slice(0, 2);
  const remainingCost1 = shuffledCost1.slice(2);
  
  // Combine remaining cost-1 with cost-2 cards and shuffle
  const earlyGameRest = shuffleDeck([...remainingCost1, ...shuffledCost2]);
  
  // Stack: guaranteed cost-1 first, then rest of early game, then mid/late
  return [...guaranteedCost1, ...earlyGameRest, ...shuffledTier2, ...shuffledTier3];
}
