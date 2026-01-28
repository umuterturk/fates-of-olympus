import { useState, useEffect } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { Board } from '@components/game/Board';
import { Hand } from '@components/game/Hand';
import { EnergyDisplay } from '@components/game/EnergyDisplay';
import { useGameStore } from '@store/gameStore';
import type { LocationIndex } from '@engine/types';

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

export function Game() {
  const {
    gameState,
    playerActions,
    isAnimating,
    isNpcThinking,
    initGame,
    playCard,
    moveCard,
    endTurn,
  } = useGameStore();

  const isMobile = useIsMobile();

  // Selected card can be from hand or a pending card on board
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  // Track if selected card is from board (pending) vs hand
  const [isSelectedFromBoard, setIsSelectedFromBoard] = useState(false);

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
    if (selectedCard === null || isAnimating || isNpcThinking) return;

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
    if (selectedCard !== null && isSelectedFromBoard && !isAnimating && !isNpcThinking) {
      moveCard(selectedCard, null); // null = return to hand
      setSelectedCard(null);
      setIsSelectedFromBoard(false);
    }
  };

  const handleEndTurn = () => {
    if (!isAnimating && !isNpcThinking) {
      endTurn();
      setSelectedCard(null);
      setIsSelectedFromBoard(false);
    }
  };

  const cardsPlayedThisTurn = playerActions.length;
  const pendingCardIds = new Set(playerActions.map(a => a.cardInstanceId));

  const isDisabled = isAnimating || isNpcThinking;

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
            Turn {gameState.turn}/6
          </div>
        </div>
        <EnergyDisplay
          current={gameState.players[0].energy}
          max={gameState.turn}
        />
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

      {/* Game Board and Hand wrapped in LayoutGroup for shared card animations */}
      <LayoutGroup>
        {/* Game Board - takes remaining space */}
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
            <button
              onClick={() => handleCardSelect(null)}
              disabled={selectedCard === null || isDisabled}
              className={clsx(
                "bg-gray-700/80 rounded-lg hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all border border-gray-600",
                isMobile ? "px-3 py-1.5 text-xs" : "px-5 py-2"
              )}
            >
              Cancel
            </button>

            {/* Available Energy Display - Gold sphere */}
            <div className={clsx(
              "flex items-center justify-center rounded-full",
              "bg-gradient-to-br from-yellow-300 via-olympus-gold to-yellow-600",
              "shadow-lg shadow-olympus-gold/50",
              "border-2 border-yellow-300/50",
              isMobile ? "w-10 h-10" : "w-14 h-14"
            )}>
              <span className={clsx(
                "text-black font-bold font-display drop-shadow flex items-center gap-0.5",
                isMobile ? "text-base" : "text-xl"
              )}>
                <span className="text-yellow-800">⚡</span>
                {gameState.players[0].energy}
              </span>
            </div>

            <button
              onClick={handleEndTurn}
              disabled={isDisabled}
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
      </LayoutGroup>

      {/* Game over overlay - z-index 1000 to be above tooltips */}
      <AnimatePresence>
        {gameState.result !== 'IN_PROGRESS' && (
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
                  onClick={() => initGame()}
                  className={clsx(
                    "bg-olympus-gold text-black font-display rounded-lg hover:bg-yellow-400 transition-colors",
                    isMobile ? "px-4 py-2 text-sm" : "px-8 py-3"
                  )}
                >
                  Play Again
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
    </div>
  );
}
