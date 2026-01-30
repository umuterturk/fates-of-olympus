/**
 * BuffDebuffAnimation - Shows visual particle/beam animation when cards buff or debuff others.
 * 
 * This component renders an overlay with particles traveling from source card to target card.
 * Green particles for buffs (+power), red particles for debuffs (-power).
 * 
 * Animation duration: 2 seconds
 */

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PowerChangedEvent } from '@engine/events';

interface CardPosition {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface BuffDebuffAnimationProps {
    event: PowerChangedEvent | null;
    onComplete: () => void;
}

// Particle component that travels from source to target
function Particle({
    startX,
    startY,
    endX,
    endY,
    delay,
    isBuff,
    size = 'md',
}: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    delay: number;
    isBuff: boolean;
    size?: 'sm' | 'md' | 'lg';
}) {
    const sizeClasses = {
        sm: 'w-3 h-3',
        md: 'w-5 h-5',
        lg: 'w-7 h-7',
    };

    const glowSize = {
        sm: '8px',
        md: '14px',
        lg: '20px',
    };

    return (
        <motion.div
            className={`absolute rounded-full ${sizeClasses[size]}`}
            style={{
                left: startX,
                top: startY,
                background: isBuff
                    ? 'radial-gradient(circle, #86efac 0%, #4ade80 30%, #22c55e 60%, #16a34a 100%)'
                    : 'radial-gradient(circle, #fca5a5 0%, #f87171 30%, #ef4444 60%, #dc2626 100%)',
                boxShadow: isBuff
                    ? `0 0 ${glowSize[size]} ${glowSize[size]} rgba(74, 222, 128, 0.8), 0 0 30px 15px rgba(34, 197, 94, 0.5), 0 0 50px 25px rgba(22, 163, 74, 0.3)`
                    : `0 0 ${glowSize[size]} ${glowSize[size]} rgba(248, 113, 113, 0.8), 0 0 30px 15px rgba(239, 68, 68, 0.5), 0 0 50px 25px rgba(220, 38, 38, 0.3)`,
            }}
            initial={{
                x: 0,
                y: 0,
                opacity: 0,
                scale: 0,
            }}
            animate={{
                x: endX - startX,
                y: endY - startY,
                opacity: [0, 1, 1, 1, 0],
                scale: [0, 1.5, 1.2, 1, 0.3],
            }}
            transition={{
                duration: 1.2,
                delay,
                ease: [0.25, 0.1, 0.25, 1],
                opacity: {
                    times: [0, 0.15, 0.5, 0.85, 1],
                },
                scale: {
                    times: [0, 0.15, 0.5, 0.85, 1],
                },
            }}
        />
    );
}

// Trail/beam effect from source to target
function BeamTrail({
    startX,
    startY,
    endX,
    endY,
    isBuff,
}: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    isBuff: boolean;
}) {
    const angle = Math.atan2(endY - startY, endX - startX) * (180 / Math.PI);
    const distance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));

    return (
        <>
            {/* Main beam - thicker and more visible */}
            <motion.div
                className="absolute h-2 origin-left rounded-full"
                style={{
                    left: startX,
                    top: startY - 2,
                    transform: `rotate(${angle}deg)`,
                    background: isBuff
                        ? 'linear-gradient(90deg, rgba(74, 222, 128, 0.9), rgba(34, 197, 94, 0.7), rgba(22, 163, 74, 0.4), transparent)'
                        : 'linear-gradient(90deg, rgba(248, 113, 113, 0.9), rgba(239, 68, 68, 0.7), rgba(220, 38, 38, 0.4), transparent)',
                    boxShadow: isBuff
                        ? '0 0 20px 6px rgba(34, 197, 94, 0.6), 0 0 40px 12px rgba(22, 163, 74, 0.3)'
                        : '0 0 20px 6px rgba(239, 68, 68, 0.6), 0 0 40px 12px rgba(220, 38, 38, 0.3)',
                }}
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: distance, opacity: [0, 1, 1, 0.8, 0] }}
                transition={{
                    duration: 1.4,
                    ease: 'easeOut',
                    opacity: {
                        times: [0, 0.1, 0.5, 0.8, 1],
                    },
                }}
            />
            {/* Secondary glow beam */}
            <motion.div
                className="absolute h-4 origin-left rounded-full"
                style={{
                    left: startX,
                    top: startY - 6,
                    transform: `rotate(${angle}deg)`,
                    background: isBuff
                        ? 'linear-gradient(90deg, rgba(134, 239, 172, 0.4), rgba(74, 222, 128, 0.2), transparent)'
                        : 'linear-gradient(90deg, rgba(252, 165, 165, 0.4), rgba(248, 113, 113, 0.2), transparent)',
                }}
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: distance * 0.9, opacity: [0, 0.8, 0.6, 0] }}
                transition={{
                    duration: 1.2,
                    delay: 0.1,
                    ease: 'easeOut',
                    opacity: {
                        times: [0, 0.2, 0.7, 1],
                    },
                }}
            />
        </>
    );
}

// Impact burst effect on the target card
function ImpactBurst({
    x,
    y,
    isBuff,
    powerChange,
}: {
    x: number;
    y: number;
    isBuff: boolean;
    powerChange: number;
}) {
    return (
        <>
            {/* Outer expanding ring */}
            <motion.div
                className="absolute rounded-full border-4"
                style={{
                    left: x,
                    top: y,
                    borderColor: isBuff ? '#22c55e' : '#ef4444',
                    transform: 'translate(-50%, -50%)',
                    boxShadow: isBuff
                        ? '0 0 20px 4px rgba(34, 197, 94, 0.6)'
                        : '0 0 20px 4px rgba(239, 68, 68, 0.6)',
                }}
                initial={{ width: 0, height: 0, opacity: 1 }}
                animate={{ width: 140, height: 140, opacity: 0 }}
                transition={{ duration: 0.9, delay: 0.8, ease: 'easeOut' }}
            />

            {/* Inner expanding ring */}
            <motion.div
                className="absolute rounded-full border-2"
                style={{
                    left: x,
                    top: y,
                    borderColor: isBuff ? '#4ade80' : '#f87171',
                    transform: 'translate(-50%, -50%)',
                }}
                initial={{ width: 0, height: 0, opacity: 1 }}
                animate={{ width: 100, height: 100, opacity: 0 }}
                transition={{ duration: 0.7, delay: 0.9, ease: 'easeOut' }}
            />

            {/* Inner glow - larger and more intense */}
            <motion.div
                className="absolute rounded-full"
                style={{
                    left: x,
                    top: y,
                    transform: 'translate(-50%, -50%)',
                    background: isBuff
                        ? 'radial-gradient(circle, rgba(134, 239, 172, 0.8), rgba(74, 222, 128, 0.5), transparent 70%)'
                        : 'radial-gradient(circle, rgba(252, 165, 165, 0.8), rgba(248, 113, 113, 0.5), transparent 70%)',
                }}
                initial={{ width: 0, height: 0, opacity: 0 }}
                animate={{ width: 120, height: 120, opacity: [0, 1, 0.8, 0] }}
                transition={{ duration: 0.8, delay: 0.7, opacity: { times: [0, 0.3, 0.7, 1] } }}
            />

            {/* Flash effect */}
            <motion.div
                className="absolute rounded-full"
                style={{
                    left: x,
                    top: y,
                    transform: 'translate(-50%, -50%)',
                    background: isBuff
                        ? 'radial-gradient(circle, rgba(255, 255, 255, 0.9), rgba(134, 239, 172, 0.6), transparent 60%)'
                        : 'radial-gradient(circle, rgba(255, 255, 255, 0.9), rgba(252, 165, 165, 0.6), transparent 60%)',
                }}
                initial={{ width: 0, height: 0, opacity: 0 }}
                animate={{ width: 80, height: 80, opacity: [0, 1, 0] }}
                transition={{ duration: 0.3, delay: 0.85 }}
            />

            {/* Power change indicator - bigger and longer lasting */}
            <motion.div
                className="absolute font-bold text-4xl font-display"
                style={{
                    left: x,
                    top: y,
                    color: isBuff ? '#4ade80' : '#f87171',
                    textShadow: isBuff
                        ? '0 0 15px rgba(74, 222, 128, 1), 0 0 30px rgba(34, 197, 94, 0.8), 0 0 45px rgba(22, 163, 74, 0.5), 2px 2px 4px rgba(0, 0, 0, 0.5)'
                        : '0 0 15px rgba(248, 113, 113, 1), 0 0 30px rgba(239, 68, 68, 0.8), 0 0 45px rgba(220, 38, 38, 0.5), 2px 2px 4px rgba(0, 0, 0, 0.5)',
                }}
                initial={{ x: '-50%', y: '-50%', opacity: 0, scale: 0.3 }}
                animate={{
                    x: '-50%',
                    y: ['-50%', '-120%', '-180%'],
                    opacity: [0, 1, 1, 1, 0],
                    scale: [0.3, 1.5, 1.3, 1.1, 0.8],
                }}
                transition={{
                    duration: 1.2,
                    delay: 0.8,
                    opacity: { times: [0, 0.15, 0.4, 0.8, 1] },
                    scale: { times: [0, 0.15, 0.4, 0.8, 1] },
                    y: { times: [0, 0.3, 1] },
                }}
            >
                {isBuff ? `+${powerChange}` : powerChange}
            </motion.div>
        </>
    );
}

export function BuffDebuffAnimation({ event, onComplete }: BuffDebuffAnimationProps) {
    const [sourcePos, setSourcePos] = useState<CardPosition | null>(null);
    const [targetPos, setTargetPos] = useState<CardPosition | null>(null);
    const [isActive, setIsActive] = useState(false);

    // Find card positions by their instance ID (with retry)
    const findCardPosition = useCallback((instanceId: number): CardPosition | null => {
        // Cards have data-card-id attribute
        const cardElement = document.querySelector(`[data-card-id="${instanceId}"]`);
        if (cardElement) {
            const rect = cardElement.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                return {
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2,
                    width: rect.width,
                    height: rect.height,
                };
            }
        }
        return null;
    }, []);

    useEffect(() => {
        if (!event) {
            setIsActive(false);
            return;
        }

        // Skip if source and target are the same card (self-buff)
        if (event.sourceCardId === event.cardInstanceId) {
            onComplete();
            return;
        }

        // Retry finding positions with delay
        let retryCount = 0;
        const maxRetries = 5;
        const retryDelay = 150; // ms

        const tryFindPositions = () => {
            const source = findCardPosition(event.sourceCardId);
            const target = findCardPosition(event.cardInstanceId);

            if (source && target) {
                console.log('[BuffDebuff] Found cards:', { source, target, event });
                setSourcePos(source);
                setTargetPos(target);
                setIsActive(true);

                // Complete after 2.2 seconds (longer for more dramatic effect)
                setTimeout(() => {
                    setIsActive(false);
                    onComplete();
                }, 2200);
            } else if (retryCount < maxRetries) {
                retryCount++;
                console.log(`[BuffDebuff] Retrying... (${retryCount}/${maxRetries})`);
                setTimeout(tryFindPositions, retryDelay);
            } else {
                console.log('[BuffDebuff] Could not find cards, skipping animation');
                // If we can't find the cards, complete immediately
                onComplete();
            }
        };

        // Initial delay to let DOM update after card reveal
        const timeout = setTimeout(tryFindPositions, 200);

        return () => clearTimeout(timeout);
    }, [event, findCardPosition, onComplete]);

    if (!event || !isActive || !sourcePos || !targetPos) {
        return null;
    }

    const isBuff = event.newPower > event.oldPower;
    const powerChange = event.newPower - event.oldPower;

    // Generate particle positions with more randomness and staggered delays
    const particles = Array.from({ length: 12 }, (_, i) => ({
        id: i,
        delay: i * 0.08,
        size: (['sm', 'md', 'lg'] as const)[i % 3],
        offsetX: (Math.random() - 0.5) * 30,
        offsetY: (Math.random() - 0.5) * 30,
    }));

    return (
        <AnimatePresence>
            {isActive && (
                <motion.div
                    className="fixed inset-0 pointer-events-none z-[500]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    {/* Beam trail */}
                    <BeamTrail
                        startX={sourcePos.x}
                        startY={sourcePos.y}
                        endX={targetPos.x}
                        endY={targetPos.y}
                        isBuff={isBuff}
                    />

                    {/* Particles */}
                    {particles.map(({ id, delay, size, offsetX, offsetY }) => (
                        <Particle
                            key={id}
                            startX={sourcePos.x + offsetX}
                            startY={sourcePos.y + offsetY}
                            endX={targetPos.x + offsetX * 0.5}
                            endY={targetPos.y + offsetY * 0.5}
                            delay={delay}
                            isBuff={isBuff}
                            size={size}
                        />
                    ))}

                    {/* Impact burst */}
                    <ImpactBurst
                        x={targetPos.x}
                        y={targetPos.y}
                        isBuff={isBuff}
                        powerChange={powerChange}
                    />
                </motion.div>
            )}
        </AnimatePresence>
    );
}
