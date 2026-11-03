import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  BellIcon,
  BookDuoIcon,
  BoxDuoIcon,
  CartDuoIcon,
  ChartDuoIcon,
  ChevronRightIcon,
  GridDuoIcon,
  MenuIcon,
  ReceiptDuoIcon,
  TrendDuoIcon,
  TrophyDuoIcon,
} from '../components/Icons';
import { AnimatedIconPress } from '../components/AnimatedIconPress';
import { HomeActionTile } from '../components/HomeActionTile';
import { GradientStatCard, HeroSalesCard, gradients } from '../components/DashboardCards';
import { FadeUp } from '../components/FadeUp';
import { PulsingDot } from '../components/PulsingDot';
import { AppLogo } from '../components/AppLogo';
import { RemoteHomePromo } from '../components/RemoteHomePromo';
import { OpeningBalanceModal } from '../components/OpeningBalanceModal';
import { Screen, SyncNotice } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useBooks } from '../context/BooksContext';
import { useI18n } from '../context/LocaleContext';
import { formatRs, isSameDay, startOfDay, sum } from '../lib/format';
import { dayKey, openingBalanceForDay } from '../lib/dayKey';
import { useRole } from '../lib/roles';
import { usesKitchenStock } from '../lib/shopType';
import { changePercent } from '../lib/stats';
import { markOpeningPromptDay, needsOpeningBalancePrompt, readOpeningPromptDay } from '../lib/openingPrompt';
import type { AppStackParamList, TabParamList } from '../navigation/types';
import { useTheme } from '../context/ThemeContext';
import { fonts } from '../theme/fonts';

import { AccessBlockedModal } from '../components/GateModals';
import { useFeature } from '../context/RemoteConfigContext';
import { useShopGate } from '../context/ShopGateContext';
import {
  ExpiredRenewBar,
  HomeAnnouncementBanner,
  TrialChip,
} from './GateScreens';

const ACTIONS = [
  { key: 'sale', labelKey: 'newSale' as const, gradient: gradients.green, route: 'NewSale' as const, Icon: CartDuoIcon, feature: 'addSale' as const, flag: 'sales' as const },
  { key: 'expense', labelKey: 'addExpense' as const, gradient: gradients.orange, route: 'AddExpense' as const, Icon: ReceiptDuoIcon, feature: 'addExpense' as const, flag: 'expenses' as const },
  { key: 'credit', labelKey: 'creditBook' as const, gradient: gradients.teal, route: 'CreditBook' as const, Icon: BookDuoIcon, feature: 'addSale' as const, flag: 'sales' as const },
  { key: 'products', labelKey: 'products' as const, gradient: gradients.purple, route: 'Products' as const, Icon: BoxDuoIcon, feature: 'manageProducts' as const, flag: 'products' as const },
  { key: 'reports', labelKey: 'reports' as const, gradient: gradients.blue, route: 'Reports' as const, Icon: ChartDuoIcon, feature: 'viewReports' as const, flag: 'reports' as const },
] as const;

export function HomeScreen() {
  const navigation = useNavigation<CompositeNavigationProp<
    BottomTabNavigationProp<TabParamList, 'Home'>,
    NativeStackNavigationProp<AppStackParamList>
  >>();
  const { user } = useAuth();
  const { books, error, loading, setTodayOpeningBalance } = useBooks();
  const { t } = useI18n();
  const { colors } = useTheme();
  const { canAccess, profile } = useShopGate();
  const { can } = useRole();
  const showKitchen = usesKitchenStock(profile?.shopType ?? user?.shopType) && can('manageStock');
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
  const monthSaleList = books.sales.filter((sale) => sale.createdAt >= monthStart);
  const monthExpenseList = books.expenses.filter((expense) => expense.createdAt >= monthStart);
  const monthSales = sum(monthSaleList);
  const monthExpenses = sum(monthExpenseList);
  const monthProfit = monthSales - monthExpenses;
  const margin = monthSales > 0 ? Math.round((monthProfit / monthSales) * 100) : 0;
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
          <AppLogo size={44} style={styles.brandLogo} />
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
      <ScrollView
        style={{ backgroundColor: colors.canvas }}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <RemoteHomePromo />
        <HomeAnnouncementBanner />
        <SyncNotice
          message={error ? `${error} ${t((m) => m.home.syncError)}` : null}
        />
        <View>
          <HeroSalesCard
            delay={40}
            title={t((m) => m.home.dashboard)}
            subtitle={t((m) => m.home.dashboardSub)}
            label={t((m) => m.home.todaySales)}
            amount={todaySales}
            percent={percent}
            hint={
              openingToday > 0
                ? t((m) => m.home.todayOpeningNote, { opening: formatRs(openingToday), sales: formatRs(salesToday) })
                : t((m) => m.home.openSalesHistory)
            }
            vsLabel={t((m) => m.home.vsYesterday)}
            viewLabel={t((m) => m.home.view)}
            Icon={TrendDuoIcon}
            onPress={() => navigation.navigate('Sales')}
          />
          <View style={styles.trialSlot}>
            <TrialChip />
          </View>
        </View>
        <FadeUp delay={160} style={[styles.panel, { backgroundColor: colors.white, borderColor: colors.hairline }]}>
          <View style={[styles.panelHead, { borderBottomColor: colors.hairline }]}>
            <GridDuoIcon color={colors.brand} size={18} />
            <Text style={[styles.panelTitle, { color: colors.brand }]}>{t((m) => m.home.quickActions)}</Text>
          </View>
          <View style={styles.grid}>
            {ACTIONS.filter((action) => flags[action.flag]).map((action, index) => (
              <HomeActionTile
                key={action.key}
                delay={220 + index * 90}
                gradient={action.gradient}
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
            {showKitchen ? (
              <HomeActionTile
                key="kitchen"
                delay={220 + ACTIONS.length * 90}
                gradient={gradients.red}
                label={t((m) => m.home.kitchenStock)}
                Icon={GridDuoIcon}
                onPress={() => {
                  if (!canAccess('manageProducts')) {
                    setBlockedOpen(true);
                    return;
                  }
                  navigation.navigate('Kitchen');
                }}
              />
            ) : null}
          </View>
        </FadeUp>
        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, { color: colors.ink }]}>{t((m) => m.home.thisMonth)}</Text>
          <Pressable onPress={() => navigation.navigate('Month')} style={styles.viewAll}>
            <Text style={[styles.viewAllText, { color: colors.brand }]}>{t((m) => m.home.viewAll)}</Text>
            <ChevronRightIcon color={colors.brand} size={15} />
          </Pressable>
        </View>
        <View style={styles.stats}>
          <GradientStatCard
            delay={560}
            gradient={gradients.teal}
            glow="rgba(20,163,142,0.32)"
            label={t((m) => m.home.totalSales)}
            value={monthSales}
            chip={t((m) => m.home.salesCount, { count: monthSaleList.length })}
            viewLabel={t((m) => m.home.view)}
            Icon={CartDuoIcon}
            onPress={() => navigation.navigate('Month')}
            style={styles.statHalf}
          />
          <GradientStatCard
            delay={640}
            gradient={gradients.orange}
            glow="rgba(249,115,22,0.32)"
            label={t((m) => m.home.totalExpenses)}
            value={monthExpenses}
            chip={t((m) => m.home.expensesCount, { count: monthExpenseList.length })}
            viewLabel={t((m) => m.home.view)}
            Icon={ReceiptDuoIcon}
            onPress={() => navigation.navigate('Month')}
            style={styles.statHalf}
          />
          <GradientStatCard
            delay={720}
            gradient={monthProfit >= 0 ? gradients.green : gradients.red}
            glow={monthProfit >= 0 ? 'rgba(34,164,71,0.32)' : 'rgba(239,68,68,0.32)'}
            label={t((m) => m.home.profit)}
            value={monthProfit}
            chip={t((m) => m.home.margin, { percent: margin })}
            viewLabel={t((m) => m.home.view)}
            Icon={TrophyDuoIcon}
            onPress={() => navigation.navigate('Month')}
            style={styles.statFull}
          />
        </View>
      </ScrollView>
    </Screen>
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
  brandLogo: {
    marginTop: 1,
  },
  brandName: {
    fontFamily: fonts.bold,
    fontSize: 20,
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
    paddingTop: 12,
    paddingBottom: 20,
    gap: 16,
  },
  trialSlot: {
    position: 'absolute',
    top: -14,
    right: 54,
    zIndex: 2,
  },
  panel: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    gap: 12,
    boxShadow: '0px 4px 14px rgba(15,23,42,0.05)',
  },
  panelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  panelTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  sectionHead: {
    marginTop: 4,
    marginBottom: -6,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewAllText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  statHalf: {
    width: '48%',
  },
  statFull: {
    width: '100%',
  },
});
