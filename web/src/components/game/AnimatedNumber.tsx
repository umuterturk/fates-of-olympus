import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

interface AnimatedNumberProps {
  value: number;
  /** CSS class for the number text */
  className?: string;
  /** Duration of the slot machine animation in ms */
  duration?: number;
  /** Color when value increases */
  increaseColor?: string;
  /** Color when value decreases */
  decreaseColor?: string;
  /** Default color (no change) */
  defaultColor?: string;
  /** Whether to show +/- prefix during change animation */
  showDelta?: boolean;
  /** Callback when animation completes */
  onAnimationComplete?: () => void;
}

/**
 * Animated number component with slot machine rolling effect.
 * Numbers roll through intermediate values before settling on the final number.
 */
export function AnimatedNumber({
  value,
  className,
  duration = 600,
  increaseColor = 'text-emerald-400',
  decreaseColor = 'text-red-400',
  defaultColor: _defaultColor = 'inherit',
  showDelta = false,
  onAnimationComplete,
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const [direction, setDirection] = useState<'up' | 'down' | null>(null);
  const previousValueRef = useRef(value);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const previousValue = previousValueRef.current;
    
    // Skip animation on initial mount or if value hasn't changed
    if (previousValue === value) {
      return;
    }

    // Determine direction
    const newDirection = value > previousValue ? 'up' : 'down';
    setDirection(newDirection);
    setIsAnimating(true);

    // Calculate animation parameters
    const startValue = previousValue;
    const endValue = value;
    const diff = Math.abs(endValue - startValue);
    const startTime = performance.now();
    
    // Number of "rolls" before settling - more rolls for larger differences
    const rollCount = Math.min(Math.max(diff * 2, 6), 15);
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function - ease out quad for slot machine feel
      const easeOutQuad = (t: number) => t * (2 - t);
      const easedProgress = easeOutQuad(progress);
      
      if (progress < 1) {
        // During animation, show rolling numbers
        // Roll faster at the start, slower as we approach the end
        const rollSpeed = (1 - easedProgress) * rollCount;
        
        if (rollSpeed > 0.3) {
          // Still rolling - show intermediate numbers
          const intermediateProgress = easedProgress + Math.sin(elapsed / 30) * 0.1 * (1 - easedProgress);
          const intermediateValue = Math.round(
            startValue + (endValue - startValue) * intermediateProgress
          );
          setDisplayValue(intermediateValue);
        } else {
          // Slowing down - approach final value
          const approachValue = Math.round(startValue + (endValue - startValue) * easedProgress);
          setDisplayValue(approachValue);
        }
        
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // Animation complete
        setDisplayValue(endValue);
        setIsAnimating(false);
        
        // Clear direction after a short delay to show the final color
        setTimeout(() => {
          setDirection(null);
          onAnimationComplete?.();
        }, 300);
      }
    };
    
    animationRef.current = requestAnimationFrame(animate);
    previousValueRef.current = value;
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration, onAnimationComplete]);

  // Determine color based on direction - only override during animation
  const getAnimationColor = () => {
    if (!direction) return null; // Return null to use className colors
    return direction === 'up' ? increaseColor : decreaseColor;
  };

  // Calculate delta for display
  const delta = value - previousValueRef.current;
  const deltaPrefix = delta > 0 ? '+' : '';

  const animationColor = getAnimationColor();

  return (
    <span className={clsx('relative inline-flex items-center', className)}>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={isAnimating ? 'animating' : displayValue}
          className={clsx(
            'inline-block tabular-nums',
            // Only apply animation color during animation, otherwise inherit from parent className
            animationColor,
            isAnimating && 'drop-shadow-[0_0_8px_currentColor]'
          )}
          initial={isAnimating ? { y: direction === 'up' ? 10 : -10, opacity: 0 } : false}
          animate={{ 
            y: 0, 
            opacity: 1,
            scale: isAnimating ? [1, 1.1, 1] : 1,
          }}
          exit={{ y: direction === 'up' ? -10 : 10, opacity: 0 }}
          transition={{ 
            duration: 0.15,
            scale: { duration: 0.3, repeat: isAnimating ? Infinity : 0, repeatDelay: 0.1 }
          }}
        >
          {displayValue}
        </motion.span>
      </AnimatePresence>
      
      {/* Delta indicator */}
      {showDelta && isAnimating && delta !== 0 && (
        <motion.span
          className={clsx(
            'absolute -top-3 left-1/2 -translate-x-1/2 text-[0.7em] font-bold',
            delta > 0 ? increaseColor : decreaseColor
          )}
          initial={{ y: 5, opacity: 0, scale: 0.5 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -5, opacity: 0, scale: 0.5 }}
          transition={{ duration: 0.2 }}
        >
          {deltaPrefix}{delta}
        </motion.span>
      )}
    </span>
  );
}

/**
 * Animated digit component for individual digit rolling.
 * Used for more dramatic slot machine effects on larger numbers.
 */
export function AnimatedDigit({
  digit,
  className,
  duration = 400,
}: {
  digit: number;
  className?: string;
  duration?: number;
}) {
  const [displayDigit, setDisplayDigit] = useState(digit);
  const [isRolling, setIsRolling] = useState(false);
  const previousDigitRef = useRef(digit);

  useEffect(() => {
    if (previousDigitRef.current === digit) return;

    setIsRolling(true);
    const startTime = performance.now();
    const rollFrames = 8;
    let frameCount = 0;

    const roll = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      if (progress < 1 && frameCount < rollFrames) {
        // Show random digits while rolling
        setDisplayDigit(Math.floor(Math.random() * 10));
        frameCount++;
        setTimeout(roll, duration / rollFrames);
      } else {
        // Settle on final digit
        setDisplayDigit(digit);
        setIsRolling(false);
      }
    };

    roll();
    previousDigitRef.current = digit;
  }, [digit, duration]);

  return (
    <motion.span
      className={clsx('inline-block tabular-nums', className)}
      animate={{
        y: isRolling ? [0, -2, 2, 0] : 0,
      }}
      transition={{
        y: { duration: 0.1, repeat: isRolling ? Infinity : 0 },
      }}
    >
      {displayDigit}
    </motion.span>
  );
}

/**
 * Animated number with individual digit rolling (full slot machine effect).
 * Each digit rolls independently like a slot machine.
 */
export function SlotMachineNumber({
  value,
  className,
  digitClassName,
  duration = 600,
  staggerDelay = 100,
}: {
  value: number;
  className?: string;
  digitClassName?: string;
  duration?: number;
  /** Delay between each digit starting to roll */
  staggerDelay?: number;
}) {
  const digits = String(Math.abs(value)).split('').map(Number);
  const isNegative = value < 0;

  return (
    <span className={clsx('inline-flex', className)}>
      {isNegative && <span className={digitClassName}>-</span>}
      {digits.map((digit, index) => (
        <AnimatedDigit
          key={`${index}-${digit}`}
          digit={digit}
          className={digitClassName}
          duration={duration + index * staggerDelay}
        />
      ))}
    </span>
  );
}
