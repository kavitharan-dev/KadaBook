import { Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Header, Screen } from '../components/ui';
import { useBooks } from '../context/BooksContext';
import { useVisibleBooks } from '../context/KitchenContext';
import { useI18n } from '../context/LocaleContext';
import { expenseCategoryMessage } from '../i18n';
import { confirmDelete } from '../lib/confirm';
import { formatDay, formatRs, formatTime, sum } from '../lib/format';
import type { ColorPalette } from '../theme/palettes';
import { useStyleSheet } from '../theme/useStyleSheet';
import { fonts } from '../theme/fonts';

export function MonthScreen() {
  const styles = useStyleSheet(listsStyles);
  const navigation = useNavigation();
  const { deleteSale, deleteExpense } = useBooks();
  const books = useVisibleBooks();
  const { t, messages } = useI18n();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const sales = books.sales.filter((sale) => sale.createdAt >= monthStart);
  const expenses = books.expenses.filter((expense) => expense.createdAt >= monthStart);

  const confirmOpts = {
    message: t((m) => m.common.deleteBody),
    cancel: t((m) => m.common.cancel),
    deleteLabel: t((m) => m.common.delete),
  };

  return (
    <Screen>
      <Header title={t((m) => m.lists.thisMonth)} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.summary}>
          <Text style={styles.summaryText}>
            {t((m) => m.lists.sales)} {formatRs(sum(sales))}
          </Text>
          <Text style={styles.summaryText}>
            {t((m) => m.lists.expenses)} {formatRs(sum(expenses))}
          </Text>
        </View>
        <Text style={styles.heading}>{t((m) => m.lists.sales)}</Text>
        {sales.length === 0 ? <Text style={styles.empty}>{t((m) => m.lists.noSalesMonth)}</Text> : null}
        {sales.map((sale) => (
          <Pressable
            key={sale.id}
            onLongPress={() =>
              confirmDelete({
                title: t((m) => m.common.deleteSale),
                ...confirmOpts,
                onDelete: () => deleteSale(sale.id),
              })
            }
            style={styles.row}
          >
            <Text style={styles.meta}>
              {formatDay(sale.createdAt)} · {formatTime(sale.createdAt)}
            </Text>
            <Text style={styles.sale}>{formatRs(sale.amount)}</Text>
          </Pressable>
        ))}
        <Text style={styles.heading}>{t((m) => m.lists.expenses)}</Text>
        {expenses.length === 0 ? <Text style={styles.empty}>{t((m) => m.lists.noExpensesMonth)}</Text> : null}
        {expenses.map((expense) => (
          <Pressable
            key={expense.id}
            onLongPress={() =>
              confirmDelete({
                title: t((m) => m.common.deleteExpense),
                ...confirmOpts,
                onDelete: () => deleteExpense(expense.id),
              })
            }
            style={styles.row}
          >
            <View>
              <Text style={styles.name}>{expenseCategoryMessage(messages, expense.category)}</Text>
              <Text style={styles.meta}>
                {formatDay(expense.createdAt)} · {formatTime(expense.createdAt)}
              </Text>
            </View>
            <Text style={styles.expense}>{formatRs(expense.amount)}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}

export function ExpensesScreen() {
  const styles = useStyleSheet(listsStyles);
  const navigation = useNavigation();
  const { deleteExpense } = useBooks();
  const books = useVisibleBooks();
  const { t, messages } = useI18n();

  return (
    <Screen>
      <Header title={t((m) => m.lists.expensesTitle)} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        {books.expenses.length === 0 ? <Text style={styles.empty}>{t((m) => m.lists.noExpenses)}</Text> : null}
        {books.expenses.map((expense) => (
          <Pressable
            key={expense.id}
            onLongPress={() =>
              confirmDelete({
                title: t((m) => m.common.deleteExpense),
                message: t((m) => m.common.deleteBody),
                cancel: t((m) => m.common.cancel),
                deleteLabel: t((m) => m.common.delete),
                onDelete: () => deleteExpense(expense.id),
              })
            }
            style={styles.row}
          >
            <View>
              <Text style={styles.name}>{expenseCategoryMessage(messages, expense.category)}</Text>
              <Text style={styles.meta}>
                {formatDay(expense.createdAt)} · {formatTime(expense.createdAt)}
              </Text>
            </View>
            <Text style={styles.expense}>{formatRs(expense.amount)}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}

function listsStyles(c: ColorPalette) {
  return {
  body: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    gap: 8,
  },
  summary: {
    borderRadius: 14,
    backgroundColor: c.gradientTop,
    padding: 16,
    gap: 4,
  },
  summaryText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: c.ink,
  },
  heading: {
    marginTop: 8,
    fontFamily: fonts.bold,
    fontSize: 16,
    color: c.ink,
  },
  empty: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: c.muted,
  },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: c.rowLine,
    gap: 12,
  },
  name: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: c.ink,
  },
  meta: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.muted,
  },
  sale: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: c.saleText,
  },
  expense: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: c.expenseText,
  },
};
}
