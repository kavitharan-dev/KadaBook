import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { CheckIcon, PrinterIcon } from './Icons';
import { useTheme } from '../context/ThemeContext';
import type { PrintPhase } from '../lib/usePrintFeedback';
import { fonts } from '../theme/fonts';

type Props = {
  phase: PrintPhase;
  onPress: () => void;
  label: string;
  compact?: boolean;
  /** Full-height button for the bill sheet. */
  large?: boolean;
  /** Square icon-only button (no text label) — for dense rows. */
  iconOnly?: boolean;
};

/** Print button that shows Printing... / Printed / Retry so the user always knows what happened. */
export function PrintButton({ phase, onPress, label, compact, large, iconOnly }: Props) {
  const { colors } = useTheme();
  const busy = phase === 'printing';
  const background = phase === 'done' ? colors.saleText : phase === 'error' ? colors.expenseText : colors.brand;
  const text = busy ? 'Printing…' : phase === 'done' ? '✓ Printed' : phase === 'error' ? 'Retry' : label;

  if (iconOnly) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={text}
        disabled={busy}
        onPress={onPress}
        style={({ pressed }) => [styles.iconBtn, { backgroundColor: background }, pressed && { opacity: 0.75 }]}
      >
        {busy ? (
          <ActivityIndicator size="small" color={colors.onFill} />
        ) : phase === 'done' ? (
          <CheckIcon color={colors.onFill} size={16} />
        ) : (
          <PrinterIcon color={colors.onFill} size={16} />
        )}
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        compact ? styles.compact : large ? styles.large : styles.regular,
        { backgroundColor: background },
        pressed && { opacity: 0.75 },
      ]}
    >
      {busy ? <ActivityIndicator size="small" color={colors.onFill} /> : null}
      <Text style={[styles.text, { color: colors.onFill, fontSize: compact ? 12 : large ? 16 : 14 }]}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
  },
  regular: {
    minHeight: 40,
    minWidth: 104,
    paddingHorizontal: 16,
  },
  large: {
    minHeight: 54,
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  compact: {
    minHeight: 34,
    minWidth: 84,
    paddingHorizontal: 10,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: fonts.semibold,
  },
});
