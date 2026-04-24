/**
 * PWA Update Notification component.
 * Shows a toast when a new version is available and allows the user to update.
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRegisterSW } from 'virtual:pwa-register/react';

export function UpdateNotification() {
  const [showPrompt, setShowPrompt] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // Check for updates every 5 minutes
      if (r) {
        setInterval(() => {
          r.update();
        }, 5 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('SW registration error:', error);
    },
  });

  useEffect(() => {
    if (needRefresh || offlineReady) {
      setShowPrompt(true);
    }
  }, [needRefresh, offlineReady]);

  const handleUpdate = async () => {
    await updateServiceWorker(true);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setNeedRefresh(false);
    setOfflineReady(false);
  };

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-[200]"
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        >
          <div className="bg-gradient-to-br from-olympus-navy via-purple-900/90 to-olympus-navy 
                          border border-purple-500/50 rounded-xl p-4 shadow-2xl shadow-purple-500/20">
            {/* Glow effect */}
            <motion.div
              className="absolute inset-0 bg-purple-500/10 rounded-xl blur-lg -z-10"
              animate={{ opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
            />

            {needRefresh ? (
              <>
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-2xl">✨</span>
                  <div>
                    <h3 className="font-display text-lg text-purple-300">
                      New Version Available!
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">
                      A new update is ready. Refresh to get the latest features.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={handleDismiss}
                    className="px-3 py-1.5 text-sm text-gray-400 hover:text-white 
                               transition-colors rounded-lg hover:bg-white/10"
                  >
                    Later
                  </button>
                  <button
                    onClick={handleUpdate}
                    className="px-4 py-1.5 text-sm font-medium bg-gradient-to-r 
                               from-purple-500 to-violet-500 text-white rounded-lg
                               hover:shadow-lg hover:shadow-purple-500/30 transition-all
                               hover:scale-105 active:scale-95"
                  >
                    Update Now
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📱</span>
                  <div>
                    <h3 className="font-display text-lg text-green-300">
                      Ready for Offline
                    </h3>
                    <p className="text-sm text-gray-400">
                      App is cached and works offline!
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleDismiss}
                  className="absolute top-2 right-2 text-gray-500 hover:text-white 
                             transition-colors p-1"
                  aria-label="Dismiss"
                >
                  ✕
                </button>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
