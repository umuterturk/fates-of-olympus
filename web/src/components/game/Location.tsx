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

export function Location({
  location,
  onClick,
  onCardClick,
  isDropTarget = false,
  selectedCard = null,
  pendingCardIds,
  disabled = false,
}: LocationProps) {
  const playerCards = getCards(location, 0);
  const opponentCards = getCards(location, 1);
  const playerPower = getTotalPower(location, 0);
  const opponentPower = getTotalPower(location, 1);

  const locationNames = ['Mount Olympus', 'The Underworld', 'The Aegean Sea'];
  const locationName = locationNames[location.index] ?? `Location ${location.index + 1}`;

  const handleCardClick = (cardInstanceId: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger location click
    onCardClick?.(cardInstanceId);
  };

  return (
    <motion.div
      className={clsx(
        'location flex-1',
        isDropTarget && 'ring-2 ring-olympus-gold bg-olympus-gold/10',
        onClick && !disabled && 'cursor-pointer hover:bg-white/5',
      )}
      onClick={disabled ? undefined : onClick}
      layout
    >
      {/* Location header */}
      <div className="text-center mb-2">
        <h3 className="font-display text-olympus-gold text-sm">{locationName}</h3>
      </div>

      {/* Opponent's side (top) */}
      <div className="location-slot min-h-[100px] overflow-visible">
        <div className="w-full flex justify-between items-center mb-2">
          <PowerBadge power={opponentPower} isWinning={opponentPower > playerPower} />
          <span className="text-xs text-gray-500">Opponent</span>
        </div>
        <div className="flex flex-wrap gap-1 justify-center overflow-visible">
          <AnimatePresence>
            {opponentCards.map((card) => (
              <motion.div
                key={card.instanceId}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
              >
                <Card
                  card={card}
                  size="sm"
                  faceDown={!card.revealed}
                  showTooltip={card.revealed}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-white/10 my-2" />

      {/* Player's side (bottom) */}
      <div className="location-slot min-h-[100px] overflow-visible">
        <div className="flex flex-wrap gap-1 justify-center overflow-visible">
          {playerCards.map((card) => {
            const isPending = pendingCardIds?.has(card.instanceId) ?? false;
            const isSelected = selectedCard === card.instanceId;
            
            return (
              <div
                key={card.instanceId}
                onClick={isPending && !disabled ? (e) => handleCardClick(card.instanceId, e) : undefined}
                className={clsx(
                  isPending && !disabled && 'cursor-pointer',
                  isPending && 'ring-2 ring-yellow-500/50 rounded-lg',
                  isSelected && 'ring-2 ring-olympus-gold rounded-lg',
                )}
              >
                <Card
                  card={card}
                  size="sm"
                  faceDown={!card.revealed}
                  showTooltip={card.revealed}
                  selected={isSelected}
                />
              </div>
            );
          })}
        </div>
        <div className="w-full flex justify-between items-center mt-2">
          <span className="text-xs text-gray-500">You</span>
          <PowerBadge power={playerPower} isWinning={playerPower > opponentPower} />
        </div>
      </div>

      {/* Capacity indicator */}
      <div className="text-center mt-2">
        <span className="text-xs text-gray-500">
          {playerCards.length}/4 cards
        </span>
      </div>
    </motion.div>
  );
}

function PowerBadge({ power, isWinning }: { power: number; isWinning: boolean }) {
  return (
    <motion.div
      className={clsx(
        'power-display',
        isWinning ? 'power-winning' : 'power-losing',
        power === 0 && 'bg-gray-600',
      )}
      key={power}
      initial={{ scale: 1 }}
      animate={{ scale: [1, 1.2, 1] }}
      transition={{ duration: 0.3 }}
    >
      {power}
    </motion.div>
  );
}
