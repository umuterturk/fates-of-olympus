import { useState, useEffect } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Board } from '@components/game/Board';
import { Hand } from '@components/game/Hand';
import { EnergyDisplay } from '@components/game/EnergyDisplay';
import { useGameStore } from '@store/gameStore';
import type { LocationIndex } from '@engine/types';

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
    <div className="min-h-screen flex flex-col p-4 max-w-6xl mx-auto">
      {/* Header */}
      <header className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-gray-400 hover:text-white">
            ← Back
          </Link>
          <div className="text-xl font-display text-olympus-gold">
            Turn {gameState.turn} / 6
          </div>
        </div>
        <EnergyDisplay 
          current={gameState.players[0].energy} 
          max={gameState.turn} 
        />
      </header>

      {/* Opponent area (NPC) */}
      <motion.div 
        className="mb-4 flex justify-between items-center px-4 py-2 bg-black/30 rounded-lg"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div>
          <div className="text-sm text-gray-300">Opponent (NPC)</div>
          <div className="text-xs text-gray-500">
            {gameState.players[1].hand.length} cards in hand • Energy: {gameState.players[1].energy}
          </div>
        </div>
        
        <AnimatePresence>
          {isNpcThinking && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-2 text-olympus-gold"
            >
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                ⚡
              </motion.span>
              Thinking...
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Game Board and Hand wrapped in LayoutGroup for shared card animations */}
      <LayoutGroup>
        {/* Game Board */}
        <div className="flex-1 flex flex-col">
          <Board 
            locations={gameState.locations}
            onLocationClick={handleLocationClick}
            onCardClick={(cardId) => handleCardSelect(cardId, true)}
            selectedCard={selectedCard}
            pendingCardIds={pendingCardIds}
            disabled={isDisabled}
          />
        </div>

        {/* Instructions */}
        <div className="text-center text-sm text-gray-400 my-2">
          {selectedCard !== null 
            ? isSelectedFromBoard
              ? 'Click a location to move your card, or click your hand to return it'
              : 'Click a location to play your card' 
            : cardsPlayedThisTurn > 0
              ? 'Click a played card to move it, or select another card from hand'
              : 'Select a card from your hand, then click a location to play it'}
        </div>

        {/* Player Hand */}
        <div className="mt-auto pt-4">
          <div className="flex justify-between items-center mb-2 px-4">
            <span className="text-sm text-gray-400">Your Hand</span>
            <span className="text-sm text-gray-500">
              {gameState.players[0].hand.length} cards
            </span>
          </div>
          
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
          <div className="flex justify-center gap-4 mt-4">
            <button
              onClick={() => handleCardSelect(null)}
              disabled={selectedCard === null || isDisabled}
              className="px-6 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 
                         disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleEndTurn}
              disabled={isDisabled}
              className="px-6 py-2 bg-olympus-bronze rounded-lg hover:bg-yellow-700 
                         disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Reveal Cards {cardsPlayedThisTurn > 0 && `(${cardsPlayedThisTurn} cards)`}
            </button>
          </div>
        </div>
      </LayoutGroup>

      {/* Game over overlay - z-index 1000 to be above tooltips */}
      <AnimatePresence>
        {gameState.result !== 'IN_PROGRESS' && (
          <motion.div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1000]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className="text-center bg-olympus-navy p-8 rounded-xl border-2 border-olympus-gold"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <h2 className="text-5xl font-display text-olympus-gold mb-4">
                {gameState.result === 'PLAYER_0_WINS' ? '⚡ Victory! ⚡' : 
                 gameState.result === 'PLAYER_1_WINS' ? '💀 Defeat' : '⚖️ Draw'}
              </h2>
              
              <p className="text-gray-300 mb-6">
                {gameState.result === 'PLAYER_0_WINS' 
                  ? 'The gods smile upon you!' 
                  : gameState.result === 'PLAYER_1_WINS'
                  ? 'The Fates were not in your favor...'
                  : 'An honorable stalemate!'}
              </p>
              
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => initGame()}
                  className="px-8 py-3 bg-olympus-gold text-black font-display rounded-lg
                           hover:bg-yellow-400 transition-colors"
                >
                  Play Again
                </button>
                <Link
                  to="/"
                  className="px-8 py-3 bg-gray-700 text-white font-display rounded-lg
                           hover:bg-gray-600 transition-colors"
                >
                  Main Menu
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
