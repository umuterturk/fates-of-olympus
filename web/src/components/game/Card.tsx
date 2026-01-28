import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import type { CardInstance } from '@engine/models';
import { getEffectivePower } from '@engine/models';
import { CardTooltip } from './CardTooltip';

interface CardProps {
  card: CardInstance;
  size?: 'sm' | 'md' | 'lg';
  selected?: boolean;
  disabled?: boolean;
  faceDown?: boolean;
  onClick?: () => void;
  draggable?: boolean;
  showTooltip?: boolean;
}

export function Card({
  card,
  size = 'md',
  selected = false,
  disabled = false,
  faceDown = false,
  onClick,
  draggable = false,
  showTooltip = true,
}: CardProps) {
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const power = getEffectivePower(card);
  const basePower = card.cardDef.basePower;
  const powerDiff = power - basePower;

  // Image path - tries multiple extensions
  const imagePath = `/cards/${card.cardDef.id}.png`;

  const sizeClasses = {
    sm: 'w-16 h-24 text-xs',
    md: 'w-24 h-36 text-sm',
    lg: 'w-32 h-48 text-base',
  };

  const powerSizeClasses = {
    sm: 'w-5 h-5 text-xs',
    md: 'w-8 h-8 text-lg',
    lg: 'w-10 h-10 text-xl',
  };

  const costSizeClasses = {
    sm: 'w-4 h-4 text-[10px]',
    md: 'w-6 h-6 text-sm',
    lg: 'w-8 h-8 text-base',
  };

  if (faceDown) {
    return (
      <motion.div
        layout
        layoutId={`card-${card.instanceId}`}
        className={clsx(
          'card flex items-center justify-center',
          sizeClasses[size],
          'bg-gradient-to-br from-olympus-navy to-gray-900',
          'border-olympus-bronze'
        )}
        transition={{
          layout: { duration: 0.4, type: 'spring', bounce: 0.2 },
        }}
      >
        <div className="text-olympus-gold font-display text-2xl">⚡</div>
      </motion.div>
    );
  }

  // Get width for wrapper to match card size
  const wrapperSizeClasses = {
    sm: 'w-16',
    md: 'w-24',
    lg: 'w-32',
  };

  return (
    <motion.div 
      layout
      layoutId={`card-${card.instanceId}`}
      className={clsx("relative", wrapperSizeClasses[size])}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      transition={{
        layout: { duration: 0.4, type: 'spring', bounce: 0.2 },
      }}
    >
      {/* Tooltip on hover - outside the card to avoid clipping */}
      <AnimatePresence>
        {showTooltip && isHovered && !faceDown && (
          <CardTooltip 
            cardDef={card.cardDef} 
            power={power} 
            powerDiff={powerDiff}
            cardWidth={size === 'sm' ? 64 : size === 'md' ? 96 : 128}
          />
        )}
      </AnimatePresence>
      
      <motion.div
        className={clsx(
          'card cursor-pointer overflow-hidden relative',
          sizeClasses[size],
          selected && 'ring-2 ring-olympus-gold ring-offset-2 ring-offset-olympus-navy',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
        onClick={disabled ? undefined : onClick}
        whileHover={disabled ? undefined : { scale: 1.05, y: -4 }}
        whileTap={disabled ? undefined : { scale: 0.98 }}
        drag={draggable && !disabled}
        dragSnapToOrigin
      >
      {/* Card background image */}
      {!imageError && (
        <img
          src={imagePath}
          alt={card.cardDef.name}
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      )}
      
      {/* Gradient overlay for readability */}
      <div className={clsx(
        'absolute inset-0',
        !imageError && 'bg-gradient-to-t from-black/80 via-black/20 to-black/40'
      )} />

      {/* Card content */}
      <div className="relative h-full p-2 flex flex-col">
        {/* Cost badge */}
        <div className={clsx('card-cost', costSizeClasses[size])}>
          {card.cardDef.cost}
        </div>

        {/* Card name - positioned at bottom when image exists */}
        <div className={clsx(
          'flex-1 flex items-end justify-center text-center',
          !imageError && 'items-center'
        )}>
          <span className={clsx(
            'font-display leading-tight drop-shadow-lg',
            !imageError && 'text-white'
          )}>
            {card.cardDef.name}
          </span>
        </div>

        {/* Ability text (only on larger cards without images, or always show on lg) */}
        {((size !== 'sm' && imageError) || size === 'lg') && card.cardDef.text && (
          <div className="text-[10px] text-gray-300 text-center mb-2 line-clamp-2 drop-shadow">
            {card.cardDef.text}
          </div>
        )}

        {/* Power badge */}
        <div
          className={clsx(
            'card-power',
            powerSizeClasses[size],
            powerDiff > 0 && 'bg-green-500',
            powerDiff < 0 && 'bg-red-500',
          )}
        >
          {power}
        </div>
      </div>

      {/* Power change indicator */}
      {powerDiff !== 0 && (
        <motion.div
          className={clsx(
            'absolute -top-2 -right-2 rounded-full px-1 text-xs font-bold z-10',
            powerDiff > 0 ? 'bg-green-500' : 'bg-red-500'
          )}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
        >
          {powerDiff > 0 ? `+${powerDiff}` : powerDiff}
        </motion.div>
      )}
      </motion.div>
    </motion.div>
  );
}

// Mini card for showing in compact views
export function CardMini({ card }: { card: CardInstance }) {
  return <Card card={card} size="sm" />;
}
