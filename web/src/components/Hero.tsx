import { useI18n } from '@/i18n/I18nProvider';

export function Hero() {
  const { t } = useI18n();

  return (
    <section
      id="hero"
      className="relative flex min-h-[90dvh] flex-col items-center justify-center px-6 pb-8 pt-[max(2rem,calc(env(safe-area-inset-top)+3.5rem))]"
    >
      <img
        src="/backgrounds/background.jpg"
        alt=""
        width={1080}
        height={1920}
        fetchPriority="high"
        decoding="async"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-storm/80 via-storm/60 to-storm"
        aria-hidden
      />

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center text-center">
        <img
          src="/app-icon.jpg"
          alt="Fates of Olympus"
          width={1024}
          height={1024}
          className="mb-7 h-auto w-[min(64vw,220px)] rounded-[22%] drop-shadow-2xl"
          decoding="async"
        />
        <h1 className="mb-3 text-3xl font-bold tracking-tight text-parchment">
          {t.hero.title}
        </h1>
        <p className="mb-2 text-base text-parchment/80">
          {t.hero.subtitle}
        </p>
        <p className="text-sm text-parchment/65">
          {t.hero.tagline}
        </p>
      </div>
    </section>
  );
}
