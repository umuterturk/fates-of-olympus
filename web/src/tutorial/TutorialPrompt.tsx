/**
 * Tutorial prompt overlay: message, optional spotlight on a UI element, and Continue when applicable.
 */

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import type { TutorialStepConfig } from './tutorialStore';

interface TutorialPromptProps {
  step: TutorialStepConfig;
  onContinue: () => void;
  isMobile: boolean;
}

export function TutorialPrompt({ step, onContinue, isMobile }: TutorialPromptProps) {
  const showContinue = step.trigger === 'click_continue';
  const dimBackground = step.dimBackground !== false;

  // Pulse highlight on the target element
  useEffect(() => {
    if (!step.highlight) return;
    const el = document.querySelector(`[data-name="${step.highlight}"]`);
    if (!el) return;
    el.classList.add('tutorial-highlight');
    return () => el.classList.remove('tutorial-highlight');
  }, [step.highlight]);

  return (
    <AnimatePresence>
      <motion.div
        data-name="tutorial-overlay"
        className={clsx(
          'fixed inset-0 z-[999] flex items-start justify-center',
          isMobile ? 'pt-16 px-4' : 'pt-20 px-6',
          showContinue ? '' : 'pointer-events-none'
        )}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop when Continue is shown: dark dim for later steps, transparent block for intro so board stays visible */}
        {showContinue && (
          <div
            className={clsx(
              'absolute inset-0 pointer-events-auto',
              dimBackground ? 'bg-black/60' : 'bg-transparent'
            )}
            aria-hidden
          />
        )}

        {/* Message card - flexbox keeps it on screen on mobile; max-w-full prevents overflow */}
        <motion.div
          data-name="tutorial-message-card"
          className={clsx(
            'relative w-full max-w-lg',
            'bg-olympus-navy border-2 border-olympus-gold rounded-xl shadow-xl',
            showContinue ? 'pointer-events-auto' : 'pointer-events-none',
            isMobile ? 'px-4 py-4' : 'px-6 py-5'
          )}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          <p
            data-name="tutorial-message"
            className={clsx(
              'text-gray-100 text-center',
              isMobile ? 'text-sm leading-relaxed' : 'text-base leading-relaxed'
            )}
          >
            {step.message}
          </p>
          {showContinue && (
            <div className="mt-4 flex justify-center">
              <button
                data-name="tutorial-continue-button"
                onClick={onContinue}
                className={clsx(
                  'font-display font-semibold rounded-lg',
                  'bg-gradient-to-r from-olympus-gold to-olympus-bronze text-black',
                  'hover:brightness-110 transition-all shadow-md',
                  isMobile ? 'px-5 py-2 text-sm' : 'px-6 py-2.5'
                )}
              >
                Continue
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
