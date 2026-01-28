import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import type { CardInstance } from '@engine/models';
import { getEffectivePower } from '@engine/models';
import { CardTooltip } from './CardTooltip';

interface CardProps {
  card: CardInstance;
  size?: 'xs' | 'loc' | 'sm' | 'md' | 'lg';
  selected?: boolean;
  disabled?: boolean;
  faceDown?: boolean;
  onClick?: () => void;
  draggable?: boolean;
  showTooltip?: boolean;
}

// Hook to detect mobile/touch devices
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 640 || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
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
  const [showMobileTooltip, setShowMobileTooltip] = useState(false);
  const isMobile = useIsMobile();
  const power = getEffectivePower(card);
  const basePower = card.cardDef.basePower;
  const powerDiff = power - basePower;

  // Image path - use base URL for GitHub Pages compatibility
  const imagePath = `${import.meta.env.BASE_URL}cards/${card.cardDef.id}.png`;

  const sizeClasses = {
    xs: 'w-10 h-14 text-[8px]',
    loc: 'w-12 h-[68px] text-[9px] border',  // Mobile location cards - 48x68px, thinner border
    sm: 'w-20 h-[120px] text-xs',            // Mobile hand cards - 80x120px
    md: 'w-28 h-[168px] text-sm',            // Desktop hand cards - 112x168px
    lg: 'w-32 h-48 text-base',
  };

  const powerSizeClasses = {
    xs: 'text-[7px]',
    loc: 'text-[8px]',
    sm: 'text-[10px]',
    md: 'text-sm',
    lg: 'text-base',
  };

  const handleInfoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMobileTooltip(true);
  };

  if (faceDown) {
    const faceDownIconSize = size === 'xs' || size === 'loc' ? 'text-sm' : size === 'sm' ? 'text-lg' : 'text-2xl';
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
        <div className={clsx("text-olympus-gold font-display", faceDownIconSize)}>⚡</div>
      </motion.div>
    );
  }

  // Get width for wrapper to match card size
  const wrapperSizeClasses = {
    xs: 'w-10',
    loc: 'w-12',
    sm: 'w-20',   // 80px to match new sm size
    md: 'w-28',   // 112px to match new md size
    lg: 'w-32',
  };

  const cardWidth = size === 'xs' ? 40 : size === 'loc' ? 48 : size === 'sm' ? 80 : size === 'md' ? 112 : 128;

  return (
    <motion.div
      layout
      layoutId={`card-${card.instanceId}`}
      className={clsx("relative", wrapperSizeClasses[size])}
      onMouseEnter={() => !isMobile && setIsHovered(true)}
      onMouseLeave={() => !isMobile && setIsHovered(false)}
      transition={{
        layout: { duration: 0.4, type: 'spring', bounce: 0.2 },
      }}
    >
      {/* Desktop: Tooltip on hover - outside the card to avoid clipping */}
      <AnimatePresence>
        {showTooltip && isHovered && !faceDown && !isMobile && (
          <CardTooltip
            cardDef={card.cardDef}
            power={power}
            powerDiff={powerDiff}
            cardWidth={cardWidth}
          />
        )}
      </AnimatePresence>

      {/* Mobile: Tooltip as modal on click */}
      <AnimatePresence>
        {showMobileTooltip && isMobile && (
          <CardTooltip
            cardDef={card.cardDef}
            power={power}
            powerDiff={powerDiff}
            cardWidth={cardWidth}
            isMobile={true}
            onClose={() => setShowMobileTooltip(false)}
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
          {/* Power badge - top left */}
          <div
            className={clsx(
              'card-power',
              powerSizeClasses[size],
            )}
          >
            <span className={clsx(
              powerDiff === 0 && 'text-black',
              powerDiff > 0 && 'text-emerald-800 drop-shadow-[0_0_2px_rgba(255,255,255,0.8)]',
              powerDiff < 0 && 'text-red-800 drop-shadow-[0_0_2px_rgba(255,255,255,0.8)]',
            )}>{power}</span>
          </div>

          {/* Cost badge - hexagon below power, aligned */}
          <div
            className={clsx(
              'absolute flex items-center justify-center font-bold',
              'text-amber-100',
              size === 'xs' || size === 'loc' ? 'w-3 h-3 text-[6px] top-6 left-0' :
                size === 'sm' ? 'w-3.5 h-3.5 text-[7px] top-7 left-0' :
                  size === 'md' ? 'w-4 h-4 text-[9px] top-8 left-0.5' :
                    'w-5 h-5 text-[10px] top-10 left-0.5'
            )}
            style={{
              background: 'linear-gradient(145deg, #b5651d 0%, #8B4513 25%, #654321 50%, #4a3219 75%, #3a2815 100%)',
              clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
              filter: 'drop-shadow(0 2px 3px rgba(0, 0, 0, 0.5))',
              boxShadow: 'inset 1px 1px 2px rgba(255, 200, 150, 0.3), inset -1px -1px 2px rgba(0, 0, 0, 0.3)',
            }}
          >
            {card.cardDef.cost}
          </div>

          {/* Ability text (only on larger cards without images, or always show on lg) */}
          {((size !== 'sm' && imageError) || size === 'lg') && card.cardDef.text && (
            <div className="text-[10px] text-gray-300 text-center mb-2 line-clamp-2 drop-shadow flex-1 flex items-center justify-center">
              {card.cardDef.text}
            </div>
          )}

          {/* Card name - positioned at bottom center */}
          <div className="flex items-end justify-center text-center mt-auto">
            <span className={clsx(
              'font-display leading-tight drop-shadow-lg',
              !imageError && 'text-white'
            )}>
              {card.cardDef.name}
            </span>
          </div>
        </div>


      </motion.div>

      {/* Mobile info button */}
      {showTooltip && isMobile && !faceDown && (
        <button
          onClick={handleInfoClick}
          className={clsx(
            'absolute z-20 bg-olympus-gold/90 text-black rounded-full flex items-center justify-center font-bold',
            'hover:bg-olympus-gold active:scale-95 transition-transform',
            (size === 'xs' || size === 'loc') ? 'w-3 h-3 text-[7px] -top-0.5 -right-0.5' :
              size === 'sm' ? 'w-4 h-4 text-[9px] -top-1 -right-1' :
                'w-5 h-5 text-[10px] -top-1 -right-1'
          )}
        >
          i
        </button>
      )}
    </motion.div>
  );
}

// Mini card for showing in compact views
export function CardMini({ card }: { card: CardInstance }) {
  return <Card card={card} size="sm" />;
}
