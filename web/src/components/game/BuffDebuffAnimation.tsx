/**
 * BuffDebuffAnimation - Shows visual particle/beam animation when cards buff or debuff others.
 * 
 * This component renders an overlay with particles traveling from source card to target card.
 * Green particles for buffs (+power), red particles for debuffs (-power).
 * 
 * Animation duration: 2 seconds
 */

import type { ReactNode } from 'react';
import { useEffect, useState, useCallback, useMemo } from 'react';
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
    isGodSource?: boolean;  // If true, adds camera shake effect for god cards
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
        sm: '12px',
        md: '20px',
        lg: '30px',
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
                duration: 0.8,
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

// Particle component for self-buff - radiates outward from center
function SelfBuffParticle({
    centerX,
    centerY,
    endOffsetX,
    endOffsetY,
    delay,
    isBuff,
    size = 'md',
}: {
    centerX: number;
    centerY: number;
    endOffsetX: number;
    endOffsetY: number;
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
        sm: '12px',
        md: '20px',
        lg: '30px',
    };

    return (
        <motion.div
            className={`absolute rounded-full ${sizeClasses[size]}`}
            style={{
                left: centerX,
                top: centerY,
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
                x: endOffsetX,
                y: endOffsetY,
                opacity: [0, 1, 1, 0.8, 0],
                scale: [0, 1.8, 1.4, 1, 0],
            }}
            transition={{
                duration: 0.9,
                delay,
                ease: [0.25, 0.1, 0.25, 1],
                opacity: {
                    times: [0, 0.2, 0.5, 0.8, 1],
                },
                scale: {
                    times: [0, 0.2, 0.5, 0.8, 1],
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
                    delay: 0.6,
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
                    delay: 0.7,
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
                animate={{ width: 200, height: 200, opacity: 0 }}
                transition={{ duration: 0.9, delay: 1.3, ease: 'easeOut' }}
            />

            {/* Middle expanding ring */}
            <motion.div
                className="absolute rounded-full border-4"
                style={{
                    left: x,
                    top: y,
                    borderColor: isBuff ? '#4ade80' : '#f87171',
                    transform: 'translate(-50%, -50%)',
                }}
                initial={{ width: 0, height: 0, opacity: 1 }}
                animate={{ width: 150, height: 150, opacity: 0 }}
                transition={{ duration: 0.7, delay: 1.4, ease: 'easeOut' }}
            />

            {/* Inner expanding ring */}
            <motion.div
                className="absolute rounded-full border-2"
                style={{
                    left: x,
                    top: y,
                    borderColor: isBuff ? '#86efac' : '#fca5a5',
                    transform: 'translate(-50%, -50%)',
                }}
                initial={{ width: 0, height: 0, opacity: 1 }}
                animate={{ width: 100, height: 100, opacity: 0 }}
                transition={{ duration: 0.6, delay: 1.5, ease: 'easeOut' }}
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
                animate={{ width: 180, height: 180, opacity: [0, 1, 0.8, 0] }}
                transition={{ duration: 0.8, delay: 1.2, opacity: { times: [0, 0.3, 0.7, 1] } }}
            />

            {/* Flash effect - more dramatic */}
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
                animate={{ width: 120, height: 120, opacity: [0, 1, 0] }}
                transition={{ duration: 0.3, delay: 1.35 }}
            />

            {/* Power change indicator - text-6xl for more impact */}
            <motion.div
                className="absolute font-bold text-6xl font-display"
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
                    delay: 1.3,
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

// Screen shake wrapper - animates its children on impact
function ScreenShake({
    children,
    intensity = 'medium',
}: {
    children: ReactNode;
    intensity?: 'light' | 'medium' | 'heavy';
}) {
    const shakeIntensity = {
        light: { x: 2, y: 1 },
        medium: { x: 4, y: 2 },
        heavy: { x: 6, y: 3 },
    };
    const { x: sx, y: sy } = shakeIntensity[intensity];

    return (
        <motion.div
            className="absolute inset-0"
            style={{ willChange: 'transform' }}
            animate={{
                x: [0, -sx, sx, -sx / 2, sx / 2, 0],
                y: [0, sy, -sy, sy / 2, 0],
            }}
            transition={{
                duration: 0.4,
                delay: 1.1,
                ease: 'easeInOut',
            }}
        >
            {children}
        </motion.div>
    );
}

// God location shake - shakes only the targeted location for dramatic effect
function GodLocationShake({ targetCardId, isBuff }: { targetCardId: number; isBuff: boolean }) {
    useEffect(() => {
        // Find the target card element to determine its location
        const cardElement = document.querySelector(`[data-card-id="${targetCardId}"]`);
        console.log('[GodShake] Looking for card:', targetCardId, 'Found:', cardElement);
        if (!cardElement) return;
        
        // Find the parent location element
        const locationElement = cardElement.closest('[data-location-index]') as HTMLElement;
        console.log('[GodShake] Location element:', locationElement);
        if (!locationElement) return;
        
        const originalTransform = locationElement.style.transform;
        const originalTransition = locationElement.style.transition;
        
        // Delay before shake starts
        const startDelay = setTimeout(() => {
            locationElement.style.transition = 'transform 0.05s ease-in-out';
            
            // Shake sequence - dramatic for god powers
            const shakeSequence = [
                { x: -10, y: 5 },
                { x: 12, y: -6 },
                { x: -8, y: 5 },
                { x: 10, y: -4 },
                { x: -6, y: 3 },
                { x: 5, y: -2 },
                { x: -3, y: 1 },
                { x: 0, y: 0 },
            ];
            
            let i = 0;
            const interval = setInterval(() => {
                if (i < shakeSequence.length) {
                    locationElement.style.transform = `translate(${shakeSequence[i].x}px, ${shakeSequence[i].y}px)`;
                    i++;
                } else {
                    clearInterval(interval);
                    locationElement.style.transform = originalTransform;
                    locationElement.style.transition = originalTransition;
                }
            }, 50);
            
            return () => clearInterval(interval);
        }, 700); // 0.7s delay - when particles hit
        
        return () => {
            clearTimeout(startDelay);
            locationElement.style.transform = originalTransform;
            locationElement.style.transition = originalTransition;
        };
    }, [targetCardId]);

    return null; // No visual element needed, we manipulate the DOM directly
}

// Lightning arc effect - zigzag path from source to target
function LightningArc({
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
    const path = useMemo(() => {
        const segments = 5;
        const zigzagAmount = 20;
        let d = `M ${startX} ${startY}`;
        for (let i = 1; i <= segments; i++) {
            const t = i / segments;
            const x = startX + (endX - startX) * t;
            const y = startY + (endY - startY) * t;
            const offsetX = (Math.random() - 0.5) * zigzagAmount;
            const offsetY = (Math.random() - 0.5) * zigzagAmount;
            d += ` L ${x + offsetX} ${y + offsetY}`;
        }
        return d;
    }, [startX, startY, endX, endY]);

    return (
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
            <defs>
                <filter id="lightning-glow-buff-debuff">
                    <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                    <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>
            <motion.path
                d={path}
                stroke={isBuff ? '#4ade80' : '#ef4444'}
                strokeWidth={4}
                fill="none"
                filter="url(#lightning-glow-buff-debuff)"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{
                    pathLength: 1,
                    opacity: [0, 1, 0.8, 0],
                }}
                transition={{
                    duration: 0.5,
                    delay: 0.6,
                    ease: 'easeOut',
                    opacity: { times: [0, 0.2, 0.7, 1] },
                }}
            />
        </svg>
    );
}

// Background flash centered on target
function BackgroundFlash({ x, y, isBuff }: { x: number; y: number; isBuff: boolean }) {
    return (
        <motion.div
            className="fixed inset-0 pointer-events-none"
            style={{
                background: isBuff
                    ? `radial-gradient(circle at ${x}px ${y}px, rgba(34, 197, 94, 0.25), transparent 50%)`
                    : `radial-gradient(circle at ${x}px ${y}px, rgba(239, 68, 68, 0.25), transparent 50%)`,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.6, 0] }}
            transition={{
                duration: 0.8,
                delay: 1.2,
                times: [0, 0.3, 0.7, 1],
            }}
        />
    );
}

export function BuffDebuffAnimation({ event, onComplete, isGodSource = false }: BuffDebuffAnimationProps) {
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

    const isSelfBuff = event?.sourceCardId === event?.cardInstanceId;
    
    useEffect(() => {
        if (!event) {
            setIsActive(false);
            return;
        }

        // Retry finding positions with delay
        let retryCount = 0;
        const maxRetries = 5;
        const retryDelay = 150; // ms

        const tryFindPositions = () => {
            // For self-buff, we only need to find one position
            if (isSelfBuff) {
                const selfPos = findCardPosition(event.cardInstanceId);
                if (selfPos) {
                    console.log('[BuffDebuff] Self-buff animation:', {
                        cardId: event.cardInstanceId,
                        position: selfPos,
                        isBuff: event.newPower > event.oldPower,
                        isGodSource,
                    });
                    setSourcePos(selfPos);
                    setTargetPos(selfPos);
                    setIsActive(true);

                    // Shorter duration for self-buff (no particle travel needed)
                    setTimeout(() => {
                        setIsActive(false);
                        onComplete();
                    }, 1800);
                } else if (retryCount < maxRetries) {
                    retryCount++;
                    setTimeout(tryFindPositions, retryDelay);
                } else {
                    onComplete();
                }
                return;
            }

            const source = findCardPosition(event.sourceCardId);
            const target = findCardPosition(event.cardInstanceId);

            if (source && target) {
                console.log('[BuffDebuff] Animation setup:', {
                    sourceCardId: event.sourceCardId,
                    targetCardId: event.cardInstanceId,
                    sourcePosition: source,
                    targetPosition: target,
                    direction: 'Particles fly FROM source TO target',
                    isBuff: event.newPower > event.oldPower,
                });
                setSourcePos(source);
                setTargetPos(target);
                setIsActive(true);

                // Complete after 2.7 seconds (visual effects are delayed by 0.5s to let cards scale first)
                setTimeout(() => {
                    setIsActive(false);
                    onComplete();
                }, 2700);
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
    }, [event, findCardPosition, onComplete, isSelfBuff, isGodSource]);

    if (!event || !isActive || !sourcePos || !targetPos) {
        return null;
    }

    const isBuff = event.newPower > event.oldPower;
    const powerChange = event.newPower - event.oldPower;

    // Generate particle positions - more particles, more large sizes, faster stagger
    // Base delay 0.6s so effects start after source (0.4s) and target starts scaling (0.5s)
    const particles = Array.from({ length: 28 }, (_, i) => ({
        id: i,
        delay: 0.6 + i * 0.04,
        size: (i % 2 === 0 ? 'lg' : i % 3 === 0 ? 'md' : 'sm') as 'sm' | 'md' | 'lg',
        offsetX: (Math.random() - 0.5) * 50,
        offsetY: (Math.random() - 0.5) * 50,
    }));

    // Self-buff particles - radiate outward from the card
    const selfBuffParticles = Array.from({ length: 16 }, (_, i) => {
        const angle = (i / 16) * Math.PI * 2; // Distribute around the card
        const distance = 60 + Math.random() * 40;
        return {
            id: i,
            delay: 0.3 + i * 0.03,
            size: (i % 2 === 0 ? 'lg' : 'md') as 'sm' | 'md' | 'lg',
            endX: Math.cos(angle) * distance,
            endY: Math.sin(angle) * distance,
        };
    });

    // For self-buffs, show animation with particles radiating outward
    if (isSelfBuff) {
        return (
            <AnimatePresence>
                {isActive && (
                    <motion.div
                        className="fixed inset-0 pointer-events-none z-[500]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        {/* Location shake effect for god self-buffs */}
                        {isGodSource && <GodLocationShake targetCardId={event.cardInstanceId} isBuff={isBuff} />}
                        <BackgroundFlash x={targetPos.x} y={targetPos.y} isBuff={isBuff} />
                        <ScreenShake intensity={isGodSource ? 'heavy' : 'medium'}>
                            {/* Radiating particles for self-buff */}
                            {selfBuffParticles.map(({ id, delay, size, endX, endY }) => (
                                <SelfBuffParticle
                                    key={id}
                                    centerX={targetPos.x}
                                    centerY={targetPos.y}
                                    endOffsetX={endX}
                                    endOffsetY={endY}
                                    delay={delay}
                                    isBuff={isBuff}
                                    size={size}
                                />
                            ))}
                            <ImpactBurst
                                x={targetPos.x}
                                y={targetPos.y}
                                isBuff={isBuff}
                                powerChange={powerChange}
                            />
                        </ScreenShake>
                    </motion.div>
                )}
            </AnimatePresence>
        );
    }

    return (
        <AnimatePresence>
            {isActive && (
                <motion.div
                    className="fixed inset-0 pointer-events-none z-[500]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    {/* Location shake effect for god cards */}
                    {isGodSource && <GodLocationShake targetCardId={event.cardInstanceId} isBuff={isBuff} />}
                    <BackgroundFlash x={targetPos.x} y={targetPos.y} isBuff={isBuff} />
                    <ScreenShake intensity={isGodSource ? 'heavy' : 'medium'}>
                        <LightningArc
                            startX={sourcePos.x}
                            startY={sourcePos.y}
                            endX={targetPos.x}
                            endY={targetPos.y}
                            isBuff={isBuff}
                        />
                        <BeamTrail
                            startX={sourcePos.x}
                            startY={sourcePos.y}
                            endX={targetPos.x}
                            endY={targetPos.y}
                            isBuff={isBuff}
                        />
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
                        <ImpactBurst
                            x={targetPos.x}
                            y={targetPos.y}
                            isBuff={isBuff}
                            powerChange={powerChange}
                        />
                    </ScreenShake>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
