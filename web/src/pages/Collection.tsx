import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { usePlayerStore } from '@store/playerStore';
import { getCardDef, getAllCardDefs } from '@engine/cards';
import { getDefaultStarterDeck } from '@engine/starterDeck';
import { getNextUnlockCard, IDEOLOGY_CHOICE_POSITION } from '@engine/progression';
import { getCardImagePath } from '@/utils/assets';
import type { CardDef } from '@engine/models';
import type { CardId } from '@engine/types';
import type { Ideology } from '@storage/types';

// =============================================================================
// Mini Card Component for Collection
// =============================================================================

interface MiniCardProps {
  cardDef: CardDef;
  selected?: boolean;
  locked?: boolean;
  inDeck?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md';
  /** Shiny effect intensity: 'high' for affordable unlock, 'low' for locked unlock preview */
  shiny?: 'high' | 'low';
}

function MiniCard({ cardDef, selected, locked, inDeck, onClick, size = 'md', shiny }: MiniCardProps) {
  const imagePath = getCardImagePath(cardDef.id);
  const [imageError, setImageError] = useState(false);

  const sizeClasses = size === 'sm' 
    ? 'w-16 h-24 text-[8px]' 
    : 'w-20 h-28 text-[10px]';

  return (
    <motion.button
      onClick={onClick}
      disabled={locked}
      className={clsx(
        'relative rounded-md overflow-hidden transition-all',
        sizeClasses,
        selected && 'ring-2 ring-olympus-gold ring-offset-2 ring-offset-olympus-navy',
        locked && 'opacity-70 cursor-not-allowed',
        inDeck && !selected && 'ring-1 ring-green-500/50',
        !locked && !selected && !inDeck && 'ring-1 ring-olympus-gold/70',
        !locked && !selected && 'hover:scale-105 hover:ring-2 hover:ring-olympus-gold'
      )}
      whileHover={!locked ? { scale: 1.05 } : undefined}
      whileTap={!locked ? { scale: 0.98 } : undefined}
    >
      {/* Card Image or Placeholder */}
      {!imageError ? (
        <img
          src={imagePath}
          alt={cardDef.name}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex flex-col items-center justify-center p-1">
          <span className="font-bold text-olympus-gold text-center leading-tight">
            {cardDef.name}
          </span>
        </div>
      )}

      {/* Shiny Effect Overlay */}
      {shiny && (
        <motion.div
          className={clsx(
            'absolute inset-0 pointer-events-none',
            shiny === 'high' 
              ? 'bg-gradient-to-br from-white/40 via-transparent to-olympus-gold/30'
              : 'bg-gradient-to-br from-white/15 via-transparent to-olympus-gold/10'
          )}
          animate={{
            opacity: shiny === 'high' ? [0.6, 1, 0.6] : [0.4, 0.7, 0.4],
          }}
          transition={{
            duration: shiny === 'high' ? 1.5 : 2.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}

      {/* Cost Badge */}
      <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-blue-900 rounded-full flex items-center justify-center border border-blue-400">
        <span className="text-[8px] font-bold text-blue-200">{cardDef.cost}</span>
      </div>

      {/* Power Badge */}
      <div className="absolute bottom-0.5 right-0.5 w-4 h-4 bg-amber-900 rounded-full flex items-center justify-center border border-amber-400">
        <span className="text-[8px] font-bold text-amber-200">{cardDef.basePower}</span>
      </div>

      {/* In Deck Indicator */}
      {inDeck && (
        <div className="absolute top-0.5 right-0.5 w-3 h-3 bg-green-500 rounded-full flex items-center justify-center">
          <span className="text-[6px] text-white font-bold">✓</span>
        </div>
      )}

      {/* Locked Overlay */}
      {locked && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <span className="text-lg">🔒</span>
        </div>
      )}
    </motion.button>
  );
}

// =============================================================================
// Ideology Choice Modal
// =============================================================================

interface IdeologyChoiceModalProps {
  isOpen: boolean;
  onChoose: (ideology: Ideology) => void;
}

const IDEOLOGY_INFO: Record<Ideology, { name: string; description: string; color: string }> = {
  NOMOS: {
    name: 'Nomos (Law of Order)',
    description: 'Focus on structure, buffs, and formation bonuses. Control the board with precision.',
    color: 'from-blue-600 to-blue-800',
  },
  KATABASIS: {
    name: 'Katabasis (Path of Descent)',
    description: 'Sacrifice for power. Destroy your cards to gain overwhelming strength.',
    color: 'from-purple-600 to-purple-800',
  },
  KINESIS: {
    name: 'Kinesis (Way of Motion)',
    description: 'Movement is key. Relocate cards and gain bonuses from mobility.',
    color: 'from-teal-600 to-teal-800',
  },
};

function IdeologyChoiceModal({ isOpen, onChoose }: IdeologyChoiceModalProps) {
  if (!isOpen) return null;

  return (
    <motion.div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        className="bg-olympus-navy rounded-xl border-2 border-olympus-gold p-6 max-w-2xl w-full"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >
        <h2 className="text-2xl font-display text-olympus-gold text-center mb-4">
          Choose Your Path
        </h2>
        <p className="text-gray-300 text-center mb-6">
          Select an ideology to shape your card collection. 70% of future unlocks will be from your chosen path.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(Object.entries(IDEOLOGY_INFO) as [Ideology, typeof IDEOLOGY_INFO[Ideology]][]).map(([ideology, info]) => (
            <motion.button
              key={ideology}
              onClick={() => onChoose(ideology)}
              className={clsx(
                'p-4 rounded-lg bg-gradient-to-br text-white text-left transition-transform',
                info.color,
                'hover:scale-105 hover:shadow-lg'
              )}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
            >
              <h3 className="font-display text-lg mb-2">{info.name}</h3>
              <p className="text-sm opacity-90">{info.description}</p>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

// =============================================================================
// Main Collection Page
// =============================================================================

export function Collection() {
  const {
    profile,
    isLoading,
    initialize,
    addCardToDeck,
    removeCardFromDeck,
    chooseIdeology,
    needsIdeologyChoice,
    isCardUnlocked,
    getNextUnlockCost,
  } = usePlayerStore();

  const [selectedCardId, setSelectedCardId] = useState<CardId | null>(null);
  const [showIdeologyModal, setShowIdeologyModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'collection' | 'deck'>('collection');

  // Initialize player store on mount
  useEffect(() => {
    const starterDeck = getDefaultStarterDeck();
    initialize(starterDeck);
  }, [initialize]);

  // Show ideology modal when needed
  useEffect(() => {
    if (profile && needsIdeologyChoice()) {
      setShowIdeologyModal(true);
    }
  }, [profile, needsIdeologyChoice]);

  const allCards = getAllCardDefs();
  const selectedCardDef = selectedCardId ? getCardDef(selectedCardId) : null;

  // Get next card to unlock
  const starterDeck = getDefaultStarterDeck();
  const nextCardId = profile 
    ? getNextUnlockCard(
        profile.unlockPathPosition,
        starterDeck,
        profile.unlockedCardIds,
        profile.chosenIdeology,
        42
      )
    : null;
  const nextCardDef = nextCardId ? getCardDef(nextCardId) : null;
  const unlockCost = getNextUnlockCost();

  const handleIdeologyChoice = async (ideology: Ideology) => {
    await chooseIdeology(ideology);
    setShowIdeologyModal(false);
  };

  const handleAddToDeck = async () => {
    if (!selectedCardId) return;
    await addCardToDeck(selectedCardId);
  };

  const handleRemoveFromDeck = async () => {
    if (!selectedCardId) return;
    await removeCardFromDeck(selectedCardId);
  };

  if (isLoading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          className="text-2xl text-olympus-gold"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          Loading collection...
        </motion.div>
      </div>
    );
  }

  const unlockedCards = allCards.filter(c => isCardUnlocked(c.id));
  const deckCards = profile.currentDeckIds.map(id => getCardDef(id)).filter(Boolean) as CardDef[];

  return (
    <div className="min-h-screen flex flex-col items-center pt-2 sm:pt-8 p-2 sm:p-4">
      {/* Centered container - matches game column width */}
      <div className="w-full max-w-[800px] bg-black/40 rounded-xl shadow-lg shadow-black/50 flex flex-col">
        {/* Header */}
        <header className="flex justify-between items-center p-2 sm:p-4 border-b border-gray-800">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-gray-400 hover:text-white">
              ← Back
            </Link>
            <h1 className="text-2xl font-display text-olympus-gold">Collection</h1>
          </div>

          {/* Ichor Display */}
          <div className="flex items-center gap-2 bg-black/30 px-4 py-2 rounded-lg">
            <span className="text-purple-400 text-xl">✨</span>
            <span className="text-xl font-bold text-olympus-gold">{profile.credits}</span>
          </div>
        </header>

        {/* Stats Bar */}
        <div className="flex flex-wrap gap-3 px-2 sm:px-4 py-2 text-sm text-gray-400 border-b border-gray-800/50">
          <span>🃏 {unlockedCards.length} cards</span>
          <span>📚 {deckCards.length}/24 deck</span>
          {profile.loginStreak.count > 0 && (
            <span>🔥 {profile.loginStreak.count} streak</span>
          )}
          {profile.chosenIdeology && (
            <span className="text-olympus-gold">{profile.chosenIdeology}</span>
          )}
        </div>

        {/* Next Card to Unlock */}
        {nextCardDef && (() => {
          const canAfford = profile.credits >= unlockCost;
          return (
            <Link to="/card-reveal" className="block mx-2 sm:mx-4 mt-2 sm:mt-3">
              <motion.div 
                className={clsx(
                  'relative overflow-hidden bg-gradient-to-r from-olympus-gold/20 to-transparent p-2 sm:p-3 rounded-lg flex items-center justify-between cursor-pointer',
                  'hover:from-olympus-gold/30 transition-colors'
                )}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                {/* Shimmer animation on whole region when affordable */}
                {canAfford && (
                  <motion.span
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none"
                    animate={{
                      x: ['-100%', '200%'],
                    }}
                    transition={{
                      duration: 2.0,
                      repeat: Infinity,
                      repeatDelay: 0.5,
                      ease: 'easeInOut',
                    }}
                  />
                )}
                
                <div className="flex items-center gap-3 relative z-10">
                  <MiniCard 
                    cardDef={nextCardDef} 
                    size="sm" 
                    locked={!canAfford}
                    shiny={canAfford ? 'high' : 'low'}
                  />
                  <div>
                    <h3 className="font-display text-olympus-gold text-sm">Next: {nextCardDef.name}</h3>
                    <p className={clsx(
                      'text-xs',
                      canAfford ? 'text-green-400' : 'text-gray-400'
                    )}>
                      {unlockCost} ✨ {!canAfford && `(need ${unlockCost - profile.credits} more)`}
                    </p>
                  </div>
                </div>
                
                <div
                  className={clsx(
                    'px-4 py-2 font-display text-sm rounded-lg transition-all relative z-10',
                    canAfford 
                      ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-black'
                      : 'bg-gray-700/80 text-gray-300'
                  )}
                >
                  {canAfford ? 'Reveal' : 'Inspect'}
                </div>
              </motion.div>
            </Link>
          );
        })()}

        {/* Ideology Choice Prompt */}
        {profile.unlockPathPosition >= IDEOLOGY_CHOICE_POSITION && !profile.chosenIdeology && (
          <motion.div 
            className="bg-purple-900/30 border border-purple-500/50 rounded-lg p-2 sm:p-3 mx-2 sm:mx-4 mt-2 sm:mt-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p className="text-purple-200 text-sm">
              Choose your ideology to shape your collection!
            </p>
            <button
              onClick={() => setShowIdeologyModal(true)}
              className="mt-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg transition-colors"
            >
              Choose Path
            </button>
          </motion.div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 px-2 sm:px-4 pt-2 sm:pt-3">
          <button
            onClick={() => setActiveTab('collection')}
            className={clsx(
              'flex-1 py-2 rounded-lg transition-colors text-sm',
              activeTab === 'collection'
                ? 'bg-olympus-gold text-black'
                : 'bg-black/30 text-gray-400'
            )}
          >
            Collection ({unlockedCards.length})
          </button>
          <button
            onClick={() => setActiveTab('deck')}
            className={clsx(
              'flex-1 py-2 rounded-lg transition-colors text-sm',
              activeTab === 'deck'
                ? 'bg-olympus-gold text-black'
                : 'bg-black/30 text-gray-400'
            )}
          >
            Deck ({deckCards.length}/24)
          </button>
        </div>

        {/* Main Content */}
        <div className="p-2 sm:p-4">
          {/* Collection Grid */}
          {activeTab === 'collection' && (() => {
            // Sort cards: most recently unlocked first, then by deck status
            const sortedCards = [...unlockedCards].sort((a, b) => {
              const aIndex = profile.unlockedCardIds.indexOf(a.id);
              const bIndex = profile.unlockedCardIds.indexOf(b.id);
              // Most recently unlocked (higher index) comes first
              return bIndex - aIndex;
            });
            
            return (
              <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {sortedCards.map(card => (
                  <MiniCard
                    key={card.id}
                    cardDef={card}
                    selected={selectedCardId === card.id}
                    inDeck={profile.currentDeckIds.includes(card.id)}
                    onClick={() => setSelectedCardId(card.id)}
                    size="sm"
                  />
                ))}
              </div>
            );
          })()}

          {/* Deck Grid */}
          {activeTab === 'deck' && (
            <div>
              <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {deckCards.map(card => (
                  <MiniCard
                    key={card.id}
                    cardDef={card}
                    selected={selectedCardId === card.id}
                    onClick={() => setSelectedCardId(card.id)}
                    size="sm"
                  />
                ))}
              </div>
              {deckCards.length < 12 && (
                <p className="text-red-400 text-sm mt-3">
                  ⚠️ Deck needs at least 12 cards
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Card Detail (Bottom Sheet Style) */}
      <AnimatePresence>
        {selectedCardDef && (
          <motion.div
            className="fixed bottom-0 left-0 right-0 bg-olympus-navy border-t border-olympus-gold/50 p-2 sm:p-4 z-40"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
          >
            <div className="max-w-[800px] mx-auto">
              <button
                onClick={() => setSelectedCardId(null)}
                className="absolute top-2 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-700 hover:bg-gray-600 text-white transition-all"
              >
                ✕
              </button>
              <div className="flex gap-4">
                <MiniCard cardDef={selectedCardDef} size="md" />
                <div className="flex-1">
                  <h3 className="font-display text-olympus-gold">{selectedCardDef.name}</h3>
                  <div className="flex gap-2 text-sm mt-1">
                    <span className="text-blue-400">⚡{selectedCardDef.cost}</span>
                    <span className="text-amber-400">⚔{selectedCardDef.basePower}</span>
                  </div>
                  {selectedCardDef.text && (
                    <p className="text-xs text-gray-400 mt-1 italic">{selectedCardDef.text}</p>
                  )}
                  <div className="flex gap-2 mt-2">
                    {profile.currentDeckIds.includes(selectedCardDef.id) ? (
                      <button
                        onClick={handleRemoveFromDeck}
                        disabled={deckCards.length <= 12}
                        className="px-3 py-1 bg-red-600/50 hover:bg-red-600 text-white text-sm rounded disabled:opacity-50"
                      >
                        Remove from Deck
                      </button>
                    ) : (
                      <button
                        onClick={handleAddToDeck}
                        disabled={deckCards.length >= 24}
                        className="px-3 py-1 bg-green-600/50 hover:bg-green-600 text-white text-sm rounded disabled:opacity-50"
                      >
                        Add to Deck
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ideology Choice Modal */}
      <IdeologyChoiceModal
        isOpen={showIdeologyModal}
        onChoose={handleIdeologyChoice}
      />
    </div>
  );
}
