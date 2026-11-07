import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
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
import { GradientStatCard, HERO_GRADIENT, HeroSalesCard, gradients, statCardBg } from '../components/DashboardCards';
import { Designable } from '../devtools/designMode/Designable';
import { homeLayout } from '../designConfig/home';
import { FadeUp } from '../components/FadeUp';
import { PulsingDot } from '../components/PulsingDot';
import { AppLogo } from '../components/AppLogo';
import { RemoteHomePromo } from '../components/RemoteHomePromo';
import { OpeningBalanceModal } from '../components/OpeningBalanceModal';
import { CloseDayModal } from '../components/CloseDayModal';
import { Toast, useToast } from '../components/Toast';
import { FillButton, Screen, SyncNotice } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useBooks } from '../context/BooksContext';
import { useKitchen } from '../context/KitchenContext';
import { useI18n } from '../context/LocaleContext';
import { BranchChips } from '../components/kitchen/KitchenUi';
import { BranchSalesCard } from '../components/BranchSalesCard';
import { BranchStockCard } from '../components/BranchStockCard';
import { scopeBooks } from '../lib/branchScope';
import { formatRs, isSameDay, startOfDay, sum } from '../lib/format';
import { dayClosedAt, dayKey, openingBalanceForDay } from '../lib/dayKey';
import {
  buildDayCloseReportText,
  buildAttachedPeriodSummary,
  buildDayCloseSummary,
  isStockPurchase,
  printDayCloseReport,
  shareDayCloseWhatsApp,
} from '../lib/dayClose';
import { buildKitchenDayReportExtras } from '../lib/kitchenDailyReport';
import { useRole } from '../lib/roles';
import { usesKitchenStock } from '../lib/shopType';
import { markOpeningPromptDay, needsOpeningBalancePrompt, readOpeningPromptDay } from '../lib/openingPrompt';
import type { TierFeature } from '../lib/tiers';
import { usePrintFeedback } from '../lib/usePrintFeedback';
import { useTier } from '../lib/useTier';
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

const ACTIONS: {
  key: string;
  labelKey: 'newSale' | 'addExpense' | 'creditBook' | 'products' | 'reports';
  gradient: readonly [string, string, ...string[]];
  route: 'NewSale' | 'AddExpense' | 'CreditBook' | 'Products' | 'Reports';
  Icon: typeof CartDuoIcon;
  feature: 'addSale' | 'addExpense' | 'manageProducts' | 'viewReports';
  flag: 'sales' | 'expenses' | 'products' | 'reports';
  needs: 'addSale' | 'addExpense' | 'collectCredit' | 'manageProducts' | 'viewReports';
  /** Plan tick(s) — any match unlocks the tile. */
  planAny: TierFeature[];
}[] = [
  { key: 'sale', labelKey: 'newSale', gradient: gradients.green, route: 'NewSale', Icon: CartDuoIcon, feature: 'addSale', flag: 'sales', needs: 'addSale', planAny: ['quickSale', 'productSale'] },
  { key: 'expense', labelKey: 'addExpense', gradient: gradients.orange, route: 'AddExpense', Icon: ReceiptDuoIcon, feature: 'addExpense', flag: 'expenses', needs: 'addExpense', planAny: ['expenses'] },
  { key: 'credit', labelKey: 'creditBook', gradient: gradients.teal, route: 'CreditBook', Icon: BookDuoIcon, feature: 'addSale', flag: 'sales', needs: 'collectCredit', planAny: ['creditBook'] },
  { key: 'products', labelKey: 'products', gradient: gradients.purple, route: 'Products', Icon: BoxDuoIcon, feature: 'manageProducts', flag: 'products', needs: 'manageProducts', planAny: ['products'] },
  { key: 'reports', labelKey: 'reports', gradient: gradients.blue, route: 'Reports', Icon: ChartDuoIcon, feature: 'viewReports', flag: 'reports', needs: 'viewReports', planAny: ['fullReports'] },
];

const DASHBOARD_BACKGROUND = require('../../assets/dashboard/dashboard-bg.png');

export function HomeScreen() {
  const navigation = useNavigation<CompositeNavigationProp<
    BottomTabNavigationProp<TabParamList, 'Home'>,
    NativeStackNavigationProp<AppStackParamList>
  >>();
  const { user } = useAuth();
  const { books, error, loading, dayBranch, setTodayOpeningBalance, editTodayOpeningBalance, todayClosed, closeToday, resumeToday } = useBooks();
  const kitchen = useKitchen();
  const branches = kitchen.data.branches;
  // Everything on this screen follows the branch switcher; staff tied to a branch only ever see theirs.
  const scoped = useMemo(() => scopeBooks(books, kitchen.scope, branches), [books, kitchen.scope, branches]);
  const { locale, t } = useI18n();
  const { colors } = useTheme();
  const { canAccess, profile } = useShopGate();
  const { can, role } = useRole();
  const { has } = useTier();
  const isCashier = role === 'cashier';
  const isOwner = role === 'owner';
  const showKitchen =
    usesKitchenStock(profile?.shopType ?? user?.shopType) && can('manageStock') && has('kitchenStock');
  const salesOn = useFeature('sales');
  const expensesOn = useFeature('expenses');
  const productsOn = useFeature('products');
  const reportsOn = useFeature('reports');
  const flags = { sales: salesOn, expenses: expensesOn, products: productsOn, reports: reportsOn };
  const homeActions = ACTIONS.filter(
    (action) => flags[action.flag] && can(action.needs) && action.planAny.some((f) => has(f)),
  );
  const canCloseDay = can('closeDay');
  const canSeeReports = can('viewReports') && has('fullReports');
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [chromeHeight, setChromeHeight] = useState(0);
  const [scrollContentHeight, setScrollContentHeight] = useState(0);
  const bgHeight = Math.max(screenHeight, insets.top + chromeHeight + scrollContentHeight);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [openingModal, setOpeningModal] = useState(false);
  const [openingEditing, setOpeningEditing] = useState(false);
  const [openingInput, setOpeningInput] = useState('');
  const [openingBusy, setOpeningBusy] = useState(false);
  const [closeModal, setCloseModal] = useState(false);
  const [closeBusy, setCloseBusy] = useState(false);
  const toast = useToast();
  const closePrintFx = usePrintFeedback();
  const closeShareFx = usePrintFeedback();
  const [localPromptDay, setLocalPromptDay] = useState<string | null>(null);
  const [promptReady, setPromptReady] = useState(false);
  const now = Date.now();
  const todayKey = dayKey(now);
  const yesterday = startOfDay(now) - 24 * 60 * 60 * 1000;
  const openingToday = openingBalanceForDay(scoped.meta, now);
  const salesTodayList = scoped.sales.filter((sale) => isSameDay(sale.createdAt, now));
  const salesToday = sum(salesTodayList);
  const todaySales = salesToday;
  const yesterdaySales = sum(scoped.sales.filter((sale) => isSameDay(sale.createdAt, yesterday)));
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const monthSaleList = scoped.sales.filter((sale) => sale.createdAt >= monthStart);
  const monthExpenseList = scoped.expenses.filter((expense) => expense.createdAt >= monthStart);
  const monthSales = sum(monthSaleList);
  const monthRunning = monthExpenseList.filter((expense) => !isStockPurchase(expense));
  const monthExpenses = sum(monthRunning);
  const monthPurchases = sum(monthExpenseList) - monthExpenses;
  // Cost is already in each bill's profit, so stock purchases must not come off again.
  const monthProfit = useMemo(
    () => buildAttachedPeriodSummary(scoped, { start: monthStart, end: startOfDay(now) + 24 * 60 * 60 * 1000 }, 'month').weeklyFinal,
    [scoped, monthStart, todayKey],
  );
  const margin = monthSales > 0 ? Math.round((monthProfit / monthSales) * 100) : 0;
  const hasToday = todaySales > 0 || scoped.expenses.some((expense) => isSameDay(expense.createdAt, now));
  const daySummary = useMemo(() => buildDayCloseSummary(scoped, now), [scoped, todayKey]);
  const kitchenReport = useMemo(() => {
    if (!usesKitchenStock(profile?.shopType ?? user?.shopType)) return null;
    return buildKitchenDayReportExtras(kitchen.data, scoped, kitchen.scope, now);
  }, [profile?.shopType, user?.shopType, kitchen.data, kitchen.scope, scoped, todayKey]);
  const closedAt = dayClosedAt(books.meta, now, dayBranch);

  useEffect(() => {
    readOpeningPromptDay().then((day) => {
      setLocalPromptDay(day);
      setPromptReady(true);
    });
  }, []);

  useEffect(() => {
    if (loading || kitchen.loading || !promptReady) return;
    // "All branches" has no single drawer to count, so only ask once one branch is chosen.
    setOpeningModal(!kitchen.viewAll && needsOpeningBalancePrompt(books.meta, Date.now(), localPromptDay, dayBranch));
  }, [loading, kitchen.loading, kitchen.viewAll, promptReady, books.meta.openingBalances, books.meta.branchDays, dayBranch, localPromptDay, todayKey]);

  // New calendar day → dismiss close/resume sheet (Resume is same-day only).
  useEffect(() => {
    setCloseModal(false);
  }, [todayKey]);

  const confirmOpening = useCallback(
    async (skip: boolean) => {
      setOpeningBusy(true);
      try {
        const value = skip ? 0 : Math.max(0, Math.round(Number(openingInput) || 0));
        await setTodayOpeningBalance(value);
        setLocalPromptDay(await markOpeningPromptDay(now, dayBranch));
        setOpeningModal(false);
        setOpeningInput('');
      } catch (caught) {
        Alert.alert(
          t((m) => m.sale.openingTitle),
          caught instanceof Error ? caught.message : t((m) => m.sale.errorSave),
        );
      } finally {
        setOpeningBusy(false);
      }
    },
    [dayBranch, openingInput, setTodayOpeningBalance, t],
  );

  const startOpeningEdit = useCallback(() => {
    if (kitchen.viewAll) {
      toast.show('error', t((m) => m.home.pickBranchFirst));
      return;
    }
    setOpeningInput(String(openingToday));
    setOpeningEditing(true);
  }, [kitchen.viewAll, openingToday, t, toast]);

  const cancelOpeningEdit = useCallback(() => {
    setOpeningEditing(false);
    setOpeningInput('');
  }, []);

  const saveOpeningEdit = useCallback(async () => {
    setOpeningBusy(true);
    try {
      await editTodayOpeningBalance(Math.max(0, Math.round(Number(openingInput) || 0)));
      setOpeningEditing(false);
      setOpeningInput('');
    } catch (caught) {
      Alert.alert(
        t((m) => m.sale.openingEditTitle),
        caught instanceof Error ? caught.message : t((m) => m.sale.errorSave),
      );
    } finally {
      setOpeningBusy(false);
    }
  }, [editTodayOpeningBalance, openingInput, t]);

  const runClosePrint = useCallback(async () => {
    const result = await closePrintFx.run(() =>
      printDayCloseReport(user?.shopName ?? 'KadaBook', daySummary, closedAt, kitchenReport),
    );
    if (!result) return;
    if (result.ok) toast.show('success', t((m) => m.reportsTab.printOk));
    else Alert.alert(t((m) => m.home.closeFailed), result.message);
  }, [closePrintFx, closedAt, daySummary, kitchenReport, t, toast, user?.shopName]);

  const runCloseWhatsApp = useCallback(async () => {
    const text = buildDayCloseReportText(user?.shopName ?? 'KadaBook', daySummary, closedAt, kitchenReport);
    const result = await closeShareFx.run(() => shareDayCloseWhatsApp(text));
    if (!result) return;
    if (result.ok) toast.show('success', t((m) => m.reportsTab.shareOk));
    else Alert.alert(t((m) => m.home.closeFailed), result.message);
  }, [closeShareFx, closedAt, daySummary, kitchenReport, t, toast, user?.shopName]);

  const confirmCloseDay = useCallback(async () => {
    setCloseBusy(true);
    try {
      await closeToday();
      toast.show('success', t((m) => m.home.dayClosedTitle));
      setCloseModal(false);
    } catch (caught) {
      Alert.alert(
        t((m) => m.home.closeFailed),
        caught instanceof Error ? caught.message : t((m) => m.home.closeFailed),
      );
    } finally {
      setCloseBusy(false);
    }
  }, [closeToday, t, toast]);

  const confirmResumeDay = useCallback(async () => {
    setCloseBusy(true);
    try {
      await resumeToday();
      setCloseModal(false);
    } catch (caught) {
      Alert.alert(
        t((m) => m.home.resumeFailed),
        caught instanceof Error ? caught.message : t((m) => m.home.resumeFailed),
      );
    } finally {
      setCloseBusy(false);
    }
  }, [resumeToday, t]);

  return (
    <Screen
      edgeToEdgeTop
      background={
        <ImageBackground source={DASHBOARD_BACKGROUND} resizeMode="cover" style={[styles.dashboardBg, { height: bgHeight }]} pointerEvents="none" />
      }
    >
      <StatusBar style="light" />
      <AccessBlockedModal visible={blockedOpen} onClose={() => setBlockedOpen(false)} />
      <OpeningBalanceModal
        visible={openingModal || openingEditing}
        value={openingInput}
        onChangeValue={setOpeningInput}
        busy={openingBusy}
        editing={openingEditing}
        onSkip={() => (openingEditing ? cancelOpeningEdit() : confirmOpening(true))}
        onSave={() => (openingEditing ? saveOpeningEdit() : confirmOpening(false))}
      />
      <Toast toast={toast.toast} onHide={toast.hide} />
      <CloseDayModal
        visible={closeModal}
        summary={daySummary}
        alreadyClosed={todayClosed}
        busy={closeBusy}
        printPhase={closePrintFx.phase}
        sharePhase={closeShareFx.phase}
        shopName={user?.shopName ?? 'KadaBook'}
        kitchen={kitchenReport}
        onClose={() => setCloseModal(false)}
        onPrint={() => {
          void runClosePrint();
        }}
        onWhatsApp={() => {
          void runCloseWhatsApp();
        }}
        onConfirmClose={() => {
          void confirmCloseDay();
        }}
        onResume={() => {
          void confirmResumeDay();
        }}
      />
      <View onLayout={(e) => setChromeHeight(e.nativeEvent.layout.height)}>
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
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={(_w, h) => setScrollContentHeight(h)}
      >
        <RemoteHomePromo />
        <HomeAnnouncementBanner />
        <SyncNotice
          message={error ? `${error} ${t((m) => m.home.syncError)}` : null}
        />
        {branches.length > 1 && !kitchen.branchLocked ? (
          <BranchChips branches={branches} value={kitchen.scope} onChange={kitchen.setScope} />
        ) : null}
        {todayClosed && !kitchen.viewAll ? (
          <View style={[styles.dayCloseBanner, { backgroundColor: colors.white, borderColor: colors.hairline }]}>
            <Text style={[styles.dayCloseBannerText, { color: colors.ink }]}>{t((m) => m.home.dayClosedBanner)}</Text>
            <View style={styles.dayCloseBannerActions}>
              {canCloseDay ? (
                <FillButton
                  label={t((m) => m.home.resumeSales)}
                  onPress={() => {
                    void confirmResumeDay();
                  }}
                  busy={closeBusy}
                  color={colors.saleText}
                />
              ) : null}
              <FillButton
                label={t((m) => m.home.viewDayClose)}
                onPress={() => setCloseModal(true)}
                busy={closeBusy}
                color={colors.line}
              />
            </View>
          </View>
        ) : null}
        <View>
          <HeroSalesCard
            delay={40}
            title={t((m) => m.home.dashboard)}
            subtitle={t((m) => m.home.dashboardSub)}
            label={t((m) => m.home.todaySales)}
            amount={todaySales}
            yesterdayAmount={yesterdaySales}
            locale={locale}
            vsLabel={t((m) => m.home.vsYesterday)}
            neutralLabel={t((m) => m.home.trendNeutral)}
            newLabel={t((m) => m.home.trendNew)}
            viewLabel={t((m) => m.home.view)}
            Icon={TrendDuoIcon}
            onPress={() => navigation.navigate('Sales')}
            onLongPress={isOwner ? startOpeningEdit : undefined}
          />
          {!isCashier ? (
            <View style={styles.trialSlot}>
              <TrialChip />
            </View>
          ) : null}
        </View>
        <BranchStockCard />
        {canSeeReports ? <BranchSalesCard sales={salesTodayList} branches={branches} /> : null}
        <FadeUp delay={160} style={[styles.panel, { backgroundColor: colors.white, borderColor: colors.hairline }]}>
          <View style={[styles.panelHead, { borderBottomColor: colors.hairline }]}>
            <GridDuoIcon color={colors.brand} size={18} />
            <Text style={[styles.panelTitle, { color: colors.brand }]}>{t((m) => m.home.quickActions)}</Text>
          </View>
          <View style={styles.grid}>
            {homeActions.map((action, index) => (
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
                  // When closed, still open New Sale so the closed banner + Resume show.
                  navigation.navigate(action.route);
                }}
              />
            ))}
            {showKitchen ? (
              <HomeActionTile
                key="kitchen"
                delay={220 + homeActions.length * 90}
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
        {canSeeReports ? (
        <>
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
            gradient={gradients.blue}
            glow="rgba(0,74,224,0.32)"
            bgImage={statCardBg.sales}
            label={t((m) => m.home.totalSales)}
            value={monthSales}
            chip={t((m) => m.home.salesCount, { count: monthSaleList.length })}
            Icon={CartDuoIcon}
            onPress={() => navigation.navigate('Month')}
            style={styles.statHalf}
          />
          <GradientStatCard
            delay={640}
            gradient={gradients.orange}
            glow="rgba(253,100,2,0.32)"
            bgImage={statCardBg.expense}
            label={t((m) => m.home.totalExpenses)}
            value={monthExpenses}
            chip={monthPurchases > 0 ? `Stock ${formatRs(monthPurchases)}` : t((m) => m.home.expensesCount, { count: monthRunning.length })}
            Icon={ReceiptDuoIcon}
            onPress={() => navigation.navigate('Month')}
            style={styles.statHalf}
          />
          <GradientStatCard
            delay={720}
            gradient={monthProfit >= 0 ? gradients.green : gradients.red}
            glow={monthProfit >= 0 ? 'rgba(2,134,37,0.32)' : 'rgba(243,40,42,0.32)'}
            bgImage={monthProfit >= 0 ? statCardBg.profit : undefined}
            label={t((m) => m.home.profit)}
            value={monthProfit}
            chip={t((m) => m.home.margin, { percent: margin })}
            Icon={TrophyDuoIcon}
            onPress={() => navigation.navigate('Month')}
            style={styles.statFull}
          />
        </View>
        </>
        ) : null}
        {salesOn && canCloseDay && (kitchen.viewAll || !todayClosed) ? (
          <Designable screen="home" id="closeDayButton" base={homeLayout.closeDayButton} offsetKey="marginTop">
            {(v) => (
              <View style={[styles.dayCloseBottom, { marginTop: v.marginTop }]}>
                <FillButton
                  label={t((m) => m.home.closeDay)}
                  onPress={() => {
                    if (kitchen.viewAll) toast.show('error', t((m) => m.home.pickBranchFirst));
                    else setCloseModal(true);
                  }}
                  gradient={HERO_GRADIENT}
                  height={v.height}
                  borderRadius={v.borderRadius}
                />
              </View>
            )}
          </Designable>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  dayCloseBottom: {
    marginBottom: 8,
  },
  dayCloseBanner: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 10,
    marginBottom: 10,
  },
  dayCloseBannerText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 19,
  },
  dayCloseBannerActions: {
    gap: 8,
  },
  top: {
    minHeight: 52,
    paddingHorizontal: 8,
    paddingTop: 8,
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
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 15,
    shadowColor: '#123E92',
    shadowOpacity: 0.16,
    shadowRadius: 9,
    elevation: 3,
  },
  iconPressInner: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashboardBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
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
    paddingTop: 8,
    paddingBottom: 16,
    gap: 12,
  },
  scroll: {
    backgroundColor: 'transparent',
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
    padding: 10,
    gap: 8,
    boxShadow: '0px 4px 14px rgba(15,23,42,0.05)',
  },
  panelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    paddingBottom: 7,
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
    rowGap: 8,
  },
  sectionHead: {
    marginTop: 2,
    marginBottom: -4,
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
    rowGap: 10,
  },
  statHalf: {
    width: '48%',
  },
  statFull: {
    width: '100%',
  },
});
