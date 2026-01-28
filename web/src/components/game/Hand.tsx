import { useState } from 'react';
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

  return (
    <motion.div
      className={clsx(
        "flex justify-center gap-2 p-4 bg-black/30 rounded-xl overflow-visible",
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
          <motion.div
            key={card.instanceId}
            className="relative"
            animate={{
              y: isSelected ? -20 : 0,
              scale: isSelected ? 1.05 : 1,
            }}
            transition={{ duration: 0.2 }}
            style={{ zIndex }}
            onMouseEnter={() => setHoveredCard(card.instanceId)}
            onMouseLeave={() => setHoveredCard(null)}
            onClick={(e) => handleCardClick(card, e)}
          >
            <Card
              card={card}
              size="md"
              selected={isSelected}
              disabled={disabled || !canAfford}
            />
            
            {/* Unaffordable overlay - shows when card costs more than current energy */}
            {!canAfford && (
              <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center pointer-events-none">
                <span className="text-red-400 text-sm font-bold bg-black/80 px-2 py-1 rounded">
                  Cost: {card.cardDef.cost} ⚡
                </span>
              </div>
            )}
          </motion.div>
        );
      })}

      {cards.length === 0 && (
        <div className="text-gray-500 py-8">
          No cards in hand
        </div>
      )}
    </motion.div>
  );
}
