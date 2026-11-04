import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { CloseDayModal } from '../components/CloseDayModal';
import { Toast, useToast } from '../components/Toast';
import { FillButton, Screen, SyncNotice } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useBooks } from '../context/BooksContext';
import { useI18n } from '../context/LocaleContext';
import { formatRs, isSameDay, startOfDay, sum } from '../lib/format';
import { dayClosedAt, dayKey, openingBalanceForDay } from '../lib/dayKey';
import {
  buildDayCloseReportText,
  buildDayCloseSummary,
  printDayCloseReport,
  shareDayCloseWhatsApp,
} from '../lib/dayClose';
import { useRole } from '../lib/roles';
import { usesKitchenStock } from '../lib/shopType';
import { changePercent } from '../lib/stats';
import { markOpeningPromptDay, needsOpeningBalancePrompt, readOpeningPromptDay } from '../lib/openingPrompt';
import { usePrintFeedback } from '../lib/usePrintFeedback';
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
  const { books, error, loading, setTodayOpeningBalance, editTodayOpeningBalance, todayClosed, closeToday, resumeToday } = useBooks();
  const { t } = useI18n();
  const { colors } = useTheme();
  const { canAccess, profile } = useShopGate();
  const { can, role } = useRole();
  const isCashier = role === 'cashier';
  const isOwner = role === 'owner';
  const showKitchen = usesKitchenStock(profile?.shopType ?? user?.shopType) && can('manageStock');
  const salesOn = useFeature('sales');
  const expensesOn = useFeature('expenses');
  const productsOn = useFeature('products');
  const reportsOn = useFeature('reports');
  const flags = { sales: salesOn, expenses: expensesOn, products: productsOn, reports: reportsOn };
  const homeActions = ACTIONS.filter((action) => {
    if (!flags[action.flag]) return false;
    if (!isCashier) return true;
    return action.key === 'sale' || action.key === 'credit';
  });
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
  const daySummary = useMemo(() => buildDayCloseSummary(books, now), [books, todayKey]);
  const closedAt = dayClosedAt(books.meta, now);

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
        await markOpeningPromptDay(now);
        setLocalPromptDay(dayKey(now));
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
    [openingInput, setTodayOpeningBalance, t],
  );

  const startOpeningEdit = useCallback(() => {
    setOpeningInput(String(openingToday));
    setOpeningEditing(true);
  }, [openingToday]);

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
      printDayCloseReport(user?.shopName ?? 'KadaBook', daySummary, closedAt),
    );
    if (!result) return;
    if (result.ok) toast.show('success', t((m) => m.reportsTab.printOk));
    else Alert.alert(t((m) => m.home.closeFailed), result.message);
  }, [closePrintFx, closedAt, daySummary, t, toast, user?.shopName]);

  const runCloseWhatsApp = useCallback(async () => {
    const text = buildDayCloseReportText(user?.shopName ?? 'KadaBook', daySummary, closedAt);
    const result = await closeShareFx.run(() => shareDayCloseWhatsApp(text));
    if (!result) return;
    if (result.ok) toast.show('success', t((m) => m.reportsTab.shareOk));
    else Alert.alert(t((m) => m.home.closeFailed), result.message);
  }, [closeShareFx, closedAt, daySummary, t, toast, user?.shopName]);

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
    <Screen>
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
        {todayClosed ? (
          <View style={[styles.dayCloseBanner, { backgroundColor: colors.white, borderColor: colors.hairline }]}>
            <Text style={[styles.dayCloseBannerText, { color: colors.ink }]}>{t((m) => m.home.dayClosedBanner)}</Text>
            <View style={styles.dayCloseBannerActions}>
              <FillButton
                label={t((m) => m.home.resumeSales)}
                onPress={() => {
                  void confirmResumeDay();
                }}
                busy={closeBusy}
                color={colors.saleText}
              />
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
            onLongPress={isOwner ? startOpeningEdit : undefined}
          />
          {!isCashier ? (
            <View style={styles.trialSlot}>
              <TrialChip />
            </View>
          ) : null}
        </View>
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
            {showKitchen && !isCashier ? (
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
        {salesOn && !todayClosed ? (
          <View style={styles.dayCloseBottom}>
            <FillButton
              label={t((m) => m.home.closeDay)}
              onPress={() => setCloseModal(true)}
              color={colors.brand}
            />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  dayCloseBottom: {
    marginTop: 18,
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
