import AsyncStorage from '@react-native-async-storage/async-storage';

export type AppTheme = 'light' | 'dark';

const KEY = 'kb_theme';

export async function loadThemePreference(): Promise<AppTheme> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw === 'dark' ? 'dark' : 'light';
}

export async function saveThemePreference(theme: AppTheme) {
  await AsyncStorage.setItem(KEY, theme);
}
