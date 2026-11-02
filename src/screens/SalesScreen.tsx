import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useState } from 'react';
import { useNavigation, type CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { EditSaleModal, type SaleEdit } from '../components/EditSaleModal';
import { PrintButton } from '../components/PrintButton';
import { Toast, useToast } from '../components/Toast';
import type { Sale } from '../data/types';
import { useRole } from '../lib/roles';
import { FillButton, Header, Screen } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useBooks } from '../context/BooksContext';
import { useI18n } from '../context/LocaleContext';
import { confirmDelete } from '../lib/confirm';
import { formatDay, formatRs, formatTime, isSameDay, startOfDay, sum } from '../lib/format';
import { printOrShareReceipt } from '../lib/printReceipt';
import { usePrintFeedback } from '../lib/usePrintFeedback';
import { saleSummaryLine } from '../lib/receipt';
import type { AppStackParamList, TabParamList } from '../navigation/types';
import type { ColorPalette } from '../theme/palettes';
import { useStyleSheet } from '../theme/useStyleSheet';
import { fonts } from '../theme/fonts';

const DAY = 24 * 60 * 60 * 1000;

export function SalesScreen() {
  const styles = useStyleSheet(salesStyles);
  const navigation = useNavigation<CompositeNavigationProp<
    BottomTabNavigationProp<TabParamList, 'Sales'>,
    NativeStackNavigationProp<AppStackParamList>
  >>();
  const { user } = useAuth();
  const { books, deleteSale, updateSale } = useBooks();
  const toast = useToast();
  const { can } = useRole();
  const [editing, setEditing] = useState<Sale | null>(null);
  const { t } = useI18n();
  const [day, setDay] = useState(() => startOfDay(Date.now()));
  const printFx = usePrintFeedback();
  const [printingId, setPrintingId] = useState<string | null>(null);
  const sales = books.sales
    .filter((sale) => isSameDay(sale.createdAt, day))
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt);
  const total = sum(sales);
  const isToday = day === startOfDay(Date.now());

  async function printSale(sale: (typeof sales)[number]) {
    setPrintingId(sale.id);
    const result = await printFx.run(() => printOrShareReceipt(user?.shopName ?? 'KadaBook', sale));
    if (result && !result.ok) {
      Alert.alert(t((m) => m.settings.printFailed), result.message);
    }
  }

  async function saveEdit(edit: SaleEdit) {
    if (!editing) return;
    await updateSale(editing.id, edit);
    const moved = !isSameDay(edit.createdAt, editing.createdAt);
    setEditing(null);
    toast.show('success', moved ? `Sale moved to ${formatDay(edit.createdAt)}` : 'Sale updated');
  }

  return (
    <Screen>
      <EditSaleModal sale={editing} onClose={() => setEditing(null)} onSave={saveEdit} />
      <Header title={t((m) => m.salesTab.title)} onBack={() => navigation.navigate('Home')} />
      <View style={styles.body}>
        <View style={styles.dateRow}>
          <Pressable accessibilityLabel="Previous day" onPress={() => setDay((value) => value - DAY)} style={styles.step}>
            <Text style={styles.stepLabel}>‹</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Jump to today"
            onPress={() => setDay(startOfDay(Date.now()))}
            style={styles.dateCenter}
          >
            <Text style={styles.dateText}>{isToday ? `Today · ${formatDay(day)}` : formatDay(day)}</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Next day"
            disabled={isToday}
            onPress={() => setDay((value) => Math.min(startOfDay(Date.now()), value + DAY))}
            style={[styles.step, isToday && { opacity: 0.3 }]}
          >
            <Text style={styles.stepLabel}>›</Text>
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
                onPress={() => can('editSale') && setEditing(sale)}
                onLongPress={() =>
                  can('deleteSale') &&
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
                    {sale.note ? (
                      <Text style={styles.summary} numberOfLines={1}>
                        📝 {sale.note}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <Text style={styles.amount}>{formatRs(sale.amount)}</Text>
                <View style={styles.actions}>
                  <PrintButton
                    compact
                    phase={printingId === sale.id ? printFx.phase : 'idle'}
                    onPress={() => printSale(sale)}
                    label={t((m) => m.salesTab.print)}
                  />
                </View>
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
      <Toast toast={toast.toast} onHide={toast.hide} />
    </Screen>
  );
}

function salesStyles(c: ColorPalette) {
  return {
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateCenter: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: c.ink,
    textAlign: 'center',
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
  actions: { alignItems: 'flex-end', gap: 6 },
};
}
