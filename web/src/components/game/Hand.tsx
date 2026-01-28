import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import type { CardInstance } from '@engine/models';
import type { Energy } from '@engine/types';
import { Card } from './Card';

interface HandProps {
  cards: readonly CardInstance[];
  energy: Energy;
  selectedCard: number | null;
  onSelectCard: (instanceId: number | null) => void;
  onHandClick?: () => void;
  isDropTarget?: boolean;
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

export function Hand({
  cards,
  energy,
  selectedCard,
  onSelectCard,
  onHandClick,
  isDropTarget = false,
  disabled = false,
}: HandProps) {
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const isMobile = useIsMobile();

  const handleCardClick = (card: CardInstance, e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger hand click
    if (disabled) return;
    
    // Check if card is affordable
    if (card.cardDef.cost > energy) return;
    
    // Toggle selection
    if (selectedCard === card.instanceId) {
      onSelectCard(null);
    } else {
      onSelectCard(card.instanceId);
    }
  };

  const handleHandAreaClick = () => {
    if (!disabled && onHandClick) {
      onHandClick();
    }
  };

  // Use 'sm' size on mobile, 'md' on desktop
  const cardSize = isMobile ? 'sm' : 'md';

  return (
    <motion.div
      className={clsx(
        "flex justify-center items-center overflow-visible bg-black/30 rounded-xl flex-1",
        isMobile ? "gap-0.5 px-1 py-1" : "gap-2 p-4",
        isDropTarget && "ring-2 ring-olympus-gold bg-olympus-gold/10 cursor-pointer",
      )}
      onClick={handleHandAreaClick}
      layout
    >
      {cards.map((card, index) => {
        const canAfford = card.cardDef.cost <= energy;
        const isSelected = selectedCard === card.instanceId;

        const isHovered = hoveredCard === card.instanceId;
        
        // Hovered card needs highest z-index for tooltip to appear above selected cards
        const zIndex = isHovered ? 100 : isSelected ? 10 : index;

        return (
          <div
            key={card.instanceId}
            className="relative"
            style={{ 
              zIndex,
              transform: `translateY(${isSelected ? (isMobile ? -10 : -20) : 0}px) scale(${isSelected ? 1.05 : 1})`,
              transition: 'transform 0.2s ease-out',
            }}
            onMouseEnter={() => !isMobile && setHoveredCard(card.instanceId)}
            onMouseLeave={() => !isMobile && setHoveredCard(null)}
            onClick={(e) => handleCardClick(card, e)}
          >
            <Card
              card={card}
              size={cardSize}
              selected={isSelected}
              disabled={disabled || !canAfford}
            />
            
            {/* Unaffordable overlay - shows when card costs more than current energy */}
            {!canAfford && (
              <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center pointer-events-none">
                <span className={clsx(
                  "text-red-400 font-bold bg-black/80 rounded",
                  isMobile ? "text-[8px] px-1 py-0.5" : "text-sm px-2 py-1"
                )}>
                  {card.cardDef.cost} ⚡
                </span>
              </div>
            )}
          </div>
        );
      })}

      {cards.length === 0 && (
        <div className={clsx(
          "text-gray-500",
          isMobile ? "py-4 text-xs" : "py-8"
        )}>
          No cards in hand
        </div>
      )}
    </motion.div>
  );
}
