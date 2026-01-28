import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import type { Energy } from '@engine/types';

interface EnergyDisplayProps {
  current: Energy;
  max: Energy;
}

export function EnergyDisplay({ current, max }: EnergyDisplayProps) {
  const energyPips = Array.from({ length: max }, (_, i) => i < current);

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-400">Energy:</span>
      
      <div className="flex gap-1">
        {energyPips.map((filled, index) => (
          <motion.div
            key={index}
            className={clsx(
              'w-4 h-4 rounded-full border-2',
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
        className="font-bold text-card-cost"
        initial={{ scale: 1.5 }}
        animate={{ scale: 1 }}
      >
        {current}/{max}
      </motion.span>
    </div>
  );
}
