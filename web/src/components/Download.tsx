import { Reveal } from '@/components/Reveal';
import { useI18n } from '@/i18n/I18nProvider';

export function Download() {
  const { t } = useI18n();

  return (
    <section
      id="download"
      className="relative z-10 scroll-mt-8 px-4 py-16"
    >
      <div className="mx-auto max-w-md">
        <Reveal>
          <div className="rounded-2xl border border-gold/20 bg-gradient-to-br from-storm via-aegean/20 to-storm p-8 text-center shadow-2xl">
            <h2 className="mb-3 text-2xl font-bold text-parchment">
              {t.download.title}
            </h2>
            <p className="mb-8 text-sm text-parchment/75">
              {t.download.subtitle}
            </p>

            <a
              href="https://apps.apple.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[56px] items-center justify-center rounded-2xl bg-parchment px-10 py-4 text-base font-bold text-storm shadow-xl transition-transform active:scale-95"
            >
              {t.download.cta}
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
