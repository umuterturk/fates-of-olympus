import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import type { CardInstance } from '@engine/models';
import { getEffectivePower } from '@engine/models';
import { CardTooltip } from './CardTooltip';
import { AnimatedNumber } from './AnimatedNumber';
import { useGameStore } from '@store/gameStore';
import { getCardImagePath } from '@/utils/assets';
import type { PowerChangedEvent, CardDestroyedEvent } from '@engine/events';

interface CardProps {
  card: CardInstance;
  size?: 'xs' | 'loc' | 'sm' | 'md' | 'lg';
  selected?: boolean;
  disabled?: boolean;
  isAffordable?: boolean;
  faceDown?: boolean;
  onClick?: () => void;
  draggable?: boolean;
  showTooltip?: boolean;
  /** Whether this card was just played this turn (pending). Used to control layout animation. */
  isPending?: boolean;
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
  isAffordable = true,
  faceDown = false,
  onClick,
  draggable = false,
  showTooltip = true,
  isPending = true, // Default true for cards in hand (always enable layout for hand-to-board transition)
}: CardProps) {
  const [imageError, setImageError] = useState(false);
  const [isInfoHovered, setIsInfoHovered] = useState(false);
  const [showMobileTooltip, setShowMobileTooltip] = useState(false);
  const isMobile = useIsMobile();
  const power = getEffectivePower(card);
  const basePower = card.cardDef.basePower;
  const powerDiff = power - basePower;

  // Get current animation state
  const { powerChangedEvents, currentAnimationIndex, cardDestroyedEvents, currentDestroyAnimationIndex, isAnimating } = useGameStore();
  const currentEvent = isAnimating && powerChangedEvents.length > 0 && currentAnimationIndex < powerChangedEvents.length
    ? (powerChangedEvents[currentAnimationIndex] as PowerChangedEvent)
    : null;

  // Source stays big while ANY remaining event (from current index onward) has this card as source
  // This keeps the effecting card big until all its effects are done
  const currentSourceId = currentEvent?.sourceCardId;
  const isSourceOfEffect = currentSourceId === card.instanceId && 
    powerChangedEvents.slice(currentAnimationIndex).some(
      (e) => (e as PowerChangedEvent).sourceCardId === currentSourceId
    );
  const isTargetOfEffectRaw = currentEvent && currentEvent.cardInstanceId === card.instanceId;
  const isBuffEffect = currentEvent && currentEvent.newPower > currentEvent.oldPower;
  const isDebuffEffect = currentEvent && currentEvent.newPower < currentEvent.oldPower;

  // Delay target animation state to ensure source animates first
  const [targetAnimationActive, setTargetAnimationActive] = useState(false);
  useEffect(() => {
    if (isTargetOfEffectRaw) {
      // Wait for source card to scale up first (0.5s delay)
      const timer = setTimeout(() => {
        setTargetAnimationActive(true);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setTargetAnimationActive(false);
    }
  }, [isTargetOfEffectRaw, currentAnimationIndex]);

  // Target only animates after the delay
  const isTargetOfEffect = isTargetOfEffectRaw && targetAnimationActive;

  // Disable layout animation when card is involved in buff/debuff animation to prevent conflicts
  const isInBuffDebuffAnimation = isSourceOfEffect || isTargetOfEffect;

  // Check if this card is being destroyed
  const currentDestroyEvent = cardDestroyedEvents.length > 0 && currentDestroyAnimationIndex < cardDestroyedEvents.length
    ? (cardDestroyedEvents[currentDestroyAnimationIndex] as CardDestroyedEvent)
    : null;
  const isBeingDestroyed = currentDestroyEvent && currentDestroyEvent.cardInstanceId === card.instanceId;

  // Only enable layout for pending cards (just played) OR during animation resolution
  // This allows cards to animate when they shift slots within a location or move between locations
  const shouldEnableLayout = (isPending || isAnimating) && !isBeingDestroyed && !isInBuffDebuffAnimation;

  // Image path - use base URL for GitHub Pages compatibility
  const imagePath = getCardImagePath(card.cardDef.id);

  const sizeClasses = {
    xs: 'w-10 h-14 text-[8px]',
    loc: 'w-14 h-20 text-[10px] border',     // Mobile location cards - 56x80px, thinner border
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

  // Get width for wrapper to match card size
  const wrapperSizeClasses = {
    xs: 'w-10',
    loc: 'w-14',  // 56px to match loc size
    sm: 'w-20',   // 80px to match new sm size
    md: 'w-28',   // 112px to match new md size
    lg: 'w-32',
  };

  const cardWidth = size === 'xs' ? 40 : size === 'loc' ? 56 : size === 'sm' ? 80 : size === 'md' ? 112 : 128;

  // Confrontation offset for source card moving toward target during debuff
  // Computed via effect to ensure DOM positions are available
  const getConfrontationOffset = useGameStore(state => state.getConfrontationOffset);
  const [confrontationOffset, setConfrontationOffset] = useState({ x: 0, y: 0 });
  
  useEffect(() => {
    if (isSourceOfEffect && isDebuffEffect && currentEvent) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        const offset = getConfrontationOffset(currentEvent.sourceCardId, currentEvent.cardInstanceId);
        setConfrontationOffset(offset);
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setConfrontationOffset({ x: 0, y: 0 });
    }
  }, [isSourceOfEffect, isDebuffEffect, currentEvent, getConfrontationOffset]);

  // Target recoil offset for target card moving away during debuff confrontation
  const getTargetRecoilOffset = useGameStore(state => state.getTargetRecoilOffset);
  const [targetRecoilOffset, setTargetRecoilOffset] = useState({ x: 0, y: 0 });
  
  useEffect(() => {
    if (isTargetOfEffect && isDebuffEffect && currentEvent) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        const offset = getTargetRecoilOffset(currentEvent.sourceCardId, currentEvent.cardInstanceId);
        setTargetRecoilOffset(offset);
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setTargetRecoilOffset({ x: 0, y: 0 });
    }
  }, [isTargetOfEffect, isDebuffEffect, currentEvent, getTargetRecoilOffset]);

  // Memoize animate/transition so Framer Motion doesn't restart the animation on every render

  const cardAnimate = useMemo(() => {
    if (isBeingDestroyed) {
      return { scale: 3, opacity: 0.01, zIndex: 100 };
    }
    if (isSourceOfEffect) {
      // Source card (effecting card) scales up with a golden glow - stays big
      // For debuffs, also moves toward the target for confrontation
      if (isDebuffEffect && (confrontationOffset.x !== 0 || confrontationOffset.y !== 0)) {
        return {
          scale: [1, 1.55, 1.55],
          x: [0, confrontationOffset.x, confrontationOffset.x],
          y: [0, confrontationOffset.y - 25, confrontationOffset.y - 25],
          zIndex: 50,
          boxShadow: '0 0 30px 8px rgba(212, 175, 55, 0.7), 0 0 60px 15px rgba(184, 134, 11, 0.5)',
        };
      }
      return {
        scale: [1, 1.55, 1.55],
        y: [0, -25, -25],
        zIndex: 50,
        boxShadow: '0 0 30px 8px rgba(212, 175, 55, 0.7), 0 0 60px 15px rgba(184, 134, 11, 0.5)',
      };
    }
    if (isTargetOfEffect && isBuffEffect) {
      return {
        scale: [1, 1.55, 1.55, 1],
        y: [0, -20, -20, 0],
        rotate: [0, 2, 2, 0],
        zIndex: 40,
        boxShadow: '0 0 25px 6px rgba(34, 197, 94, 0.5), 0 0 50px 12px rgba(22, 163, 74, 0.3)',
      };
    }
    if (isTargetOfEffect && isDebuffEffect) {
      // Target card recoils away from the source during debuff confrontation
      const recoilX = targetRecoilOffset.x;
      const recoilY = targetRecoilOffset.y;
      return {
        scale: [1, 0.95, 1.5, 1.5, 1],
        x: [0, recoilX + 5, recoilX - 5, recoilX, 0],
        y: [0, recoilY + 3, recoilY - 3, recoilY, 0],
        zIndex: 40,
        boxShadow: '0 0 25px 6px rgba(239, 68, 68, 0.5), 0 0 50px 12px rgba(220, 38, 38, 0.3)',
      };
    }
    if (isTargetOfEffect) {
      return { scale: 1.5, zIndex: 40 };
    }
    return {
      scale: 1,
      x: 0,
      y: 0,
      rotate: 0,
      zIndex: 1,
      opacity: 1,
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    };
  }, [isBeingDestroyed, isSourceOfEffect, isTargetOfEffect, isBuffEffect, isDebuffEffect, confrontationOffset, targetRecoilOffset]);

  const cardTransition = useMemo(() => {
    if (isBeingDestroyed) {
      return { duration: 0.4, ease: 'easeOut' as const };
    }
    // SOURCE card: scales up IMMEDIATELY with clear visual cue, stays big
    // For debuffs, also moves toward the target for confrontation
    if (isSourceOfEffect) {
      return {
        duration: 0.4,
        ease: 'easeOut' as const,
        scale: { times: [0, 0.5, 1] },
        x: { times: [0, 0.5, 1] },
        y: { times: [0, 0.5, 1] },
        boxShadow: { duration: 0 },
      };
    }
    // TARGET card: scales up (delay is handled by state, not transition)
    if (isTargetOfEffect && (isBuffEffect || isDebuffEffect)) {
      return {
        duration: 2.2,
        ease: 'easeInOut' as const,
        scale: { times: isDebuffEffect ? [0, 0.05, 0.12, 0.9, 1] : [0, 0.1, 0.9, 1] },
        y: { times: isDebuffEffect ? [0, 0.05, 0.1, 0.2, 1] : [0, 0.1, 0.9, 1] },
        x: isDebuffEffect ? { times: [0, 0.05, 0.1, 0.2, 1] } : undefined,
        rotate: isBuffEffect ? { times: [0, 0.1, 0.9, 1] } : undefined,
        boxShadow: { duration: 0 },
      };
    }
    // Fast transition for hover-out and normal state changes
    return { duration: 0.1 };
  }, [isBeingDestroyed, isSourceOfEffect, isTargetOfEffect, isBuffEffect, isDebuffEffect]);

  const handleInfoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMobileTooltip(true);
  };

  // Early return for face-down cards (placed after all hooks to satisfy React's rules of hooks)
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

  return (
    <motion.div
      layout={shouldEnableLayout}
      layoutId={isBeingDestroyed ? undefined : `card-${card.instanceId}`}
      data-card-id={card.instanceId}
      className={clsx("relative", wrapperSizeClasses[size])}
      transition={{
        layout: { duration: 0.6, type: 'spring', bounce: 0.25 },
      }}
    >
      {/* Desktop: Tooltip on hover over info button */}
      <AnimatePresence>
        {showTooltip && isInfoHovered && !faceDown && !isMobile && (
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
          'card cursor-pointer overflow-visible relative',
          sizeClasses[size],
          selected && 'ring-2 ring-olympus-gold ring-offset-2 ring-offset-olympus-navy',
          disabled && 'brightness-[0.7] saturate-[0.8] cursor-not-allowed',
        )}
        onClick={disabled ? undefined : onClick}
        initial={false}
        animate={cardAnimate}
        whileHover={disabled || isBeingDestroyed ? undefined : { 
          scale: 1.05, 
          y: -4, 
          zIndex: 100,
          transition: { duration: 0.1 }
        }}
        whileTap={disabled || isBeingDestroyed ? undefined : { 
          scale: 0.98,
          transition: { duration: 0.05 }
        }}
        transition={cardTransition}
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

        {/* Debuff flash overlay */}
        {isTargetOfEffect && isDebuffEffect && (
          <motion.div
            className="absolute inset-0 bg-red-500 pointer-events-none z-[5]"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.6, 0.3, 0] }}
            transition={{
              duration: 0.6,
              times: [0, 0.3, 0.7, 1],
              repeat: 2,
            }}
          />
        )}

        {/* Card content */}
        <div className="relative h-full p-2 flex flex-col">
          {/* Power badge - top left */}
          <div
            className={clsx(
              'card-power',
              powerSizeClasses[size],
            )}
          >
            <AnimatedNumber
              value={power}
              className={clsx(
                powerDiff === 0 && 'text-black',
                powerDiff > 0 && 'text-emerald-800 drop-shadow-[0_0_2px_rgba(255,255,255,0.8)]',
                powerDiff < 0 && 'text-red-800 drop-shadow-[0_0_2px_rgba(255,255,255,0.8)]',
              )}
              increaseColor="text-emerald-800"
              decreaseColor="text-red-800"
              defaultColor="text-black"
              duration={500}
            />
          </div>

          {/* Cost badge - hexagon below power, aligned */}
          <div
            className={clsx(
              'absolute flex items-center justify-center font-bold',
              isAffordable ? 'text-amber-100' : 'text-red-500',
              size === 'xs' || size === 'loc' ? 'w-4 h-3.5 text-[7px] top-6 left-0' :
                size === 'sm' ? 'w-5 h-4.5 text-[9px] top-7 left-0' :
                  size === 'md' ? 'w-6 h-5.5 text-[10px] top-8 left-0.5' :
                    'w-8 h-7 text-xs top-10 left-0.5'
            )}
            style={{
              background: 'linear-gradient(145deg, #4a3219 0%, #3a2815 25%, #2c1e0f 50%, #1a1209 75%, #0d0904 100%)',
              clipPath: 'polygon(20% 0%, 80% 0%, 100% 50%, 80% 100%, 20% 100%, 0% 50%)',
              filter: 'drop-shadow(0 2px 3px rgba(0, 0, 0, 0.4))',
              boxShadow: 'inset 1px 1px 2px rgba(255, 255, 255, 0.1), inset -1px -1px 2px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div className="flex items-center -ml-0.5">
              <span className="text-[0.9em] brightness-125">⚡</span>
              <span className="-ml-0.5">{card.cardDef.cost}</span>
            </div>
          </div>

          {!isAffordable && !faceDown && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 px-2">
              <span className={clsx(
                "text-red-500 font-bold text-center uppercase tracking-tighter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]",
                size === 'xs' || size === 'loc' ? 'text-[6px]' :
                  size === 'sm' ? 'text-[8px]' :
                    'text-[10px]'
              )}>
                Not Enough Energy
              </span>
            </div>
          )}

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

        {/* Info button - inside card so it scales with the card */}
        {showTooltip && !faceDown && (
          <button
            onClick={isMobile ? handleInfoClick : undefined}
            onMouseEnter={() => !isMobile && setIsInfoHovered(true)}
            onMouseLeave={() => !isMobile && setIsInfoHovered(false)}
            className={clsx(
              'absolute z-[110] rounded-full flex items-center justify-center font-bold text-black',
              'transition-all active:scale-90 select-none shadow-sm',
              isMobile ? 'opacity-85' : 'opacity-70 hover:opacity-100',
              (size === 'xs' || size === 'loc') ? 'w-2.5 h-2.5 text-[8px] -top-0.5 -right-0.5' :
                size === 'sm' ? 'w-3.5 h-3.5 text-[10px] -top-1 -right-1' :
                  size === 'md' ? 'w-5 h-5 text-[12px] -top-1.5 -right-1.5' :
                    'w-5 h-5 text-[12px] -top-1.5 -right-1.5'
            )}
            style={{
              background: 'linear-gradient(135deg, #D4AF37 0%, #B8860B 100%)',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.3)',
            }}
          >
            <span className="leading-none">?</span>
          </button>
        )}
      </motion.div>
    </motion.div >
  );
}

// Mini card for showing in compact views
export function CardMini({ card }: { card: CardInstance }) {
  return <Card card={card} size="sm" />;
}
