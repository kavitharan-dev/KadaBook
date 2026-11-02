import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { collection, getDocs } from 'firebase/firestore';
import { PlanComparison } from '../components/PlanComparison';
import { SettingsRow } from '../components/SettingsRow';
import { ErrorText, Field, FillButton, Header, Screen } from '../components/ui';
import { useI18n } from '../context/LocaleContext';
import { useShopGate } from '../context/ShopGateContext';
import { useTheme } from '../context/ThemeContext';
import { getFirestoreDb } from '../firebase/client';
import { formatDay, formatRs } from '../lib/format';
import { loadReceiptSettings, saveReceiptSettings, type ReceiptSettings } from '../lib/receiptSettings';
import { fonts } from '../theme/fonts';

export function SettingsMenuScreen() {
  const navigation = useNavigation();
  const { t } = useI18n();
  return (
    <Screen>
      <Header title={t((m) => m.settings.title)} onBack={() => navigation.goBack()} />
      <ScrollView>
        <SettingsRow
          title={t((m) => m.tips.title)}
          subtitle={t((m) => m.tips.endSaleTitle)}
          onPress={() => navigation.navigate('TipsHelp' as never)}
        />
        <SettingsRow
          title={t((m) => m.settings.receiptTitle)}
          subtitle={t((m) => m.settings.receiptSub)}
          onPress={() => navigation.navigate('ReceiptSettings' as never)}
        />
        <SettingsRow
          title="Credit & WhatsApp"
          subtitle="Shop WhatsApp number, reminder and receipt messages"
          onPress={() => navigation.navigate('CreditSettings' as never)}
        />
        <SettingsRow
          title={t((m) => m.settings.themeTitle)}
          subtitle={t((m) => m.settings.themeSub)}
          onPress={() => navigation.navigate('ThemeSettings' as never)}
        />
        <SettingsRow
          title={t((m) => m.settings.upgradeTitle)}
          subtitle={t((m) => m.settings.upgradeSub)}
          onPress={() => navigation.navigate('UpgradePlan' as never)}
        />
      </ScrollView>
    </Screen>
  );
}

export function ReceiptSettingsScreen() {
  const navigation = useNavigation();
  const { t } = useI18n();
  const { colors } = useTheme();
  const [settings, setSettings] = useState<ReceiptSettings | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadReceiptSettings().then(setSettings);
  }, []);

  async function save() {
    if (!settings) return;
    await saveReceiptSettings(settings);
    setMessage(t((m) => m.settings.saved));
  }

  if (!settings) return null;

  return (
    <Screen>
      <Header title={t((m) => m.settings.receiptTitle)} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.label, { color: colors.muted }]}>{t((m) => m.settings.invoicePrefix)}</Text>
        <Field value={settings.invoicePrefix} onChangeText={(v) => setSettings({ ...settings, invoicePrefix: v })} />
        <Text style={[styles.label, { color: colors.muted }]}>{t((m) => m.settings.shopLine)}</Text>
        <Field value={settings.shopLine} onChangeText={(v) => setSettings({ ...settings, shopLine: v })} />
        <Text style={[styles.label, { color: colors.muted }]}>{t((m) => m.settings.footerLine)}</Text>
        <Field value={settings.footerLine} onChangeText={(v) => setSettings({ ...settings, footerLine: v })} />
        <Text style={[styles.label, { color: colors.muted }]}>{t((m) => m.settings.paperSize)}</Text>
        <View style={styles.row}>
          {([58, 80] as const).map((mm) => (
            <Pressable
              key={mm}
              onPress={() => setSettings({ ...settings, paperMm: mm })}
              style={[styles.chip, settings.paperMm === mm && { borderColor: colors.brand }]}
            >
              <Text style={{ color: colors.ink, fontFamily: fonts.semibold }}>{mm}mm</Text>
            </Pressable>
          ))}
        </View>
        <FillButton label={t((m) => m.common.save)} onPress={() => save()} />
        {message ? <Text style={[styles.ok, { color: colors.saleText }]}>{message}</Text> : null}
      </ScrollView>
    </Screen>
  );
}

export function ThemeSettingsScreen() {
  const navigation = useNavigation();
  const { t } = useI18n();
  const { theme, setTheme, colors } = useTheme();

  return (
    <Screen>
      <Header title={t((m) => m.settings.themeTitle)} onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        {(['light', 'dark'] as const).map((mode) => {
          const on = theme === mode;
          return (
            <Pressable
              key={mode}
              onPress={() => setTheme(mode)}
              style={[styles.themeRow, { borderColor: colors.line }, on && { borderColor: colors.brand }]}
            >
              <Text style={{ color: colors.ink, fontFamily: fonts.semibold }}>
                {mode === 'light' ? t((m) => m.settings.themeLight) : t((m) => m.settings.themeDark)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

// Admin panel plans live in this Firestore collection. Change the name if yours differs.
const PLANS_COLLECTION = 'plans';
const DAY_MS = 24 * 60 * 60 * 1000;
const RENEW_WINDOW_DAYS = 14;

type AdminPlan = { id: string; name: string; price: number; days: number; active: boolean };

export function UpgradePlanScreen() {
  const navigation = useNavigation();
  const { t } = useI18n();
  const { colors } = useTheme();
  const { openRenewWhatsApp, subscription, status, profile } = useShopGate();
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getDocs(collection(getFirestoreDb(), PLANS_COLLECTION))
      .then((snap) => {
        if (!alive) return;
        const list: AdminPlan[] = snap.docs
          .map((d) => {
            const x = d.data() as Record<string, unknown>;
            return {
              id: d.id,
              name: String(x.name ?? x.label ?? x.title ?? d.id),
              price: Number(x.price ?? x.priceRs ?? x.amount ?? 0),
              days: Number(x.days ?? x.durationDays ?? x.duration ?? 0),
              active: x.active !== false,
            };
          })
          .filter((p) => p.active && p.price > 0) // hides Free trial
          .sort((a, b) => a.price - b.price);
        setPlans(list);
      })
      .catch(() => {
        if (alive) setError('Could not load plans. Check internet and try again.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const expiresAt = subscription?.expiresAt ?? 0;
  const daysLeft = expiresAt ? Math.ceil((expiresAt - Date.now()) / DAY_MS) : 0;

  // Cheapest ~monthly plan is the baseline for "save x%" on longer plans.
  const monthlyBase = plans
    .filter((p) => p.days > 0 && p.days <= 31)
    .reduce<number | null>((min, p) => (min === null || p.price < min ? p.price : min), null);

  function deal(p: AdminPlan) {
    if (!monthlyBase || p.days < 60) return null;
    const perMonth = Math.round((p.price / p.days) * 30);
    const save = Math.round((1 - perMonth / monthlyBase) * 100);
    return save > 0 ? { perMonth, save } : null;
  }

  function isCurrent(p: AdminPlan) {
    if (status !== 'active' || !subscription) return false;
    const current = subscription.plan.toLowerCase();
    return current === p.id.toLowerCase() || current === p.name.toLowerCase();
  }

  function buyNow(p: AdminPlan, renew: boolean) {
    const shop = profile?.shopName ?? '-';
    const phone = profile?.phone ?? '-';
    openRenewWhatsApp(
      `${renew ? 'Hi, I want to renew my KadaBook plan.' : 'Hi, I want to activate a plan in KadaBook.'}\n\nPlan: ${p.name}\nPrice: ${formatRs(p.price)}\nDuration: ${p.days} days\nShop: ${shop}\nPhone: ${phone}`,
    );
    setNotice('Send the WhatsApp message. Your plan will be activated after payment.');
  }

  return (
    <Screen>
      <Header title={t((m) => m.settings.upgradeTitle)} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.hint, { color: colors.muted }]}>{t((m) => m.settings.upgradeHint)}</Text>
        {loading ? <ActivityIndicator color={colors.brand} /> : null}
        {plans.map((item) => {
          const active = isCurrent(item);
          const renewable = active && daysLeft <= RENEW_WINDOW_DAYS;
          const saving = deal(item);
          return (
            <View key={item.id} style={[styles.planCard, { borderColor: colors.hairline }]}>
              <Text style={[styles.planTitle, { color: colors.ink }]}>{item.name}</Text>
              <Text style={[styles.planPrice, { color: colors.brand }]}>{formatRs(item.price)}</Text>
              <Text style={[styles.planPeriod, { color: colors.muted }]}>
                {item.days} days
                {saving ? ` · ${formatRs(saving.perMonth)} / month · save ${saving.save}%` : ''}
              </Text>
              {active && expiresAt ? (
                <Text style={[styles.planPeriod, { color: colors.saleText }]}>
                  Active until {formatDay(expiresAt)} ·{' '}
                  {daysLeft > 0 ? `${daysLeft} days left` : 'expires today'}
                </Text>
              ) : null}
              <FillButton
                label={active ? (renewable ? 'Renew' : t((m) => m.settings.currentPlan)) : t((m) => m.settings.buyNow)}
                onPress={() => buyNow(item, active)}
                color={active && !renewable ? colors.muted : colors.brand}
                disabled={active && !renewable}
              />
            </View>
          );
        })}
        <PlanComparison />
        {notice ? <Text style={[styles.ok, { color: colors.saleText }]}>{notice}</Text> : null}
        <ErrorText message={error} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: 16,
    gap: 12,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ok: {
    textAlign: 'center',
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  themeRow: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    justifyContent: 'center',
    marginBottom: 10,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  planCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  planTitle: {
    fontFamily: fonts.bold,
    fontSize: 17,
  },
  planPrice: {
    fontFamily: fonts.bold,
    fontSize: 22,
  },
  planPeriod: {
    fontFamily: fonts.regular,
    fontSize: 13,
  },
});
