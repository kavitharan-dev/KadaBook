import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { BellIcon, ExpenseIcon, MenuIcon, ProductIcon, ReportIcon, SaleIcon } from '../components/Icons';
import { AnimatedIconPress } from '../components/AnimatedIconPress';
import { HomeActionTile } from '../components/HomeActionTile';
import { PulsingDot } from '../components/PulsingDot';
import { AppLogo } from '../components/AppLogo';
import { RemoteHomePromo } from '../components/RemoteHomePromo';
import { OpeningBalanceModal } from '../components/OpeningBalanceModal';
import { Screen, SyncNotice } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useBooks } from '../context/BooksContext';
import { useI18n } from '../context/LocaleContext';
import { formatDay, formatRs, isSameDay, startOfDay, sum } from '../lib/format';
import { dayKey, openingBalanceForDay } from '../lib/dayKey';
import { changePercent } from '../lib/stats';
import { markOpeningPromptDay, needsOpeningBalancePrompt, readOpeningPromptDay } from '../lib/openingPrompt';
import type { AppStackParamList, TabParamList } from '../navigation/types';
import { useTheme } from '../context/ThemeContext';
import { fonts } from '../theme/fonts';

import { AccessBlockedModal } from '../components/GateModals';
import { useFeature } from '../context/RemoteConfigContext';
import { useShopGate } from '../context/ShopGateContext';
import type { AccessFeature } from '../lib/shopAccessTypes';
import {
  ExpiredRenewBar,
  GraceBanner,
  HomeAnnouncementBanner,
  TrialChip,
} from './GateScreens';

const ACTIONS = [
  { key: 'sale', labelKey: 'newSale' as const, colorKey: 'sale' as const, route: 'NewSale' as const, Icon: SaleIcon, feature: 'addSale' as const, flag: 'sales' as const },
  { key: 'expense', labelKey: 'addExpense' as const, colorKey: 'expense' as const, route: 'AddExpense' as const, Icon: ExpenseIcon, feature: 'addExpense' as const, flag: 'expenses' as const },
  { key: 'products', labelKey: 'products' as const, colorKey: 'product' as const, route: 'Products' as const, Icon: ProductIcon, feature: 'manageProducts' as const, flag: 'products' as const },
  { key: 'reports', labelKey: 'reports' as const, colorKey: 'brand' as const, route: 'Reports' as const, Icon: ReportIcon, feature: 'viewReports' as const, flag: 'reports' as const },
] as const;

export function HomeScreen() {
  const navigation = useNavigation<CompositeNavigationProp<
    BottomTabNavigationProp<TabParamList, 'Home'>,
    NativeStackNavigationProp<AppStackParamList>
  >>();
  const { books, error, loading, setTodayOpeningBalance } = useBooks();
  const { t } = useI18n();
  const { colors } = useTheme();
  const { canAccess } = useShopGate();
  const salesOn = useFeature('sales');
  const expensesOn = useFeature('expenses');
  const productsOn = useFeature('products');
  const reportsOn = useFeature('reports');
  const flags = { sales: salesOn, expenses: expensesOn, products: productsOn, reports: reportsOn };
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [openingModal, setOpeningModal] = useState(false);
  const [openingInput, setOpeningInput] = useState('');
  const [openingBusy, setOpeningBusy] = useState(false);
  const [localPromptDay, setLocalPromptDay] = useState<string | null>(null);
  const [promptReady, setPromptReady] = useState(false);
  const now = Date.now();
  const todayKey = dayKey(now);
  const yesterday = startOfDay(now) - 24 * 60 * 60 * 1000;
  const openingToday = openingBalanceForDay(books.meta, now);
  const salesToday = sum(books.sales.filter((sale) => isSameDay(sale.createdAt, now)));
  const todaySales = openingToday + salesToday;
  const yesterdaySales = sum(books.sales.filter((sale) => isSameDay(sale.createdAt, yesterday)));
  const percent = changePercent(todaySales, yesterdaySales);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const monthSales = sum(books.sales.filter((sale) => sale.createdAt >= monthStart));
  const monthExpenses = sum(books.expenses.filter((expense) => expense.createdAt >= monthStart));
  const hasToday = todaySales > 0 || books.expenses.some((expense) => isSameDay(expense.createdAt, now));

  useEffect(() => {
    readOpeningPromptDay().then((day) => {
      setLocalPromptDay(day);
      setPromptReady(true);
    });
  }, []);

  useEffect(() => {
    if (loading || !promptReady) return;
    setOpeningModal(needsOpeningBalancePrompt(books.meta, Date.now(), localPromptDay));
  }, [loading, promptReady, books.meta.openingBalances, localPromptDay, todayKey]);

  const confirmOpening = useCallback(
    async (skip: boolean) => {
      setOpeningBusy(true);
      try {
        const value = skip ? 0 : Math.max(0, Math.round(Number(openingInput) || 0));
        await setTodayOpeningBalance(value);
        await markOpeningPromptDay(now);
        setLocalPromptDay(dayKey(now));
        setOpeningModal(false);
        setOpeningInput('');
      } finally {
        setOpeningBusy(false);
      }
    },
    [openingInput, setTodayOpeningBalance],
  );

  return (
    <Screen>
      <AccessBlockedModal visible={blockedOpen} onClose={() => setBlockedOpen(false)} />
      <OpeningBalanceModal
        visible={openingModal}
        value={openingInput}
        onChangeValue={setOpeningInput}
        busy={openingBusy}
        onSkip={() => confirmOpening(true)}
        onSave={() => confirmOpening(false)}
      />
      <View style={styles.top}>
        <AnimatedIconPress accessibilityLabel="Menu" onPress={() => navigation.navigate('More')} style={styles.iconButton}>
          <MenuIcon />
        </AnimatedIconPress>
        <View style={styles.brand}>
          <AppLogo />
          <Text style={[styles.brandName, { color: colors.ink }]}>
            Kada<Text style={[styles.brandAccent, { color: colors.brand }]}>Book</Text>
          </Text>
        </View>
        <View style={styles.iconButton}>
          <AnimatedIconPress
            accessibilityLabel="Notifications"
            onPress={() => navigation.navigate('Notifications')}
            style={styles.iconPressInner}
          >
            <BellIcon />
          </AnimatedIconPress>
          <PulsingDot visible={hasToday} />
        </View>
      </View>
      <ExpiredRenewBar />
      <GraceBanner />
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <RemoteHomePromo />
        <HomeAnnouncementBanner />
        <SyncNotice
          message={error ? `${error} ${t((m) => m.home.syncError)}` : null}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t((m) => m.home.todaySales)}
          onPress={() => navigation.navigate('Sales')}
          style={({ pressed }) => [pressed && styles.heroPressed]}
        >
          <View style={{ position: 'relative' }}>
            <TrialChip />
            <LinearGradient colors={['#1D5FE0', '#3B82F6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <Text style={styles.heroLabel}>{t((m) => m.home.todaySales)}</Text>
            <View style={styles.heroRow}>
              <Text style={styles.heroAmount}>{formatRs(todaySales)}</Text>
              <Text style={styles.pill}>{percent >= 0 ? '▲' : '▼'} {Math.abs(percent)}%</Text>
            </View>
            <Text style={styles.heroDate}>{formatDay(now)}</Text>
            {openingToday > 0 ? (
              <Text style={styles.heroHint}>
                {t((m) => m.home.todayOpeningNote, { opening: formatRs(openingToday), sales: formatRs(salesToday) })}
              </Text>
            ) : (
              <Text style={styles.heroHint}>{t((m) => m.home.openSalesHistory)}</Text>
            )}
          </LinearGradient>
          </View>
        </Pressable>
        <View style={styles.grid}>
          {ACTIONS.filter((action) => flags[action.flag]).map((action, index) => (
            <HomeActionTile
              key={action.key}
              delay={180 + index * 90}
              backgroundColor={colors[action.colorKey]}
              label={t((m) => m.home[action.labelKey])}
              Icon={action.Icon}
              onPress={() => {
                if (!canAccess(action.feature)) {
                  setBlockedOpen(true);
                  return;
                }
                navigation.navigate(action.route);
              }}
            />
          ))}
        </View>
        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, { color: colors.ink }]}>{t((m) => m.home.thisMonth)}</Text>
          <Pressable onPress={() => navigation.navigate('Month')} style={styles.viewAll}>
            <Text style={[styles.viewAllText, { color: colors.brand }]}>{t((m) => m.home.viewAll)}</Text>
          </Pressable>
        </View>
        <View style={[styles.card, { borderColor: colors.hairline }]}>
          <SummaryRow label={t((m) => m.home.totalSales)} value={formatRs(monthSales)} color={colors.saleText} />
          <SummaryRow
            label={t((m) => m.home.totalExpenses)}
            value={formatRs(monthExpenses)}
            color={colors.expenseText}
            border
            lineColor={colors.hairline}
            labelColor={colors.ink}
          />
          <SummaryRow
            label={t((m) => m.home.profit)}
            value={formatRs(monthSales - monthExpenses)}
            color={colors.brand}
            border
            lineColor={colors.hairline}
            labelColor={colors.ink}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

function SummaryRow({
  label,
  value,
  color,
  border,
  lineColor,
  labelColor,
}: {
  label: string;
  value: string;
  color: string;
  border?: boolean;
  lineColor?: string;
  labelColor?: string;
}) {
  return (
    <View style={[styles.row, border && lineColor ? { borderTopWidth: 1, borderTopColor: lineColor } : border && styles.rowBorder]}>
      <Text style={[styles.rowLabel, labelColor ? { color: labelColor } : null]}>{label}</Text>
      <Text style={[styles.rowValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  top: {
    minHeight: 52,
    paddingHorizontal: 8,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconPressInner: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandName: {
    fontFamily: fonts.bold,
    fontSize: 19,
  },
  brandAccent: {
    fontFamily: fonts.bold,
  },
  dot: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#E5484D',
  },
  body: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 16,
  },
  hero: {
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginTop: 4,
  },
  heroPressed: {
    opacity: 0.92,
  },
  heroHint: {
    marginTop: 8,
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
  },
  heroLabel: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
  },
  heroRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  heroAmount: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 34,
    color: '#FFFFFF',
  },
  pill: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  heroDate: {
    marginTop: 6,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  action: {
    width: '48%',
    flexGrow: 1,
    height: 92,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionLabel: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  sectionHead: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  viewAll: {
    minHeight: 44,
    justifyContent: 'center',
  },
  viewAllText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  rowBorder: {
    borderTopWidth: 1,
  },
  rowLabel: {
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  rowValue: {
    fontFamily: fonts.bold,
    fontSize: 14,
  },
});
