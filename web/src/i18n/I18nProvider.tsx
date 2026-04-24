import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { translations, detectLanguage, type Language } from './translations';

type Translation = {
  hero: {
    title: string;
    subtitle: string;
    tagline: string;
    cta: string;
  };
  gods: {
    title: string;
    subtitle: string;
  };
  monsters: {
    title: string;
    subtitle: string;
  };
  download: {
    title: string;
    subtitle: string;
    cta: string;
  };
  screenshots: {
    title: string;
  };
  footer: {
    copyright: string;
    support: string;
  };
  support: {
    title: string;
    reportBug: string;
    reportBugDesc: string;
    openIssue: string;
    discussions: string;
    discussionsDesc: string;
    joinDiscussion: string;
    backHome: string;
  };
};

type I18nContextType = {
  lang: Language;
  t: Translation;
  setLang: (lang: Language) => void;
};

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>(() => detectLanguage());

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value: I18nContextType = {
    lang,
    t: translations[lang],
    setLang,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
