import { zhCN } from './zh-CN';

export const translations = {
  'zh-CN': zhCN,
};

export type Locale = keyof typeof translations;

export const defaultLocale: Locale = 'zh-CN';

export function getTranslations(locale: Locale = defaultLocale) {
  return translations[locale] || translations[defaultLocale];
}

// Export the default translations for convenience
export const t = zhCN;
