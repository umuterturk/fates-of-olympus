import { useI18n } from '@/i18n/I18nProvider';
import { Header } from '@/components/Header';

export function Support() {
  const { t } = useI18n();

  return (
    <>
      <Header />
      <div className="min-h-screen bg-storm px-4 pb-16 pt-[max(1rem,calc(env(safe-area-inset-top)+3.25rem))]">
        <div className="mx-auto max-w-2xl">
          <a
            href="/"
            className="mb-8 inline-flex items-center gap-2 text-sm text-parchment/70 transition-colors hover:text-parchment"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t.support.backHome}
          </a>

          <h1 className="mb-8 text-3xl font-bold text-parchment">{t.support.title}</h1>

        <div className="space-y-6">
          <section className="rounded-2xl border border-white/10 bg-storm/60 p-6">
            <div className="mb-4 flex items-start gap-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0 text-gold">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
              <div className="flex-1">
                <h2 className="mb-2 text-xl font-semibold text-parchment">{t.support.reportBug}</h2>
                <p className="mb-4 text-sm text-parchment/70">
                  {t.support.reportBugDesc}
                </p>
                <a
                  href="https://github.com/umuterturk/fates-of-olympus/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-parchment/10 px-5 py-2.5 text-sm font-medium text-parchment transition-colors hover:bg-parchment/15"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  {t.support.openIssue}
                </a>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-storm/60 p-6">
            <div className="mb-4 flex items-start gap-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0 text-gold">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <div className="flex-1">
                <h2 className="mb-2 text-xl font-semibold text-parchment">{t.support.discussions}</h2>
                <p className="mb-4 text-sm text-parchment/70">
                  {t.support.discussionsDesc}
                </p>
                <a
                  href="https://github.com/umuterturk/fates-of-olympus/discussions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-parchment/10 px-5 py-2.5 text-sm font-medium text-parchment transition-colors hover:bg-parchment/15"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  {t.support.joinDiscussion}
                </a>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-storm/60 p-6">
            <h2 className="mb-4 text-xl font-semibold text-parchment">FAQ</h2>
            <div className="space-y-4">
              <div>
                <h3 className="mb-2 font-medium text-parchment">What platforms is the game available on?</h3>
                <p className="text-sm text-parchment/70">
                  Fates of Olympus is currently available exclusively on iPhone.
                </p>
              </div>
              <div>
                <h3 className="mb-2 font-medium text-parchment">Is the game free to play?</h3>
                <p className="text-sm text-parchment/70">
                  Yes, the game is free to download and play with optional in-game purchases.
                </p>
              </div>
              <div>
                <h3 className="mb-2 font-medium text-parchment">What languages are supported?</h3>
                <p className="text-sm text-parchment/70">
                  The game supports English, Spanish (Mexico), and Turkish.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
      </div>
    </>
  );
}
