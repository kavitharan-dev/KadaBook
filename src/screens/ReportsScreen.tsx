import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation, type CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MenuIcon } from '../components/Icons';
import { AccessBlockedModal } from '../components/GateModals';
import { FillButton, Screen } from '../components/ui';
import { useShopGate } from '../context/ShopGateContext';
import { useBooks } from '../context/BooksContext';
import { useFeature } from '../context/RemoteConfigContext';
import { useI18n } from '../context/LocaleContext';
import { expenseCategoryMessage } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { formatDay, formatRs, formatTime, sum } from '../lib/format';
import { buildLowStockReportText } from '../lib/receipt';
import { buildPeriodReportText, periodReportTitle } from '../lib/periodReport';
import { printTextReport } from '../lib/printReceipt';
import { lowStockProducts } from '../lib/stockCart';
import { chartBars, periodExpenses, periodRange } from '../lib/stats';
import type { AppStackParamList, TabParamList } from '../navigation/types';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../theme/palettes';
import { useStyleSheet } from '../theme/useStyleSheet';
import { fonts } from '../theme/fonts';

const MODES = ['daily', 'weekly', 'monthly'] as const;
type Mode = (typeof MODES)[number];

export function ReportsScreen() {
  const styles = useStyleSheet(reportsStyles);
  const { colors } = useTheme();
  const categoryWash = {
    'Stock Purchase': colors.expenseWash,
    Transport: colors.gradientTop,
    Other: colors.keypad,
  } as const;
  const navigation = useNavigation<CompositeNavigationProp<
    BottomTabNavigationProp<TabParamList, 'Reports'>,
    NativeStackNavigationProp<AppStackParamList>
  >>();
  const { books } = useBooks();
  const reportsOn = useFeature('reports');
  const exportOn = useFeature('export');
  const { canAccess } = useShopGate();
  const [blockedOpen, setBlockedOpen] = useState(false);
  const { user } = useAuth();
  const { t, messages } = useI18n();
  const [mode, setMode] = useState<Mode>('daily');
  const now = Date.now();
  const range = periodRange(mode, now);
  const sales = books.sales.filter((sale) => sale.createdAt >= range.start && sale.createdAt < range.end);
  const expenses = periodExpenses(books.expenses, mode, now);
  const salesTotal = sum(sales);
  const expenseTotal = sum(expenses);
  const bars = chartBars(books.sales, mode, now);
  const max = Math.max(1, ...bars.map((bar) => bar.value));
  const recent = books.expenses.slice(0, 3);
  const lowStock = lowStockProducts(books.products);

  async function printLowStock() {
    if (!exportOn || !canAccess('exportData')) {
      setBlockedOpen(true);
      return;
    }
    const body = buildLowStockReportText(user?.shopName ?? 'KadaBook', lowStock);
    const result = await printTextReport(t((m) => m.settings.lowStock), body);
    if (!result.ok) {
      Alert.alert(t((m) => m.settings.printFailed), result.message);
    }
  }

  async function printPeriodReport() {
    if (!exportOn || !canAccess('exportData')) {
      setBlockedOpen(true);
      return;
    }
    const body = buildPeriodReportText({
      shopName: user?.shopName ?? 'KadaBook',
      mode,
      range,
      sales,
      expenses,
      bars,
      expenseLabel: (category) => expenseCategoryMessage(messages, category),
    });
    const title = `${periodReportTitle(mode)} — ${user?.shopName ?? 'KadaBook'}`;
    const result = await printTextReport(title, body);
    if (!result.ok) {
      Alert.alert(t((m) => m.settings.printFailed), result.message);
    }
  }

  if (!reportsOn) {
    return (
      <Screen>
        <View style={styles.top}>
          <Text style={styles.title}>{t((m) => m.reportsTab.title)}</Text>
        </View>
        <Text style={{ padding: 20, fontFamily: fonts.regular }}>Reports are turned off.</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <AccessBlockedModal visible={blockedOpen} onClose={() => setBlockedOpen(false)} />
      <View style={styles.top}>
        <Pressable accessibilityLabel="Menu" onPress={() => navigation.navigate('More')} style={styles.iconButton}>
          <MenuIcon />
        </Pressable>
        <Text style={styles.title}>{t((m) => m.reportsTab.title)}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.modes}>
          {(
            [
              ['daily', t((m) => m.reportsTab.daily)],
              ['weekly', t((m) => m.reportsTab.weekly)],
              ['monthly', t((m) => m.reportsTab.monthly)],
            ] as const
          ).map(([item, label]) => {
            const on = item === mode;
            return (
              <Pressable key={item} onPress={() => setMode(item)} style={[styles.mode, on && styles.modeOn]}>
                <Text style={[styles.modeText, on && styles.modeTextOn]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.date}>{mode === 'daily' ? formatDay(now) : `${formatDay(range.start)} – ${formatDay(range.end - 1)}`}</Text>
        <View style={styles.metrics}>
          <Metric label={t((m) => m.reportsTab.sales)} value={formatRs(salesTotal)} wash={colors.saleWash} ink={colors.saleText} />
          <Metric label={t((m) => m.reportsTab.expenses)} value={formatRs(expenseTotal)} wash={colors.expenseWash} ink={colors.expenseText} />
          <Metric label={t((m) => m.reportsTab.profit)} value={formatRs(salesTotal - expenseTotal)} wash={colors.gradientTop} ink={colors.profitText} />
        </View>
        <FillButton
          label={t((m) => m.reportsTab.printPeriod)}
          color={colors.brand}
          onPress={() => printPeriodReport()}
        />
        <View style={styles.chart}>
          <View style={styles.bars}>
            {bars.map((bar) => (
              <View key={bar.key} style={styles.barCol}>
                <View style={[styles.bar, { height: Math.max(bar.value > 0 ? 6 : 0, (bar.value / max) * 96) }]} />
              </View>
            ))}
          </View>
          <View style={styles.axis} />
          <View style={styles.labels}>
            {bars.map((bar) => (
              <Text key={bar.key} style={styles.axisLabel} numberOfLines={1}>
                {bar.label}
              </Text>
            ))}
          </View>
        </View>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{t((m) => m.reportsTab.recentExpenses)}</Text>
          <Pressable onPress={() => navigation.navigate('Expenses')} style={styles.viewAll}>
            <Text style={styles.viewAllText}>{t((m) => m.reportsTab.viewAll)}</Text>
          </Pressable>
        </View>
        {recent.length === 0 ? (
          <Text style={styles.empty}>{t((m) => m.reportsTab.noExpensesYet)}</Text>
        ) : (
          recent.map((expense) => (
            <View key={expense.id} style={styles.expense}>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: categoryWash[expense.category as keyof typeof categoryWash] ?? colors.keypad },
                ]}
              />
              <View style={styles.expenseCopy}>
                <Text style={styles.expenseName}>{expenseCategoryMessage(messages, expense.category)}</Text>
                <Text style={styles.expenseTime}>{formatTime(expense.createdAt)}</Text>
              </View>
              <Text style={styles.expenseAmount}>{formatRs(expense.amount)}</Text>
            </View>
          ))
        )}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{t((m) => m.settings.lowStock)}</Text>
          <Pressable onPress={() => printLowStock()} style={styles.viewAll}>
            <Text style={styles.viewAllText}>{t((m) => m.settings.printReport)}</Text>
          </Pressable>
        </View>
        {lowStock.length === 0 ? (
          <Text style={styles.empty}>{t((m) => m.reportsTab.noLowStock)}</Text>
        ) : (
          lowStock.map((product) => (
            <View key={product.id} style={styles.lowRow}>
              <Text style={styles.expenseName}>{product.name}</Text>
              <Text style={styles.expenseTime}>
                {product.stock} {product.unit} · {formatRs(product.sellingPrice)}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

function Metric({ label, value, wash, ink }: { label: string; value: string; wash: string; ink: string }) {
  const styles = useStyleSheet(reportsStyles);
  return (
    <View style={[styles.metric, { backgroundColor: wash }]}>
      <Text style={[styles.metricLabel, { color: ink }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: ink }]}>{value}</Text>
    </View>
  );
}

function reportsStyles(c: ColorPalette) {
  return {
  top: {
    minHeight: 56,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 19,
    color: c.ink,
  },
  body: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 12,
    flexGrow: 1,
  },
  modes: {
    flexDirection: 'row',
    gap: 8,
  },
  mode: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.keypad,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeOn: {
    backgroundColor: c.brand,
  },
  modeText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: c.ink,
  },
  modeTextOn: {
    color: c.onFill,
  },
  date: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: c.ink,
  },
  metrics: {
    flexDirection: 'row',
    gap: 8,
  },
  metric: {
    flex: 1,
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  metricLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  metricValue: {
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  chart: {
    marginTop: 4,
  },
  bars: {
    height: 110,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    width: 16,
    borderRadius: 3,
    backgroundColor: c.sale,
  },
  axis: {
    height: 1,
    backgroundColor: c.line,
    marginTop: 0,
  },
  labels: {
    flexDirection: 'row',
    marginTop: 6,
  },
  axisLabel: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.regular,
    fontSize: 10,
    color: c.muted,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: c.ink,
  },
  viewAll: {
    minHeight: 44,
    justifyContent: 'center',
  },
  viewAllText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: c.brand,
  },
  empty: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: c.muted,
  },
  expense: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  expenseCopy: {
    flex: 1,
  },
  expenseName: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: c.ink,
  },
  expenseTime: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.muted,
  },
  expenseAmount: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: c.expenseText,
  },
  lowRow: {
    minHeight: 48,
    justifyContent: 'center',
    gap: 2,
    borderBottomWidth: 1,
    borderBottomColor: c.rowLine,
  },
};
}
