import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RawMaterial } from '../data/kitchenTypes';
import { formatQty } from './kitchenOps';

const KEY = 'kb_kitchen_low_stock_alert';

/** Once per day, alert when kitchen materials are at or below reorder level. */
export async function maybeNotifyKitchenLowStock(
  materials: RawMaterial[],
  stock: Record<string, number>,
) {
  const low = materials.filter((m) => m.reorderLevel > 0 && (stock[m.id] ?? 0) <= m.reorderLevel);
  if (!low.length) return;

  const day = new Date().toISOString().slice(0, 10);
  const fingerprint = `${day}:${low
    .map((m) => m.id)
    .sort()
    .join(',')}`;
  try {
    const prev = await AsyncStorage.getItem(KEY);
    if (prev === fingerprint) return;
    await AsyncStorage.setItem(KEY, fingerprint);
  } catch {
    /* still show once this session if storage fails */
  }

  const preview = low
    .slice(0, 5)
    .map((m) => `• ${m.name}: ${formatQty(stock[m.id] ?? 0, m.unit)}`)
    .join('\n');
  const more = low.length > 5 ? `\n…and ${low.length - 5} more` : '';

  Alert.alert(
    'Kitchen low stock',
    `${low.length} material${low.length === 1 ? '' : 's'} need reordering:\n\n${preview}${more}`,
  );
}
