/**
 * CardDestroyedAnimation - Coordinates card destruction animations.
 * 
 * The actual card animation (scale up + fade out) is handled by the Card component.
 * The timing is handled by the game store's fixed wait (~0.5s per card).
 */

import type { CardDestroyedEvent } from '@engine/events';

interface CardDestroyedAnimationProps {
    event: CardDestroyedEvent | null;
    onComplete: () => void;
}

export function CardDestroyedAnimation({ event }: CardDestroyedAnimationProps) {
    // Log for debugging
    if (event) {
        console.log('[CardDestroyed] Event active:', event);
    }

    // No visual rendering - the Card component handles its own animation
    // Don't call onComplete - the game store handles timing to avoid the card
    // snapping back to full opacity before being removed
    return null;
}
