import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { usePlayerStore } from "@store/playerStore";
import { IchorDisplay } from "@components/IchorIcon";
import { useTutorialStore } from "@tutorial/tutorialStore";
import { getDefaultStarterDeck } from "@engine/starterDeck";
import { IDEOLOGY_KEYS } from "@/utils/ideologyData";
import { IDEOLOGY_CHOICE_POSITION } from "@engine/progression";
import type { Ideology } from "@storage/types";

import { IdeologyPanel } from "@/components/IdeologyPanel";

/** Format build time as human-readable date */
function formatBuildTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

// =============================================================================
// Home Page
// =============================================================================

export function Home() {
  // Performance tracking
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log("[PERF] Home rendered");
    }
  });

  const navigate = useNavigate();

  // Use selectors to prevent unnecessary re-renders when unrelated profile fields change
  const profile = usePlayerStore((s) => s.profile);
  const isLoading = usePlayerStore((s) => s.isLoading);
  const initialize = usePlayerStore((s) => s.initialize);
  const processDailyLogin = usePlayerStore((s) => s.processDailyLogin);
  const shouldShowUnlockNotification = usePlayerStore(
    (s) => s.shouldShowUnlockNotification,
  );
  const [dailyReward, setDailyReward] = useState<{
    creditsEarned: number;
    newStreak: number;
    wasReset: boolean;
  } | null>(null);
  const [showRewardPopup, setShowRewardPopup] = useState(false);
  const [confirmingIdeology, setConfirmingIdeology] = useState<Ideology | null>(
    null,
  );
  const buildTimeDisplay = useMemo(() => formatBuildTime(__BUILD_TIME__), []);

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
          setTimeout(() => setShowRewardPopup(false), 4000);

          setTimeout(() => {
            if (shouldShowUnlockNotification()) {
              navigate("/card-reveal");
            }
          }, 4500);
        }
      }
    };
    handleDailyLogin();
  }, [
    profile,
    dailyReward,
    processDailyLogin,
    shouldShowUnlockNotification,
    navigate,
  ]);

  const chosenIdeology = profile?.chosenIdeology ?? null;
  // Use a stable reference for needsIdeologyChoice if possible, or just call it from the store state
  const needsIdeologyChoice = usePlayerStore((s) => s.needsIdeologyChoice());
  const unlockPathPosition = profile?.unlockPathPosition ?? 0;

  const handleChooseIdeology = async (ideology: Ideology) => {
    if (confirmingIdeology === ideology) {
      const success = await usePlayerStore.getState().chooseIdeology(ideology);
      if (success) {
        setConfirmingIdeology(null);
      }
    } else {
      setConfirmingIdeology(ideology);
    }
  };

  const handleClickAway = () => {
    setConfirmingIdeology(null);
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8 relative"
      onClick={handleClickAway}
    >
      {/* Player Stats Bar (top right) */}
      {profile && !isLoading && (
        <motion.div
          className="absolute top-4 right-4 flex items-center gap-4"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {/* Unlock Ready — Chest */}
          {shouldShowUnlockNotification() && (
            <Link to="/card-reveal" className="relative group">
              <motion.div
                className="absolute -inset-3 bg-gradient-to-r from-yellow-500/50 via-amber-400/50 to-yellow-500/50 rounded-full blur-xl"
                animate={{ opacity: [0.4, 0.8, 0.4], scale: [0.9, 1.1, 0.9] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <motion.div
                className="relative w-14 h-14 cursor-pointer"
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.95 }}
                animate={{ y: [0, -4, 0] }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <img
                  src={`${import.meta.env.BASE_URL}icons/chest.png`}
                  alt=""
                  className="w-full h-full object-contain drop-shadow-[0_0_8px_rgba(255,200,50,0.6)]"
                />
                <motion.div
                  className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full"
                  animate={{ opacity: [0, 1, 0], scale: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <motion.div
                  className="absolute top-0 left-0 w-1.5 h-1.5 bg-amber-300 rounded-full"
                  animate={{ opacity: [0, 1, 0], scale: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
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
          <IchorDisplay credits={profile.credits} />
        </motion.div>
      )}

      {/* Title */}
      <div className="w-full flex sm:justify-center mb-8 sm:mb-1">
        <div className="flex flex-col sm:items-center">
          <motion.h1
            className="text-2xl sm:text-5xl font-display text-olympus-gold"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            Fates of Olympus
          </motion.h1>

          <motion.p
            className="hidden sm:block text-xs sm:text-sm text-gray-500 tracking-widest uppercase mt-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.7 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            Choose your fate
          </motion.p>
        </div>
      </div>

      {/* ===== IDEOLOGY SHOWCASE ===== */}
      <motion.div
        className="mb-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        {/* Panels */}
        <div className="flex gap-3 sm:gap-4 justify-center">
          {IDEOLOGY_KEYS.map((ideo, i) => (
            <IdeologyPanel
              key={ideo}
              ideology={ideo}
              isChosen={chosenIdeology === ideo}
              hasChosenAny={chosenIdeology !== null}
              delay={0.5 + i * 0.12}
              revealsLeft={Math.max(
                0,
                IDEOLOGY_CHOICE_POSITION - unlockPathPosition,
              )}
              forceRevealed={needsIdeologyChoice}
              isConfirming={confirmingIdeology === ideo}
              onSelect={needsIdeologyChoice ? handleChooseIdeology : undefined}
            />
          ))}
        </div>
      </motion.div>

      {/* Action Buttons */}
      <motion.div
        className="flex flex-col gap-3 w-full max-w-xs"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.5 }}
      >
        {profile && !profile.tutorialCompleted && (
          <button
            onClick={() => {
              useTutorialStore.getState().startTutorial();
              navigate("/game?tutorial=true");
            }}
            className="px-6 py-3 bg-gradient-to-r from-amber-500 to-olympus-bronze text-black font-display text-lg rounded-lg
                       hover:from-amber-400 hover:to-yellow-700 transition-colors duration-200
                       flex items-center justify-center gap-2 border-2 border-olympus-gold/50"
          >
            Start Tutorial
          </button>
        )}
        <Link
          to="/game"
          className="px-6 py-3 bg-olympus-gold text-black font-display text-lg rounded-lg
                     hover:bg-yellow-400 transition-colors duration-200
                     flex items-center justify-center gap-2"
        >
          Play vs NPC
        </Link>

        <Link
          to="/collection"
          className="px-6 py-3 bg-white/5 text-gray-300 font-display text-lg rounded-lg
                     border border-white/10 hover:bg-white/10 transition-colors duration-200
                     flex items-center justify-center gap-2"
        >
          Collection & Deck
        </Link>

        <button
          disabled
          className="px-6 py-3 bg-white/[0.02] text-gray-600 font-display text-base rounded-lg
                     border border-white/5 cursor-not-allowed flex items-center justify-center gap-2"
        >
          Multiplayer (Coming Soon)
        </button>
      </motion.div>

      {/* Stats Summary */}
      {profile && (
        <motion.div
          className="mt-6 flex gap-6 text-sm text-gray-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <span className="flex items-center gap-1">
            <img
              src={`${import.meta.env.BASE_URL}icons/draw.png`}
              alt=""
              width={14}
              height={14}
              className="inline-block opacity-50"
            />{" "}
            {profile.stats.gamesPlayed}
          </span>
          <span className="flex items-center gap-1">
            <img
              src={`${import.meta.env.BASE_URL}icons/victory.png`}
              alt=""
              width={14}
              height={14}
              className="inline-block opacity-50"
            />{" "}
            {profile.stats.wins}
          </span>
          {profile.stats.perfectWins > 0 && (
            <span className="flex items-center gap-1">
              <img
                src={`${import.meta.env.BASE_URL}icons/victory_perfect.png`}
                alt=""
                width={14}
                height={14}
                className="inline-block opacity-50"
              />{" "}
              {profile.stats.perfectWins}
            </span>
          )}
        </motion.div>
      )}

      <motion.div
        className="mt-4 text-gray-600 text-xs flex flex-col items-center gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        transition={{ delay: 1.1, duration: 0.5 }}
      >
        <p>6 turns • 3 locations • 12-24 cards</p>
        {profile?.tutorialCompleted && (
          <button
            type="button"
            onClick={() => {
              useTutorialStore.getState().startTutorial();
              navigate("/game?tutorial=true");
            }}
            className="text-olympus-gold/50 hover:text-olympus-gold/80 text-xs underline"
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
                  {dailyReward.wasReset
                    ? " Streak reset!"
                    : ` ${dailyReward.newStreak} day streak`}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Build version */}
      <div className="absolute bottom-1 left-0 right-0 text-center pointer-events-none">
        <span className="text-[10px] text-gray-600">
          Build: {buildTimeDisplay}
        </span>
      </div>
    </div>
  );
}
