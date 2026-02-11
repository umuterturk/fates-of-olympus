import { useState, useCallback, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { trackPageView } from './analytics/ga4';
import { Home } from './pages/Home';
import { Game } from './pages/Game';
import { Collection } from './pages/Collection';
import { CardReveal } from './pages/CardReveal';
import { LoadingScreen } from './components/LoadingScreen';
import { UpdateNotification } from './components/UpdateNotification';
import { InstallPrompt } from './components/InstallPrompt';

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const location = useLocation();

  const handleLoadComplete = useCallback(() => {
    setIsLoading(false);
  }, []);

  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search]);

  return (
    <div className="min-h-screen bg-olympus-navy text-white relative">
      {/* PWA Notifications */}
      <UpdateNotification />
      <InstallPrompt />
      
      {/* Mobile background image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat sm:hidden blur-xs"
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}backgrounds/background.jpg)` }}
      />
      {/* Mobile overlay for readability */}
      <div 
        className="absolute inset-0 sm:hidden"
        style={{ background: 'radial-gradient(circle at center, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 70%, rgba(0,0,0,0.4) 100%)' }}
      />
      
      {/* Desktop background image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat hidden sm:block blur-xs"
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}backgrounds/background.jpg)` }}
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
    </div>
  );
}

export default App;
