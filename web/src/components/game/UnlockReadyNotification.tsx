/**
 * Flashy notification component that appears when player can afford to unlock a new card.
 * Designed to boost dopamine with particles, glow effects, and smooth animations.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { getCardDef } from '@engine/cards';
import type { CardId } from '@engine/types';

interface UnlockReadyNotificationProps {
  /** The card that can be unlocked */
  cardId: CardId | null;
  /** Whether to show the notification */
  show: boolean;
  /** Callback when notification is dismissed */
  onDismiss?: () => void;
  /** Whether to show as a compact inline version */
  compact?: boolean;
}

// Particle component for the sparkle effect
function Particle({ delay, x, y }: { delay: number; x: number; y: number }) {
  return (
    <motion.div
      className="absolute w-2 h-2 bg-yellow-400 rounded-full"
      initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
      animate={{
        opacity: [0, 1, 1, 0],
        scale: [0, 1.5, 1, 0],
        x: [0, x * 0.5, x],
        y: [0, y * 0.5, y],
      }}
      transition={{
        duration: 1.5,
        delay,
        ease: 'easeOut',
      }}
    />
  );
}

// Generate random particles
function generateParticles(count: number) {
  const particles = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const distance = 60 + Math.random() * 40;
    particles.push({
      id: i,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      delay: Math.random() * 0.3,
    });
  }
  return particles;
}

export function UnlockReadyNotification({
  cardId,
  show,
  onDismiss,
  compact = false,
}: UnlockReadyNotificationProps) {
  const [particles] = useState(() => generateParticles(12));
  const cardDef = cardId ? getCardDef(cardId) : null;
  const imagePath = cardDef ? `${import.meta.env.BASE_URL}cards/${cardDef.id}.png` : '';

  if (!cardDef) return null;

  if (compact) {
    // Compact inline version for headers/sidebars
    return (
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -10 }}
            className="relative"
          >
            <Link
              to="/collection"
              className="flex items-center gap-2 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 
                         border border-yellow-500/50 rounded-lg px-3 py-2 hover:border-yellow-400
                         transition-all group"
            >
              {/* Pulsing glow */}
              <motion.div
                className="absolute inset-0 bg-yellow-500/20 rounded-lg blur-md"
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              
              {/* Content */}
              <motion.span
                className="text-xl relative z-10"
                animate={{ rotate: [0, -10, 10, 0] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
              >
                🎁
              </motion.span>
              <span className="text-sm font-medium text-yellow-300 relative z-10">
                New card ready!
              </span>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // Full notification modal
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center z-[100] p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onDismiss}
          />

          {/* Main content */}
          <motion.div
            className="relative flex flex-col items-center"
            initial={{ scale: 0.5, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: -30 }}
            transition={{ type: 'spring', damping: 15, stiffness: 300 }}
          >
            {/* Particles */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {particles.map((p) => (
                <Particle key={p.id} delay={p.delay} x={p.x} y={p.y} />
              ))}
            </div>

            {/* Glow ring */}
            <motion.div
              className="absolute w-48 h-48 rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(251,191,36,0.4) 0%, transparent 70%)',
              }}
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.5, 0.8, 0.5],
              }}
              transition={{ duration: 2, repeat: Infinity }}
            />

            {/* Card image with glow */}
            <motion.div
              className="relative mb-6"
              initial={{ rotateY: 180 }}
              animate={{ rotateY: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              {/* Card glow */}
              <motion.div
                className="absolute inset-0 bg-yellow-400 rounded-xl blur-xl"
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              
              {/* Card */}
              <img
                src={imagePath}
                alt={cardDef.name}
                className="w-32 h-48 rounded-xl object-cover relative z-10 shadow-2xl
                           ring-2 ring-yellow-400/50"
              />

              {/* Shine effect */}
              <motion.div
                className="absolute inset-0 rounded-xl overflow-hidden z-20"
                initial={{ x: '-100%' }}
                animate={{ x: '200%' }}
                transition={{ duration: 1, delay: 0.5, repeat: Infinity, repeatDelay: 3 }}
              >
                <div
                  className="w-1/2 h-full"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                  }}
                />
              </motion.div>
            </motion.div>

            {/* Text */}
            <motion.div
              className="text-center relative z-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <motion.h2
                className="text-3xl font-display text-yellow-400 mb-2"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
              >
                New Card Ready!
              </motion.h2>
              <p className="text-xl text-white mb-1">{cardDef.name}</p>
              <p className="text-gray-400 text-sm mb-6">
                You have enough credits to unlock this card!
              </p>

              {/* Action buttons */}
              <div className="flex gap-3 justify-center">
                <Link
                  to="/collection"
                  className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-amber-500 
                             text-black font-display rounded-lg shadow-lg shadow-yellow-500/30
                             hover:shadow-yellow-500/50 hover:scale-105 transition-all"
                >
                  Unlock Now!
                </Link>
                <button
                  onClick={onDismiss}
                  className="px-6 py-3 bg-white/10 text-white font-display rounded-lg
                             hover:bg-white/20 transition-all border border-white/20"
                >
                  Later
                </button>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
