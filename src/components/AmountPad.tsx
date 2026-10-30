import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { fonts } from '../theme/fonts';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '+', '⌫'] as const;

export function AmountPad({
  amount,
  onChange,
  stack = [],
  onPlus,
  keyHeight = 56,
  keyGap = 8,
  displayMinHeight = 112,
  valueFontSize = 48,
}: {
  amount: string;
  onChange: (next: string) => void;
  stack?: number[];
  onPlus?: () => void;
  keyHeight?: number;
  keyGap?: number;
  displayMinHeight?: number;
  valueFontSize?: number;
}) {
  const { colors } = useTheme();

  function press(key: string) {
    if (key === '+') {
      onPlus?.();
      return;
    }
    if (key === 'C') {
      onChange('');
      return;
    }
    if (key === '⌫') {
      onChange(amount.slice(0, -1));
      return;
    }
    if (amount.length >= 8) return;
    onChange(`${amount}${key}`.replace(/^0+(?=\d)/, ''));
  }

  const stackTotal = stack.reduce((sum, n) => sum + n, 0);
  const typed = Math.round(Number(amount) || 0);
  const stackLine = stack.map((n) => n.toLocaleString('en-IN')).join(' + ');
  const mainNumber = amount ? typed : stack.length > 0 ? stackTotal : 0;
  const mainShown = mainNumber.toLocaleString('en-IN');

  return (
    <View style={[styles.wrap, { gap: keyGap + 6 }]}>
      <View
        style={[
          styles.display,
          { backgroundColor: colors.keypad, borderColor: colors.hairline, minHeight: displayMinHeight },
        ]}
      >
        {stackLine ? (
          <Text style={[styles.stackLine, { color: colors.muted }]} numberOfLines={2}>
            {stackLine}
          </Text>
        ) : null}
        <View style={styles.mainRow}>
          <Text style={[styles.rs, { color: colors.muted }]}>Rs.</Text>
          <Text
            style={[styles.value, { color: colors.ink, fontSize: valueFontSize }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {mainShown}
          </Text>
        </View>
      </View>
      <View style={[styles.grid, { gap: keyGap }]}>
        {KEYS.map((key) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={
              key === '⌫' ? 'Delete' : key === 'C' ? 'Clear' : key === '+' ? 'Add' : key
            }
            onPress={() => press(key)}
            style={({ pressed }) => [
              styles.key,
              key === '+' && styles.keyPlus,
              { backgroundColor: key === '+' ? colors.brand : colors.keypad, height: keyHeight },
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.keyLabel,
                { color: key === '+' ? colors.onFill : colors.ink },
                key === '+' && styles.keyPlusLabel,
              ]}
            >
              {key}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 14,
  },
  display: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 14,
    justifyContent: 'center',
    gap: 6,
  },
  stackLine: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    textAlign: 'right',
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  rs: {
    fontFamily: fonts.regular,
    fontSize: 22,
  },
  value: {
    fontFamily: fonts.bold,
    maxWidth: '78%',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  key: {
    width: '23%',
    flexGrow: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyPlus: {
    minWidth: '48%',
  },
  pressed: {
    opacity: 0.7,
  },
  keyLabel: {
    fontFamily: fonts.semibold,
    fontSize: 22,
  },
  keyPlusLabel: {
    fontSize: 28,
  },
});
