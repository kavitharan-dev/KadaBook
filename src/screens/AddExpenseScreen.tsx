import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CalculatorPad as AmountPad } from '../components/CalculatorPad';
import { AccessBlockedModal } from '../components/GateModals';
import { ErrorText, Field, FillButton, Header, Screen } from '../components/ui';
import { useShopGate } from '../context/ShopGateContext';
import { useBooks } from '../context/BooksContext';
import { useKitchen } from '../context/KitchenContext';
import { useI18n } from '../context/LocaleContext';
import { expenseCategoryMessage } from '../i18n';
import { formatRs, formatTime, startOfDay } from '../lib/format';
import { expenseCategoriesForShop } from '../lib/expenseCategories';
import { closeToDashboard } from '../lib/navigation';
import { useResponsive } from '../lib/useResponsive';
import type { AppStackParamList } from '../navigation/types';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../theme/palettes';
import { useStyleSheet } from '../theme/useStyleSheet';
import { fonts } from '../theme/fonts';

const KNOWN_COLORS: Record<string, string> = {
  'Stock Purchase': '#C2410C',
  Transport: '#2563EB',
  Other: '#6B7280',
};
const PALETTE = ['#0F766E', '#7C3AED', '#BE185D', '#4D7C0F', '#B45309', '#0369A1'];

/** Each category keeps its own colour so the chips are easy to tell apart. */
function categoryColor(name: string) {
  if (KNOWN_COLORS[name]) return KNOWN_COLORS[name];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export function AddExpenseScreen() {
  const styles = useStyleSheet(addExpenseStyles);
  const { colors } = useTheme();
  const { keySize } = useResponsive();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { canAccess } = useShopGate();
  const [blockedOpen, setBlockedOpen] = useState(false);
  const { t, messages } = useI18n();
  const { books, addExpense, addCustomExpenseCategory } = useBooks();
  const kitchen = useKitchen();
  const categories = useMemo(() => expenseCategoriesForShop(books.meta), [books.meta]);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Stock Purchase');
  const [note, setNote] = useState('');
  const [when, setWhen] = useState<'today' | 'yesterday'>('today');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedSlip, setSavedSlip] = useState<{ amount: number; category: string } | null>(null);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [categoryBusy, setCategoryBusy] = useState(false);
  const slipScale = useRef(new Animated.Value(0.85)).current;
  const slipOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!canAccess('addExpense')) setBlockedOpen(true);
  }, [canAccess]);

  useEffect(() => {
    if (!savedSlip) return;
    slipScale.setValue(0.85);
    slipOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(slipScale, { toValue: 1, useNativeDriver: true, friction: 6 }),
      Animated.timing(slipOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
    const timer = setTimeout(() => setSavedSlip(null), 1800);
    return () => clearTimeout(timer);
  }, [savedSlip, slipOpacity, slipScale]);

  function expenseCreatedAt() {
    const now = Date.now();
    if (when === 'today') return now;
    return startOfDay(now) - 24 * 60 * 60 * 1000 + (now - startOfDay(now));
  }

  async function save() {
    setError(null);
    setBusy(true);
    const value = Number(amount);
    try {
      await addExpense(value, category, {
        note: note.trim() || undefined,
        createdAt: expenseCreatedAt(),
        ...(kitchen.activeBranchId ? { branchId: kitchen.activeBranchId } : {}),
      });
      setAmount('');
      setNote('');
      setWhen('today');
      setSavedSlip({ amount: Math.round(value), category });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t((m) => m.expense.errorSave));
    } finally {
      setBusy(false);
    }
  }

  async function saveNewCategory() {
    setError(null);
    setCategoryBusy(true);
    try {
      const label = await addCustomExpenseCategory(newCategory);
      setCategory(label);
      setNewCategory('');
      setAddingCategory(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t((m) => m.expense.errorSave));
    } finally {
      setCategoryBusy(false);
    }
  }

  return (
    <Screen>
      <AccessBlockedModal
        visible={blockedOpen}
        onClose={() => {
          setBlockedOpen(false);
          closeToDashboard(navigation);
        }}
      />
      <Header
        title={t((m) => m.expense.title)}
        onBack={() => closeToDashboard(navigation)}
      />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryRow}
        >
          {categories.map((item) => {
            const selected = item === category;
            return (
              <Pressable
                key={item}
                onPress={() => setCategory(item)}
                style={[styles.category, selected && { backgroundColor: categoryColor(item) }]}
              >
                <Text style={[styles.categoryText, selected && styles.categoryTextOn]} numberOfLines={2}>
                  {expenseCategoryMessage(messages, item)}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t((m) => m.expense.addCategoryA11y)}
            onPress={() => {
              setAddingCategory(true);
              setError(null);
            }}
            style={[styles.category, styles.categoryAdd]}
          >
            <Text style={[styles.categoryAddText, { color: colors.brand }]}>+</Text>
          </Pressable>
        </ScrollView>
        {addingCategory ? (
          <View style={styles.newCategoryRow}>
            <Field
              value={newCategory}
              onChangeText={setNewCategory}
              placeholder={t((m) => m.expense.addCategoryPlaceholder)}
              autoFocus
            />
            <FillButton
              label={t((m) => m.expense.addCategory)}
              color={colors.expense}
              onPress={saveNewCategory}
              busy={categoryBusy}
              disabled={!newCategory.trim()}
            />
          </View>
        ) : null}
        <AmountPad amount={amount} onChange={setAmount} keyHeight={keySize} keyGap={10} />
        <Field value={note} onChangeText={setNote} placeholder="Note (optional)" />
        <View style={styles.dateRow}>
          {(['today', 'yesterday'] as const).map((item) => {
            const on = when === item;
            return (
              <Pressable
                key={item}
                onPress={() => setWhen(item)}
                style={[styles.dateChip, { backgroundColor: on ? colors.expense : colors.keypad }]}
              >
                <Text style={[styles.dateChipText, { color: on ? colors.onFill : colors.ink }]}>
                  {item === 'today' ? 'Today' : 'Yesterday'}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <FillButton label={t((m) => m.expense.save)} color={categoryColor(category)} onPress={save} busy={busy} />
        <ErrorText message={error} />
        {savedSlip ? (
          <Animated.View style={[styles.slip, { backgroundColor: colors.expenseWash, opacity: slipOpacity, transform: [{ scale: slipScale }] }]}>
            <Text style={[styles.slipTitle, { color: colors.expenseText }]}>{t((m) => m.expense.saved)}</Text>
            <Text style={[styles.slipAmount, { color: colors.ink }]}>{formatRs(savedSlip.amount)}</Text>
            <Text style={[styles.slipMeta, { color: colors.muted }]}>{expenseCategoryMessage(messages, savedSlip.category)}</Text>
          </Animated.View>
        ) : null}
        {books.expenses.length > 0 ? (
          <View style={styles.recent}>
            <Text style={styles.recentTitle}>Recent expenses</Text>
            {books.expenses.slice(0, 3).map((expense) => (
              <View key={expense.id} style={styles.recentRow}>
                <View style={[styles.recentDot, { backgroundColor: categoryColor(expense.category) }]} />
                <View style={styles.recentCopy}>
                  <Text style={styles.recentName}>{expenseCategoryMessage(messages, expense.category)}</Text>
                  <Text style={styles.recentTime}>{formatTime(expense.createdAt)}</Text>
                </View>
                <Text style={styles.recentAmount}>{formatRs(expense.amount)}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function addExpenseStyles(c: ColorPalette) {
  return {
  body: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 14,
    flexGrow: 1,
  },
  categoryScroll: {
    flexGrow: 0,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    paddingVertical: 2,
    paddingRight: 16,
  },
  category: {
    minWidth: 96,
    maxWidth: 140,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: c.keypad,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  categoryOn: {
    backgroundColor: c.expense,
  },
  categoryAdd: {
    minWidth: 52,
    maxWidth: 52,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.white,
  },
  categoryAddText: {
    fontFamily: fonts.bold,
    fontSize: 26,
    lineHeight: 30,
  },
  categoryText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: c.ink,
    textAlign: 'center',
  },
  categoryTextOn: {
    color: c.onFill,
  },
  newCategoryRow: {
    gap: 10,
  },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.45)' },
  backdropTap: { flex: 1 },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, gap: 10, maxHeight: '88%' },
  sheetTitle: { fontFamily: fonts.bold, fontSize: 18 },
  sheetAmount: { fontFamily: fonts.bold, fontSize: 28 },
  fieldLabel: { fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 0.4 },
  dropdown: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownText: { fontFamily: fonts.semibold, fontSize: 15 },
  menu: { maxHeight: 180, borderRadius: 12 },
  menuRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10 },
  link: { fontFamily: fonts.semibold, fontSize: 14 },
  dateRow: { flexDirection: 'row', gap: 8 },
  dateChip: { flex: 1, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  dateChipText: { fontFamily: fonts.semibold, fontSize: 14 },
  slip: { borderRadius: 16, padding: 16, alignItems: 'center', gap: 4 },
  slipTitle: { fontFamily: fonts.semibold, fontSize: 14 },
  slipAmount: { fontFamily: fonts.bold, fontSize: 28 },
  slipMeta: { fontFamily: fonts.regular, fontSize: 13 },
  close: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: c.brand,
  },
  recent: {
    gap: 8,
    marginTop: 4,
  },
  recentTitle: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: c.muted,
  },
  recentRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.rowLine,
  },
  recentDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  recentCopy: {
    flex: 1,
  },
  recentName: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: c.ink,
  },
  recentTime: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.muted,
  },
  recentAmount: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: c.expenseText,
  },
};
}
