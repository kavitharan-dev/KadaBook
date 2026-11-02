import AsyncStorage from '@react-native-async-storage/async-storage';

export type CreditSettings = {
  /** The shop's own WhatsApp number, put into messages so customers can reply or pay. */
  shopWhatsApp: string;
  /** Sent from the credit book as a payment reminder. */
  reminderTemplate: string;
  /** Sent after "Collect payment". */
  receiptTemplate: string;
  /** Show "Send receipt on WhatsApp" after a payment is collected. */
  offerReceipt: boolean;
};

/** Placeholders a template can use; the settings screen shows these as tap-to-insert chips. */
export const TEMPLATE_TAGS = ['{customer}', '{amount}', '{paid}', '{shop}', '{shopPhone}', '{date}'] as const;

export const DEFAULT_CREDIT_SETTINGS: CreditSettings = {
  shopWhatsApp: '',
  reminderTemplate:
    'Hello {customer}, this is {shop}.\nYour balance is {amount} as of {date}.\nPlease pay when you can. Thank you.\nWhatsApp / Call: {shopPhone}',
  receiptTemplate:
    'Hello {customer}, we received {paid} on {date}. Thank you!\nBalance remaining: {amount}\n- {shop}\nWhatsApp / Call: {shopPhone}',
  offerReceipt: true,
};

const KEY = 'kb_credit_settings';

export async function loadCreditSettings(): Promise<CreditSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_CREDIT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<CreditSettings>;
    return {
      shopWhatsApp: parsed.shopWhatsApp ?? '',
      reminderTemplate: parsed.reminderTemplate?.trim() ? parsed.reminderTemplate : DEFAULT_CREDIT_SETTINGS.reminderTemplate,
      receiptTemplate: parsed.receiptTemplate?.trim() ? parsed.receiptTemplate : DEFAULT_CREDIT_SETTINGS.receiptTemplate,
      offerReceipt: parsed.offerReceipt ?? true,
    };
  } catch {
    return DEFAULT_CREDIT_SETTINGS;
  }
}

export async function saveCreditSettings(settings: CreditSettings) {
  await AsyncStorage.setItem(KEY, JSON.stringify(settings));
}

/**
 * Fills a message template. A line whose placeholder has no value (say, no shop number set)
 * is dropped instead of being sent half-empty.
 */
export function fillTemplate(
  template: string,
  values: Partial<Record<'customer' | 'amount' | 'paid' | 'shop' | 'shopPhone' | 'date', string>>,
) {
  const known = new Set<string>(TEMPLATE_TAGS.map((tag) => tag.slice(1, -1)));
  const valueOf = (key: string) => values[key as keyof typeof values]?.trim() ?? '';
  return template
    .split('\n')
    .filter((line) => [...line.matchAll(/\{(\w+)\}/g)].every((m) => !known.has(m[1]) || valueOf(m[1])))
    .map((line) => line.replace(/\{(\w+)\}/g, (whole, key: string) => (known.has(key) ? valueOf(key) : whole)))
    .join('\n')
    .trim();
}
