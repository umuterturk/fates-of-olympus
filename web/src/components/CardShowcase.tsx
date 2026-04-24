import { Reveal } from '@/components/Reveal';
import { LazyImage } from '@/components/LazyImage';
import { GODS } from '@/data/cards';
import { useI18n } from '@/i18n/I18nProvider';

export default function CardShowcase() {
  const { t } = useI18n();

  return (
    <section className="relative z-10 px-0 py-12">
      <div className="mx-auto max-w-lg px-4">
        <Reveal>
          <h2 className="mb-2 text-center text-2xl font-bold text-parchment">
            {t.gods.title}
          </h2>
          <p className="mb-6 text-center text-sm text-parchment/70">
            {t.gods.subtitle}
          </p>
        </Reveal>
      </div>

      <Reveal>
        <div
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-pl-4 scroll-pr-4 px-4 pb-4 pt-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {GODS.map((card) => (
            <article
              key={card.id}
              className="w-[42vw] max-w-[220px] shrink-0 snap-center overflow-hidden rounded-xl border border-white/10 bg-storm/60 shadow-xl"
            >
              <LazyImage
                src={`/cards/${card.id}.jpg`}
                alt={card.name}
                width={384}
                height={576}
                placeholderColor={card.placeholder}
              />
              <div className="border-t border-white/5 px-2 py-2 text-center">
                <h3 className="text-xs font-medium leading-tight text-parchment">
                  {card.name}
                </h3>
              </div>
            </article>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
