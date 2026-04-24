import { Reveal } from '@/components/Reveal';
import { useI18n } from '@/i18n/I18nProvider';

type Screenshot = {
  file: string;
  alt: string;
};

const screenshots: Record<string, Screenshot[]> = {
  en: [
    { file: '1-gameplay-en.png', alt: 'Gameplay' },
    { file: '2-gameplay-en.png', alt: 'Battle' },
    { file: '3-gameplay-en.png', alt: 'Strategy' },
    { file: '4-card-reveal-en.png', alt: 'Card Reveal' },
    { file: '5-card-reveal-en.png', alt: 'New Cards' },
    { file: '6-deck-building-en.png', alt: 'Deck Building' },
    { file: '7-ideology-selection-en.png', alt: 'Ideology Selection' },
    { file: '8-daily-rewards-en.png', alt: 'Daily Rewards' },
  ],
  'es-mx': [
    { file: '1-gameplay-sp.png', alt: 'Jugabilidad' },
    { file: '2-gameplay-sp.png', alt: 'Batalla' },
    { file: '3-gameplay-sp.png', alt: 'Estrategia' },
    { file: '4-cardreveal-sp.png', alt: 'Revelación de Cartas' },
    { file: '6-deck-building-sp.png', alt: 'Construcción de Mazos' },
    { file: '7-ideology-selection-sp.png', alt: 'Selección de Ideología' },
    { file: '8-daily-rewards-sp.png', alt: 'Recompensas Diarias' },
  ],
  tr: [
    { file: '1-gameplay-tr.png', alt: 'Oynanış' },
    { file: '2-gameplay-tr.png', alt: 'Savaş' },
    { file: '3-gameplay-tr.png', alt: 'Strateji' },
    { file: '4-cardreveal-tr.png', alt: 'Kart Açılımı' },
    { file: '6-deck-building-tr.png', alt: 'Deste Oluşturma' },
    { file: '7-ideology-selection-tr.png', alt: 'İdeoloji Seçimi' },
    { file: '8-daily-rewards-tr.png', alt: 'Günlük Ödüller' },
  ],
};

export function Screenshots() {
  const { lang, t } = useI18n();
  const items = screenshots[lang] || screenshots.en;

  return (
    <section className="relative z-10 px-0 py-12">
      <div className="mx-auto max-w-lg px-4">
        <Reveal>
          <h2 className="mb-6 text-center text-2xl font-bold text-parchment">
            {t.screenshots.title}
          </h2>
        </Reveal>
      </div>

      <Reveal>
        <div
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-pl-4 scroll-pr-4 px-4 pb-4 pt-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {items.map((screenshot) => (
            <div
              key={screenshot.file}
              className="w-[58vw] max-w-[280px] shrink-0 snap-center overflow-hidden rounded-xl border border-white/10 bg-storm/60 shadow-2xl"
            >
              <img
                src={`/screenshots/${screenshot.file}`}
                alt={screenshot.alt}
                loading="lazy"
                decoding="async"
                className="h-auto w-full"
              />
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
