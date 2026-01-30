import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
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

// Hook to detect mobile
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  return isMobile;
}

export function Board({
  locations,
  onLocationClick,
  onCardClick,
  selectedCard,
  pendingCardIds,
  disabled = false,
}: BoardProps) {
  const isMobile = useIsMobile();
  
  return (
    <motion.div
      data-name="board"
      className={clsx(
        "flex flex-1 justify-center items-center",
        isMobile ? "gap-1" : "gap-4"
      )}
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
