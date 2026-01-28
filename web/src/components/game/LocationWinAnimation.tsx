/**
 * LocationWinAnimation - Shows +1 flying from won locations to the points indicator.
 * 
 * When a player wins a location, this component animates a "+1" particle
 * flying from the location to the points display in the header.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PlayerId } from '@engine/types';

interface LocationWinAnimationProps {
    /** Location winners array - index is location index, value is winning player ID or null for tie */
    locationWinners: readonly (PlayerId | null)[] | null;
    /** Which player we're showing the animation for (0 = human player) */
    playerId: PlayerId;
    /** Called when all animations complete */
    onComplete?: () => void;
    /** Called when a single point lands */
    onPointLanded?: () => void;
}

interface AnimationItem {
    id: number;
    locationIndex: number;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
}

// Flying +1 particle with trail
function FlyingPoint({
    startX,
    startY,
    endX,
    endY,
    delay,
    onLanded,
    onFinished,
}: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    delay: number;
    onLanded?: () => void;
    onFinished?: () => void;
}) {
    return (
        <>
            {/* Trail particles */}
            {[0, 1, 2].map((i) => (
                <motion.div
                    key={`trail-${i}`}
                    className="absolute w-2 h-2 rounded-full"
                    style={{
                        left: startX,
                        top: startY,
                        background: 'radial-gradient(circle, #fcd34d 0%, #f59e0b 50%, #d97706 100%)',
                        boxShadow: '0 0 8px 4px rgba(252, 211, 77, 0.5)',
                    }}
                    initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                    animate={{
                        x: endX - startX,
                        y: endY - startY,
                        opacity: [0, 0.7, 0.7, 0],
                        scale: [0, 0.8, 0.6, 0.2],
                    }}
                    transition={{
                        duration: 0.8,
                        delay: delay + i * 0.08,
                        ease: [0.4, 0, 0.2, 1],
                    }}
                />
            ))}

            {/* Main +1 particle */}
            <motion.div
                className="absolute flex items-center justify-center"
                style={{
                    left: startX,
                    top: startY,
                }}
                initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                animate={{
                    x: endX - startX,
                    y: endY - startY,
                    opacity: [0, 1, 1, 0],
                    scale: [0.5, 1.3, 1.1, 0.8],
                }}
                transition={{
                    duration: 0.9,
                    delay,
                    ease: [0.25, 0.1, 0.25, 1],
                    opacity: { times: [0, 0.15, 0.85, 1] },
                }}
                onAnimationComplete={() => {
                    if (onLanded) onLanded();
                    // Wait a bit before calling onFinished to sync with impact animations
                    setTimeout(() => {
                        if (onFinished) onFinished();
                    }, 500);
                }}
            >
                {/* Glow background */}
                <div
                    className="absolute w-10 h-10 rounded-full"
                    style={{
                        background: 'radial-gradient(circle, rgba(252, 211, 77, 0.6) 0%, transparent 70%)',
                    }}
                />
                {/* +1 text */}
                <span
                    className="relative font-bold text-xl font-display"
                    style={{
                        color: '#fcd34d',
                        textShadow: '0 0 10px rgba(252, 211, 77, 0.9), 0 0 20px rgba(245, 158, 11, 0.7), 0 2px 4px rgba(0,0,0,0.5)',
                    }}
                >
                    +1
                </span>
            </motion.div>
        </>
    );
}

// Impact burst at destination
function PointImpact({
    x,
    y,
    delay,
}: {
    x: number;
    y: number;
    delay: number;
}) {
    return (
        <>
            {/* Expanding ring */}
            <motion.div
                className="absolute rounded-full border-2"
                style={{
                    left: x,
                    top: y,
                    borderColor: '#fcd34d',
                    transform: 'translate(-50%, -50%)',
                }}
                initial={{ width: 0, height: 0, opacity: 1 }}
                animate={{ width: 50, height: 50, opacity: 0 }}
                transition={{ duration: 0.5, delay: delay + 0.7, ease: 'easeOut' }}
            />

            {/* Inner glow */}
            <motion.div
                className="absolute rounded-full"
                style={{
                    left: x,
                    top: y,
                    transform: 'translate(-50%, -50%)',
                    background: 'radial-gradient(circle, rgba(252, 211, 77, 0.6), transparent 70%)',
                }}
                initial={{ width: 0, height: 0, opacity: 0 }}
                animate={{ width: 40, height: 40, opacity: [0, 1, 0] }}
                transition={{ duration: 0.4, delay: delay + 0.6 }}
            />
        </>
    );
}

export function LocationWinAnimation({
    locationWinners,
    playerId,
    onComplete,
    onPointLanded,
}: LocationWinAnimationProps) {
    const [animations, setAnimations] = useState<AnimationItem[]>([]);
    const completedCountRef = useRef(0);
    const [isActive, setIsActive] = useState(false);

    // Find the points indicator element position
    const findPointsIndicator = useCallback((): { x: number; y: number } | null => {
        const indicator = document.querySelector('[data-points-indicator]');
        if (indicator) {
            const rect = indicator.getBoundingClientRect();
            return {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2,
            };
        }
        return null;
    }, []);

    // Find location element position by index
    const findLocationPosition = useCallback((locationIndex: number): { x: number; y: number } | null => {
        // Use more specific selector with data attribute
        const locationElement = document.querySelector(`[data-location-index="${locationIndex}"]`);
        if (!locationElement) return null;

        const rect = locationElement.getBoundingClientRect();
        return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
        };
    }, []);

    useEffect(() => {
        if (!locationWinners || locationWinners.length === 0) {
            setIsActive(false);
            return;
        }

        // Calculate which locations the player won
        const wonLocations = locationWinners
            .map((winner, index) => ({ winner, index }))
            .filter(({ winner }) => winner === playerId);

        if (wonLocations.length === 0) {
            onComplete?.();
            return;
        }

        // Wait for DOM to be ready
        const timeout = setTimeout(() => {
            const pointsTarget = findPointsIndicator();
            if (!pointsTarget) {
                onComplete?.();
                return;
            }

            const animationItems: AnimationItem[] = [];

            wonLocations.forEach(({ index: locationIndex }, i) => {
                const locationPos = findLocationPosition(locationIndex);
                if (locationPos) {
                    animationItems.push({
                        id: i,
                        locationIndex,
                        startX: locationPos.x,
                        startY: locationPos.y,
                        endX: pointsTarget.x,
                        endY: pointsTarget.y,
                    });
                }
            });

            if (animationItems.length > 0) {
                setAnimations(animationItems);
                completedCountRef.current = 0;
                setIsActive(true);
            } else {
                onComplete?.();
            }
        }, 100);

        return () => clearTimeout(timeout);
    }, [locationWinners, playerId, findPointsIndicator, findLocationPosition, onComplete]);

    // Handle animation completion
    const handleAnimationComplete = useCallback(() => {
        completedCountRef.current += 1;
        if (completedCountRef.current >= animations.length) {
            // All animations complete
            setIsActive(false);
            setAnimations([]);
            onComplete?.();
        }
    }, [animations.length, onComplete]);

    if (!isActive || animations.length === 0) {
        return null;
    }

    return (
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 pointer-events-none z-[2000]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
            >
                {animations.map((anim) => (
                    <div key={anim.id}>
                        <FlyingPoint
                            startX={anim.startX}
                            startY={anim.startY}
                            endX={anim.endX}
                            endY={anim.endY}
                            delay={anim.id * 0.3}
                            onLanded={onPointLanded}
                            onFinished={handleAnimationComplete}
                        />
                        <PointImpact
                            x={anim.endX}
                            y={anim.endY}
                            delay={anim.id * 0.3}
                        />
                    </div>
                ))}
            </motion.div>
        </AnimatePresence>
    );
}
