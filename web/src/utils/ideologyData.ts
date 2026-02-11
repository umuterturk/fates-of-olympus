/**
 * Shared ideology data and helpers.
 * Used by Home page (showcase) and Collection page (choice modal).
 */

import type { Ideology } from '@storage/types';
import type { CardDef, CardIdeology } from '@engine/models';
import { getAllCardDefs } from '@engine/cards';

// =============================================================================
// Ideology Display Info
// =============================================================================

export interface IdeologyDisplayInfo {
    name: string;
    tagline: string;
    description: string;
    color: string;         // Tailwind gradient classes
    accentColor: string;   // Hex color for glow/border effects
    zoomCenter: string;    // CSS transform-origin for hover zoom (e.g. 'center 20%')
    featuredCardId: string; // Card ID for the featured character on the home page
}

/** Map from storage Ideology type to engine CardIdeology */
const IDEOLOGY_TO_CARD_IDEOLOGY: Record<Ideology, CardIdeology> = {
    NOMOS: 'NOMOS',
    KATABASIS: 'KATABASIS',
    KINESIS: 'KINESIS',
};

export const IDEOLOGY_INFO: Record<Ideology, IdeologyDisplayInfo> = {
    NOMOS: {
        name: 'Nomos',
        tagline: 'Law of Order',
        description: 'Focus on structure, buffs, and formation bonuses. Control the board with precision.',
        color: 'from-blue-600 to-blue-800',
        accentColor: '#3b82f6',
        zoomCenter: 'center 20%',
        featuredCardId: 'zeus',
    },
    KATABASIS: {
        name: 'Katabasis',
        tagline: 'Path of Descent',
        description: 'Sacrifice for power. Destroy your cards to gain overwhelming strength.',
        color: 'from-purple-600 to-purple-800',
        accentColor: '#9333ea',
        zoomCenter: 'center 25%',
        featuredCardId: 'nyx',
    },
    KINESIS: {
        name: 'Kinesis',
        tagline: 'Way of Motion',
        description: 'Movement is key. Relocate cards and gain bonuses from mobility.',
        color: 'from-teal-600 to-teal-800',
        accentColor: '#14b8a6',
        zoomCenter: 'center 55%',
        featuredCardId: 'charybdis',
    },
};

export const IDEOLOGY_KEYS: readonly Ideology[] = ['NOMOS', 'KATABASIS', 'KINESIS'] as const;

// =============================================================================
// Card Helpers
// =============================================================================

/**
 * Get the top N most powerful cards for an ideology.
 * Prioritizes Gods, then Monsters, then by highest basePower.
 */
export function getTopCardsByIdeology(ideology: Ideology, count: number = 3): CardDef[] {
    const cardIdeology = IDEOLOGY_TO_CARD_IDEOLOGY[ideology];
    const allCards = getAllCardDefs();

    const ideologyCards = allCards.filter(c => c.ideology === cardIdeology);

    // Sort: Gods first, then Monsters, then others. Within each group, by basePower descending.
    const typeOrder = (type?: string): number => {
        if (type === 'God') return 0;
        if (type === 'Monster') return 1;
        return 2;
    };

    ideologyCards.sort((a, b) => {
        const typeA = typeOrder(a.cardType);
        const typeB = typeOrder(b.cardType);
        if (typeA !== typeB) return typeA - typeB;
        return b.basePower - a.basePower;
    });

    return ideologyCards.slice(0, count);
}
