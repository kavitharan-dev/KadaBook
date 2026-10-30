import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CalendarIcon } from '../components/Icons';
import { FillButton, Screen } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useBooks } from '../context/BooksContext';
import { useI18n } from '../context/LocaleContext';
import { confirmDelete } from '../lib/confirm';
import { formatDay, formatRs, formatTime, isSameDay, startOfDay, sum } from '../lib/format';
import { printOrShareReceipt } from '../lib/printReceipt';
import { saleSummaryLine } from '../lib/receipt';
import type { AppStackParamList } from '../navigation/types';
import type { ColorPalette } from '../theme/palettes';
import { useStyleSheet } from '../theme/useStyleSheet';
import { fonts } from '../theme/fonts';

const DAY = 24 * 60 * 60 * 1000;

export function SalesScreen() {
  const styles = useStyleSheet(salesStyles);
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { user } = useAuth();
  const { books, deleteSale } = useBooks();
  const { t } = useI18n();
  const [day, setDay] = useState(() => startOfDay(Date.now()));
  const sales = books.sales
    .filter((sale) => isSameDay(sale.createdAt, day))
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt);
  const total = sum(sales);
  const isToday = day === startOfDay(Date.now());

  async function printSale(sale: (typeof sales)[number]) {
    const result = await printOrShareReceipt(user?.shopName ?? 'KadaBook', sale);
    if (!result.ok) {
      Alert.alert(t((m) => m.settings.printFailed), result.message);
    }
  }

  return (
    <Screen>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{t((m) => m.salesTab.title)}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.dateRow}>
          <Pressable accessibilityLabel="Previous day" onPress={() => setDay((value) => value - DAY)} style={styles.step}>
            <Text style={styles.stepLabel}>‹</Text>
          </Pressable>
          <Text style={styles.dateText}>{isToday ? formatDay(day) : formatDay(day)}</Text>
          <Pressable
            accessibilityLabel="Next day"
            onPress={() => setDay((value) => Math.min(startOfDay(Date.now()), value + DAY))}
            style={styles.step}
          >
            <CalendarIcon />
          </Pressable>
        </View>
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {sales.length === 0 ? (
            <Text style={styles.empty}>
              {t((m) => m.salesTab.empty)} {t((m) => m.salesTab.addFirst)}
            </Text>
          ) : (
            sales.map((sale, index) => (
              <Pressable
                key={sale.id}
                onLongPress={() =>
                  confirmDelete({
                    title: t((m) => m.common.deleteSale),
                    message: t((m) => m.common.deleteBody),
                    cancel: t((m) => m.common.cancel),
                    deleteLabel: t((m) => m.common.delete),
                    onDelete: () => deleteSale(sale.id),
                  })
                }
                style={styles.row}
              >
                <View style={styles.rowMain}>
                  <Text style={styles.index}>{index + 1}</Text>
                  <View style={styles.rowCopy}>
                    <Text style={styles.invoice}>
                      {sale.invoiceNo
                        ? `${t((m) => m.salesTab.invoice)} ${sale.invoiceNo}`
                        : formatTime(sale.createdAt)}
                    </Text>
                    <Text style={styles.summary}>{saleSummaryLine(sale)}</Text>
                  </View>
                </View>
                <Text style={styles.amount}>{formatRs(sale.amount)}</Text>
                <Pressable onPress={() => printSale(sale)} style={styles.printBtn}>
                  <Text style={styles.printLabel}>{t((m) => m.salesTab.print)}</Text>
                </Pressable>
              </Pressable>
            ))
          )}
        </ScrollView>
        <View style={styles.footer}>
          <View style={styles.total}>
            <Text style={styles.totalLabel}>{t((m) => m.salesTab.total)}</Text>
            <Text style={styles.totalValue}>{formatRs(total)}</Text>
          </View>
          <FillButton label={t((m) => m.home.newSale)} onPress={() => navigation.navigate('NewSale')} />
        </View>
      </View>
    </Screen>
  );
}

function salesStyles(c: ColorPalette) {
  return {
  titleRow: {
    minHeight: 56,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 19,
    color: c.ink,
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 12,
  },
  dateRow: {
    height: 46,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 12,
    paddingLeft: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: c.ink,
  },
  step: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: {
    fontSize: 22,
    color: c.ink,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 8,
  },
  empty: {
    marginTop: 24,
    textAlign: 'center',
    fontFamily: fonts.regular,
    fontSize: 14,
    color: c.muted,
  },
  row: {
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: c.rowLine,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  index: {
    width: 22,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: c.muted,
  },
  invoice: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: c.ink,
  },
  summary: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: c.muted,
  },
  amount: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: c.ink,
  },
  printBtn: {
    paddingHorizontal: 8,
    minHeight: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  printLabel: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: c.brand,
  },
  footer: {
    gap: 12,
  },
  total: {
    borderRadius: 14,
    backgroundColor: c.gradientTop,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: c.ink,
  },
  totalValue: {
    fontFamily: fonts.bold,
    fontSize: 19,
    color: c.profitText,
  },
};
}
