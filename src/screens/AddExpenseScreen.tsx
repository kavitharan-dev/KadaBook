import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
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
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [savedSlip, setSavedSlip] = useState<{ amount: number; category: string } | null>(null);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [categoryBusy, setCategoryBusy] = useState(false);
  const slipScale = useRef(new Animated.Value(0.85)).current;
  const slipOpacity = useRef(new Animated.Value(0)).current;

  const amountValue = Math.round(Number(amount) || 0);

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

  function openDetails() {
    setError(null);
    if (!amountValue || amountValue <= 0) {
      setError('Enter an expense amount first.');
      return;
    }
    setMenuOpen(false);
    setAddingCategory(false);
    setDetailsOpen(true);
  }

  function closeDetails() {
    setDetailsOpen(false);
    setMenuOpen(false);
    setAddingCategory(false);
  }

  async function save() {
    setError(null);
    setBusy(true);
    try {
      await addExpense(amountValue, category, {
        note: note.trim() || undefined,
        createdAt: expenseCreatedAt(),
        ...(kitchen.activeBranchId ? { branchId: kitchen.activeBranchId } : {}),
      });
      setAmount('');
      setNote('');
      setWhen('today');
      setSavedSlip({ amount: amountValue, category });
      closeDetails();
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
      setMenuOpen(false);
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
      <Header title={t((m) => m.expense.title)} onBack={() => closeToDashboard(navigation)} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <AmountPad amount={amount} onChange={setAmount} keyHeight={keySize} keyGap={10} />
        <FillButton
          label="Continue"
          color={colors.expense}
          onPress={openDetails}
          disabled={!amountValue}
        />
        <ErrorText message={!detailsOpen ? error : null} />
        {savedSlip ? (
          <Animated.View
            style={[
              styles.slip,
              {
                backgroundColor: colors.expenseWash,
                opacity: slipOpacity,
                transform: [{ scale: slipScale }],
              },
            ]}
          >
            <Text style={[styles.slipTitle, { color: colors.expenseText }]}>{t((m) => m.expense.saved)}</Text>
            <Text style={[styles.slipAmount, { color: colors.ink }]}>{formatRs(savedSlip.amount)}</Text>
            <Text style={[styles.slipMeta, { color: colors.muted }]}>
              {expenseCategoryMessage(messages, savedSlip.category)}
            </Text>
          </Animated.View>
        ) : null}
        {books.expenses.length > 0 ? (
          <View style={styles.recent}>
            <Text style={styles.recentTitle}>Recent expenses</Text>
            {books.expenses.slice(0, 5).map((expense) => (
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

      <Modal visible={detailsOpen} transparent animationType="slide" onRequestClose={closeDetails}>
        <View style={styles.backdrop}>
          <Pressable style={styles.backdropTap} onPress={closeDetails} />
          <View style={[styles.sheet, { backgroundColor: colors.white }]}>
            <Text style={[styles.sheetTitle, { color: colors.ink }]}>Expense details</Text>
            <Text style={[styles.sheetAmount, { color: colors.expenseText }]}>{formatRs(amountValue)}</Text>

            <Text style={[styles.fieldLabel, { color: colors.muted }]}>CATEGORY</Text>
            <Pressable
              onPress={() => {
                setMenuOpen((open) => !open);
                setAddingCategory(false);
              }}
              style={[styles.dropdown, { borderColor: colors.line, backgroundColor: colors.keypad }]}
            >
              <View style={styles.dropdownLeft}>
                <View style={[styles.menuDot, { backgroundColor: categoryColor(category) }]} />
                <Text style={[styles.dropdownText, { color: colors.ink }]}>
                  {expenseCategoryMessage(messages, category)}
                </Text>
              </View>
              <Text style={[styles.chevron, { color: colors.muted }]}>{menuOpen ? '▴' : '▾'}</Text>
            </Pressable>

            {menuOpen ? (
              <ScrollView
                style={[styles.menu, { backgroundColor: colors.keypad, borderColor: colors.line }]}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                {categories.map((item) => {
                  const selected = item === category;
                  return (
                    <Pressable
                      key={item}
                      onPress={() => {
                        setCategory(item);
                        setMenuOpen(false);
                      }}
                      style={[
                        styles.menuRow,
                        selected && { backgroundColor: categoryColor(item) },
                      ]}
                    >
                      <View
                        style={[
                          styles.menuDot,
                          { backgroundColor: selected ? '#fff' : categoryColor(item) },
                        ]}
                      />
                      <Text
                        style={[
                          styles.menuText,
                          { color: selected ? '#fff' : colors.ink },
                        ]}
                      >
                        {expenseCategoryMessage(messages, item)}
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  onPress={() => {
                    setAddingCategory(true);
                    setMenuOpen(false);
                  }}
                  style={styles.menuRow}
                >
                  <Text style={[styles.link, { color: colors.brand }]}>
                    + {t((m) => m.expense.addCategory)}
                  </Text>
                </Pressable>
              </ScrollView>
            ) : null}

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

            <Text style={[styles.fieldLabel, { color: colors.muted }]}>NOTE</Text>
            <Field value={note} onChangeText={setNote} placeholder="Note (optional)" />

            <Text style={[styles.fieldLabel, { color: colors.muted }]}>DATE</Text>
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

            <ErrorText message={error} />
            <FillButton
              label={t((m) => m.expense.save)}
              color={categoryColor(category)}
              onPress={save}
              busy={busy}
            />
            <Pressable onPress={closeDetails} style={styles.close}>
              <Text style={styles.closeText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
    newCategoryRow: {
      gap: 10,
    },
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(15,23,42,0.45)',
    },
    backdropTap: { flex: 1 },
    sheet: {
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 28,
      gap: 10,
      maxHeight: '92%' as unknown as number,
    },
    sheetTitle: { fontFamily: fonts.bold, fontSize: 18 },
    sheetAmount: { fontFamily: fonts.bold, fontSize: 32, marginBottom: 4 },
    fieldLabel: {
      fontFamily: fonts.semibold,
      fontSize: 11,
      letterSpacing: 0.6,
      marginTop: 4,
    },
    dropdown: {
      minHeight: 52,
      borderWidth: 1,
      borderRadius: 14,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    dropdownLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    dropdownText: { fontFamily: fonts.semibold, fontSize: 16, flexShrink: 1 },
    chevron: { fontFamily: fonts.bold, fontSize: 14 },
    menu: {
      maxHeight: 200,
      borderRadius: 14,
      borderWidth: 1,
      overflow: 'hidden',
    },
    menuRow: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
    },
    menuDot: { width: 10, height: 10, borderRadius: 5 },
    menuText: { fontFamily: fonts.semibold, fontSize: 15, flex: 1 },
    link: { fontFamily: fonts.semibold, fontSize: 15 },
    dateRow: { flexDirection: 'row', gap: 8 },
    dateChip: {
      flex: 1,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
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
    recent: { gap: 8, marginTop: 4 },
    recentTitle: { fontFamily: fonts.semibold, fontSize: 13, color: c.muted },
    recentRow: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.rowLine,
    },
    recentDot: { width: 10, height: 10, borderRadius: 5 },
    recentCopy: { flex: 1 },
    recentName: { fontFamily: fonts.semibold, fontSize: 14, color: c.ink },
    recentTime: { fontFamily: fonts.regular, fontSize: 12, color: c.muted },
    recentAmount: { fontFamily: fonts.bold, fontSize: 14, color: c.expenseText },
  };
}
