import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import type { SaleLine } from '../data/types';
import { formatRs } from '../lib/format';
import { fonts } from '../theme/fonts';

type Props = {
  line: SaleLine;
  unit: string;
  /** Stock available for this product, or null when it is not a stocked product. */
  maxQty: number | null;
  onQty: (qty: number) => void;
  onRemove: () => void;
  onLimit: (message: string) => void;
};

const clean = (n: number) => Math.round(n * 1000) / 1000;

/** One bill line with - / + buttons and a box to type the quantity (kg, pcs, ...). */
export function CartLineRow({ line, unit, maxQty, onQty, onRemove, onLimit }: Props) {
  const { colors } = useTheme();
  const [text, setText] = useState(String(line.qty));

  useEffect(() => {
    setText(String(line.qty));
  }, [line.qty]);

  function apply(raw: number) {
    let qty = clean(raw);
    if (maxQty !== null && qty > maxQty) {
      qty = maxQty;
      onLimit(`${line.name}: only ${maxQty} ${unit} left.`);
    }
    if (qty <= 0) {
      onRemove();
      return;
    }
    setText(String(qty));
    onQty(qty);
  }

  function onType(value: string) {
    setText(value);
    const n = Number(value.replace(',', '.'));
    // Update the total while typing, but only for sensible values.
    if (Number.isFinite(n) && n > 0 && (maxQty === null || n <= maxQty)) onQty(clean(n));
  }

  function onDone(value: string) {
    const n = Number(value.replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) {
      setText(String(line.qty)); // empty or invalid: go back to the last good value
      return;
    }
    apply(n);
  }

  return (
    <View style={[styles.row, { borderBottomColor: colors.rowLine }]}>
      <View style={styles.copy}>
        <Text style={[styles.name, { color: colors.ink }]} numberOfLines={1}>
          {line.name}
        </Text>
        <Text style={[styles.meta, { color: colors.muted }]} numberOfLines={1}>
          {formatRs(line.unitPrice)} × {line.qty} = {formatRs(line.lineTotal)}
        </Text>
      </View>
      <View style={styles.stepper}>
        <Pressable
          accessibilityLabel="Decrease quantity"
          onPress={() => apply(line.qty - 1)}
          style={[styles.stepBtn, { backgroundColor: colors.keypad }]}
        >
          <Text style={[styles.stepText, { color: colors.ink }]}>−</Text>
        </Pressable>
        <TextInput
          value={text}
          onChangeText={onType}
          onEndEditing={(e) => onDone(e.nativeEvent.text)}
          keyboardType="decimal-pad"
          selectTextOnFocus
          style={[styles.input, { color: colors.ink, borderColor: colors.line, backgroundColor: colors.white }]}
        />
        <Pressable
          accessibilityLabel="Increase quantity"
          onPress={() => apply(line.qty + 1)}
          style={[styles.stepBtn, { backgroundColor: colors.brand }]}
        >
          <Text style={[styles.stepText, { color: colors.onFill }]}>+</Text>
        </Pressable>
        <Pressable accessibilityLabel="Remove item" onPress={onRemove} hitSlop={8} style={styles.remove}>
          <Text style={[styles.removeText, { color: colors.expenseText }]}>✕</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
  meta: {
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    fontFamily: fonts.bold,
    fontSize: 20,
    lineHeight: 22,
  },
  input: {
    width: 54,
    height: 36,
    borderWidth: 1,
    borderRadius: 10,
    textAlign: 'center',
    fontFamily: fonts.bold,
    fontSize: 15,
    paddingVertical: 0,
  },
  remove: {
    width: 26,
    alignItems: 'center',
  },
  removeText: {
    fontFamily: fonts.bold,
    fontSize: 15,
  },
});
