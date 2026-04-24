import { Reveal } from '@/components/Reveal';
import { useI18n } from '@/i18n/I18nProvider';

type Screenshot = {
  file: string;
  alt: string;
};

const screenshots: Record<string, Screenshot[]> = {
  en: [
    { file: '1-gameplay-en.jpg', alt: 'Gameplay' },
    { file: '2-gameplay-en.jpg', alt: 'Battle' },
    { file: '3-gameplay-en.jpg', alt: 'Strategy' },
    { file: '4-card-reveal-en.jpg', alt: 'Card Reveal' },
    { file: '5-card-reveal-en.jpg', alt: 'New Cards' },
    { file: '6-deck-building-en.jpg', alt: 'Deck Building' },
    { file: '7-ideology-selection-en.jpg', alt: 'Ideology Selection' },
    { file: '8-daily-rewards-en.jpg', alt: 'Daily Rewards' },
  ],
  'es-mx': [
    { file: '1-gameplay-sp.jpg', alt: 'Jugabilidad' },
    { file: '2-gameplay-sp.jpg', alt: 'Batalla' },
    { file: '3-gameplay-sp.jpg', alt: 'Estrategia' },
    { file: '4-cardreveal-sp.jpg', alt: 'Revelación de Cartas' },
    { file: '6-deck-building-sp.jpg', alt: 'Construcción de Mazos' },
    { file: '7-ideology-selection-sp.jpg', alt: 'Selección de Ideología' },
    { file: '8-daily-rewards-sp.jpg', alt: 'Recompensas Diarias' },
  ],
  tr: [
    { file: '1-gameplay-tr.jpg', alt: 'Oynanış' },
    { file: '2-gameplay-tr.jpg', alt: 'Savaş' },
    { file: '3-gameplay-tr.jpg', alt: 'Strateji' },
    { file: '4-cardreveal-tr.jpg', alt: 'Kart Açılımı' },
    { file: '6-deck-building-tr.jpg', alt: 'Deste Oluşturma' },
    { file: '7-ideology-selection-tr.jpg', alt: 'İdeoloji Seçimi' },
    { file: '8-daily-rewards-tr.jpg', alt: 'Günlük Ödüller' },
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
