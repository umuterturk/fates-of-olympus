import { useEffect, useState, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx } from "clsx";
import { getCardImagePath } from "@/utils/assets";
import { IDEOLOGY_INFO } from "@/utils/ideologyData";
import type { Ideology } from "@storage/types";

interface IdeologyPanelProps {
  ideology: Ideology;
  isChosen: boolean;
  hasChosenAny: boolean;
  delay?: number;
  revealsLeft?: number; // 0 = unlocked, >0 = locked
  onSelect?: (ideology: Ideology) => void;
  forceRevealed?: boolean;
  isConfirming?: boolean;
  className?: string;
}

export const IdeologyPanel = memo(function IdeologyPanel({
  ideology,
  isChosen,
  hasChosenAny,
  delay = 0,
  revealsLeft = 0,
  onSelect,
  forceRevealed = false,
  isConfirming = false,
  className,
}: IdeologyPanelProps) {
  // Performance tracking
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log(`[PERF] IdeologyPanel(${ideology}) rendered`);
    }
  });

  const info = IDEOLOGY_INFO[ideology];
  const [isRevealedInternal, setIsRevealedInternal] = useState(isChosen);
  const [isShaking, setIsShaking] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  const isRevealed = forceRevealed || isRevealedInternal;

  // Trigger scary shake in the last ~10% of zoom — only on hover or periodically if selection is enabled
  useEffect(() => {
    let startTimer: ReturnType<typeof setTimeout>;
    let stopTimer: ReturnType<typeof setTimeout>;
    let ambientTimer: ReturnType<typeof setInterval>;

    const triggerShake = (duration = 200) => {
      setIsShaking(true);
      stopTimer = setTimeout(() => setIsShaking(false), duration);
    };

    if (isHovering && !isChosen) {
      startTimer = setTimeout(() => triggerShake(), 1000);
    } else if (forceRevealed && !isChosen) {
      // Periodic ambient shake for selection mode — reduced frequency (was 2s)
      ambientTimer = setInterval(() => {
        if (Math.random() > 0.8) triggerShake(150); // Reduced probability from 0.4 to 0.2
      }, 4000);
    } else {
      setIsShaking(false);
    }

    return () => {
      clearTimeout(startTimer);
      clearTimeout(stopTimer);
      clearInterval(ambientTimer);
    };
  }, [isHovering, isChosen, forceRevealed]);

  return (
    <motion.div
      className={clsx(
        "relative group cursor-pointer rounded-lg overflow-hidden",
        "w-[108px] sm:w-[150px] lg:w-[180px] h-[158px] sm:h-[220px] lg:h-[260px]",
        "transition-all duration-500",
        (isChosen || isConfirming) && "ring-2 ring-olympus-gold",
        hasChosenAny && !isChosen && !isConfirming && "opacity-40",
        className,
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6, ease: "easeOut" }}
      onHoverStart={() => {
        setIsRevealedInternal(true);
        setIsHovering(true);
      }}
      onHoverEnd={() => {
        setIsHovering(false);
        if (!isChosen) setIsRevealedInternal(false);
        setIsShaking(false);
      }}
      onClick={(e) => {
        e.stopPropagation(); // Prevent background click from firing
        if (onSelect) {
          onSelect(ideology);
          if (!isChosen) {
            setIsRevealedInternal(true);
            setIsHovering(true);
          }
          return;
        }
        if (!isChosen) {
          setIsRevealedInternal(!isRevealed);
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
                  ? [0.7, 0.1, 0.5, 0, 0.7, 0.1, 0.7] // brighter pulses
                  : [0.8, 0, 0.9, 0, 0.7, 0, 0.8] // ghost teleport
              : isRevealed
                ? 1.0 // Full opacity when revealed/selection
                : 0.7, // Brighter unrevealed base
            scale: isRevealed ? 4 : 1,
            filter: isRevealed
              ? ideology === "NOMOS"
                ? "brightness(1.2) contrast(1.4) saturate(0.5) hue-rotate(200deg)"
                : ideology === "KATABASIS"
                  ? "brightness(2.4) contrast(1.6) saturate(0.6) hue-rotate(340deg)"
                  : "brightness(2.2) contrast(1.5) saturate(0.6)"
              : ideology === "KATABASIS" || ideology === "KINESIS"
                ? "brightness(1.3) contrast(1.3) saturate(0.8)"
                : "brightness(1.0) contrast(1.2) saturate(0.8)",
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
              : { duration: 1.2, ease: "easeOut", filter: { duration: 0 } }
          }
          loading="lazy"
        />

        {/* Ideology-themed glow overlay */}
        {ideology === "NOMOS" && (
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
          animate={{ opacity: isRevealed ? 0.8 : 0 }}
          transition={{ duration: 0.4 }}
        />

        {/* Static noise / grain — shared (static for GPU performance) */}
        {isRevealed && (
          <div
            className="absolute inset-0 pointer-events-none z-[1] mix-blend-overlay"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.4'/%3E%3C/svg%3E")`,
              backgroundSize: "128px 128px",
              opacity: 0.5,
            }}
          />
        )}

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

        {/* NOMOS Lightning strike effect */}
        {ideology === "NOMOS" && (
          <motion.div
            className="absolute inset-0 pointer-events-none z-[1] bg-white"
            initial={{ opacity: 0 }}
            animate={{
              opacity: isShaking ? [0, 0.8, 0, 0.9, 0, 0.5, 0] : 0,
            }}
            transition={{
              duration: 0.15,
              repeat: isShaking ? Infinity : 0,
              repeatDelay: 0.1,
            }}
          />
        )}
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
          className="font-display text-olympus-gold text-sm sm:text-base leading-tight"
          animate={{ opacity: isRevealed ? 1 : 0.9 }}
          style={{
            textShadow:
              "0 1px 6px rgba(0,0,0,1), 0 0 12px rgba(0,0,0,0.9), 0 2px 3px rgba(0,0,0,1)",
          }}
        >
          {info.name}
        </motion.h3>
        <p
          className="text-[10px] sm:text-xs text-white/80 italic mt-0.5"
          style={{ textShadow: "0 1px 4px rgba(0,0,0,1), 0 0 8px rgba(0,0,0,0.9)" }}
        >
          {info.tagline}
        </p>

        {/* Hint text — only appears on hover, adds mystery */}
        <AnimatePresence>
          {(isRevealed || isConfirming) && (
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
            className="absolute bottom-3 right-3 z-[6] pointer-events-none"
            initial={{ opacity: 0, scale: 0, rotate: -20 }}
            animate={{ opacity: 1, scale: 1, rotate: -12 }}
            transition={{ delay: delay + 0.4, duration: 0.4, type: "spring" }}
          >
            <div
              className="px-2 py-0.5 border border-green-400/90 rounded-sm"
              style={{
                background:
                  "linear-gradient(135deg, rgba(34,197,94,0.35), rgba(22,163,74,0.25))",
                boxShadow: "0 0 10px rgba(34,197,94,0.6), 0 0 4px rgba(34,197,94,0.4)",
              }}
            >
              <span className="text-[8px] font-bold tracking-[0.2em] text-green-300 uppercase">
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
      {/* Confirmation indicator */}
      <AnimatePresence>
        {isConfirming && (
          <motion.div
            className="absolute inset-0 z-[10] flex items-center justify-center p-2 bg-black/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="px-3 py-1.5 bg-olympus-gold text-black font-bold text-[10px] sm:text-xs rounded shadow-lg tracking-widest uppercase"
              initial={{ scale: 0.8, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              whileTap={{ scale: 0.9 }}
            >
              Confirm
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});
