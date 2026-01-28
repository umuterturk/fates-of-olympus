import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAllCardDefs } from '@engine/cards';

interface LoadingScreenProps {
  onLoadComplete: () => void;
}

// All card images to preload
const CARD_IMAGES = getAllCardDefs().map(
  (card) => `${import.meta.env.BASE_URL}cards/${card.id}.png`
);

// Fonts to wait for
const FONTS_TO_LOAD = ['Cinzel', 'Inter'];

async function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => {
      // Don't fail on missing images, just log
      console.warn(`Failed to load image: ${src}`);
      resolve();
    };
    img.src = src;
  });
}

async function waitForFonts(): Promise<void> {
  if (!document.fonts) {
    // Font Loading API not supported, wait a bit and continue
    await new Promise((r) => setTimeout(r, 500));
    return;
  }

  try {
    await document.fonts.ready;
    
    // Double-check specific fonts are loaded
    const fontPromises = FONTS_TO_LOAD.map(async (fontFamily) => {
      try {
        await document.fonts.load(`16px "${fontFamily}"`);
      } catch {
        console.warn(`Font ${fontFamily} may not have loaded`);
      }
    });
    
    await Promise.all(fontPromises);
  } catch {
    // Continue even if fonts fail
    console.warn('Font loading check failed');
  }
}

export function LoadingScreen({ onLoadComplete }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [loadingText, setLoadingText] = useState('Awakening the gods...');

  useEffect(() => {
    let cancelled = false;

    async function loadAssets() {
      const totalSteps = CARD_IMAGES.length + 2; // images + fonts + CSS settle
      let completedSteps = 0;

      const updateProgress = () => {
        if (cancelled) return;
        completedSteps++;
        setProgress(Math.round((completedSteps / totalSteps) * 100));
      };

      // Step 1: Wait for fonts
      setLoadingText('Loading divine fonts...');
      await waitForFonts();
      updateProgress();

      // Step 2: Preload all card images
      setLoadingText('Summoning heroes...');
      
      // Load images in batches of 4 for better performance
      const batchSize = 4;
      for (let i = 0; i < CARD_IMAGES.length; i += batchSize) {
        if (cancelled) return;
        
        const batch = CARD_IMAGES.slice(i, i + batchSize);
        await Promise.all(batch.map(preloadImage));
        
        // Update progress for each image in batch
        for (let j = 0; j < batch.length && completedSteps < totalSteps - 1; j++) {
          updateProgress();
        }
      }

      // Step 3: Let CSS settle
      setLoadingText('Preparing the battlefield...');
      await new Promise((r) => setTimeout(r, 300));
      updateProgress();

      // Complete!
      if (!cancelled) {
        setLoadingText('Ready for battle!');
        setProgress(100);
        
        // Small delay before transitioning
        await new Promise((r) => setTimeout(r, 400));
        onLoadComplete();
      }
    }

    loadAssets();

    return () => {
      cancelled = true;
    };
  }, [onLoadComplete]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-olympus-navy"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNCAxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNCAxNHoiIGZpbGw9IiNkNGFmMzciIG9wYWNpdHk9Ii4zIi8+PC9nPjwvc3ZnPg==')] bg-repeat" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center gap-8 px-8">
          {/* Logo/Title */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-center"
          >
            <h1 className="font-display text-5xl md:text-6xl text-olympus-gold mb-2">
              Fates of Olympus
            </h1>
            <p className="text-gray-400 text-lg">A strategic card game</p>
          </motion.div>

          {/* Lightning bolt animation */}
          <motion.div
            className="text-6xl"
            animate={{
              scale: [1, 1.2, 1],
              rotate: [0, 5, -5, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            ⚡
          </motion.div>

          {/* Progress bar */}
          <div className="w-64 md:w-80">
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden border border-olympus-gold/30">
              <motion.div
                className="h-full bg-gradient-to-r from-olympus-gold to-yellow-400"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <div className="flex justify-between mt-2 text-sm">
              <span className="text-gray-400">{loadingText}</span>
              <span className="text-olympus-gold font-bold">{progress}%</span>
            </div>
          </div>

          {/* Loading tips */}
          <motion.p
            className="text-gray-500 text-sm text-center max-w-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            Tip: Play cards at locations to win. The player who controls the most locations wins!
          </motion.p>
        </div>

        {/* Bottom decoration */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-olympus-gold to-transparent opacity-50" />
      </motion.div>
    </AnimatePresence>
  );
}
