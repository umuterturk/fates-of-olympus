import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayerStore } from '@store/playerStore';
import { useTutorialStore } from '@tutorial/tutorialStore';
import { getDefaultStarterDeck } from '@engine/starterDeck';

export function Home() {
  const navigate = useNavigate();
  const { 
    profile, 
    isLoading, 
    initialize, 
    processDailyLogin,
    shouldShowUnlockNotification,
  } = usePlayerStore();
  const [dailyReward, setDailyReward] = useState<{
    creditsEarned: number;
    newStreak: number;
    wasReset: boolean;
  } | null>(null);
  const [showRewardPopup, setShowRewardPopup] = useState(false);

  // Initialize player store on mount
  useEffect(() => {
    const starterDeck = getDefaultStarterDeck();
    initialize(starterDeck);
  }, [initialize]);

  // Process daily login after profile loads
  useEffect(() => {
    const handleDailyLogin = async () => {
      if (profile && !dailyReward) {
        const result = await processDailyLogin();
        if (result.creditsEarned > 0) {
          setDailyReward(result);
          setShowRewardPopup(true);
          // Auto-hide after 4 seconds
          setTimeout(() => setShowRewardPopup(false), 4000);
          
          // After daily reward popup, navigate to card reveal if can afford
          setTimeout(() => {
            if (shouldShowUnlockNotification()) {
              navigate('/card-reveal');
            }
          }, 4500);
        }
      }
    };
    handleDailyLogin();
  }, [profile, dailyReward, processDailyLogin, shouldShowUnlockNotification, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 relative">
      {/* Player Stats Bar (top right) */}
      {profile && !isLoading && (
        <motion.div
          className="absolute top-4 right-4 flex items-center gap-4"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {/* Compact Unlock Ready Link - Ancient Greek Chest */}
          {shouldShowUnlockNotification() && (
            <Link
              to="/card-reveal"
              className="relative group"
            >
              {/* Outer glow */}
              <motion.div
                className="absolute -inset-3 bg-gradient-to-r from-yellow-500/50 via-amber-400/50 to-yellow-500/50 rounded-full blur-xl"
                animate={{ opacity: [0.4, 0.8, 0.4], scale: [0.9, 1.1, 0.9] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              
              {/* Chest Container */}
              <motion.div
                className="relative w-14 h-14 cursor-pointer"
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.95 }}
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                <img 
                  src={`${import.meta.env.BASE_URL}icons/chest.png`}
                  alt="" 
                  className="w-full h-full object-contain drop-shadow-[0_0_8px_rgba(255,200,50,0.6)]"
                />
                
                {/* Sparkle particles */}
                <motion.div
                  className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full"
                  animate={{ opacity: [0, 1, 0], scale: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
                />
                <motion.div
                  className="absolute top-0 left-0 w-1.5 h-1.5 bg-amber-300 rounded-full"
                  animate={{ opacity: [0, 1, 0], scale: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
                />
                <motion.div
                  className="absolute -top-2 left-1/2 w-1 h-1 bg-yellow-200 rounded-full"
                  animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5], y: [0, -6, 0] }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
                />
              </motion.div>
            </Link>
          )}

          {/* Streak */}
          {profile.loginStreak.count > 0 && (
            <div className="flex items-center gap-1 text-orange-400">
              <span>🔥</span>
              <span className="font-bold">{profile.loginStreak.count}</span>
            </div>
          )}
          
          {/* Ichor */}
          <div className="flex items-center gap-2 bg-black/40 px-4 py-2 rounded-lg">
            <span className="text-purple-400">✨</span>
            <span className="font-bold text-olympus-gold">{profile.credits}</span>
          </div>
        </motion.div>
      )}

      <motion.h1
        className="text-6xl font-display text-olympus-gold mb-8"
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        Fates of Olympus
      </motion.h1>

      <motion.p
        className="text-xl text-gray-300 mb-12 text-center max-w-xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        A strategic card game set in Greek mythology.
        Command gods, heroes, and mythical creatures across three battlefields.
      </motion.p>

      <motion.div
        className="flex flex-col gap-4"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        {profile && !profile.tutorialCompleted && (
          <button
            onClick={() => {
              useTutorialStore.getState().startTutorial();
              navigate('/game?tutorial=true');
            }}
            className="px-8 py-4 bg-gradient-to-r from-amber-500 to-olympus-bronze text-black font-display text-xl rounded-lg
                       hover:from-amber-400 hover:to-yellow-700 transition-colors duration-200
                       flex items-center justify-center gap-2 border-2 border-olympus-gold/50"
          >
            Start Tutorial
          </button>
        )}
        <Link
          to="/game"
          className="px-8 py-4 bg-olympus-gold text-black font-display text-xl rounded-lg
                     hover:bg-yellow-400 transition-colors duration-200
                     flex items-center justify-center gap-2"
        >
          Play vs NPC
        </Link>

        <Link
          to="/collection"
          className="px-8 py-4 bg-gradient-to-r from-purple-600 to-purple-800 text-white font-display text-xl rounded-lg
                     hover:from-purple-500 hover:to-purple-700 transition-colors duration-200
                     flex items-center justify-center gap-2"
        >
          Collection & Deck
        </Link>

        <button
          disabled
          className="px-8 py-4 bg-gray-700 text-gray-400 font-display text-xl rounded-lg
                     cursor-not-allowed flex items-center justify-center gap-2"
        >
          Multiplayer (Coming Soon)
        </button>
      </motion.div>

      {/* Stats Summary */}
      {profile && (
        <motion.div
          className="mt-8 flex gap-6 text-sm text-gray-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <span>🎮 {profile.stats.gamesPlayed} games</span>
          <span>🏆 {profile.stats.wins} wins</span>
          {profile.stats.perfectWins > 0 && (
            <span>⭐ {profile.stats.perfectWins} perfect</span>
          )}
        </motion.div>
      )}

      <motion.div
        className="mt-8 text-gray-500 text-sm flex flex-col items-center gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.5 }}
      >
        <p>6 turns • 3 locations • 12-24 cards per deck</p>
        {profile?.tutorialCompleted && (
          <button
            type="button"
            onClick={() => {
              useTutorialStore.getState().startTutorial();
              navigate('/game?tutorial=true');
            }}
            className="text-olympus-gold/80 hover:text-olympus-gold text-xs underline"
          >
            Replay Tutorial
          </button>
        )}
      </motion.div>

      {/* Daily Reward Popup */}
      <AnimatePresence>
        {showRewardPopup && dailyReward && dailyReward.creditsEarned > 0 && (
          <motion.div
            className="fixed top-20 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-600 to-amber-600 
                       text-white px-6 py-4 rounded-xl shadow-2xl z-50"
            initial={{ opacity: 0, y: -50, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.9 }}
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">🎁</span>
              <div>
                <p className="font-display text-lg">Daily Reward!</p>
                <p className="text-sm opacity-90">
                  +{dailyReward.creditsEarned} Ichor • 
                  {dailyReward.wasReset ? ' Streak reset!' : ` ${dailyReward.newStreak} day streak`}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
