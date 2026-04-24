import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { I18nProvider } from '@/i18n/I18nProvider';
import { Home } from '@/pages/Home';

const Support = lazy(() => import('@/pages/Support').then(m => ({ default: m.Support })));

function SectionFallback() {
  return (
    <div className="flex min-h-[120px] items-center justify-center px-4 py-12">
      <div className="h-8 w-8 animate-pulse rounded-full bg-white/10 motion-reduce:animate-none" />
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route
            path="/support"
            element={
              <Suspense fallback={<SectionFallback />}>
                <Support />
              </Suspense>
            }
          />
        </Routes>
      </BrowserRouter>
    </I18nProvider>
  );
}
