import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from './palettes';

/** StyleSheet that follows light/dark palette (avoid static imports from theme/colors). */
export function useStyleSheet(factory: (c: ColorPalette) => Record<string, unknown>) {
  const { colors } = useTheme();
  return useMemo(
    () => StyleSheet.create(factory(colors) as Parameters<typeof StyleSheet.create>[0]),
    [colors],
  );
}
