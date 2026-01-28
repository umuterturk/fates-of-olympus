import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <motion.h1
        className="text-6xl font-display text-olympus-gold mb-8"
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        Fates of Olympus
      </motion.h1>

      <motion.p
        className="text-xl text-gray-300 mb-12 text-center max-w-xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        A strategic card game set in Greek mythology.
        Command gods, heroes, and mythical creatures across three battlefields.
      </motion.p>

      <motion.div
        className="flex flex-col gap-4"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        <Link
          to="/game"
          className="px-8 py-4 bg-olympus-gold text-black font-display text-xl rounded-lg
                     hover:bg-yellow-400 transition-colors duration-200
                     flex items-center justify-center gap-2"
        >
          ⚔️ Play vs NPC
        </Link>

        <button
          disabled
          className="px-8 py-4 bg-gray-700 text-gray-400 font-display text-xl rounded-lg
                     cursor-not-allowed flex items-center justify-center gap-2"
        >
          🌐 Multiplayer (Coming Soon)
        </button>
      </motion.div>

      <motion.div
        className="mt-16 text-gray-500 text-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.5 }}
      >
        <p>6 turns • 3 locations • 12 cards per deck</p>
      </motion.div>
    </div>
  );
}
