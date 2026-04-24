import { Reveal } from '@/components/Reveal';
import { useI18n } from '@/i18n/I18nProvider';

export function Download() {
  const { t } = useI18n();

  return (
    <section id="download" className="relative z-10 scroll-mt-8 px-4 py-16">
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl border border-gold/20 bg-gradient-to-br from-storm via-aegean/20 to-storm p-8 text-center shadow-2xl">
          <Reveal>
            <div>
              <h2 className="mb-3 text-2xl font-bold text-parchment">
                {t.download.title}
              </h2>
              <p className="mb-6 text-sm text-parchment/75">
                {t.download.subtitle}
              </p>
            </div>
          </Reveal>

          <div className="flex justify-center py-2">
            <a
              href="https://apps.apple.com/app/id6737278673"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block transition-transform active:scale-95"
            >
              <img
                src="/app-store-badge.svg"
                alt={t.download.cta}
                width={405}
                height={120}
                className="mx-auto h-[min(38vw,140px)] w-auto drop-shadow-2xl sm:h-[168px]"
              />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
