import { useMemo, useState, useEffect } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AmountPad } from '../components/AmountPad';
import { AccessBlockedModal } from '../components/GateModals';
import { ErrorText, Field, FillButton, Header, Screen } from '../components/ui';
import { useShopGate } from '../context/ShopGateContext';
import { useBooks } from '../context/BooksContext';
import { useI18n } from '../context/LocaleContext';
import { expenseCategoryMessage } from '../i18n';
import { expenseCategoriesForShop } from '../lib/expenseCategories';
import { closeToDashboard } from '../lib/navigation';
import { useResponsive } from '../lib/useResponsive';
import type { AppStackParamList } from '../navigation/types';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../theme/palettes';
import { useStyleSheet } from '../theme/useStyleSheet';
import { fonts } from '../theme/fonts';

export function AddExpenseScreen() {
  const styles = useStyleSheet(addExpenseStyles);
  const { colors } = useTheme();
  const { keySize } = useResponsive();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { canAccess } = useShopGate();
  const [blockedOpen, setBlockedOpen] = useState(false);
  const { t, messages } = useI18n();
  const { books, addExpense, addCustomExpenseCategory } = useBooks();
  const categories = useMemo(() => expenseCategoriesForShop(books.meta), [books.meta]);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Stock Purchase');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [categoryBusy, setCategoryBusy] = useState(false);

  useEffect(() => {
    if (!canAccess('addExpense')) setBlockedOpen(true);
  }, [canAccess]);

  async function save() {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await addExpense(Number(amount), category);
      setAmount('');
      setNotice(t((m) => m.expense.saved));
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
          contentContainerStyle={styles.categoryRow}
        >
          {categories.map((item) => {
            const selected = item === category;
            return (
              <Pressable
                key={item}
                onPress={() => setCategory(item)}
                style={[styles.category, selected && styles.categoryOn]}
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
        <FillButton
          label={t((m) => m.expense.save)}
          color={colors.expense}
          onPress={save}
          busy={busy}
        />
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        <ErrorText message={error} />
        <Pressable onPress={() => closeToDashboard(navigation)} style={styles.close}>
          <Text style={styles.closeText}>{t((m) => m.common.closeDashboard)}</Text>
        </Pressable>
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
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    paddingVertical: 2,
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
  notice: {
    textAlign: 'center',
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: c.expenseText,
  },
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
};
}
