/**
 * PWA Install Prompt component.
 * Shows a notification when the app can be installed and allows the user to install it.
 */

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Extend the Window interface to include the beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

const STORAGE_KEY = 'pwa-install-dismissed';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Store the event globally in case it fires before React mounts
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;

// Capture the event as early as possible
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    console.log('[PWA Install] beforeinstallprompt event captured globally');
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
  });
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // Check if the user previously dismissed the prompt
  const isDismissed = useCallback(() => {
    const dismissedAt = localStorage.getItem(STORAGE_KEY);
    if (!dismissedAt) return false;
    
    const dismissedTime = parseInt(dismissedAt, 10);
    if (Date.now() - dismissedTime > DISMISS_DURATION_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return false;
    }
    return true;
  }, []);

  // Check if already installed (standalone mode)
  const isInstalled = useCallback(() => {
    return window.matchMedia('(display-mode: standalone)').matches ||
           (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  }, []);

  useEffect(() => {
    const installed = isInstalled();
    const dismissed = isDismissed();
    
    console.log('[PWA Install] Component mounted', {
      isInstalled: installed,
      isDismissed: dismissed,
      hasGlobalPrompt: !!globalDeferredPrompt,
      isStandalone: window.matchMedia('(display-mode: standalone)').matches,
    });

    // Don't show if already installed or dismissed
    if (installed || dismissed) {
      console.log('[PWA Install] Skipping - already installed or dismissed');
      return;
    }

    // Check if we already captured the event globally before React mounted
    if (globalDeferredPrompt) {
      console.log('[PWA Install] Using globally captured prompt event');
      setDeferredPrompt(globalDeferredPrompt);
      setTimeout(() => setShowPrompt(true), 2000);
    }

    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      console.log('[PWA Install] beforeinstallprompt event fired in component');
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Save the event for later use
      setDeferredPrompt(e);
      globalDeferredPrompt = e;
      // Show our custom prompt after a short delay
      setTimeout(() => setShowPrompt(true), 2000);
    };

    const handleAppInstalled = () => {
      console.log('[PWA Install] App was installed');
      // Clear the prompt when app is installed
      setDeferredPrompt(null);
      globalDeferredPrompt = null;
      setShowPrompt(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isDismissed, isInstalled]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    setIsInstalling(true);
    
    try {
      // Show the native install prompt
      await deferredPrompt.prompt();
      
      // Wait for the user's response
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('PWA installed successfully');
      } else {
        console.log('PWA installation dismissed');
      }
    } catch (error) {
      console.error('Error during PWA installation:', error);
    } finally {
      setIsInstalling(false);
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
    setShowPrompt(false);
  };

  return (
    <AnimatePresence>
      {showPrompt && deferredPrompt && (
        <motion.div
          className="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-[200]"
          initial={{ opacity: 0, y: -50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.9 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        >
          <div className="bg-gradient-to-br from-olympus-navy via-amber-900/90 to-olympus-navy 
                          border border-amber-500/50 rounded-xl p-4 shadow-2xl shadow-amber-500/20">
            {/* Glow effect */}
            <motion.div
              className="absolute inset-0 bg-amber-500/10 rounded-xl blur-lg -z-10"
              animate={{ opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
            />

            <div className="flex items-start gap-3 mb-3">
              <span className="text-2xl">📲</span>
              <div>
                <h3 className="font-display text-lg text-amber-300">
                  Install Fates of Olympus
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  Add to your home screen for the best experience - quick access & works offline!
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleDismiss}
                className="px-3 py-1.5 text-sm text-gray-400 hover:text-white 
                           transition-colors rounded-lg hover:bg-white/10"
                disabled={isInstalling}
              >
                Not Now
              </button>
              <button
                onClick={handleInstall}
                disabled={isInstalling}
                className="px-4 py-1.5 text-sm font-medium bg-gradient-to-r 
                           from-amber-500 to-orange-500 text-white rounded-lg
                           hover:shadow-lg hover:shadow-amber-500/30 transition-all
                           hover:scale-105 active:scale-95 disabled:opacity-50 
                           disabled:hover:scale-100 disabled:cursor-not-allowed
                           flex items-center gap-2"
              >
                {isInstalling ? (
                  <>
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                      ⏳
                    </motion.span>
                    Installing...
                  </>
                ) : (
                  'Install'
                )}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
