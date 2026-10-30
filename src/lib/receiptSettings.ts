import AsyncStorage from '@react-native-async-storage/async-storage';

export type ReceiptSettings = {
  shopLine: string;
  invoicePrefix: string;
  footerLine: string;
  paperMm: 58 | 80;
};

export const DEFAULT_RECEIPT_SETTINGS: ReceiptSettings = {
  shopLine: '',
  invoicePrefix: 'INV',
  footerLine: 'Thank you — visit again!',
  paperMm: 58,
};

const KEY = 'kb_receipt_settings';

export async function loadReceiptSettings(): Promise<ReceiptSettings> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return DEFAULT_RECEIPT_SETTINGS;
  try {
    const parsed = JSON.parse(raw) as Partial<ReceiptSettings>;
    return {
      shopLine: parsed.shopLine ?? '',
      invoicePrefix: parsed.invoicePrefix ?? 'INV',
      footerLine: parsed.footerLine ?? DEFAULT_RECEIPT_SETTINGS.footerLine,
      paperMm: parsed.paperMm === 80 ? 80 : 58,
    };
  } catch {
    return DEFAULT_RECEIPT_SETTINGS;
  }
}

export async function saveReceiptSettings(settings: ReceiptSettings) {
  await AsyncStorage.setItem(KEY, JSON.stringify(settings));
}
