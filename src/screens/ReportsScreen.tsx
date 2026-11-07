import { useMemo, useState } from 'react';
import { Alert, ImageBackground, Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation, type CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  BackIcon,
  BoxDuoIcon,
  CalendarIcon,
  ChatDuoIcon,
  ClockIcon,
  ExpenseIcon,
  MenuIcon,
  TrendDuoIcon,
} from '../components/Icons';
import { AccessBlockedModal } from '../components/GateModals';
import { AnimatedIconPress } from '../components/AnimatedIconPress';
import { FillButton, Screen } from '../components/ui';
import { Designable } from '../devtools/designMode/Designable';
import { reportsLayout } from '../designConfig/reports';
import { PrintButton } from '../components/PrintButton';
import { Toast, useToast } from '../components/Toast';
import { FullReports } from '../components/FullReports';
import { BranchChips } from '../components/kitchen/KitchenUi';
import { BranchSalesCard } from '../components/BranchSalesCard';
import { BranchStockReport } from '../components/BranchStockCard';
import { useKitchen } from '../context/KitchenContext';
import { scopeBooks } from '../lib/branchScope';
import { useShopGate } from '../context/ShopGateContext';
import { useBooks } from '../context/BooksContext';
import { useFeature } from '../context/RemoteConfigContext';
import { useI18n } from '../context/LocaleContext';
import { expenseCategoryMessage } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { formatDay, formatRs, formatTime, isSameDay, sum } from '../lib/format';
import {
  buildAttachedPeriodReportText,
  buildAttachedPeriodSummary,
  buildDayCloseReportText,
  buildDayCloseSummary,
  shareDayCloseWhatsApp,
} from '../lib/dayClose';
import {
  buildKitchenDayReportExtras,
  buildKitchenPeriodReportExtras,
  buildKitchenPeriodReportText,
} from '../lib/kitchenDailyReport';
import { buildLowStockReportText } from '../lib/receipt';
import { periodReportTitle } from '../lib/periodReport';
import { printTextReport } from '../lib/printReceipt';
import { usesKitchenStock } from '../lib/shopType';
import { lowStockProducts } from '../lib/stockCart';
import { chartBars, periodExpenses, periodRange } from '../lib/stats';
import { usePrintFeedback } from '../lib/usePrintFeedback';
import type { AppStackParamList, TabParamList } from '../navigation/types';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../theme/palettes';
import { useStyleSheet } from '../theme/useStyleSheet';
import { fonts } from '../theme/fonts';

const appbarBg = require('../../assets/appbar-bg.png');

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
  const kitchen = useKitchen();
  const branches = kitchen.data.branches;
  // The whole report follows the branch switcher, opening balance and credit collected included.
  const scopedBooks = useMemo(() => scopeBooks(books, kitchen.scope, branches), [books, kitchen.scope, branches]);
  const branchSales = scopedBooks.sales;
  const branchExpenses = scopedBooks.expenses;
  const reportsOn = useFeature('reports');
  const exportOn = useFeature('export');
  const { canAccess, profile } = useShopGate();
  const [blockedOpen, setBlockedOpen] = useState(false);
  const { user } = useAuth();
  const { t, messages } = useI18n();
  const toast = useToast();
  const printFx = usePrintFeedback();
  const shareFx = usePrintFeedback();
  const lowStockFx = usePrintFeedback();
  const [mode, setMode] = useState<Mode>('daily');
  const now = Date.now();
  const range = periodRange(mode, now);
  const sales = branchSales.filter((sale) => sale.createdAt >= range.start && sale.createdAt < range.end);
  const expenses = periodExpenses(branchExpenses, mode, now);
  const attached = useMemo(
    () => buildAttachedPeriodSummary(scopedBooks, range, periodReportTitle(mode)),
    [scopedBooks, range.start, range.end, mode],
  );
  const daySummary = useMemo(() => buildDayCloseSummary(scopedBooks, now), [scopedBooks, now]);
  const isKitchenShop = usesKitchenStock(profile?.shopType ?? user?.shopType);
  const kitchenReport = useMemo(() => {
    if (!isKitchenShop || mode !== 'daily') return null;
    return buildKitchenDayReportExtras(kitchen.data, scopedBooks, kitchen.scope, now);
  }, [isKitchenShop, mode, kitchen.data, kitchen.scope, scopedBooks, now]);
  const kitchenPeriod = useMemo(() => {
    if (!isKitchenShop || mode === 'daily') return null;
    return buildKitchenPeriodReportExtras(kitchen.data, scopedBooks, kitchen.scope, range);
  }, [isKitchenShop, mode, kitchen.data, kitchen.scope, scopedBooks, range.start, range.end]);
  const salesTotal = mode === 'daily' ? daySummary.totalSales : attached.weeklySales;
  // Running costs only: stock purchases are shown apart and never come off profit.
  const expenseTotal = mode === 'daily' ? daySummary.operatingExpenses : attached.weeklyOperating;
  const purchaseTotal = mode === 'daily' ? daySummary.stockPurchase : attached.weeklyStockPurchase;
  const profitTotal = mode === 'daily' ? daySummary.finalProfit : attached.weeklyFinal;
  const bars = chartBars(branchSales, mode, now);
  const max = Math.max(1, ...bars.map((bar) => bar.value));
  const recent = books.expenses.slice(0, 3);
  const lowStock = lowStockProducts(books.products);
  const shopName = user?.shopName ?? 'KadaBook';
  const shareLabel =
    shareFx.phase === 'printing'
      ? t((m) => m.reportsTab.sharing)
      : shareFx.phase === 'done'
        ? t((m) => m.reportsTab.shared)
        : shareFx.phase === 'error'
          ? t((m) => m.reportsTab.retryShare)
          : t((m) => m.home.closeWhatsApp);

  function periodBody() {
    if (mode === 'daily') return buildDayCloseReportText(shopName, daySummary, null, kitchenReport);
    if (kitchenPeriod) return buildKitchenPeriodReportText(shopName, attached, kitchenPeriod);
    return buildAttachedPeriodReportText(shopName, attached);
  }

  async function printLowStock() {
    if (!exportOn || !canAccess('exportData')) {
      setBlockedOpen(true);
      return;
    }
    const result = await lowStockFx.run(async () =>
      printTextReport(t((m) => m.settings.lowStock), buildLowStockReportText(shopName, lowStock)),
    );
    if (!result) return;
    if (result.ok) toast.show('success', t((m) => m.reportsTab.printOk));
    else Alert.alert(t((m) => m.settings.printFailed), result.message);
  }

  async function printPeriodReport() {
    if (!exportOn || !canAccess('exportData')) {
      setBlockedOpen(true);
      return;
    }
    const title = `${periodReportTitle(mode)} — ${shopName}`;
    const result = await printFx.run(async () => printTextReport(title, periodBody()));
    if (!result) return;
    if (result.ok) toast.show('success', t((m) => m.reportsTab.printOk));
    else Alert.alert(t((m) => m.settings.printFailed), result.message);
  }

  async function sharePeriodWhatsApp() {
    if (!exportOn || !canAccess('exportData')) {
      setBlockedOpen(true);
      return;
    }
    const result = await shareFx.run(async () => shareDayCloseWhatsApp(periodBody()));
    if (!result) return;
    if (result.ok) toast.show('success', t((m) => m.reportsTab.shareOk));
    else Alert.alert(t((m) => m.settings.printFailed), result.message);
  }

  if (!reportsOn) {
    return (
      <Screen>
        <ReportsHero
          title={t((m) => m.reportsTab.title)}
          subtitle="Sales, expenses and stock at a glance"
          onBack={() => navigation.navigate('Home')}
          onMenu={() => navigation.navigate('More')}
        />
        <Text style={{ padding: 20, fontFamily: fonts.regular }}>Reports are turned off.</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <AccessBlockedModal visible={blockedOpen} onClose={() => setBlockedOpen(false)} />
      <Toast toast={toast.toast} onHide={toast.hide} />
      <ReportsHero
        title={t((m) => m.reportsTab.title)}
        subtitle="Sales, expenses and stock at a glance"
        onBack={() => navigation.navigate('Home')}
        onMenu={() => navigation.navigate('More')}
      />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {branches.length > 1 && !kitchen.branchLocked ? <BranchChips branches={branches} value={kitchen.scope} onChange={kitchen.setScope} /> : null}
        <View style={styles.modes}>
          {(
            [
              ['daily', t((m) => m.reportsTab.daily), ClockIcon],
              ['weekly', t((m) => m.reportsTab.weekly), CalendarIcon],
              ['monthly', t((m) => m.reportsTab.monthly), TrendDuoIcon],
            ] as const
          ).map(([item, label, ModeIcon]) => {
            const on = item === mode;
            return (
              <Pressable key={item} onPress={() => setMode(item)} style={[styles.mode, on && styles.modeOn]}>
                <ModeIcon color={on ? colors.onFill : colors.muted} size={15} />
                <Text style={[styles.modeText, on && styles.modeTextOn]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.dateRow}>
          <CalendarIcon color={colors.brand} size={15} />
          <Text style={styles.date}>{mode === 'daily' ? formatDay(now) : `${formatDay(range.start)} – ${formatDay(range.end - 1)}`}</Text>
        </View>
        {mode === 'daily' ? (
          <View style={styles.metrics}>
            <Metric
              label={t((m) => m.home.closeOpeningCash)}
              value={formatRs(daySummary.openingCash)}
              wash={colors.keypad}
              ink={colors.ink}
            />
            <Metric
              label={t((m) => m.home.closeExpectedCash)}
              value={formatRs(daySummary.expectedCash)}
              wash={colors.keypad}
              ink={colors.ink}
            />
          </View>
        ) : null}
        <View style={styles.metrics}>
          <Metric
            label={
              mode === 'weekly'
                ? t((m) => m.reportsTab.weeklySales)
                : mode === 'monthly'
                  ? t((m) => m.reportsTab.monthlySales)
                  : t((m) => m.reportsTab.sales)
            }
            value={formatRs(salesTotal)}
            wash={colors.saleWash}
            ink={colors.saleText}
          />
          <Metric label={t((m) => m.reportsTab.expenses)} value={formatRs(expenseTotal)} wash={colors.expenseWash} ink={colors.expenseText} />
          <Metric
            label={
              mode === 'weekly'
                ? t((m) => m.reportsTab.weeklyFinal)
                : mode === 'monthly'
                  ? t((m) => m.reportsTab.monthlyFinal)
                  : t((m) => m.reportsTab.profit)
            }
            value={formatRs(profitTotal)}
            wash={colors.gradientTop}
            ink={colors.profitText}
          />
        </View>
        <View style={styles.metrics}>
          <Metric label={t((m) => m.home.closeStockPurchase)} value={formatRs(purchaseTotal)} wash={colors.keypad} ink={colors.ink} />
        </View>
        <BranchStockReport start={range.start} end={range.end} />
        {mode === 'daily' ? (
          <BranchSalesCard sales={branchSales.filter((sale) => isSameDay(sale.createdAt, now))} branches={branches} />
        ) : null}
        {mode === 'weekly' ? (
          <Text style={styles.weekHint}>{t((m) => m.reportsTab.weeklyHint)}</Text>
        ) : null}
        {mode === 'monthly' ? (
          <Text style={styles.weekHint}>{t((m) => m.reportsTab.monthlyHint)}</Text>
        ) : null}
        <PrintButton
          large
          phase={printFx.phase}
          label={t((m) => m.reportsTab.printPeriod)}
          onPress={() => {
            void printPeriodReport();
          }}
        />
        <FillButton
          label={shareLabel}
          icon={<ChatDuoIcon color={colors.onFill} size={18} />}
          color={shareFx.phase === 'done' ? colors.saleText : shareFx.phase === 'error' ? colors.expenseText : colors.saleText}
          busy={shareFx.phase === 'printing'}
          onPress={() => {
            void sharePeriodWhatsApp();
          }}
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
        <FullReports
          sales={sales}
          expenses={expenses}
          allSales={branchSales}
          allExpenses={branchExpenses}
          products={books.products}
          expenseLabel={(category) => expenseCategoryMessage(messages, category)}
        />
        <View style={styles.sectionHead}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionIconWrap, { backgroundColor: `${colors.expense}1A` }]}>
              <ExpenseIcon color={colors.expense} size={14} />
            </View>
            <Text style={styles.sectionTitle}>{t((m) => m.reportsTab.recentExpenses)}</Text>
          </View>
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
              >
                <ExpenseIcon color={colors.expense} size={16} />
              </View>
              <View style={styles.expenseCopy}>
                <Text style={styles.expenseName}>{expenseCategoryMessage(messages, expense.category)}</Text>
                <Text style={styles.expenseTime}>{formatTime(expense.createdAt)}</Text>
              </View>
              <Text style={styles.expenseAmount}>{formatRs(expense.amount)}</Text>
            </View>
          ))
        )}
        <View style={styles.sectionHead}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionIconWrap, { backgroundColor: `${colors.expenseText}1A` }]}>
              <BoxDuoIcon color={colors.expenseText} size={14} />
            </View>
            <Text style={styles.sectionTitle}>{t((m) => m.settings.lowStock)}</Text>
          </View>
          <Pressable
            onPress={() => {
              void printLowStock();
            }}
            disabled={lowStockFx.phase === 'printing'}
            style={styles.viewAll}
          >
            <Text style={styles.viewAllText}>
              {lowStockFx.phase === 'printing'
                ? 'Printing…'
                : lowStockFx.phase === 'done'
                  ? '✓ Printed'
                  : t((m) => m.settings.printReport)}
            </Text>
          </Pressable>
        </View>
        {lowStock.length === 0 ? (
          <Text style={styles.empty}>{t((m) => m.reportsTab.noLowStock)}</Text>
        ) : (
          lowStock.map((product) => (
            <View key={product.id} style={styles.lowRow}>
              <View style={[styles.badge, { backgroundColor: `${colors.expenseText}1A` }]}>
                <BoxDuoIcon color={colors.expenseText} size={16} />
              </View>
              <View style={styles.expenseCopy}>
                <Text style={styles.expenseName}>{product.name}</Text>
                <Text style={styles.expenseTime}>
                  {product.stock} {product.unit} · {formatRs(product.sellingPrice)}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

function ReportsHero({
  title,
  subtitle,
  onBack,
  onMenu,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  onMenu: () => void;
}) {
  const styles = useStyleSheet(reportsStyles);
  return (
    <Designable screen="reports" id="hero" base={reportsLayout.hero} offsetKey="marginTop">
      {(v) => (
        <ImageBackground
          source={appbarBg}
          resizeMode="cover"
          imageStyle={{ width: '100%', height: '100%' }}
          style={[styles.hero, { padding: v.padding, marginTop: v.marginTop, borderRadius: v.borderRadius }]}
        >
          <AnimatedIconPress
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={onBack}
            hitSlop={6}
            style={styles.heroBack}
          >
            <BackIcon color="#FFFFFF" />
          </AnimatedIconPress>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.heroSubtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
          <AnimatedIconPress accessibilityRole="button" accessibilityLabel="Menu" onPress={onMenu} hitSlop={6} style={styles.heroBack}>
            <MenuIcon color="#FFFFFF" />
          </AnimatedIconPress>
        </ImageBackground>
      )}
    </Designable>
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
  hero: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    borderRadius: 24,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1D5FE0',
    overflow: 'hidden',
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
  body: {
    paddingHorizontal: 16,
    paddingTop: 4,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
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
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  date: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: c.ink,
  },
  weekHint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: c.muted,
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
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
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
    alignItems: 'center',
    justifyContent: 'center',
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
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: c.rowLine,
  },
};
}
