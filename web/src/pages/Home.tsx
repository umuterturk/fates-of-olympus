import { lazy, Suspense, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Hero } from '@/components/Hero';
import { Download } from '@/components/Download';
import { Screenshots } from '@/components/Screenshots';
import { useI18n } from '@/i18n/I18nProvider';

const CardShowcase = lazy(() => import('@/components/CardShowcase'));
const HeroesMonsters = lazy(() => import('@/components/HeroesMonsters'));

function SectionFallback() {
  return (
    <div className="flex min-h-[120px] items-center justify-center px-4 py-12">
      <div className="h-8 w-8 animate-pulse rounded-full bg-white/10 motion-reduce:animate-none" />
    </div>
  );
}

function initGa4() {
  const id = import.meta.env.VITE_GA4_MEASUREMENT_ID;
  if (!id || typeof document === 'undefined') return;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(script);

  window.gtag =
    window.gtag ||
    function gtag(...args: unknown[]) {
      (window.dataLayer = window.dataLayer || []).push(args);
    };
  window.gtag('js', new Date());
  window.gtag('config', id);
}

export function Home() {
  const { t } = useI18n();

  useEffect(() => {
    initGa4();
  }, []);

  return (
    <>
      <Header />
      <main>
        <Hero />

        <div className="pointer-events-none sticky top-0 z-50 -mt-[14dvh] mb-8 flex justify-center px-4 sm:-mt-[10dvh] sm:mb-12">
          <a
            href="https://apps.apple.com/app/id6737278673"
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t.hero.cta}
            className="pointer-events-auto inline-block active:scale-95"
          >
            <img
              src="/app-store-badge.svg"
              alt={t.hero.cta}
              width={405}
              height={120}
              className="h-[min(51vw,180px)] w-auto drop-shadow-2xl sm:h-[180px]"
            />
          </a>
        </div>

        <Suspense fallback={<SectionFallback />}>
          <CardShowcase />
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <HeroesMonsters />
        </Suspense>
        <Screenshots />
        <Download />
        <footer className="relative z-10 border-t border-white/5 px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center text-xs text-parchment/40">
            <p>{t.footer.copyright} © {new Date().getFullYear()}</p>
            <span className="text-parchment/20">•</span>
            <a href="/support" className="hover:text-parchment/60 transition-colors">
              {t.footer.support}
            </a>
          </div>
        </footer>
      </main>
    </>
  );
}
