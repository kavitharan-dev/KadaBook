import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StockPlan, StockRows } from '../lib/stockEngine';
import { EMPTY_KITCHEN, type KitchenData } from './kitchenTypes';

/** The phone-only kitchen store, shared by the kitchen repo and the phone-only bills. */

const listeners = new Map<string, Set<(data: KitchenData) => void>>();
const key = (uid: string) => `kb_kitchen_${uid}`;

export const newLocalId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export async function readLocalKitchen(uid: string): Promise<KitchenData> {
  try {
    const raw = await AsyncStorage.getItem(key(uid));
    return raw ? { ...EMPTY_KITCHEN, ...(JSON.parse(raw) as KitchenData) } : { ...EMPTY_KITCHEN };
  } catch {
    return { ...EMPTY_KITCHEN };
  }
}

export async function writeLocalKitchen(uid: string, data: KitchenData) {
  data.moves.sort((a, b) => b.createdAt - a.createdAt);
  await AsyncStorage.setItem(key(uid), JSON.stringify(data));
  listeners.get(uid)?.forEach((fn) => fn({ ...data }));
}

export function listenLocalKitchen(uid: string, onData: (data: KitchenData) => void) {
  const set = listeners.get(uid) ?? new Set();
  set.add(onData);
  listeners.set(uid, set);
  readLocalKitchen(uid).then(onData);
  return () => {
    set.delete(onData);
  };
}

/** Plans against the stored rows and saves rows and ledger together. Returns the plan. */
export async function applyLocalStock<P extends StockPlan>(uid: string, plan: (rows: StockRows) => P): Promise<P> {
  const data = await readLocalKitchen(uid);
  const planned = plan(data.stock ?? {});
  data.stock = { ...(data.stock ?? {}), ...planned.rows };
  for (const move of planned.moves) {
    data.moves.push({ ...move, id: newLocalId(), createdAt: move.createdAt ?? Date.now() });
  }
  await writeLocalKitchen(uid, data);
  return planned;
}
