import { Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { Game } from './pages/Game';

function App() {
  return (
    <div className="min-h-screen bg-olympus-navy text-white">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/game" element={<Game />} />
      </Routes>
    </div>
  );
}

export default App;
