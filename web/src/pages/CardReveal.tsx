/**
 * Card Reveal Screen - Shows the unlock path tree and the next card to unlock.
 * Displayed when player earns enough credits to unlock a new card.
 */

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { usePlayerStore } from '@store/playerStore';
import { generateUnlockPath } from '@engine/progression';
import { getDefaultStarterDeck } from '@engine/starterDeck';
import { getCardDef } from '@engine/cards';
import type { CardId } from '@engine/types';

// Particle component for sparkle effects
function Particle({ delay, x, y }: { delay: number; x: number; y: number }) {
  return (
    <motion.div
      className="absolute w-1.5 h-1.5 bg-yellow-400 rounded-full"
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
        repeat: Infinity,
        repeatDelay: 2,
      }}
    />
  );
}

// Generate random particles
function generateParticles(count: number) {
  const particles = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const distance = 40 + Math.random() * 30;
    particles.push({
      id: i,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      delay: Math.random() * 0.5,
    });
  }
  return particles;
}

// Reveal state for cards: full (all info), partial (image + name), hidden (image 40% + ?)
type RevealState = 'full' | 'partial' | 'hidden';

// Card node in the unlock path
function PathCard({
  cardId,
  index,
  revealState,
  isStarter,
  onClick,
}: {
  cardId: CardId;
  index: number;
  revealState: RevealState;
  isStarter: boolean;
  onClick?: () => void;
}) {
  const cardDef = getCardDef(cardId);
  const imagePath = cardDef ? `${import.meta.env.BASE_URL}cards/${cardDef.id}.png` : '';
  const isCurrent = revealState === 'full';
  const isHidden = revealState === 'hidden';

  return (
    <motion.div
      className="relative flex flex-col items-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
    >
      {/* Connection line to next card */}
      {!isStarter && (
        <div 
          className={`absolute -top-6 left-1/2 w-0.5 h-6 -translate-x-1/2 ${
            revealState === 'full' ? 'bg-yellow-500' : 
            revealState === 'partial' ? 'bg-purple-500' : 'bg-purple-900/50'
          }`} 
        />
      )}

      {/* Card */}
      <motion.div
        className={`relative cursor-pointer transition-all ${
          isCurrent ? 'scale-110 z-10' : ''
        }`}
        onClick={onClick}
        whileHover={{ scale: isCurrent ? 1.15 : 1.05 }}
      >
        {/* Glow for current card */}
        {isCurrent && (
          <motion.div
            className="absolute inset-0 bg-yellow-400 rounded-lg blur-xl"
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}

        {/* Subtle glow for partial reveal */}
        {revealState === 'partial' && (
          <motion.div
            className="absolute inset-0 bg-purple-500 rounded-lg blur-lg"
            animate={{ opacity: [0.15, 0.3, 0.15] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}

        {/* Mysterious glow for hidden cards */}
        {isHidden && (
          <motion.div
            className="absolute inset-0 bg-purple-600 rounded-lg blur-lg"
            animate={{ opacity: [0.1, 0.2, 0.1] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
        )}

        {/* Card image */}
        <div
          className={`relative w-16 h-24 rounded-lg overflow-hidden border-2 ${
            revealState === 'full'
              ? 'border-yellow-400 ring-2 ring-yellow-400/50'
              : revealState === 'partial'
                ? 'border-purple-500/70'
                : 'border-purple-700/50'
          }`}
        >
          {/* Always show card image, but with varying opacity */}
          <img
            src={imagePath}
            alt={cardDef?.name || cardId}
            className={`w-full h-full object-cover ${
              isHidden ? 'opacity-40' : ''
            }`}
          />
          
          {/* Mystery overlay with ? for hidden cards */}
          {isHidden && (
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.span 
                className="text-3xl text-purple-300 font-display drop-shadow-lg"
                animate={{ opacity: [0.7, 1, 0.7], scale: [0.95, 1.05, 0.95] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{ textShadow: '0 0 10px rgba(147,51,234,0.8)' }}
              >
                ?
              </motion.span>
            </div>
          )}

          {/* Checkmark for unlocked (full reveal that's already unlocked) */}
          {revealState === 'full' && (
            <div className="absolute top-1 right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
              <span className="text-xs">✓</span>
            </div>
          )}
        </div>

        {/* Position number */}
        <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 text-xs px-1.5 rounded ${
          revealState === 'full' ? 'bg-yellow-400 text-black' : 
          revealState === 'partial' ? 'bg-purple-600 text-white' : 'bg-purple-800/80 text-purple-300'
        }`}>
          {isStarter ? 'S' : index + 1}
        </div>
      </motion.div>
    </motion.div>
  );
}

// Featured card display with full details
function FeaturedCard({ cardId, revealState }: { cardId: CardId; revealState: RevealState }) {
  const cardDef = getCardDef(cardId);
  const [particles] = useState(() => generateParticles(10));
  
  if (!cardDef) return null;

  const imagePath = `${import.meta.env.BASE_URL}cards/${cardDef.id}.png`;

  // Hidden card display - image at 40% with large ?
  if (revealState === 'hidden') {
    return (
      <div className="relative flex flex-col items-center">
        {/* Mysterious purple glow */}
        <motion.div
          className="absolute w-56 h-56 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(147,51,234,0.4) 0%, transparent 70%)',
          }}
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{ duration: 3, repeat: Infinity }}
        />

        {/* Card with faded image + ? overlay */}
        <motion.div
          className="relative mb-4"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            className="absolute inset-0 bg-purple-600 rounded-xl blur-xl"
            animate={{ opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          
          <div className="relative w-40 h-56 rounded-xl overflow-hidden shadow-2xl ring-2 ring-purple-500/50">
            {/* Faded card image */}
            <img
              src={imagePath}
              alt="???"
              className="w-full h-full object-cover opacity-40"
            />
            {/* ? overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.span 
                className="text-7xl text-purple-300 font-display"
                animate={{ 
                  opacity: [0.7, 1, 0.7], 
                  scale: [0.9, 1.1, 0.9],
                }}
                transition={{ duration: 2.5, repeat: Infinity }}
                style={{ textShadow: '0 0 30px rgba(147,51,234,0.8)' }}
              >
                ?
              </motion.span>
            </div>
          </div>
        </motion.div>

        {/* Mysterious text */}
        <motion.div
          className="text-center relative z-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-2xl font-display text-purple-400 mb-1">???</h2>
          <p className="text-purple-400/60 text-sm italic">A mystery awaits...</p>
          
          <div className="mt-4 max-w-xs mx-auto bg-purple-900/30 rounded-lg p-3 border border-purple-700/50">
            <p className="text-sm text-purple-300/70 italic">
              Unlock previous cards to reveal this one
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  // Partial reveal - image + name only (no stats, no ability)
  if (revealState === 'partial') {
    return (
      <div className="relative flex flex-col items-center">
        {/* Purple glow for partial */}
        <motion.div
          className="absolute w-56 h-56 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(147,51,234,0.3) 0%, transparent 70%)',
          }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 2.5, repeat: Infinity }}
        />

        {/* Card image */}
        <motion.div
          className="relative mb-4"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            className="absolute inset-0 bg-purple-500 rounded-xl blur-xl"
            animate={{ opacity: [0.2, 0.35, 0.2] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          
          <img
            src={imagePath}
            alt={cardDef.name}
            className="w-40 h-56 rounded-xl object-cover relative z-10 shadow-2xl
                       ring-2 ring-purple-500/50"
          />
        </motion.div>

        {/* Card name only */}
        <motion.div
          className="text-center relative z-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-2xl font-display text-purple-300 mb-1">{cardDef.name}</h2>
          <p className="text-purple-400/60 text-sm italic mb-3">Next in your fate...</p>
          
          <div className="max-w-xs mx-auto bg-purple-900/30 rounded-lg p-3 border border-purple-700/50">
            <p className="text-sm text-purple-300/70 italic">
              Unlock the current card to reveal details
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  // Full reveal - all details
  return (
    <div className="relative flex flex-col items-center">
      {/* Particles */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {particles.map((p) => (
          <Particle key={p.id} delay={p.delay} x={p.x} y={p.y} />
        ))}
      </div>

      {/* Glow ring */}
      <motion.div
        className="absolute w-56 h-56 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(251,191,36,0.3) 0%, transparent 70%)',
        }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.4, 0.7, 0.4],
        }}
        transition={{ duration: 2, repeat: Infinity }}
      />

      {/* Card image */}
      <motion.div
        className="relative mb-4"
        initial={{ rotateY: 180, opacity: 0 }}
        animate={{ rotateY: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.3 }}
      >
        <motion.div
          className="absolute inset-0 bg-yellow-400 rounded-xl blur-xl"
          animate={{ opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        
        <img
          src={imagePath}
          alt={cardDef.name}
          className="w-40 h-56 rounded-xl object-cover relative z-10 shadow-2xl
                     ring-2 ring-yellow-400/50"
        />

        {/* Shine effect */}
        <motion.div
          className="absolute inset-0 rounded-xl overflow-hidden z-20"
          initial={{ x: '-100%' }}
          animate={{ x: '200%' }}
          transition={{ duration: 1.2, delay: 0.8, repeat: Infinity, repeatDelay: 4 }}
        >
          <div
            className="w-1/2 h-full"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
            }}
          />
        </motion.div>
      </motion.div>

      {/* Card info */}
      <motion.div
        className="text-center relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <h2 className="text-2xl font-display text-yellow-400 mb-1">{cardDef.name}</h2>
        
        {/* Stats */}
        <div className="flex items-center justify-center gap-4 mb-3">
          <div className="flex items-center gap-1">
            <span className="text-blue-400">⚡</span>
            <span className="text-white">{cardDef.cost}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-red-400">💪</span>
            <span className="text-white">{cardDef.basePower}</span>
          </div>
          {cardDef.ideology && (
            <div className="px-2 py-0.5 bg-purple-500/30 rounded text-purple-300 text-sm">
              {cardDef.ideology}
            </div>
          )}
        </div>

        {/* Ability */}
        {cardDef.text && (
          <div className="max-w-xs mx-auto bg-black/40 rounded-lg p-3 border border-gray-700">
            <p className="text-sm text-gray-300 leading-relaxed">
              {cardDef.abilityType !== 'VANILLA' && (
                <span className="text-yellow-400 font-medium">{cardDef.abilityType}: </span>
              )}
              {cardDef.text}
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}

export function CardReveal() {
  const navigate = useNavigate();
  const pathContainerRef = useRef<HTMLDivElement>(null);
  const currentCardRef = useRef<HTMLDivElement>(null);
  
  const {
    profile,
    isLoading,
    initialize,
    unlockNextCard,
    canAffordUnlock,
    getNextUnlockCost,
    dismissUnlockNotification,
  } = usePlayerStore();

  const [selectedCardId, setSelectedCardId] = useState<CardId | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);

  // Initialize if needed
  useEffect(() => {
    if (!profile && !isLoading) {
      const starterDeck = getDefaultStarterDeck();
      initialize(starterDeck);
    }
  }, [profile, isLoading, initialize]);

  // Generate the unlock path
  const starterDeck = getDefaultStarterDeck();
  const unlockPath = profile
    ? generateUnlockPath({
        seed: 42,
        starterDeckIds: starterDeck,
        chosenIdeology: profile.chosenIdeology,
      })
    : [];

  // Find the next card to unlock
  const unlockedSet = new Set(profile?.unlockedCardIds || []);
  const nextCardIndex = unlockPath.findIndex(id => !unlockedSet.has(id));
  const nextCardId = nextCardIndex >= 0 ? unlockPath[nextCardIndex] : null;

  // Set initial selected card
  useEffect(() => {
    if (nextCardId && !selectedCardId) {
      setSelectedCardId(nextCardId);
    }
  }, [nextCardId, selectedCardId]);

  // Scroll to current card on mount
  useEffect(() => {
    if (currentCardRef.current && pathContainerRef.current) {
      const container = pathContainerRef.current;
      const card = currentCardRef.current;
      const scrollLeft = card.offsetLeft - container.clientWidth / 2 + card.clientWidth / 2;
      container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
    }
  }, [nextCardIndex]);

  const handleUnlock = async () => {
    if (!nextCardId || !canAffordUnlock()) return;
    
    setIsUnlocking(true);
    await unlockNextCard(nextCardId);
    
    // Brief delay to show the unlock, then navigate
    setTimeout(() => {
      navigate('/collection');
    }, 500);
  };

  const handleSkip = () => {
    dismissUnlockNotification();
    navigate(-1); // Go back to previous page
  };

  if (isLoading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-olympus-dark">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  const unlockCost = getNextUnlockCost();
  const canAfford = canAffordUnlock();
  const displayCard = selectedCardId || nextCardId;

  return (
    <div className="min-h-screen bg-olympus-dark flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ← Back
          </button>
          <motion.h1 
            className="text-2xl font-display text-yellow-400"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            Fate Path
          </motion.h1>
        </div>

        {/* Credits display */}
        <div className="flex items-center gap-2 bg-black/40 px-4 py-2 rounded-lg">
          <span className="text-yellow-400">💰</span>
          <span className="font-bold text-olympus-gold">{profile.credits}</span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Fate Path Tree - Scrollable */}
        <div className="lg:w-1/2 p-4 border-b lg:border-b-0 lg:border-r border-gray-800 overflow-hidden">
          <h2 className="text-lg font-display text-gray-300 mb-4">Your Fate Path</h2>
          
          <div 
            ref={pathContainerRef}
            className="overflow-x-auto overflow-y-hidden pb-4"
            style={{ scrollbarWidth: 'thin' }}
          >
            <div className="flex gap-4 px-4 min-w-max">
              {/* Starter deck indicator */}
              <div className="flex flex-col items-center opacity-50">
                <div className="w-12 h-18 rounded-lg bg-gray-800 border border-gray-600 flex items-center justify-center mb-2">
                  <span className="text-xs text-gray-400">Starter</span>
                </div>
              </div>

              {/* Unlock path cards */}
              {unlockPath.map((cardId, index) => {
                const isUnlocked = unlockedSet.has(cardId);
                const isCurrent = index === nextCardIndex;
                const isNextAfterCurrent = index === nextCardIndex + 1;
                
                // Determine reveal state: full (unlocked or current), partial (next after current), hidden (rest)
                let revealState: RevealState = 'hidden';
                if (isUnlocked || isCurrent) {
                  revealState = 'full';
                } else if (isNextAfterCurrent) {
                  revealState = 'partial';
                }
                
                return (
                  <div 
                    key={cardId} 
                    ref={isCurrent ? currentCardRef : undefined}
                  >
                    <PathCard
                      cardId={cardId}
                      index={index}
                      revealState={revealState}
                      isStarter={false}
                      onClick={() => setSelectedCardId(cardId)}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Path progress indicator */}
          <div className="mt-4 flex items-center gap-2 text-sm text-gray-400">
            <span>Progress:</span>
            <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-yellow-500 to-amber-500"
                initial={{ width: 0 }}
                animate={{ width: `${(nextCardIndex / unlockPath.length) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <span>{nextCardIndex} / {unlockPath.length}</span>
          </div>
        </div>

        {/* Featured Card Display */}
        <div className="lg:w-1/2 flex flex-col items-center justify-center p-8">
          <AnimatePresence mode="wait">
            {displayCard && (
              <motion.div
                key={displayCard}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
              >
                <FeaturedCard 
                  cardId={displayCard} 
                  revealState={
                    unlockedSet.has(displayCard) || displayCard === nextCardId
                      ? 'full'
                      : unlockPath.indexOf(displayCard) === nextCardIndex + 1
                        ? 'partial'
                        : 'hidden'
                  }
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action buttons */}
          <motion.div
            className="mt-8 flex flex-col items-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            {/* Cost display */}
            {nextCardId && displayCard === nextCardId && (
              <div className="text-center mb-2">
                <span className="text-gray-400">Cost: </span>
                <span className={canAfford ? 'text-yellow-400' : 'text-red-400'}>
                  {unlockCost} credits
                </span>
              </div>
            )}

            {/* Unlock button */}
            {displayCard === nextCardId && (
              <button
                onClick={handleUnlock}
                disabled={!canAfford || isUnlocking}
                className={`px-8 py-3 font-display rounded-lg shadow-lg transition-all ${
                  canAfford && !isUnlocking
                    ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-black hover:shadow-yellow-500/30 hover:scale-105'
                    : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isUnlocking ? 'Unlocking...' : canAfford ? 'Unlock Now!' : 'Not Enough Credits'}
              </button>
            )}

            {/* Skip button */}
            <button
              onClick={handleSkip}
              className="px-6 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Skip for now
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
