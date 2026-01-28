import { motion } from 'framer-motion';
import type { LocationState } from '@engine/models';
import type { LocationTuple } from '@engine/types';
import { Location } from './Location';

interface BoardProps {
  locations: LocationTuple<LocationState>;
  onLocationClick?: (index: number) => void;
  onCardClick?: (cardInstanceId: number) => void;
  selectedCard: number | null;
  pendingCardIds?: Set<number>;
  disabled?: boolean;
}

export function Board({
  locations,
  onLocationClick,
  onCardClick,
  selectedCard,
  pendingCardIds,
  disabled = false,
}: BoardProps) {
  return (
    <motion.div
      className="flex gap-4 flex-1"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {locations.map((location, index) => (
        <Location
          key={location.index}
          location={location}
          onClick={onLocationClick ? () => onLocationClick(index) : undefined}
          onCardClick={onCardClick}
          isDropTarget={selectedCard !== null}
          selectedCard={selectedCard}
          pendingCardIds={pendingCardIds}
          disabled={disabled}
        />
      ))}
    </motion.div>
  );
}
