import { useState, useCallback, useMemo } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Home } from './pages/Home';
import { Game } from './pages/Game';
import { Collection } from './pages/Collection';
import { CardReveal } from './pages/CardReveal';
import { LoadingScreen } from './components/LoadingScreen';
import { UpdateNotification } from './components/UpdateNotification';

/** Format build time as human-readable date */
function formatBuildTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

function App() {
  const [isLoading, setIsLoading] = useState(true);

  const handleLoadComplete = useCallback(() => {
    setIsLoading(false);
  }, []);

  const buildTimeDisplay = useMemo(() => formatBuildTime(__BUILD_TIME__), []);

  return (
    <div className="min-h-screen bg-olympus-navy text-white relative">
      {/* PWA Update Notification */}
      <UpdateNotification />
      
      {/* Mobile background image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat sm:hidden blur-xs"
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}backgrounds/background.png)` }}
      />
      {/* Mobile overlay for readability */}
      <div 
        className="absolute inset-0 sm:hidden"
        style={{ background: 'radial-gradient(circle at center, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 70%, rgba(0,0,0,0.4) 100%)' }}
      />
      
      {/* Desktop background image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat hidden sm:block blur-xs"
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}backgrounds/background.png)` }}
      />
      {/* Desktop overlay for readability */}
      <div 
        className="absolute inset-0 hidden sm:block"
        style={{ background: 'radial-gradient(circle at center, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 70%, rgba(0,0,0,0.4) 100%)' }}
      />
      
      <div className="relative z-10 min-h-screen">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <LoadingScreen key="loading" onLoadComplete={handleLoadComplete} />
          ) : (
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/game" element={<Game />} />
              <Route path="/collection" element={<Collection />} />
              <Route path="/card-reveal" element={<CardReveal />} />
            </Routes>
          )}
        </AnimatePresence>
      </div>

      {/* Build version at the very bottom */}
      <div className="fixed bottom-1 left-0 right-0 text-center z-50 pointer-events-none">
        <span className="text-[10px] text-gray-600/50">
          Build: {buildTimeDisplay}
        </span>
      </div>
    </div>
  );
}

export default App;
