import { useI18n } from '@/i18n/I18nProvider';
import type { Language } from '@/i18n/translations';
import { useState, useRef, useEffect } from 'react';

const languages: { code: Language; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'es-mx', label: 'Español', flag: '🇲🇽' },
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
];

export function LanguageSelector() {
  const { lang, setLang } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLanguage = languages.find((l) => l.code === lang) || languages[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  function handleSelect(code: Language) {
    setLang(code);
    setIsOpen(false);
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex min-h-[36px] items-center gap-1.5 rounded-lg border border-white/10 bg-storm/60 px-2.5 py-1.5 text-xs text-parchment backdrop-blur-sm transition-colors hover:border-white/20 active:scale-95"
        aria-label="Select language"
        aria-expanded={isOpen}
      >
        <span className="text-base leading-none">{currentLanguage.flag}</span>
        <span className="font-medium">{currentLanguage.label}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 min-w-[140px] overflow-hidden rounded-xl border border-white/15 bg-storm/95 shadow-2xl backdrop-blur-md">
          {languages.map((language) => (
            <button
              key={language.code}
              type="button"
              onClick={() => handleSelect(language.code)}
              className={`flex w-full min-h-[40px] items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors ${
                language.code === lang
                  ? 'bg-gold/20 text-parchment font-medium'
                  : 'text-parchment/80 hover:bg-white/5'
              }`}
            >
              <span className="text-base leading-none">{language.flag}</span>
              <span>{language.label}</span>
              {language.code === lang && (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="ml-auto text-gold"
                >
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
