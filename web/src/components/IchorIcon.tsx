import { useState, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { usePlayerStore } from "@store/playerStore";

// =============================================================================
// IchorIcon — inline image, clickable to show popup
// =============================================================================

interface IchorIconProps {
  className?: string;
  size?: number;
}

export const IchorIcon = memo(function IchorIcon({
  className = "",
  size = 20,
}: IchorIconProps) {
  const [showPopup, setShowPopup] = useState(false);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowPopup(true);
  }, []);

  return (
    <>
      <img
        src={`${import.meta.env.BASE_URL}icons/ichor.png`}
        alt="Ichor"
        width={size}
        height={size}
        className={`inline-block cursor-pointer ${className}`}
        style={{ verticalAlign: "middle" }}
        onClick={handleClick}
      />
      {showPopup && <IchorPopup onClose={() => setShowPopup(false)} />}
    </>
  );
});

// =============================================================================
// IchorDisplay — container with icon + credits, whole thing clickable
// =============================================================================

interface IchorDisplayProps {
  credits: number;
  size?: number;
  className?: string;
  textClassName?: string;
  prefix?: string;
  suffix?: string;
}

export const IchorDisplay = memo(function IchorDisplay({
  credits,
  size = 20,
  className = "bg-black/40 px-4 py-2 rounded-lg",
  textClassName = "font-bold text-olympus-gold",
  prefix,
  suffix,
}: IchorDisplayProps) {
  const [showPopup, setShowPopup] = useState(false);

  return (
    <>
      <div
        className={`flex items-center gap-2 cursor-pointer ${className}`}
        onClick={() => setShowPopup(true)}
      >
        <img
          src={`${import.meta.env.BASE_URL}icons/ichor.png`}
          alt="Ichor"
          width={size}
          height={size}
          className="inline-block"
        />
        <span className={textClassName}>
          {prefix}
          {credits}
          {suffix && ` ${suffix}`}
        </span>
      </div>
      {showPopup && <IchorPopup onClose={() => setShowPopup(false)} />}
    </>
  );
});

// =============================================================================
// IchorPopup — modal showing ichor info + player balance
// =============================================================================

function IchorPopup({ onClose }: { onClose: () => void }) {
  const profile = usePlayerStore((s) => s.profile);
  const credits = profile?.credits ?? 0;

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[700] flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={onClose}
        />

        {/* Popup */}
        <motion.div
          className="relative w-full max-w-[320px] overflow-hidden rounded-xl border-2 border-olympus-gold shadow-2xl"
          initial={{ scale: 0.7, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: -20 }}
          transition={{ type: "spring", damping: 20, stiffness: 350 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Glow behind popup */}
          <div className="absolute -inset-4 bg-purple-500/10 rounded-3xl blur-2xl pointer-events-none" />

          {/* Header */}
          <div className="relative bg-gradient-to-r from-purple-900/95 via-gray-900/95 to-purple-900/95 px-5 pt-5 pb-4">
            {/* Decorative top border */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-olympus-gold to-transparent" />

            <div className="flex items-center gap-3">
              {/* Animated Ichor icon */}
              <motion.div
                className="relative"
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <motion.div
                  className="absolute inset-0 bg-purple-400/30 rounded-full blur-lg"
                  animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <img
                  src={`${import.meta.env.BASE_URL}icons/ichor.png`}
                  alt="Ichor"
                  width={48}
                  height={48}
                  className="relative z-10 drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]"
                />
              </motion.div>
              <div>
                <h3 className="font-display text-2xl text-olympus-gold leading-tight">
                  Ichor
                </h3>
                <p className="text-purple-300 text-xs font-medium tracking-wide uppercase">
                  Divine Currency
                </p>
              </div>
            </div>
          </div>

          {/* Balance */}
          <div className="relative bg-gradient-to-r from-purple-800/20 via-purple-700/30 to-purple-800/20 px-5 py-3 border-y border-purple-500/20">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">Your Balance</span>
              <div className="flex items-center gap-2">
                <img
                  src={`${import.meta.env.BASE_URL}icons/ichor.png`}
                  alt="Ichor"
                  width={20}
                  height={20}
                />
                <span className="font-display text-2xl text-olympus-gold">
                  {credits}
                </span>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="relative bg-gradient-to-b from-gray-900/98 to-gray-950/98 px-5 py-4">
            <p className="text-gray-300 text-sm leading-relaxed mb-4">
              The sacred blood of the gods, Ichor flows through Olympus as the
              essence of divine power. Collect it to{" "}
              <span className="text-olympus-gold font-semibold">
                unlock new cards
              </span>{" "}
              and strengthen your fate.
            </p>

            {/* How to earn section */}
            <div className="bg-black/30 rounded-lg p-3 border border-gray-800/50">
              <h4 className="font-display text-sm text-purple-300 mb-2">
                Ways to Earn
              </h4>
              <div className="space-y-1.5 text-xs text-gray-400">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <img
                      src={`${import.meta.env.BASE_URL}icons/victory.png`}
                      alt="Win"
                      width={16}
                      height={16}
                      className="inline-block"
                    />{" "}
                    Win a match
                  </span>
                  <span className="text-olympus-gold font-semibold">+25</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <img
                      src={`${import.meta.env.BASE_URL}icons/victory_perfect.png`}
                      alt="Perfect"
                      width={16}
                      height={16}
                      className="inline-block"
                    />{" "}
                    Perfect win
                  </span>
                  <span className="text-olympus-gold font-semibold">+50</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <img
                      src={`${import.meta.env.BASE_URL}icons/defeat.png`}
                      alt="Defeat"
                      width={16}
                      height={16}
                      className="inline-block"
                    />{" "}
                    Lose a match
                  </span>
                  <span className="text-olympus-gold font-semibold">+10</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="text-orange-400">🔥</span> Daily login
                  </span>
                  <div className="text-right">
                    <span className="text-olympus-gold font-semibold">+50–+100</span>
                    <span className="block text-[10px] text-gray-500">streak ×1.0–×2.0</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="relative bg-gray-950/98 px-5 pb-4 pt-2">
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-gradient-to-r from-purple-600/30 to-violet-600/30 
                         text-purple-200 font-display text-sm rounded-lg
                         border border-purple-500/30 
                         hover:border-purple-400/50 hover:from-purple-600/40 hover:to-violet-600/40
                         transition-all active:scale-[0.98]"
            >
              Got it
            </button>

            {/* Decorative bottom border */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-olympus-gold to-transparent" />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
