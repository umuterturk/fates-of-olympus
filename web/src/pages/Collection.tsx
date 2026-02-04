import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { usePlayerStore } from '@store/playerStore';
import { getCardDef, getAllCardDefs } from '@engine/cards';
import { getDefaultStarterDeck } from '@engine/starterDeck';
import { getNextUnlockCard, IDEOLOGY_CHOICE_POSITION } from '@engine/progression';
import type { CardDef } from '@engine/models';
import type { CardId } from '@engine/types';
import type { Ideology } from '@storage/types';

// =============================================================================
// Hooks
// =============================================================================

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

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
}

function MiniCard({ cardDef, selected, locked, inDeck, onClick, size = 'md' }: MiniCardProps) {
  const imagePath = `${import.meta.env.BASE_URL}cards/${cardDef.id}.png`;
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
        locked && 'opacity-30 cursor-not-allowed',
        inDeck && !selected && 'ring-1 ring-green-500/50',
        !locked && !selected && 'hover:scale-105 hover:ring-1 hover:ring-white/30'
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
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
          <span className="text-lg">🔒</span>
        </div>
      )}
    </motion.button>
  );
}

// =============================================================================
// Card Detail Panel
// =============================================================================

interface CardDetailProps {
  cardDef: CardDef | null;
  isUnlocked: boolean;
  isInDeck: boolean;
  onAddToDeck?: () => void;
  onRemoveFromDeck?: () => void;
  canModifyDeck: boolean;
}

function CardDetail({ cardDef, isUnlocked, isInDeck, onAddToDeck, onRemoveFromDeck, canModifyDeck }: CardDetailProps) {
  if (!cardDef) {
    return (
      <div className="bg-black/30 rounded-lg p-4 h-full flex items-center justify-center">
        <p className="text-gray-500">Select a card to view details</p>
      </div>
    );
  }

  const imagePath = `${import.meta.env.BASE_URL}cards/${cardDef.id}.png`;

  return (
    <motion.div 
      className="bg-black/30 rounded-lg p-4 flex flex-col gap-4"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      key={cardDef.id}
    >
      {/* Card Image */}
      <div className="flex justify-center">
        <img
          src={imagePath}
          alt={cardDef.name}
          className="w-32 h-48 rounded-lg object-cover shadow-lg"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>

      {/* Card Info */}
      <div className="text-center">
        <h3 className="text-xl font-display text-olympus-gold">{cardDef.name}</h3>
        <div className="flex justify-center gap-4 mt-2">
          <span className="text-blue-400">⚡ {cardDef.cost}</span>
          <span className="text-amber-400">⚔ {cardDef.basePower}</span>
        </div>
        {cardDef.ideology && (
          <span className="text-xs text-gray-400 mt-1 block">{cardDef.ideology}</span>
        )}
      </div>

      {/* Card Text */}
      {cardDef.text && (
        <p className="text-sm text-gray-300 text-center italic">
          "{cardDef.text}"
        </p>
      )}

      {/* Action Buttons */}
      {isUnlocked && canModifyDeck && (
        <div className="flex justify-center gap-2 mt-auto">
          {isInDeck ? (
            <button
              onClick={onRemoveFromDeck}
              className="px-4 py-2 bg-red-600/50 hover:bg-red-600 text-white rounded-lg transition-colors"
            >
              Remove from Deck
            </button>
          ) : (
            <button
              onClick={onAddToDeck}
              className="px-4 py-2 bg-green-600/50 hover:bg-green-600 text-white rounded-lg transition-colors"
            >
              Add to Deck
            </button>
          )}
        </div>
      )}

      {!isUnlocked && (
        <p className="text-center text-gray-500 text-sm">
          🔒 Unlock this card to add it to your deck
        </p>
      )}
    </motion.div>
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

  const isMobile = useIsMobile();
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
    <div className="min-h-screen flex flex-col p-4">
      {/* Header */}
      <header className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-gray-400 hover:text-white">
            ← Back
          </Link>
          <h1 className="text-2xl font-display text-olympus-gold">Collection</h1>
        </div>

        {/* Credits Display */}
        <div className="flex items-center gap-2 bg-black/30 px-4 py-2 rounded-lg">
          <span className="text-yellow-400 text-xl">💰</span>
          <span className="text-xl font-bold text-olympus-gold">{profile.credits}</span>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="flex gap-4 mb-4 text-sm text-gray-400">
        <span>🃏 {unlockedCards.length} cards unlocked</span>
        <span>📚 {deckCards.length}/24 in deck</span>
        {profile.loginStreak.count > 0 && (
          <span>🔥 {profile.loginStreak.count} day streak</span>
        )}
        {profile.chosenIdeology && (
          <span className="text-olympus-gold">{profile.chosenIdeology}</span>
        )}
      </div>

      {/* Next Card to Unlock */}
      {nextCardDef && (
        <motion.div 
          className="bg-gradient-to-r from-olympus-gold/20 to-transparent rounded-lg p-4 mb-4 flex items-center justify-between"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-4">
            <MiniCard cardDef={nextCardDef} size="sm" locked />
            <div>
              <h3 className="font-display text-olympus-gold">Next Unlock: {nextCardDef.name}</h3>
              <p className="text-sm text-gray-400">Position {profile.unlockPathPosition + 1} • {unlockCost} 💰</p>
            </div>
          </div>
          <Link
            to="/card-reveal"
            className="px-6 py-3 font-display rounded-lg transition-all bg-gradient-to-r from-yellow-500 to-amber-500 text-black hover:from-yellow-400 hover:to-amber-400 flex items-center gap-2"
          >
            <span>✨ Reveal</span>
          </Link>
        </motion.div>
      )}

      {/* Ideology Choice Prompt */}
      {profile.unlockPathPosition >= IDEOLOGY_CHOICE_POSITION && !profile.chosenIdeology && (
        <motion.div 
          className="bg-purple-900/30 border border-purple-500/50 rounded-lg p-4 mb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <p className="text-purple-200">
            You've unlocked enough cards to choose your ideology!
          </p>
          <button
            onClick={() => setShowIdeologyModal(true)}
            className="mt-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
          >
            Choose Your Path
          </button>
        </motion.div>
      )}

      {/* Main Content */}
      <div className={clsx(
        'flex-1 flex gap-4',
        isMobile ? 'flex-col' : 'flex-row'
      )}>
        {/* Tabs for Mobile */}
        {isMobile && (
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => setActiveTab('collection')}
              className={clsx(
                'flex-1 py-2 rounded-lg transition-colors',
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
                'flex-1 py-2 rounded-lg transition-colors',
                activeTab === 'deck'
                  ? 'bg-olympus-gold text-black'
                  : 'bg-black/30 text-gray-400'
              )}
            >
              Deck ({deckCards.length})
            </button>
          </div>
        )}

        {/* Collection Grid */}
        <div className={clsx(
          'bg-black/20 rounded-lg p-4',
          isMobile 
            ? (activeTab === 'collection' ? 'block' : 'hidden')
            : 'flex-1'
        )}>
          <h2 className="text-lg font-display text-gray-300 mb-3">
            {isMobile ? 'Your Cards' : 'Unlocked Cards'}
          </h2>
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2 overflow-y-auto max-h-[400px]">
            {unlockedCards.map(card => (
              <MiniCard
                key={card.id}
                cardDef={card}
                selected={selectedCardId === card.id}
                inDeck={profile.currentDeckIds.includes(card.id)}
                onClick={() => setSelectedCardId(card.id)}
                size={isMobile ? 'sm' : 'md'}
              />
            ))}
          </div>
        </div>

        {/* Deck Panel (Desktop) or Tab Content (Mobile) */}
        <div className={clsx(
          'bg-black/20 rounded-lg p-4',
          isMobile 
            ? (activeTab === 'deck' ? 'block' : 'hidden')
            : 'w-64'
        )}>
          <h2 className="text-lg font-display text-gray-300 mb-3">
            Current Deck ({deckCards.length}/24)
          </h2>
          <div className={clsx(
            'grid gap-2 overflow-y-auto',
            isMobile ? 'grid-cols-4 max-h-[300px]' : 'grid-cols-3 max-h-[400px]'
          )}>
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
          
          {/* Deck Validation */}
          {deckCards.length < 12 && (
            <p className="text-red-400 text-sm mt-2">
              ⚠️ Deck needs at least 12 cards
            </p>
          )}
        </div>

        {/* Card Detail Panel (Desktop only) */}
        {!isMobile && (
          <div className="w-64">
            <CardDetail
              cardDef={selectedCardDef ?? null}
              isUnlocked={selectedCardId ? isCardUnlocked(selectedCardId) : false}
              isInDeck={selectedCardId ? profile.currentDeckIds.includes(selectedCardId) : false}
              onAddToDeck={handleAddToDeck}
              onRemoveFromDeck={handleRemoveFromDeck}
              canModifyDeck={deckCards.length > 12 || !profile.currentDeckIds.includes(selectedCardId ?? '')}
            />
          </div>
        )}
      </div>

      {/* Mobile Card Detail (Bottom Sheet Style) */}
      <AnimatePresence>
        {isMobile && selectedCardDef && (
          <motion.div
            className="fixed bottom-0 left-0 right-0 bg-olympus-navy border-t border-olympus-gold/50 p-4 z-40"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
          >
            <button
              onClick={() => setSelectedCardId(null)}
              className="absolute top-2 right-2 text-gray-400 hover:text-white"
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
                      Remove
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
