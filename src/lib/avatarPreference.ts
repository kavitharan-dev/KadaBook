import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'kb_avatar_';

/** Profile photo, stored as a data URI on-device (no cloud upload yet — per device, not synced). */
export async function loadAvatar(uid: string): Promise<string | null> {
  if (!uid) return null;
  return AsyncStorage.getItem(KEY_PREFIX + uid);
}

export async function saveAvatar(uid: string, dataUri: string) {
  if (!uid) return;
  await AsyncStorage.setItem(KEY_PREFIX + uid, dataUri);
}

export async function clearAvatar(uid: string) {
  if (!uid) return;
  await AsyncStorage.removeItem(KEY_PREFIX + uid);
}
