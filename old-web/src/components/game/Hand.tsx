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

  // Card widths: sm = 80px, md = 112px
  const cardWidth = isMobile ? 80 : 112;
  // Container padding: mobile px-1 = 8px total, desktop p-4 = 32px total
  const containerPadding = isMobile ? 8 : 32;
  // Available width for cards (approximate container width)
  const availableWidth = isMobile ? 320 : 580; // Approximate usable width
  
  // Calculate overlap needed when cards don't fit
  const totalCardsWidth = cards.length * cardWidth;
  const needsOverlap = totalCardsWidth > (availableWidth - containerPadding);
  
  // Calculate negative margin to make cards fit (only between cards, not first)
  const overlapAmount = needsOverlap && cards.length > 1
    ? Math.min(
        (totalCardsWidth - (availableWidth - containerPadding)) / (cards.length - 1),
        cardWidth * 0.6 // Max 60% overlap
      )
    : 0;

  return (
    <motion.div
      data-name="hand"
      className={clsx(
        "flex justify-center items-center overflow-visible bg-black/30 rounded-xl flex-1",
        isMobile ? "px-1 py-1" : "p-4",
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
        const zIndex = isHovered ? 100 : isSelected ? 50 : index + 1;

        // Determine transform based on state: selected > hovered > normal
        const getTransform = () => {
          if (isSelected) {
            return `translateY(${isMobile ? -10 : -20}px) scale(1.05)`;
          }
          if (isHovered && canAfford && !disabled) {
            return `translateY(${isMobile ? -6 : -12}px) scale(1.03)`;
          }
          return 'translateY(0) scale(1)';
        };

        return (
          <div
            key={card.instanceId}
            data-name={`hand-card-slot-${index}`}
            className="relative"
            style={{
              zIndex,
              marginLeft: index > 0 ? -overlapAmount : 0,
              transform: getTransform(),
              transition: 'transform 0.2s ease-out, margin-left 0.3s ease-out',
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
              isAffordable={canAfford}
            />

          </div>
        );
      })}

      {cards.length === 0 && (
        <div
          data-name="hand-empty-message"
          className={clsx(
            "text-gray-500",
            isMobile ? "py-4 text-xs" : "py-8"
          )}
        >
          No cards in hand
        </div>
      )}
    </motion.div>
  );
}
