import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import type { LocationState } from '@engine/models';
import { getTotalPower, getCards } from '@engine/models';
import { Card } from './Card';

interface LocationProps {
  location: LocationState;
  onClick?: () => void;
  onCardClick?: (cardInstanceId: number) => void;
  isDropTarget?: boolean;
  selectedCard?: number | null;
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

export function Location({
  location,
  onClick,
  onCardClick,
  isDropTarget = false,
  selectedCard = null,
  pendingCardIds,
  disabled = false,
}: LocationProps) {
  const isMobile = useIsMobile();
  const playerCards = getCards(location, 0);
  const opponentCards = getCards(location, 1);
  const playerPower = getTotalPower(location, 0);
  const opponentPower = getTotalPower(location, 1);

  const locationNames = ['Mount Olympus', 'The Underworld', 'The Aegean Sea'];
  const locationShortNames = ['Olympus', 'Underworld', 'Aegean'];
  const locationImages = ['mount_olympus.png', 'the_uderworld.png', 'aegean_see.png'];
  const locationName = isMobile
    ? (locationShortNames[location.index] ?? `Loc ${location.index + 1}`)
    : (locationNames[location.index] ?? `Location ${location.index + 1}`);
  const locationImage = locationImages[location.index];

  const handleCardClick = (cardInstanceId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    onCardClick?.(cardInstanceId);
  };

  // Use 'loc' size on mobile (48x68), 'sm' on desktop (80x120)
  const cardSize = isMobile ? 'loc' : 'sm';

  // Card dimensions for grid calculation (must match Card component sizes)
  // loc: w-12 = 48px, sm: w-20 = 80px
  const cardW = isMobile ? 48 : 80;
  const cardH = isMobile ? 68 : 120;
  const gap = isMobile ? 1 : 4;

  // 2x2 grid dimensions
  const gridW = cardW * 2 + gap;
  const gridH = cardH * 2 + gap;

  return (
    <motion.div
      data-name={`location-${location.index}`}
      className={clsx(
        'location-container flex-1 flex flex-col items-center',
        onClick && !disabled && 'cursor-pointer',
      )}
      onClick={disabled ? undefined : onClick}
      layout
    >
      {/* Opponent cards (top) - 2x2 grid, cards fill from bottom row first */}
      <div
        data-name={`location-${location.index}-opponent-cards`}
        className="grid grid-cols-2 justify-items-center items-end overflow-visible"
        style={{
          width: gridW,
          height: gridH,
          gap: gap,
        }}
      >
        <AnimatePresence>
          {/* Visual slots 0-3, but map cards so they fill bottom row first:
              card 0 → visual slot 2 (bottom-left), card 1 → slot 3, card 2 → slot 0, card 3 → slot 1 */}
          {[0, 1, 2, 3].map((visualSlot) => {
            // Map visual slots to card indices: top row shows cards 2,3; bottom row shows cards 0,1
            const cardIndex = visualSlot < 2 ? visualSlot + 2 : visualSlot - 2;
            const card = opponentCards[cardIndex];
            return (
              <div
                key={visualSlot}
                data-name={`location-${location.index}-opponent-slot-${visualSlot}`}
                className="flex items-end justify-center"
                style={{ width: cardW, height: cardH }}
              >
                {card && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0, y: -20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0, opacity: 0 }}
                  >
                    <Card
                      card={card}
                      size={cardSize}
                      faceDown={!card.revealed}
                      showTooltip={card.revealed}
                    />
                  </motion.div>
                )}
              </div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Central location card with highlight wrapper - square with cropped corners */}
      {/* 5% bigger: 100->105 mobile, 140->147 desktop */}
      <div
        data-name={`location-${location.index}-card`}
        className={clsx(
          "relative my-1 transition-all location-card-wrapper",
          isDropTarget && 'location-card-highlight',
          isMobile ? "w-[105px] h-[105px]" : "w-[147px] h-[147px]"
        )}
      >
        <div data-name={`location-${location.index}-card-inner`} className="location-card-inner overflow-hidden">
          {/* Location background image */}
          <img
            src={`${import.meta.env.BASE_URL}locations/${locationImage}`}
            alt={locationName}
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />

          {/* Gradient overlay for readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/50" />

          {/* Location content */}
          <div className={clsx(
            "absolute inset-0 flex flex-col items-center justify-start px-2 text-center",
            isMobile ? "pt-5" : "pt-7"
          )}>
            <h3
              data-name={`location-${location.index}-name`}
              className={clsx(
                "font-display text-olympus-gold leading-tight drop-shadow-lg",
                isMobile ? "text-sm" : "text-base"
              )}
            >
              {locationName}
            </h3>
          </div>
        </div>

        {/* Opponent power badge (top center) - moved towards center */}
        <div
          data-name={`location-${location.index}-opponent-power`}
          className={clsx(
            "absolute z-20 left-1/2 -translate-x-1/2",
            isMobile ? "top-0" : "top-0"
          )}
        >
          <HexPowerBadge
            power={opponentPower}
            isWinning={opponentPower > playerPower}
            isMobile={isMobile}
          />
        </div>

        {/* Player power badge (bottom center) - moved towards center */}
        <div
          data-name={`location-${location.index}-player-power`}
          className={clsx(
            "absolute z-20 left-1/2 -translate-x-1/2",
            isMobile ? "bottom-0" : "bottom-0"
          )}
        >
          <HexPowerBadge
            power={playerPower}
            isWinning={playerPower > opponentPower}
            isMobile={isMobile}
          />
        </div>
      </div>

      {/* Player cards (bottom) - 2x2 grid */}
      <div
        data-name={`location-${location.index}-player-cards`}
        className="grid grid-cols-2 justify-items-center items-start overflow-visible"
        style={{
          width: gridW,
          height: gridH,
          gap: gap,
        }}
      >
        {[0, 1, 2, 3].map((slotIndex) => {
          const card = playerCards[slotIndex];
          const isPending = card ? (pendingCardIds?.has(card.instanceId) ?? false) : false;
          const isSelected = card ? selectedCard === card.instanceId : false;

          return (
            <div
              key={slotIndex}
              data-name={`location-${location.index}-player-slot-${slotIndex}`}
              className="flex items-start justify-center"
              style={{ width: cardW, height: cardH }}
            >
              {card && (
                <div
                  onClick={isPending && !disabled ? (e) => handleCardClick(card.instanceId, e) : undefined}
                  className={clsx(
                    'rounded-lg',
                    isPending && !disabled && 'cursor-pointer',
                    isPending && 'pending-card-glow',
                    isSelected && 'ring-2 ring-olympus-gold',
                  )}
                >
                  <Card
                    card={card}
                    size={cardSize}
                    faceDown={!card.revealed}
                    showTooltip={card.revealed}
                    selected={isSelected}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// Hexagonal power badge like Marvel Snap
function HexPowerBadge({
  power,
  isWinning,
  isMobile = false,
}: {
  power: number;
  isWinning: boolean;
  isMobile?: boolean;
}) {
  // 3D gradient colors
  const getGradient = () => {
    if (isWinning) {
      // Emerald green 3D gradient
      return 'linear-gradient(145deg, #4ade80 0%, #22c55e 25%, #16a34a 50%, #15803d 75%, #166534 100%)';
    } else if (power === 0) {
      // Gray 3D gradient
      return 'linear-gradient(145deg, #9ca3af 0%, #6b7280 25%, #4b5563 50%, #374151 75%, #1f2937 100%)';
    } else {
      // Red 3D gradient
      return 'linear-gradient(145deg, #f87171 0%, #ef4444 25%, #dc2626 50%, #b91c1c 75%, #991b1b 100%)';
    }
  };

  return (
    <motion.div
      className={clsx(
        'hex-power-badge relative flex items-center justify-center font-bold',
        isMobile ? 'w-6 h-7 text-xs' : 'w-8 h-9 text-sm',
      )}
      key={power}
      initial={{ scale: 1 }}
      animate={{ scale: [1, 1.15, 1] }}
      transition={{ duration: 0.3 }}
    >
      {/* Hexagon background with 3D gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: getGradient(),
          clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
          filter: 'drop-shadow(0 2px 3px rgba(0, 0, 0, 0.4))',
        }}
      />
      {/* Inner highlight/shadow for 3D effect */}
      <div
        className="absolute inset-0.5"
        style={{
          background: 'linear-gradient(145deg, rgba(255,255,255,0.2) 0%, transparent 50%, rgba(0,0,0,0.2) 100%)',
          clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
        }}
      />
      {/* Power number */}
      <span className="relative z-10 text-white drop-shadow-md">
        {power}
      </span>
    </motion.div>
  );
}
