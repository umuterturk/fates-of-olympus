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
import { getCardImagePath } from '@/utils/assets';
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
  isUnlocked,
  isCurrent,
  onClick,
}: {
  cardId: CardId;
  index: number;
  revealState: RevealState;
  isStarter: boolean;
  isUnlocked: boolean;
  isCurrent: boolean;
  onClick?: () => void;
}) {
  const cardDef = getCardDef(cardId);
  const imagePath = cardDef ? getCardImagePath(cardDef.id) : '';
  const isHidden = revealState === 'hidden';

  return (
    <motion.div
      className="relative flex flex-col items-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
    >
      {/* Card */}
      <motion.div
        className={`relative cursor-pointer transition-all ${
          isCurrent ? 'scale-110 z-10' : ''
        }`}
        onClick={onClick}
        whileHover={{ scale: isCurrent ? 1.15 : 1.05 }}
      >
        {/* Glow for current card (amber/gold pulsing) */}
        {isCurrent && (
          <motion.div
            className="absolute inset-0 bg-amber-400 rounded-lg blur-xl"
            animate={{ opacity: [0.4, 0.7, 0.4] }}
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
            isCurrent
              ? 'border-amber-400 ring-2 ring-amber-400/60'
              : isUnlocked
                ? 'border-green-500 ring-1 ring-green-500/40'
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

          {/* Checkmark for already unlocked cards only (not current) */}
          {isUnlocked && !isCurrent && (
            <div className="absolute top-1 right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
              <span className="text-xs">✓</span>
            </div>
          )}
        </div>

        {/* Position number */}
        <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 text-xs px-1.5 rounded ${
          isCurrent ? 'bg-amber-400 text-black font-bold' : 
          isUnlocked ? 'bg-green-600 text-white' : 
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

  const imagePath = getCardImagePath(cardDef.id);

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
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showCardPopup, setShowCardPopup] = useState(true); // Auto-open on page load
  
  // 3D tilt effect state
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 });
  const cardRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

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

  // Track which card was unlocked to show stamp in popup
  const [unlockedCardId, setUnlockedCardId] = useState<CardId | null>(null);

  // Set initial selected card only once on mount
  const hasInitializedSelection = useRef(false);
  useEffect(() => {
    if (nextCardId && !hasInitializedSelection.current) {
      setSelectedCardId(nextCardId);
      hasInitializedSelection.current = true;
    }
  }, [nextCardId]);

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
    const cardToUnlock = nextCardId;
    await unlockNextCard(cardToUnlock);
    setIsUnlocking(false);
    setIsUnlocked(true);
    setUnlockedCardId(cardToUnlock);
    // Keep showing the unlocked card in popup
    setSelectedCardId(cardToUnlock);
  };

  const handleSkip = () => {
    dismissUnlockNotification();
    navigate(-1); // Go back to previous page
  };

  const handleClosePopup = () => {
    setShowCardPopup(false);
    // Reset unlock state and update to new next card when popup closes
    if (isUnlocked) {
      setIsUnlocked(false);
      setUnlockedCardId(null);
      if (nextCardId) {
        setSelectedCardId(nextCardId);
      }
    }
  };

  // 3D Tilt effect handlers
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const mouseX = e.clientX - centerX;
    const mouseY = e.clientY - centerY;
    
    // Calculate rotation (max 15 degrees)
    const rotateY = (mouseX / (rect.width / 2)) * 15;
    const rotateX = -(mouseY / (rect.height / 2)) * 15;
    
    setTilt({ rotateX, rotateY });
  };

  const handleMouseLeave = () => {
    setTilt({ rotateX: 0, rotateY: 0 });
  };

  const handleTouchStart = () => {
    isDragging.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!cardRef.current || !isDragging.current) return;
    const touch = e.touches[0];
    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const touchX = touch.clientX - centerX;
    const touchY = touch.clientY - centerY;
    
    // Calculate rotation (max 20 degrees for touch)
    const rotateY = (touchX / (rect.width / 2)) * 20;
    const rotateX = -(touchY / (rect.height / 2)) * 20;
    
    setTilt({ rotateX, rotateY });
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
    setTilt({ rotateX: 0, rotateY: 0 });
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
    <div className="min-h-screen bg-olympus-dark flex flex-col items-center pt-2 sm:pt-8 p-2 sm:p-4">
      {/* Centered container - matches game column width */}
      <div className="w-full max-w-[800px] bg-black/40 rounded-xl shadow-lg shadow-black/50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-2 sm:p-4 border-b border-gray-800">
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

          {/* Ichor display */}
          <div className="flex items-center gap-2 bg-black/40 px-4 py-2 rounded-lg">
            <span className="text-purple-400">✨</span>
            <span className="font-bold text-olympus-gold">{profile.credits}</span>
          </div>
        </div>

        {/* Fate Path Tree - Horizontal Scrollable */}
        <div className="p-2 sm:p-4 border-b border-gray-800">
          <h2 className="text-lg font-display text-gray-300 mb-2">Your Fate Path</h2>
          
          {/* Path progress indicator */}
          <div className="mb-2 flex items-center gap-2 text-sm text-gray-400">
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

          <div 
            ref={pathContainerRef}
            className="overflow-x-auto pt-3 pb-5"
            style={{ scrollbarWidth: 'thin' }}
          >
            <div className="flex gap-2 min-w-max">
              {/* Unlock path cards */}
              {unlockPath.map((cardId, index) => {
                const isUnlocked = unlockedSet.has(cardId);
                const isCurrent = index === nextCardIndex;
                const isNextAfterCurrent = index === nextCardIndex + 1;
                
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
                      isUnlocked={isUnlocked}
                      isCurrent={isCurrent}
                      onClick={() => setSelectedCardId(cardId)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Featured Card Display */}
        <div className="flex flex-col items-center justify-center p-2 sm:p-4">
          <AnimatePresence mode="wait">
            {displayCard && (
              <motion.div
                key={displayCard}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
                onClick={() => setShowCardPopup(true)}
                className="cursor-pointer"
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
                <p className="text-center text-gray-500 text-xs mt-2">Tap to enlarge</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action buttons */}
          <motion.div
            className="mt-6 flex flex-col items-center gap-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            {nextCardId && displayCard === nextCardId && (
              <div className="text-center mb-1">
                <span className="text-gray-400">Cost: </span>
                <span className={canAfford ? 'text-purple-400' : 'text-red-400'}>
                  {unlockCost} Ichor
                </span>
              </div>
            )}

            {displayCard === nextCardId && (
              <button
                onClick={() => setShowCardPopup(true)}
                disabled={!canAfford || isUnlocked}
                className={`px-8 py-3 font-display rounded-lg shadow-lg transition-all ${
                  isUnlocked
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                    : canAfford
                      ? 'bg-gradient-to-r from-purple-500 to-violet-500 text-white hover:shadow-purple-500/30 hover:scale-105'
                      : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isUnlocked ? 'Unlocked!' : canAfford ? 'Ready To Unlock' : 'Not Enough Ichor'}
              </button>
            )}

            <button
              onClick={handleSkip}
              className="px-6 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Skip for now
            </button>
          </motion.div>
        </div>
      </div>

      {/* Card Popup - Large interactive view with 3D tilt */}
      <AnimatePresence>
        {showCardPopup && displayCard && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center cursor-pointer p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClosePopup}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/85 backdrop-blur-md" />
            
            {/* Large card display with 3D tilt */}
            <motion.div
              className="relative cursor-default"
              initial={{ scale: 0.7, opacity: 0, rotateY: -30 }}
              animate={{ scale: 1, opacity: 1, rotateY: 0 }}
              exit={{ scale: 0.7, opacity: 0, rotateY: 30 }}
              transition={{ type: 'spring', damping: 20, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()}
              style={{ perspective: '1000px' }}
            >
              {/* Close button */}
              <button
                onClick={handleClosePopup}
                className="absolute -top-3 -right-3 z-20 w-12 h-12 flex items-center justify-center rounded-full bg-gray-800/90 hover:bg-gray-700 text-white transition-all text-2xl shadow-lg border border-gray-600"
              >
                ✕
              </button>

              {/* Card with tilt effect */}
              {(() => {
                const cardDef = getCardDef(displayCard);
                if (!cardDef) return null;
                const imagePath = getCardImagePath(cardDef.id);
                const revealState = unlockedSet.has(displayCard) || displayCard === nextCardId
                  ? 'full'
                  : unlockPath.indexOf(displayCard) === nextCardIndex + 1
                    ? 'partial'
                    : 'hidden';
                
                return (
                  <div className="flex flex-col items-center">
                    {/* 3D Tilt Card Container */}
                    <motion.div
                      ref={cardRef}
                      onMouseMove={handleMouseMove}
                      onMouseLeave={handleMouseLeave}
                      onTouchStart={handleTouchStart}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                      className="relative select-none"
                      style={{
                        transform: `perspective(1000px) rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg)`,
                        transformStyle: 'preserve-3d',
                        transition: tilt.rotateX === 0 && tilt.rotateY === 0 ? 'transform 0.5s ease-out' : 'transform 0.1s ease-out',
                      }}
                    >
                      {/* Glow effect - follows tilt */}
                      <motion.div
                        className={`absolute -inset-4 rounded-3xl blur-3xl ${
                          revealState === 'full' ? 'bg-yellow-400' : 'bg-purple-500'
                        }`}
                        style={{
                          transform: `translateZ(-50px) translateX(${tilt.rotateY * 2}px) translateY(${-tilt.rotateX * 2}px)`,
                        }}
                        animate={{ opacity: [0.3, 0.5, 0.3] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                      
                      {/* Card - responsive size based on viewport */}
                      <div 
                        className={`relative rounded-2xl overflow-hidden shadow-2xl ring-4 
                          w-[280px] h-[420px] 
                          sm:w-[320px] sm:h-[480px] 
                          md:w-[360px] md:h-[540px] 
                          lg:w-[400px] lg:h-[600px]
                          ${revealState === 'full' ? 'ring-yellow-400/60' : 'ring-purple-500/60'}
                        `}
                        style={{
                          transformStyle: 'preserve-3d',
                          boxShadow: `
                            0 25px 50px -12px rgba(0, 0, 0, 0.5),
                            ${tilt.rotateY * 2}px ${tilt.rotateX * 2}px 30px rgba(0, 0, 0, 0.3)
                          `,
                        }}
                      >
                        {/* Card image */}
                        <img
                          src={imagePath}
                          alt={cardDef.name}
                          className={`w-full h-full object-cover pointer-events-none ${
                            revealState === 'hidden' ? 'opacity-40' : ''
                          }`}
                          draggable={false}
                        />
                        
                        {/* Holographic shine effect */}
                        <div 
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            background: `linear-gradient(
                              ${135 + tilt.rotateY * 2}deg, 
                              transparent 40%, 
                              rgba(255, 255, 255, ${0.1 + Math.abs(tilt.rotateX + tilt.rotateY) * 0.01}) 50%, 
                              transparent 60%
                            )`,
                          }}
                        />
                        
                        {/* Hidden state overlay */}
                        {revealState === 'hidden' && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <motion.span 
                              className="text-[120px] sm:text-[140px] md:text-[160px] text-purple-300 font-display"
                              animate={{ opacity: [0.6, 1, 0.6], scale: [0.95, 1.05, 0.95] }}
                              transition={{ duration: 2.5, repeat: Infinity }}
                              style={{ textShadow: '0 0 40px rgba(147,51,234,0.8)' }}
                            >
                              ?
                            </motion.span>
                          </div>
                        )}

                        {/* UNLOCKED stamp overlay */}
                        <AnimatePresence>
                          {isUnlocked && unlockedCardId === displayCard && (
                            <motion.div
                              className="absolute inset-0 flex items-center justify-center pointer-events-none"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                            >
                              <motion.div
                                className="relative flex items-center justify-center"
                                initial={{ scale: 4, opacity: 0, rotate: -15 }}
                                animate={{ scale: 1, opacity: 1, rotate: -12 }}
                                transition={{ 
                                  type: 'spring', 
                                  damping: 12, 
                                  stiffness: 200,
                                  duration: 0.5
                                }}
                              >
                                <div 
                                  className="px-6 py-3 border-4 border-green-400 rounded-lg bg-green-500/20 backdrop-blur-sm"
                                  style={{
                                    boxShadow: '0 0 30px rgba(34, 197, 94, 0.5), inset 0 0 20px rgba(34, 197, 94, 0.2)'
                                  }}
                                >
                                  <span 
                                    className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-green-400 tracking-wider"
                                    style={{
                                      textShadow: '0 0 10px rgba(34, 197, 94, 0.8), 2px 2px 0 rgba(0,0,0,0.3)'
                                    }}
                                  >
                                    UNLOCKED
                                  </span>
                                </div>
                              </motion.div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                    
                    {/* Card info below */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="mt-6 text-center"
                    >
                      <h2 className={`text-3xl md:text-4xl font-display ${
                        revealState === 'full' ? 'text-yellow-400' : 
                        revealState === 'partial' ? 'text-purple-300' : 'text-purple-400'
                      }`}>
                        {revealState === 'hidden' ? '???' : cardDef.name}
                      </h2>
                      
                      {revealState === 'full' && (
                        <>
                          <div className="flex items-center justify-center gap-6 mt-3 text-lg">
                            <span className="text-blue-400">⚡ {cardDef.cost}</span>
                            <span className="text-amber-400">💪 {cardDef.basePower}</span>
                            {cardDef.ideology && (
                              <span className="text-purple-400 text-sm">{cardDef.ideology}</span>
                            )}
                          </div>
                          {cardDef.text && (
                            <p className="mt-4 text-gray-300 text-center max-w-sm mx-auto">
                              {cardDef.text}
                            </p>
                          )}
                        </>
                      )}
                      
                      {revealState === 'partial' && (
                        <p className="mt-2 text-purple-400/60 text-sm italic">Next in your fate...</p>
                      )}
                      
                      {revealState === 'hidden' && (
                        <p className="mt-2 text-purple-400/60 text-sm italic">A mystery awaits...</p>
                      )}

                      {/* Action buttons */}
                      {displayCard === nextCardId && (
                        <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
                          <motion.button
                            onClick={handleUnlock}
                            disabled={!canAfford || isUnlocking || isUnlocked}
                            className={`px-8 py-3 rounded-lg font-bold text-lg transition-all ${
                              isUnlocked
                                ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/30'
                                : canAfford && !isUnlocking
                                  ? 'bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-black shadow-lg shadow-yellow-500/30'
                                  : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                            }`}
                            whileHover={canAfford && !isUnlocking && !isUnlocked ? { scale: 1.05 } : {}}
                            whileTap={canAfford && !isUnlocking && !isUnlocked ? { scale: 0.95 } : {}}
                          >
                            {isUnlocked ? 'Unlocked!' : isUnlocking ? 'Unlocking...' : canAfford ? `Unlock (${unlockCost} Ichor)` : 'Not Enough Ichor'}
                          </motion.button>
                          
                          <button
                            onClick={() => {
                              handleClosePopup();
                              handleSkip();
                            }}
                            className="px-6 py-2 text-gray-400 hover:text-white transition-colors"
                          >
                            Skip for now
                          </button>
                        </div>
                      )}
                    </motion.div>

                    {/* Drag hint for mobile */}
                    <p className="mt-4 text-gray-500 text-xs">
                      <span className="hidden sm:inline">Hover to tilt</span>
                      <span className="sm:hidden">Drag to tilt</span>
                      {' '} • Tap outside to close
                    </p>
                  </div>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
