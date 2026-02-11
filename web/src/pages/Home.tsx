import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { clsx } from "clsx";
import { usePlayerStore } from "@store/playerStore";
import { IchorDisplay } from "@components/IchorIcon";
import { useTutorialStore } from "@tutorial/tutorialStore";
import { getDefaultStarterDeck } from "@engine/starterDeck";
import { getCardImagePath } from "@/utils/assets";
import { IDEOLOGY_INFO, IDEOLOGY_KEYS } from "@/utils/ideologyData";
import { IDEOLOGY_CHOICE_POSITION } from "@engine/progression";
import type { Ideology } from "@storage/types";

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
// Ideology Showcase — Mysterious Dark Panel
// =============================================================================

interface IdeologyPanelProps {
  ideology: Ideology;
  isChosen: boolean;
  hasChosenAny: boolean;
  delay: number;
  revealsLeft: number; // 0 = unlocked, >0 = locked
}

function IdeologyPanel({
  ideology,
  isChosen,
  hasChosenAny,
  delay,
  revealsLeft,
}: IdeologyPanelProps) {
  const info = IDEOLOGY_INFO[ideology];
  const [isRevealed, setIsRevealed] = useState(isChosen);
  const [isShaking, setIsShaking] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  // Trigger scary shake in the last ~10% of zoom — only on hover, not initial chosen state
  useEffect(() => {
    let startTimer: ReturnType<typeof setTimeout>;
    let stopTimer: ReturnType<typeof setTimeout>;
    if (isHovering && !isChosen) {
      startTimer = setTimeout(() => {
        setIsShaking(true);
        stopTimer = setTimeout(() => setIsShaking(false), 200);
      }, 1000);
    } else {
      setIsShaking(false);
    }
    return () => {
      clearTimeout(startTimer);
      clearTimeout(stopTimer);
    };
  }, [isHovering, isChosen]);

  return (
    <motion.div
      className={clsx(
        "relative group cursor-pointer rounded-lg overflow-hidden",
        "w-[120px] sm:w-[150px] lg:w-[180px] h-[176px] sm:h-[220px] lg:h-[260px]",
        "transition-all duration-500",
        isChosen && "ring-1 ring-olympus-gold/60",
        hasChosenAny && !isChosen && "opacity-40",
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6, ease: "easeOut" }}
      onHoverStart={() => {
        setIsRevealed(true);
        setIsHovering(true);
      }}
      onHoverEnd={() => {
        setIsHovering(false);
        if (!isChosen) setIsRevealed(false);
        setIsShaking(false);
      }}
      onClick={() => {
        if (!isChosen) {
          setIsRevealed(!isRevealed);
          setIsHovering(!isRevealed);
        }
      }}
    >
      {/* Background: card image, deeply darkened — zooms into face on hover */}
      <div className="absolute inset-0 overflow-hidden bg-black">
        <motion.img
          key={info.featuredCardId}
          src={getCardImagePath(info.featuredCardId)}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            objectPosition: "center 20%",
            transformOrigin: info.zoomCenter,
          }}
          initial={{
            opacity: 0.5,
            scale: 1,
            filter: "brightness(0.8) contrast(1.1) saturate(0.8)",
          }}
          animate={{
            opacity: isShaking
              ? ideology === "NOMOS"
                ? [0.5, 0.7, 0.4, 0.7, 0.5] // cold flicker
                : ideology === "KATABASIS"
                  ? [0.6, 0.1, 0.5, 0, 0.7, 0.1, 0.6] // blackout pulses — lights going out
                  : [0.7, 0, 0.8, 0, 0.6, 0, 0.7] // rapid blink on/off — ghost teleport
              : isRevealed
                ? 0.8
                : 0.5,
            scale: isRevealed ? 4 : 1,
            filter: isRevealed
              ? ideology === "NOMOS"
                ? "brightness(1.4) contrast(1.5) saturate(0.4) hue-rotate(200deg)"
                : ideology === "KATABASIS"
                  ? "brightness(1.2) contrast(1.5) saturate(0.5) hue-rotate(340deg)"
                  : "brightness(1.3) contrast(1.3) saturate(0.5)"
              : "brightness(0.8) contrast(1.1) saturate(0.8)",
            // NOMOS: violent shake
            x:
              isShaking && ideology === "NOMOS"
                ? [0, -7, 8, -5, 6, -8, 3, 0]
                : // KINESIS: rapid horizontal displacement (ghost teleport)
                  isShaking && ideology === "KINESIS"
                  ? [0, -25, 30, -15, 20, -30, 0]
                  : 0,
            y:
              isShaking && ideology === "NOMOS"
                ? [0, 5, -6, 8, -3, 5, -7, 0]
                : // KATABASIS: slow sink downward (dragged under)
                  isShaking && ideology === "KATABASIS"
                  ? [0, 8, 15, 25, 35]
                  : 0,
          }}
          transition={
            isShaking
              ? ideology === "NOMOS"
                ? {
                    duration: 0.15,
                    repeat: Infinity,
                    repeatType: "loop" as const,
                  }
                : ideology === "KATABASIS"
                  ? { duration: 0.4, repeat: 2, repeatType: "loop" as const } // slower, dread
                  : {
                      duration: 0.1,
                      repeat: Infinity,
                      repeatType: "loop" as const,
                    } // rapid blinks
              : { duration: 1.2, ease: "easeOut" }
          }
          loading="lazy"
        />

        {/* Ideology-themed glow overlay */}
        {ideology === "NOMOS" && (
          /* NOMOS: Cold blue crystalline freeze flash */
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at center 30%, rgba(100,160,255,0.2) 0%, transparent 70%)",
            }}
            initial={{ opacity: 0 }}
            animate={{
              opacity: isRevealed ? [0, 0.5, 0.8, 0.3] : 0,
            }}
            transition={{
              duration: 2,
              repeat: isRevealed ? Infinity : 0,
              repeatType: "reverse",
            }}
          />
        )}
        {ideology === "KATABASIS" && (
          /* KATABASIS: Hellfire rising from below */
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(to top, rgba(180,30,30,0.3) 0%, rgba(120,20,80,0.15) 40%, transparent 70%)",
            }}
            initial={{ opacity: 0 }}
            animate={{
              opacity: isRevealed ? [0, 0.7, 0.4, 0.8, 0.5] : 0,
              y: isRevealed ? [10, 0, 5, -2, 10] : 10,
            }}
            transition={{
              duration: 2.5,
              repeat: isRevealed ? Infinity : 0,
              repeatType: "reverse",
            }}
          />
        )}
        {ideology === "KINESIS" && (
          /* KINESIS: Horizontal wind/motion streaks */
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "repeating-linear-gradient(90deg, transparent 0%, transparent 85%, rgba(80,220,200,0.08) 90%, transparent 95%)",
            }}
            initial={{ opacity: 0 }}
            animate={{
              opacity: isRevealed ? 0.9 : 0,
              x: isRevealed ? [0, 30, -20, 40, 0] : 0,
            }}
            transition={{
              duration: 0.6,
              repeat: isRevealed ? Infinity : 0,
              repeatType: "loop",
            }}
          />
        )}

        {/* Scan lines — shared but tinted per ideology */}
        <motion.div
          className="absolute inset-0 pointer-events-none z-[1]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)",
            backgroundSize: "100% 4px",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: isRevealed ? 0.6 : 0 }}
          transition={{ duration: 0.4 }}
        />

        {/* Static noise / grain — shared */}
        <motion.div
          className="absolute inset-0 pointer-events-none z-[1] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.4'/%3E%3C/svg%3E")`,
            backgroundSize: "128px 128px",
          }}
          initial={{ opacity: 0 }}
          animate={{
            opacity: isRevealed ? [0.2, 0.5, 0.15, 0.4, 0.2] : 0,
            x: isRevealed ? [0, -2, 1, -1, 0] : 0,
          }}
          transition={{
            duration: 0.3,
            repeat: isRevealed ? Infinity : 0,
            repeatType: "loop",
          }}
        />

        {/* Themed glitch bar — color per ideology */}
        <motion.div
          className="absolute left-0 right-0 h-[3px] pointer-events-none z-[1]"
          style={{
            background:
              ideology === "NOMOS"
                ? "rgba(100,160,255,0.15)"
                : ideology === "KATABASIS"
                  ? "rgba(200,50,50,0.15)"
                  : "rgba(80,220,200,0.15)",
            boxShadow:
              ideology === "NOMOS"
                ? "0 0 10px rgba(100,160,255,0.3)"
                : ideology === "KATABASIS"
                  ? "0 0 10px rgba(200,50,50,0.3)"
                  : "0 0 10px rgba(80,220,200,0.3)",
          }}
          initial={{ opacity: 0, top: "20%" }}
          animate={{
            opacity: isRevealed ? [0, 0.8, 0, 0, 0.6, 0] : 0,
            top: isRevealed
              ? ["10%", "30%", "50%", "70%", "90%", "10%"]
              : "20%",
          }}
          transition={{
            duration: 3,
            repeat: isRevealed ? Infinity : 0,
            ease: "linear",
          }}
        />
      </div>

      {/* Heavy dark gradient overlay — creates mystery */}
      <motion.div
        className="absolute inset-0 z-[2]"
        style={{
          background: `
            radial-gradient(ellipse at 50% 30%, transparent 0%, rgba(10,10,20,0.7) 50%, rgba(10,10,20,0.95) 100%),
            linear-gradient(to top, rgba(10,10,20,0.98) 0%, transparent 60%)
          `,
        }}
        animate={{
          opacity: isRevealed ? 0.5 : 0.8,
        }}
        transition={{ duration: 0.8 }}
      />

      {/* Subtle colored accent glow at top — very understated */}
      <motion.div
        className="absolute top-0 left-0 right-0 h-1 z-[3]"
        style={{ backgroundColor: info.accentColor, opacity: 0.5 }}
        animate={{ opacity: isRevealed || isChosen ? 0.8 : 0.3 }}
        transition={{ duration: 0.6 }}
      />

      {/* Content overlay */}
      <div className="absolute inset-0 z-[4] flex flex-col justify-end p-3 sm:p-4">
        {/* Ideology name */}
        <motion.h3
          className="font-display text-olympus-gold/90 text-sm sm:text-base leading-tight"
          animate={{ opacity: isRevealed ? 1 : 0.8 }}
        >
          {info.name}
        </motion.h3>
        <p className="text-[10px] sm:text-xs text-white/60 italic mt-0.5">
          {info.tagline}
        </p>

        {/* Hint text — only appears on hover, adds mystery */}
        <AnimatePresence>
          {isRevealed && (
            <motion.p
              className="text-[9px] sm:text-[10px] text-white/90 mt-2 leading-relaxed"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              transition={{ duration: 0.3 }}
            >
              {info.description}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Featured card name — subtle, mysterious */}
        <motion.p
          className="text-[9px] text-olympus-gold/40 mt-1.5 tracking-wider uppercase"
          animate={{ opacity: isRevealed ? 0.7 : 0.3 }}
          transition={{ duration: 0.5 }}
        >
          {info.featuredCardId.replace(/_/g, " ")}
        </motion.p>
      </div>

      {/* Chosen indicator — diagonal stamp + golden line */}
      {isChosen && (
        <>
          {/* Stamp badge */}
          <motion.div
            className="absolute top-3 right-3 z-[6] pointer-events-none"
            initial={{ opacity: 0, scale: 0, rotate: -20 }}
            animate={{ opacity: 1, scale: 1, rotate: -12 }}
            transition={{ delay: delay + 0.4, duration: 0.4, type: "spring" }}
          >
            <div
              className="px-2 py-0.5 border border-olympus-gold/80 rounded-sm"
              style={{
                background:
                  "linear-gradient(135deg, rgba(212,175,55,0.15), rgba(212,175,55,0.05))",
                boxShadow: "0 0 8px rgba(212,175,55,0.3)",
              }}
            >
              <span className="text-[8px] font-bold tracking-[0.2em] text-olympus-gold uppercase">
                Chosen
              </span>
            </div>
          </motion.div>

          {/* Bottom golden line */}
          <motion.div
            className="absolute bottom-0 left-0 right-0 h-[2px] z-[5]"
            style={{
              background:
                "linear-gradient(90deg, transparent, #d4af37, transparent)",
            }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: delay + 0.3, duration: 0.6 }}
          />
        </>
      )}

      {/* Locked stamp — appears on hover when ideology choice is still locked */}
      {revealsLeft > 0 && !isChosen && (
        <AnimatePresence>
          {isRevealed && (
            <motion.div
              className="absolute top-2 left-2 z-[7] pointer-events-none"
              initial={{ opacity: 0, scale: 1.5, rotate: -25 }}
              animate={{ opacity: 1, scale: 1, rotate: -8 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.3, type: "spring", damping: 12 }}
            >
              <div
                className="px-2 py-1 border border-red-500/60 rounded-sm"
                style={{
                  background: "rgba(20,0,0,0.7)",
                  boxShadow: "0 0 12px rgba(200,50,50,0.3)",
                }}
              >
                <div className="text-red-400/90 text-[8px] font-bold tracking-[0.2em] uppercase text-center">
                  Sealed
                </div>
                <div className="text-red-300/70 text-[7px] tracking-[0.1em] uppercase text-center mt-0.5">
                  {revealsLeft} reveal{revealsLeft === 1 ? "" : "s"} left
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </motion.div>
  );
}

// =============================================================================
// Home Page
// =============================================================================

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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8 relative">
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
              revealsLeft={
                profile
                  ? Math.max(
                      0,
                      IDEOLOGY_CHOICE_POSITION - profile.unlockPathPosition,
                    )
                  : 0
              }
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
