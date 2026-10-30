import AsyncStorage from '@react-native-async-storage/async-storage';
import { dayKey, hasOpeningBalanceRecorded } from './dayKey';

const KEY = '@kadabook/openingPromptDay';

/** Last calendar day the user answered opening balance (skip or save) on this device. */
export async function readOpeningPromptDay(): Promise<string | null> {
  return AsyncStorage.getItem(KEY);
}

export async function markOpeningPromptDay(ms: number = Date.now()) {
  await AsyncStorage.setItem(KEY, dayKey(ms));
}

export function needsOpeningBalancePrompt(
  meta: { openingBalances?: Record<string, number> },
  ms: number,
  localMarkedDay: string | null,
) {
  const key = dayKey(ms);
  if (hasOpeningBalanceRecorded(meta, ms)) return false;
  if (localMarkedDay === key) return false;
  return true;
}
