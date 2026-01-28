import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { Board } from '@components/game/Board';
import { Hand } from '@components/game/Hand';
import { BuffDebuffAnimation } from '@components/game/BuffDebuffAnimation';
import { LocationWinAnimation } from '@components/game/LocationWinAnimation';
import { useGameStore } from '@store/gameStore';
import type { LocationIndex } from '@engine/types';
import type { PowerChangedEvent } from '@engine/events';

// Hook to detect mobile
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

interface RetreatButtonProps {
  onRetreat: () => void;
  disabled: boolean;
  isMobile: boolean;
}

function RetreatButton({ onRetreat, disabled, isMobile }: RetreatButtonProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (isConfirming) {
      const timer = setTimeout(() => setIsConfirming(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isConfirming]);

  return (
    <button
      onClick={() => {
        if (isConfirming) {
          onRetreat();
          setIsConfirming(false);
        } else {
          setIsConfirming(true);
        }
      }}
      disabled={disabled}
      className={clsx(
        "relative overflow-hidden rounded-lg transition-all duration-300 border focus:outline-none",
        isConfirming
          ? "bg-red-600 text-white border-red-400 px-6 py-2 scale-105 shadow-lg shadow-red-900/50"
          : "bg-red-900/30 text-red-100/70 hover:bg-red-800/50 hover:text-red-100 border-red-900/50 px-5 py-2",
        isMobile ? "text-xs" : "text-sm"
      )}
    >
      <motion.div
        initial={false}
        animate={{ y: isConfirming ? -20 : 0, opacity: isConfirming ? 0 : 1 }}
        className="flex flex-col items-center"
      >
        Retreat
      </motion.div>
      {isConfirming && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="absolute inset-0 flex items-center justify-center font-bold"
        >
          Confirm?
        </motion.div>
      )}
    </button>
  );
}

export function Game() {
  const {
    gameState,
    playerActions,
    powerChangedEvents,
    currentAnimationIndex,
    isAnimating,
    isNpcThinking,
    locationWinners,
    initGame,
    playCard,
    moveCard,
    endTurn,
    nextAnimation,
    clearLocationWinners,
    addEnergy,
    retreat,
  } = useGameStore();

  const isMobile = useIsMobile();

  // Selected card can be from hand or a pending card on board
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  // Track if selected card is from board (pending) vs hand
  const [isSelectedFromBoard, setIsSelectedFromBoard] = useState(false);
  // Track if game end screen is visible
  const [isEndScreenVisible, setIsEndScreenVisible] = useState(true);

  useEffect(() => {
    initGame();
  }, [initGame]);

  if (!gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          className="text-2xl text-olympus-gold"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          Loading...
        </motion.div>
      </div>
    );
  }

  const handleCardSelect = (cardId: number | null, fromBoard: boolean = false) => {
    if (cardId === selectedCard) {
      // Deselect if clicking same card
      setSelectedCard(null);
      setIsSelectedFromBoard(false);
    } else {
      setSelectedCard(cardId);
      setIsSelectedFromBoard(fromBoard);
    }
  };

  const handleLocationClick = (locationIndex: number) => {
    if (selectedCard === null || isAnimating || isNpcThinking || isGameOver) return;

    if (isSelectedFromBoard) {
      // Moving a pending card to a new location
      moveCard(selectedCard, locationIndex as LocationIndex);
    } else {
      // Playing a card from hand
      playCard(selectedCard, locationIndex as LocationIndex);
    }
    setSelectedCard(null);
    setIsSelectedFromBoard(false);
  };

  const handleHandClick = () => {
    if (selectedCard !== null && isSelectedFromBoard && !isAnimating && !isNpcThinking && !isGameOver) {
      moveCard(selectedCard, null); // null = return to hand
      setSelectedCard(null);
      setIsSelectedFromBoard(false);
    }
  };

  const handleEndTurn = () => {
    if (!isAnimating && !isNpcThinking && !isGameOver) {
      endTurn();
      setSelectedCard(null);
      setIsSelectedFromBoard(false);
    }
  };

  const cardsPlayedThisTurn = playerActions.length;
  const pendingCardIds = new Set(playerActions.map(a => a.cardInstanceId));

  const isDisabled = isAnimating || isNpcThinking;
  const isGameOver = gameState.result !== 'IN_PROGRESS';

  return (
    <div className={clsx(
      "h-full flex flex-col max-w-6xl mx-auto",
      isMobile ? "p-2" : "p-4"
    )}>
      {/* Header */}
      <header className={clsx(
        "flex justify-between items-center",
        isMobile ? "mb-1" : "mb-4"
      )}>
        <div className={clsx(
          "flex items-center",
          isMobile ? "gap-2" : "gap-4"
        )}>
          <Link to="/" className={clsx(
            "text-gray-400 hover:text-white",
            isMobile && "text-xs"
          )}>
            ←
          </Link>
          <div className={clsx(
            "font-display text-olympus-gold",
            isMobile ? "text-sm" : "text-xl"
          )}>
            {gameState.result === 'IN_PROGRESS' ? `Turn ${gameState.turn}/6` : 'Game Ended'}
          </div>
        </div>

        {gameState.result !== 'IN_PROGRESS' && !isEndScreenVisible && (
          <button
            onClick={() => setIsEndScreenVisible(true)}
            className={clsx(
              "bg-olympus-gold text-black font-display rounded-lg hover:bg-yellow-400 transition-colors",
              isMobile ? "px-3 py-1 text-xs" : "px-4 py-2 text-sm"
            )}
          >
            Show Results
          </button>
        )}
      </header>

      {/* Opponent area (NPC) - compact on mobile */}
      <motion.div
        className={clsx(
          "flex justify-between items-center bg-black/30 rounded-lg",
          isMobile ? "mb-1 px-2 py-1" : "mb-4 px-4 py-2"
        )}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div>
          <div className={clsx(
            "text-gray-300",
            isMobile ? "text-[10px]" : "text-sm"
          )}>
            {isMobile ? 'NPC' : 'Opponent (NPC)'}
          </div>
          <div className={clsx(
            "text-gray-500",
            isMobile ? "text-[8px]" : "text-xs"
          )}>
            {gameState.players[1].hand.length} cards • ⚡{gameState.players[1].energy}
          </div>
        </div>

        <AnimatePresence>
          {isNpcThinking && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className={clsx(
                "flex items-center gap-1 text-olympus-gold",
                isMobile && "text-xs"
              )}
            >
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                ⚡
              </motion.span>
              {!isMobile && 'Thinking...'}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Game Board and Hand - Board takes remaining space */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Game Board */}
        <div className={clsx(
          "flex items-center justify-center flex-1",
          isMobile ? "min-h-[360px]" : "min-h-[500px]"
        )}>
          <Board
            locations={gameState.locations}
            onLocationClick={handleLocationClick}
            onCardClick={(cardId) => handleCardSelect(cardId, true)}
            selectedCard={selectedCard}
            pendingCardIds={pendingCardIds}
            disabled={isDisabled}
          />
        </div>

        {/* Instructions - hidden on mobile to save space */}
        {!isMobile && (
          <div className="text-center text-sm text-gray-400 my-2">
            {selectedCard !== null
              ? isSelectedFromBoard
                ? 'Click a location to move your card, or click your hand to return it'
                : 'Click a location to play your card'
              : cardsPlayedThisTurn > 0
                ? 'Click a played card to move it, or select another card from hand'
                : 'Select a card from your hand, then click a location to play it'}
          </div>
        )}

        {/* Player Hand - fixed height area */}
        <div className={clsx(
          isMobile ? "h-[120px]" : "h-[180px]",
          "flex flex-col shrink-0"
        )}>
          <Hand
            cards={gameState.players[0].hand}
            energy={gameState.players[0].energy}
            selectedCard={isSelectedFromBoard ? null : selectedCard}
            onSelectCard={(cardId) => handleCardSelect(cardId, false)}
            onHandClick={handleHandClick}
            isDropTarget={isSelectedFromBoard && selectedCard !== null}
            disabled={isDisabled}
          />

          {/* Action buttons */}
          <div className={clsx(
            "flex justify-center items-center shrink-0",
            isMobile ? "gap-3 mt-1" : "gap-4 mt-4"
          )}>
            <RetreatButton
              onRetreat={retreat}
              disabled={isDisabled || isGameOver}
              isMobile={isMobile}
            />

            <div
              data-points-indicator
              data-power-indicator
              className={clsx(
                "flex items-center justify-center font-bold",
                "text-amber-100",
                isMobile ? "w-12 h-10 text-base" : "w-16 h-14 text-2xl"
              )}
              style={{
                background: 'linear-gradient(145deg, #4a3219 0%, #3a2815 25%, #2c1e0f 50%, #1a1209 75%, #0d0904 100%)',
                clipPath: 'polygon(20% 0%, 80% 0%, 100% 50%, 80% 100%, 20% 100%, 0% 50%)',
                filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.5))',
                boxShadow: 'inset 1px 1px 2px rgba(255, 255, 255, 0.1), inset -1px -1px 2px rgba(0, 0, 0, 0.5)',
              }}
            >
              <div className="flex items-center -ml-1">
                <span className="text-[0.9em] brightness-125 mr-0.5">⚡</span>
                <span>{gameState.players[0].energy}</span>
              </div>
            </div>

            <button
              onClick={handleEndTurn}
              disabled={isDisabled || isGameOver}
              className={clsx(
                "relative rounded-lg font-display font-semibold transition-all overflow-hidden",
                "bg-gradient-to-r from-olympus-gold via-yellow-500 to-olympus-bronze",
                "text-black shadow-lg shadow-olympus-gold/30",
                "hover:shadow-olympus-gold/50 hover:scale-105",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-none",
                isMobile ? "px-4 py-1.5 text-xs" : "px-6 py-2"
              )}
            >
              <span className="relative z-10">End Turn</span>
            </button>
          </div>
        </div>
      </div>

      {/* Buff/Debuff Animation Overlay */}
      <BuffDebuffAnimation
        event={
          powerChangedEvents.length > 0 && currentAnimationIndex < powerChangedEvents.length
            ? (powerChangedEvents[currentAnimationIndex] as PowerChangedEvent)
            : null
        }
        onComplete={nextAnimation}
      />

      {/* Game over overlay - z-index 1000 to be above tooltips */}
      <AnimatePresence>
        {gameState.result !== 'IN_PROGRESS' && isEndScreenVisible && (
          <motion.div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1000] p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className={clsx(
                "text-center bg-olympus-navy rounded-xl border-2 border-olympus-gold",
                isMobile ? "p-4" : "p-8"
              )}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <h2 className={clsx(
                "font-display text-olympus-gold",
                isMobile ? "text-2xl mb-2" : "text-5xl mb-4"
              )}>
                {gameState.result === 'PLAYER_0_WINS' ? '⚡ Victory! ⚡' :
                  gameState.result === 'PLAYER_1_WINS' ? '💀 Defeat' : '⚖️ Draw'}
              </h2>

              <p className={clsx(
                "text-gray-300",
                isMobile ? "text-sm mb-4" : "mb-6"
              )}>
                {gameState.result === 'PLAYER_0_WINS'
                  ? 'The gods smile upon you!'
                  : gameState.result === 'PLAYER_1_WINS'
                    ? 'The Fates were not in your favor...'
                    : 'An honorable stalemate!'}
              </p>

              <div className={clsx(
                "flex justify-center",
                isMobile ? "gap-2" : "gap-4"
              )}>
                <button
                  onClick={() => {
                    initGame();
                    setIsEndScreenVisible(true);
                  }}
                  className={clsx(
                    "bg-olympus-gold text-black font-display rounded-lg hover:bg-yellow-400 transition-colors",
                    isMobile ? "px-4 py-2 text-sm" : "px-8 py-3"
                  )}
                >
                  Play Again
                </button>
                <button
                  onClick={() => setIsEndScreenVisible(false)}
                  className={clsx(
                    "bg-white/10 text-white font-display rounded-lg hover:bg-white/20 transition-colors border border-white/20",
                    isMobile ? "px-4 py-2 text-sm" : "px-8 py-3"
                  )}
                >
                  View Board
                </button>
                <Link
                  to="/"
                  className={clsx(
                    "bg-gray-700 text-white font-display rounded-lg hover:bg-gray-600 transition-colors",
                    isMobile ? "px-4 py-2 text-sm" : "px-8 py-3"
                  )}
                >
                  Menu
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Location Win Animation - +1 flying to points indicator */}
      <LocationWinAnimation
        locationWinners={locationWinners}
        playerId={0}
        onComplete={clearLocationWinners}
        onPointLanded={() => addEnergy(0, 1)}
      />
    </div>
  );
}
