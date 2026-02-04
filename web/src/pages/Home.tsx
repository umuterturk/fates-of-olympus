import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayerStore } from '@store/playerStore';
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
          {/* Compact Unlock Ready Link */}
          {shouldShowUnlockNotification() && (
            <Link
              to="/card-reveal"
              className="flex items-center gap-2 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 
                         border border-yellow-500/50 rounded-lg px-3 py-2 hover:border-yellow-400
                         transition-all group"
            >
              <motion.div
                className="absolute inset-0 bg-yellow-500/20 rounded-lg blur-md"
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
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
          )}

          {/* Streak */}
          {profile.loginStreak.count > 0 && (
            <div className="flex items-center gap-1 text-orange-400">
              <span>🔥</span>
              <span className="font-bold">{profile.loginStreak.count}</span>
            </div>
          )}
          
          {/* Credits */}
          <div className="flex items-center gap-2 bg-black/40 px-4 py-2 rounded-lg">
            <span className="text-yellow-400">💰</span>
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
        className="mt-8 text-gray-500 text-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.5 }}
      >
        <p>6 turns • 3 locations • 12-24 cards per deck</p>
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
                  +{dailyReward.creditsEarned} credits • 
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
