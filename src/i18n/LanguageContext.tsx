import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import id from './id.json';
import en from './en.json';

type Language = 'id' | 'en';
// Use a loose type so new keys don't cause TS errors
type Translations = Record<string, any>;

interface LanguageContextType {
  lang: Language;
  t: Translations;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
}


const translations: Record<Language, Translations> = { id, en };

const LanguageContext = createContext<LanguageContextType | null>(null);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Language>(() => {
    const saved = localStorage.getItem('twibo-lang');
    if (saved === 'en' || saved === 'id') return saved;
    // Auto-detect: Indonesian locale → 'id', otherwise 'en'
    const browserLang = typeof navigator !== 'undefined' ? (navigator.language || (navigator as any).userLanguage || '') : '';
    return browserLang.toLowerCase().startsWith('id') ? 'id' : 'en';
  });

  const setLang = useCallback((l: Language) => {
    setLangState(l);
    localStorage.setItem('twibo-lang', l);
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === 'id' ? 'en' : 'id');
  }, [lang, setLang]);

  return (
    <LanguageContext.Provider value={{ lang, t: translations[lang], setLang, toggleLang }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
};
