import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import type { Energy } from '@engine/types';

interface EnergyDisplayProps {
  current: Energy;
  max: Energy;
}

// Hook to detect mobile
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  return isMobile;
}

export function EnergyDisplay({ current, max }: EnergyDisplayProps) {
  const isMobile = useIsMobile();
  const energyPips = Array.from({ length: max }, (_, i) => i < current);

  return (
    <div className={clsx(
      "flex items-center",
      isMobile ? "gap-1" : "gap-2"
    )}>
      {!isMobile && <span className="text-sm text-gray-400">Energy:</span>}
      
      <div className={clsx("flex", isMobile ? "gap-0.5" : "gap-1")}>
        {energyPips.map((filled, index) => (
          <motion.div
            key={index}
            className={clsx(
              'rounded-full border-2',
              isMobile ? 'w-2.5 h-2.5 border' : 'w-4 h-4',
              filled
                ? 'bg-card-cost border-card-cost'
                : 'bg-transparent border-gray-600'
            )}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: index * 0.05 }}
          />
        ))}
      </div>

      <motion.span
        key={current}
        className={clsx(
          "font-bold text-card-cost",
          isMobile && "text-xs"
        )}
        initial={{ scale: 1.5 }}
        animate={{ scale: 1 }}
      >
        {current}/{max}
      </motion.span>
    </div>
  );
}
