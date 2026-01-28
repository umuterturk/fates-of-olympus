import { motion } from 'framer-motion';
import type { CardDef } from '@engine/models';

interface CardTooltipProps {
  cardDef: CardDef;
  power: number;
  powerDiff: number;
  cardWidth?: number;
}

export function CardTooltip({ cardDef, power, powerDiff, cardWidth = 96 }: CardTooltipProps) {
  // Tooltip is 256px wide (w-64), center it above the card
  const tooltipWidth = 256;
  const offset = (tooltipWidth - cardWidth) / 2;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className="absolute z-[500] bottom-full mb-3 pointer-events-none"
      style={{ left: -offset }}
    >
      <div className="w-64 bg-gradient-to-b from-gray-900 to-gray-950 border-2 border-olympus-gold rounded-lg shadow-2xl overflow-hidden">
        {/* Header with name and cost */}
        <div className="bg-gradient-to-r from-olympus-gold/20 to-transparent px-3 py-2 border-b border-olympus-gold/30">
          <div className="flex justify-between items-center">
            <h3 className="font-display text-olympus-gold text-lg">{cardDef.name}</h3>
            <div className="flex items-center gap-2">
              <span className="bg-card-cost text-white text-sm font-bold px-2 py-0.5 rounded-full">
                {cardDef.cost} ⚡
              </span>
            </div>
          </div>
        </div>

        {/* Card image preview */}
        <div className="relative h-24 bg-gray-800">
          <img
            src={`/cards/${cardDef.id}.png`}
            alt={cardDef.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent" />
        </div>

        {/* Stats */}
        <div className="px-3 py-2 flex justify-between items-center border-b border-gray-700">
          <div className="flex items-center gap-1">
            <span className="text-gray-400 text-sm">Power:</span>
            <span className={`font-bold text-lg ${
              powerDiff > 0 ? 'text-green-400' : 
              powerDiff < 0 ? 'text-red-400' : 
              'text-olympus-gold'
            }`}>
              {power}
            </span>
            {powerDiff !== 0 && (
              <span className={`text-sm ${powerDiff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                ({powerDiff > 0 ? '+' : ''}{powerDiff})
              </span>
            )}
          </div>
          <div className="text-sm text-gray-400">
            Base: {cardDef.basePower}
          </div>
        </div>

        {/* Ability type badge */}
        <div className="px-3 pt-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
            cardDef.abilityType === 'ON_REVEAL' 
              ? 'bg-yellow-600/30 text-yellow-400 border border-yellow-600/50' 
              : cardDef.abilityType === 'ONGOING'
              ? 'bg-purple-600/30 text-purple-400 border border-purple-600/50'
              : 'bg-gray-600/30 text-gray-400 border border-gray-600/50'
          }`}>
            {cardDef.abilityType === 'ON_REVEAL' ? '⚡ On Reveal' : 
             cardDef.abilityType === 'ONGOING' ? '∞ Ongoing' : 
             '● Vanilla'}
          </span>
        </div>

        {/* Ability text */}
        <div className="px-3 py-2">
          {cardDef.text ? (
            <p className="text-gray-300 text-sm leading-relaxed italic">
              "{cardDef.text}"
            </p>
          ) : (
            <p className="text-gray-500 text-sm italic">
              No special ability
            </p>
          )}
        </div>

        {/* Tags */}
        {cardDef.tags.length > 0 && (
          <div className="px-3 pb-2 flex flex-wrap gap-1">
            {cardDef.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Decorative bottom border */}
        <div className="h-1 bg-gradient-to-r from-transparent via-olympus-gold to-transparent" />
      </div>

      {/* Arrow pointing down */}
      <div className="absolute left-1/2 -translate-x-1/2 -bottom-2">
        <div className="w-4 h-4 bg-gray-950 border-r-2 border-b-2 border-olympus-gold transform rotate-45" />
      </div>
    </motion.div>
  );
}
