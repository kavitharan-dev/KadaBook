import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { amountString, evaluate, formatResult, groupNumber, isOp, prettyExpression } from '../lib/calc';
import { fonts } from '../theme/fonts';

type Props = {
  /** Plain number string the screen reads (e.g. "248"). '' when there is nothing to sell yet. */
  amount: string;
  onChange: (value: string) => void;
  keyHeight?: number;
  keyGap?: number;
  displayMinHeight?: number;
  valueFontSize?: number;
  /** Accepted so screens written for the old AmountPad still compile; the calculator replaces them. */
  stack?: unknown;
  onPlus?: () => void;
};

type Kind = 'digit' | 'util' | 'op' | 'equals';
type KeyDef = { label: string; value: string; kind: Kind };

const ROWS: KeyDef[][] = [
  [
    { label: 'C', value: 'clear', kind: 'util' },
    { label: '⌫', value: 'back', kind: 'util' },
    { label: '%', value: '%', kind: 'util' },
    { label: '÷', value: '/', kind: 'op' },
  ],
  [
    { label: '7', value: '7', kind: 'digit' },
    { label: '8', value: '8', kind: 'digit' },
    { label: '9', value: '9', kind: 'digit' },
    { label: '×', value: '*', kind: 'op' },
  ],
  [
    { label: '4', value: '4', kind: 'digit' },
    { label: '5', value: '5', kind: 'digit' },
    { label: '6', value: '6', kind: 'digit' },
    { label: '−', value: '-', kind: 'op' },
  ],
  [
    { label: '1', value: '1', kind: 'digit' },
    { label: '2', value: '2', kind: 'digit' },
    { label: '3', value: '3', kind: 'digit' },
    { label: '+', value: '+', kind: 'op' },
  ],
  [
    { label: '00', value: '00', kind: 'digit' },
    { label: '0', value: '0', kind: 'digit' },
    { label: '.', value: '.', kind: 'digit' },
    { label: '=', value: '=', kind: 'equals' },
  ],
];

type PadState = { expr: string; fresh: boolean };

const MAX_LENGTH = 60;
const lastNumber = (expr: string) => expr.split(/[+\-*/]/).pop() ?? '';

function reduce(state: PadState, key: KeyDef): PadState {
  const { expr, fresh } = state;
  const base = fresh && (key.kind === 'digit') ? '' : expr;

  if (key.value === 'clear') return { expr: '', fresh: false };
  if (key.value === 'back') return fresh ? { expr: '', fresh: false } : { expr: expr.slice(0, -1), fresh: false };

  if (key.value === '=') {
    if (!/[+\-*/%]/.test(expr)) return state;
    const value = evaluate(expr);
    if (value === null || value < 0 || value >= 1e9) return state;
    return { expr: String(Math.round(value * 100) / 100), fresh: true };
  }

  if (key.value === '%') {
    if (expr === '' || expr.endsWith('%') || isOp(expr.slice(-1)) || expr.endsWith('.')) return state;
    return { expr: `${expr}%`, fresh: false };
  }

  if (key.kind === 'op') {
    if (expr === '') return state;
    if (isOp(expr.slice(-1))) return { expr: expr.slice(0, -1) + key.value, fresh: false };
    return { expr: expr + key.value, fresh: false };
  }

  // digits, 00 and the decimal point
  if (base.endsWith('%')) return state;
  const last = lastNumber(base);
  if (key.value === '.') {
    if (last.includes('.')) return { expr: base, fresh: false };
    return { expr: base + (last === '' ? '0.' : '.'), fresh: false };
  }
  if (key.value === '00') {
    if (last === '' || last === '0') return { expr: base, fresh: false };
  }
  const next = last === '0' && key.value !== '00' ? base.slice(0, -1) + key.value : base + key.value;
  if (next.length > MAX_LENGTH) return state;
  return { expr: next, fresh: false };
}

export function CalculatorPad({
  amount,
  onChange,
  keyHeight = 56,
  keyGap = 10,
  displayMinHeight = 110,
  valueFontSize = 44,
}: Props) {
  const { colors } = useTheme();
  const [pad, setPad] = useState<PadState>({ expr: amount, fresh: false });
  const lastEmitted = useRef<string | null>(null);
  const height = Math.max(46, Math.min(keyHeight, 64));

  // Tell the screen the current value (a plain number string).
  useEffect(() => {
    const out = amountString(pad.expr);
    lastEmitted.current = out;
    onChange(out);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pad.expr]);

  // The screen cleared or replaced the amount (after saving a sale): follow it.
  useEffect(() => {
    if (lastEmitted.current !== null && amount !== lastEmitted.current) {
      lastEmitted.current = amount;
      setPad({ expr: amount, fresh: false });
    }
  }, [amount]);

  const hasOp = /[+\-*/%]/.test(pad.expr);
  const live = hasOp ? evaluate(pad.expr) : null;
  const big = hasOp ? (live === null ? '—' : formatResult(live)) : pad.expr === '' ? '0' : groupNumber(pad.expr);
  const negative = live !== null && live < 0;

  function colorsFor(kind: Kind, value: string) {
    switch (kind) {
      case 'op':
        return { bg: colors.brand, fg: colors.onFill };
      case 'equals':
        return { bg: colors.saleText, fg: colors.onFill };
      case 'util':
        return { bg: colors.line, fg: value === 'clear' ? colors.expenseText : colors.ink };
      default:
        return { bg: colors.keypad, fg: colors.ink };
    }
  }

  return (
    <View style={{ gap: keyGap }}>
      <View
        style={[styles.display, { backgroundColor: colors.keypad, minHeight: displayMinHeight, borderColor: colors.line }]}
      >
        <Text style={[styles.expr, { color: colors.muted }]}>
          {hasOp ? prettyExpression(pad.expr) : ' '}
        </Text>
        <View style={styles.valueRow}>
          <Text style={[styles.currency, { color: colors.muted }]}>Rs.</Text>
          <Text
            style={[styles.value, { color: negative ? colors.expenseText : colors.ink, fontSize: valueFontSize }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {big}
          </Text>
        </View>
      </View>
      {ROWS.map((row, r) => (
        <View key={r} style={[styles.row, { gap: keyGap }]}>
          {row.map((key) => {
            const c = colorsFor(key.kind, key.value);
            return (
              <Pressable
                key={key.label}
                accessibilityRole="button"
                accessibilityLabel={key.value === 'back' ? 'Backspace' : key.value === 'clear' ? 'Clear' : key.label}
                onPress={() => setPad((state) => reduce(state, key))}
                onLongPress={key.value === 'back' ? () => setPad({ expr: '', fresh: false }) : undefined}
                style={({ pressed }) => [
                  styles.key,
                  { height, borderRadius: height / 2, backgroundColor: c.bg },
                  pressed && { opacity: 0.65, transform: [{ scale: 0.97 }] },
                ]}
              >
                <Text style={[styles.keyText, { color: c.fg, fontSize: key.kind === 'digit' ? 26 : 28 }]}>{key.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  display: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 12,
    justifyContent: 'flex-end',
    gap: 4,
  },
  expr: {
    textAlign: 'right',
    fontFamily: fonts.semibold,
    fontSize: 15,
    minHeight: 20,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
    gap: 8,
  },
  currency: {
    fontFamily: fonts.semibold,
    fontSize: 18,
  },
  value: {
    flexShrink: 1,
    fontFamily: fonts.bold,
    textAlign: 'right',
  },
  row: {
    flexDirection: 'row',
  },
  key: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontFamily: fonts.bold,
    includeFontPadding: false,
  },
});
