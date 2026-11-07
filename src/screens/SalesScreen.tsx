import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useState } from 'react';
import { useNavigation, type CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { EditSaleModal, type SaleEdit } from '../components/EditSaleModal';
import { PrintButton } from '../components/PrintButton';
import { Toast, useToast } from '../components/Toast';
import { AnimatedIconPress } from '../components/AnimatedIconPress';
import { BackIcon, CalendarIcon, ChevronRightIcon, SaleIcon, TrendDuoIcon } from '../components/Icons';
import type { Sale } from '../data/types';
import { useRole } from '../lib/roles';
import { FillButton, Screen } from '../components/ui';
import { Designable } from '../devtools/designMode/Designable';
import { salesLayout } from '../designConfig/sales';
import { useAuth } from '../context/AuthContext';
import { useBooks } from '../context/BooksContext';
import { useTheme } from '../context/ThemeContext';
import { useVisibleBooks } from '../context/KitchenContext';
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
  const { colors } = useTheme();
  const { deleteSale, updateSale } = useBooks();
  const books = useVisibleBooks();
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

      <Designable screen="sales" id="hero" base={salesLayout.hero} offsetKey="marginTop">
        {(v) => (
          <LinearGradient
            colors={['#1D5FE0', '#3B82F6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.hero, { padding: v.padding, marginTop: v.marginTop, borderRadius: v.borderRadius }]}
          >
            <View style={styles.heroTop}>
              <AnimatedIconPress
                accessibilityRole="button"
                accessibilityLabel="Back"
                onPress={() => navigation.navigate('Home')}
                hitSlop={6}
                style={styles.heroBack}
              >
                <BackIcon color="#FFFFFF" />
              </AnimatedIconPress>
              <View style={styles.heroCopy}>
                <Text style={styles.heroTitle} numberOfLines={1}>
                  {t((m) => m.salesTab.title)}
                </Text>
                <Text style={styles.heroSubtitle} numberOfLines={1}>
                  Track your daily sales
                </Text>
              </View>
              <View style={styles.heroCountPill}>
                <Text style={styles.heroCountText} numberOfLines={1}>
                  {sales.length} {sales.length === 1 ? 'Sale' : 'Sales'}
                </Text>
              </View>
            </View>
            <Designable screen="sales" id="dateRow" base={salesLayout.dateRow} offsetKey="minHeight">
              {(dv) => (
                <View style={[styles.dateRow, { minHeight: dv.minHeight, borderRadius: dv.borderRadius }]}>
                  <AnimatedIconPress accessibilityLabel="Previous day" onPress={() => setDay((value) => value - DAY)} style={styles.step}>
                    <View style={{ transform: [{ rotate: '180deg' }] }}>
                      <ChevronRightIcon color="#FFFFFF" size={18} />
                    </View>
                  </AnimatedIconPress>
                  <Pressable
                    accessibilityLabel="Jump to today"
                    onPress={() => setDay(startOfDay(Date.now()))}
                    style={styles.dateCenter}
                  >
                    <CalendarIcon color="rgba(255,255,255,0.85)" size={15} />
                    <Text style={styles.dateText}>{isToday ? `Today · ${formatDay(day)}` : formatDay(day)}</Text>
                  </Pressable>
                  <AnimatedIconPress
                    accessibilityLabel="Next day"
                    disabled={isToday}
                    onPress={() => setDay((value) => Math.min(startOfDay(Date.now()), value + DAY))}
                    style={[styles.step, isToday && { opacity: 0.3 }]}
                  >
                    <ChevronRightIcon color="#FFFFFF" size={18} />
                  </AnimatedIconPress>
                </View>
              )}
            </Designable>
          </LinearGradient>
        )}
      </Designable>

      <View style={styles.body}>
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {sales.length === 0 ? (
            <Text style={styles.empty}>
              {t((m) => m.salesTab.empty)} {t((m) => m.salesTab.addFirst)}
            </Text>
          ) : (
            sales.map((sale) => (
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
                <View style={styles.rowThumb}>
                  <SaleIcon color={colors.brand} size={18} />
                </View>
                <View style={styles.rowMain}>
                  <View style={styles.rowCopy}>
                    <Text style={styles.invoice}>
                      {sale.invoiceNo
                        ? `${t((m) => m.salesTab.invoice)} ${sale.invoiceNo}`
                        : formatTime(sale.createdAt)}
                    </Text>
                    <Text style={styles.summary}>{saleSummaryLine(sale)}</Text>
                    {sale.soldByName ? (
                      <Text style={styles.summary} numberOfLines={1}>
                        {sale.soldByName}
                      </Text>
                    ) : null}
                    {sale.note ? (
                      <Text style={styles.summary} numberOfLines={1}>
                        📝 {sale.note}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <View style={styles.rowSide}>
                  <View style={styles.amountBadge}>
                    <Text style={styles.amount}>{formatRs(sale.amount)}</Text>
                  </View>
                  <View style={styles.actions}>
                    <PrintButton
                      iconOnly
                      phase={printingId === sale.id ? printFx.phase : 'idle'}
                      onPress={() => printSale(sale)}
                      label={t((m) => m.salesTab.print)}
                    />
                  </View>
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
        <View style={styles.footer}>
          <View style={styles.total}>
            <View style={styles.totalIconWrap}>
              <TrendDuoIcon color={colors.brand} size={18} />
            </View>
            <View style={styles.totalCopy}>
              <Text style={styles.totalLabel}>{t((m) => m.salesTab.total)}</Text>
              <Text style={styles.totalValue}>{formatRs(total)}</Text>
            </View>
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
  hero: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    borderRadius: 24,
    padding: 18,
    gap: 14,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroBack: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: {
    flex: 1,
    gap: 2,
  },
  heroTitle: {
    fontFamily: fonts.bold,
    fontSize: 21,
    color: '#FFFFFF',
  },
  heroSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
  },
  heroCountPill: {
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  heroCountText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 12,
  },
  dateRow: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateCenter: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dateText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  step: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
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
    minHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: c.rowLine,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  rowThumb: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: `${c.brand}1A`,
    alignItems: 'center',
    justifyContent: 'center',
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
  rowSide: {
    alignItems: 'flex-end',
    gap: 6,
  },
  amountBadge: {
    borderRadius: 10,
    backgroundColor: `${c.brand}14`,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  amount: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: c.brand,
  },
  footer: {
    gap: 12,
  },
  total: {
    borderRadius: 14,
    backgroundColor: c.gradientTop,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  totalIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: `${c.brand}1F`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalCopy: {
    flex: 1,
    gap: 1,
  },
  totalLabel: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: c.muted,
  },
  totalValue: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: c.profitText,
  },
  actions: { alignItems: 'flex-end', gap: 6 },
};
}
