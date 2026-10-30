import { Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Header, Screen } from '../components/ui';
import { useBooks } from '../context/BooksContext';
import { useI18n } from '../context/LocaleContext';
import { expenseCategoryMessage } from '../i18n';
import { confirmDelete } from '../lib/confirm';
import { formatRs, formatTime, isSameDay } from '../lib/format';
import type { ColorPalette } from '../theme/palettes';
import { useStyleSheet } from '../theme/useStyleSheet';
import { fonts } from '../theme/fonts';

export function NotificationsScreen() {
  const styles = useStyleSheet(notificationsStyles);
  const navigation = useNavigation();
  const { books, deleteSale, deleteExpense } = useBooks();
  const { t, messages } = useI18n();
  const now = Date.now();
  const items = [
    ...books.sales
      .filter((sale) => isSameDay(sale.createdAt, now))
      .map((sale) => ({ id: `s-${sale.id}`, kind: 'Sale' as const, amount: sale.amount, at: sale.createdAt, rawId: sale.id })),
    ...books.expenses
      .filter((expense) => isSameDay(expense.createdAt, now))
      .map((expense) => ({
        id: `e-${expense.id}`,
        kind: expense.category,
        amount: expense.amount,
        at: expense.createdAt,
        rawId: expense.id,
      })),
  ].sort((a, b) => b.at - a.at);

  function kindLabel(kind: 'Sale' | string) {
    if (kind === 'Sale') return t((m) => m.notifications.kindSale);
    return expenseCategoryMessage(messages, kind);
  }

  return (
    <Screen>
      <Header title={t((m) => m.notifications.title)} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        {items.length === 0 ? (
          <Text style={styles.empty}>{t((m) => m.notifications.empty)}</Text>
        ) : (
          items.map((item) => (
            <Pressable
              key={item.id}
              onLongPress={() =>
                confirmDelete({
                  title:
                    item.kind === 'Sale'
                      ? t((m) => m.common.deleteSale)
                      : t((m) => m.common.deleteExpense),
                  message: t((m) => m.common.deleteBody),
                  cancel: t((m) => m.common.cancel),
                  deleteLabel: t((m) => m.common.delete),
                  onDelete: () => {
                    if (item.kind === 'Sale') deleteSale(item.rawId);
                    else deleteExpense(item.rawId);
                  },
                })
              }
              style={styles.row}
            >
              <View style={styles.copy}>
                <Text style={styles.kind}>{kindLabel(item.kind)}</Text>
                <Text style={styles.time}>{formatTime(item.at)}</Text>
              </View>
              <Text style={[styles.amount, item.kind !== 'Sale' && styles.expense]}>{formatRs(item.amount)}</Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

function notificationsStyles(c: ColorPalette) {
  return {
  body: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  empty: {
    marginTop: 24,
    textAlign: 'center',
    fontFamily: fonts.regular,
    fontSize: 14,
    color: c.muted,
  },
  row: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: c.rowLine,
  },
  copy: {
    flex: 1,
  },
  kind: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: c.ink,
  },
  time: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.muted,
  },
  amount: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: c.saleText,
  },
  expense: {
    color: c.expenseText,
  },
};
}
