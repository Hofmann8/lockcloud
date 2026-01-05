/**
 * Localization Index
 * 
 * Exports all localization utilities and translations.
 * Currently supports Chinese (Simplified) as the primary language.
 * 
 * Requirements: 12.2 - Use Chinese (zh-CN) as the primary language
 */

export { zhCN, t } from './zh-CN';
export type { Translations } from './zh-CN';

// Default locale
export const defaultLocale = 'zh-CN';

// Supported locales
export const supportedLocales = ['zh-CN'] as const;
export type SupportedLocale = typeof supportedLocales[number];

// Current locale (can be extended for multi-language support in the future)
let currentLocale: SupportedLocale = 'zh-CN';

/**
 * Get the current locale
 */
export function getLocale(): SupportedLocale {
  return currentLocale;
}

/**
 * Set the current locale
 * @param locale - The locale to set
 */
export function setLocale(locale: SupportedLocale): void {
  if (supportedLocales.includes(locale)) {
    currentLocale = locale;
  } else {
    console.warn(`Unsupported locale: ${locale}. Falling back to ${defaultLocale}`);
    currentLocale = defaultLocale;
  }
}
