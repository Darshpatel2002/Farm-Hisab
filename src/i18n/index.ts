import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import gu from './locales/gu.json';
import type { Language } from '../types/db';

const STORAGE_KEY = 'farm-hisab-language';

export const SUPPORTED_LANGUAGES: Array<{ code: Language; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'gu', label: 'ગુજરાતી' },
];

function initialLanguage(): Language {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  if (stored === 'en' || stored === 'gu') return stored;
  return 'en';
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    gu: { translation: gu },
  },
  lng: initialLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export function setLanguage(language: Language): void {
  void i18n.changeLanguage(language);
  localStorage.setItem(STORAGE_KEY, language);
  document.documentElement.lang = language;
}

export function currentLanguage(): Language {
  return (i18n.language === 'gu' ? 'gu' : 'en') as Language;
}

document.documentElement.lang = initialLanguage();

export default i18n;
