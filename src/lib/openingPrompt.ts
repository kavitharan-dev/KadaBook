import AsyncStorage from '@react-native-async-storage/async-storage';
import { branchDayId, dayKey, hasOpeningBalanceRecorded, type DayBranch } from './dayKey';

const KEY = '@kadabook/openingPromptDay';

function promptMark(ms: number, branch: DayBranch) {
  return branch ? branchDayId(branch.id, dayKey(ms)) : dayKey(ms);
}

/** Last calendar day (and branch) the user answered opening balance (skip or save) on this device. */
export async function readOpeningPromptDay(): Promise<string | null> {
  return AsyncStorage.getItem(KEY);
}

export async function markOpeningPromptDay(ms: number = Date.now(), branch: DayBranch = null) {
  const mark = promptMark(ms, branch);
  await AsyncStorage.setItem(KEY, mark);
  return mark;
}

export function needsOpeningBalancePrompt(
  meta: Parameters<typeof hasOpeningBalanceRecorded>[0],
  ms: number,
  localMarkedDay: string | null,
  branch: DayBranch = null,
) {
  if (hasOpeningBalanceRecorded(meta, ms, branch)) return false;
  if (localMarkedDay === promptMark(ms, branch)) return false;
  return true;
}
