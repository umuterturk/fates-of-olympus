import { useState, useCallback } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Home } from './pages/Home';
import { Game } from './pages/Game';
import { LoadingScreen } from './components/LoadingScreen';

function App() {
  const [isLoading, setIsLoading] = useState(true);

  const handleLoadComplete = useCallback(() => {
    setIsLoading(false);
  }, []);

  return (
    <div className="min-h-screen bg-olympus-navy text-white relative">
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
            </Routes>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default App;
