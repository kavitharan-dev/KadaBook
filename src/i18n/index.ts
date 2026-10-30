import { en } from './en';
import { si } from './si';
import { ta } from './ta';
import type { Locale, Messages } from './types';

export type { Locale, Messages } from './types';

const catalogs: Record<Locale, Messages> = { en, ta, si };

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  ta: 'Tamil',
  si: 'Sinhala',
};

export const LOCALE_STORAGE_KEY = 'kb_locale';

export function getMessages(locale: Locale): Messages {
  return catalogs[locale] ?? catalogs.en;
}

export function formatMessage(template: string, params?: Record<string, string | number>) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? ''));
}

export function expenseCategoryMessage(messages: Messages, category: string): string {
  switch (category) {
    case 'Stock Purchase':
      return messages.expense.stock;
    case 'Transport':
      return messages.expense.transport;
    case 'Other':
      return messages.expense.other;
    default:
      return category;
  }
}
