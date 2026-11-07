import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { doc, getDoc } from 'firebase/firestore';
import { ChatDuoIcon, DocumentDuoIcon, StarDuoIcon } from '../components/Icons';
import { PlanComparison } from '../components/PlanComparison';
import { SettingsRow } from '../components/SettingsRow';
import { Field, FillButton, Header, Screen } from '../components/ui';
import { useI18n } from '../context/LocaleContext';
import { useShopGate } from '../context/ShopGateContext';
import { useTheme } from '../context/ThemeContext';
import { getFirestoreDb } from '../firebase/client';
import { formatDay, formatRs } from '../lib/format';
import { loadReceiptSettings, saveReceiptSettings, type ReceiptSettings } from '../lib/receiptSettings';
import {
  ALL_FEATURES,
  BASIC_FEATURES,
  DEFAULT_FEATURE_PRICE,
  DEFAULT_PLAN_PRICE,
  FEATURE_TITLE,
  STANDARD_FEATURES,
  TIER_LABEL,
  type Tier,
  type TierFeature,
} from '../lib/tiers';
import { useTier } from '../lib/useTier';
import { fonts } from '../theme/fonts';

export function SettingsMenuScreen() {
  const navigation = useNavigation();
  const { t } = useI18n();
  const { colors } = useTheme();
  return (
    <Screen>
      <Header title={t((m) => m.settings.title)} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.menuBody}>
        <View style={[styles.menuCard, { borderColor: colors.hairline, backgroundColor: colors.white }]}>
          <SettingsRow
            title={t((m) => m.settings.receiptTitle)}
            subtitle={t((m) => m.settings.receiptSub)}
            onPress={() => navigation.navigate('ReceiptSettings' as never)}
            Icon={DocumentDuoIcon}
            tint="#334155"
          />
          <SettingsRow
            title="Credit & WhatsApp"
            subtitle="Shop WhatsApp number, reminder and receipt messages"
            onPress={() => navigation.navigate('CreditSettings' as never)}
            Icon={ChatDuoIcon}
            tint="#0F766E"
          />
          <SettingsRow
            title={t((m) => m.settings.upgradeTitle)}
            subtitle={t((m) => m.settings.upgradeSub)}
            onPress={() => navigation.navigate('UpgradePlan' as never)}
            Icon={StarDuoIcon}
            tint="#D97706"
            last
          />
        </View>
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

const DAY_MS = 24 * 60 * 60 * 1000;

type BasePlanKey = 'basic' | 'pro';

export function UpgradePlanScreen() {
  const navigation = useNavigation();
  const { t } = useI18n();
  const { colors } = useTheme();
  const { openRenewWhatsApp, subscription, profile } = useShopGate();
  const { tier, grandfather, has } = useTier();
  const [prices, setPrices] = useState<Record<TierFeature, number>>({ ...DEFAULT_FEATURE_PRICE });
  const [base, setBase] = useState<BasePlanKey>('pro');
  const [enabled, setEnabled] = useState<Set<TierFeature>>(() => new Set(STANDARD_FEATURES));
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getDoc(doc(getFirestoreDb(), 'appConfig', 'featureCatalog'))
      .then((snap) => {
        if (!alive) return;
        const raw = (snap.data()?.prices ?? {}) as Record<string, unknown>;
        const next = { ...DEFAULT_FEATURE_PRICE };
        for (const key of ALL_FEATURES) {
          if (typeof raw[key] === 'number' && Number.isFinite(raw[key])) next[key] = Number(raw[key]);
        }
        setPrices(next);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  // Prefill from live subscription without changing unlock (safe — request only via WhatsApp).
  useEffect(() => {
    const fromSub: BasePlanKey = subscription?.tier === 'basic' ? 'basic' : 'pro';
    setBase(fromSub);
    if (subscription?.featuresConfigured && Array.isArray(subscription.enabledFeatures)) {
      const list = subscription.enabledFeatures.filter((f): f is TierFeature =>
        (ALL_FEATURES as string[]).includes(f),
      );
      setEnabled(new Set(list.length ? list : fromSub === 'basic' ? BASIC_FEATURES : STANDARD_FEATURES));
    } else if (grandfather) {
      // Live shops: show everything ticked (matches current unlock).
      setEnabled(new Set(ALL_FEATURES));
    } else {
      setEnabled(new Set(fromSub === 'basic' ? BASIC_FEATURES : STANDARD_FEATURES));
    }
  }, [subscription?.tier, subscription?.featuresConfigured, subscription?.enabledFeatures, grandfather]);

  const included = base === 'basic' ? BASIC_FEATURES : STANDARD_FEATURES;
  const planPrice = DEFAULT_PLAN_PRICE[base];
  const total = useMemo(() => {
    const includedSet = new Set(included);
    let addons = 0;
    for (const f of enabled) {
      if (includedSet.has(f)) continue;
      addons += Math.max(0, prices[f] ?? DEFAULT_FEATURE_PRICE[f] ?? 0);
    }
    return Math.round(planPrice + addons);
  }, [enabled, included, planPrice, prices]);

  const expiresAt = subscription?.expiresAt ?? 0;
  const daysLeft = expiresAt ? Math.ceil((expiresAt - Date.now()) / DAY_MS) : 0;

  function pickPlan(next: BasePlanKey) {
    setBase(next);
    setEnabled((prev) => {
      const nextSet = new Set(prev);
      for (const f of next === 'basic' ? BASIC_FEATURES : STANDARD_FEATURES) nextSet.add(f);
      return nextSet;
    });
  }

  function toggle(feature: TierFeature) {
    const inPlan = included.includes(feature);
    // Plan-included stay on (can request remove via WhatsApp by unticking extras only;
    // allow untick of included too so shop can ask for a leaner pack).
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(feature)) {
        if (inPlan && [...next].filter((f) => included.includes(f)).length <= 1) return prev;
        next.delete(feature);
      } else next.add(feature);
      return next;
    });
  }

  function activate() {
    const shop = profile?.shopName ?? '-';
    const phone = profile?.phone ?? '-';
    const selected = ALL_FEATURES.filter((f) => enabled.has(f));
    const addons = selected.filter((f) => !included.includes(f));
    const addonLines = addons
      .map((f) => `  • ${FEATURE_TITLE[f]} (+${formatRs(prices[f] ?? DEFAULT_FEATURE_PRICE[f])})`)
      .join('\n');
    const msg = [
      'Hi, I want to activate / update my KadaBook plan.',
      '',
      `Plan: ${TIER_LABEL[base]}`,
      `Plan amount: ${formatRs(planPrice)} / month`,
      addons.length ? `Add-ons:\n${addonLines}` : 'Add-ons: none',
      `Total: ${formatRs(total)} / month`,
      '',
      `Features (${selected.length}): ${selected.map((f) => FEATURE_TITLE[f]).join(', ')}`,
      '',
      `Shop: ${shop}`,
      `Phone: ${phone}`,
    ].join('\n');
    openRenewWhatsApp(msg);
    setNotice('WhatsApp opened. Send the message — admin will activate after payment.');
  }

  return (
    <Screen>
      <Header title={t((m) => m.settings.upgradeTitle)} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.hint, { color: colors.muted }]}>
          Pick Basic or Standard, tick the extras you need, then Activate — WhatsApp opens to admin. Live shops stay
          unlocked until admin saves the new pack.
        </Text>

        {expiresAt ? (
          <Text style={[styles.planPeriod, { color: colors.saleText }]}>
            Current: {TIER_LABEL[tier as Tier] ?? subscription?.plan ?? '—'}
            {grandfather ? ' · all features active' : ''}
            {' · '}
            until {formatDay(expiresAt)}
            {daysLeft > 0 ? ` · ${daysLeft}d left` : ''}
          </Text>
        ) : null}

        <View style={styles.row}>
          {([
            { key: 'basic' as const, label: 'Basic', price: DEFAULT_PLAN_PRICE.basic, blurb: 'Quick sale' },
            { key: 'pro' as const, label: 'Standard', price: DEFAULT_PLAN_PRICE.pro, blurb: 'Products · sale · reports · expenses' },
          ]).map((p) => {
            const on = base === p.key;
            return (
              <Pressable
                key={p.key}
                onPress={() => pickPlan(p.key)}
                style={[
                  styles.planPick,
                  { borderColor: on ? colors.brand : colors.hairline, backgroundColor: colors.white },
                ]}
              >
                <Text style={[styles.planTitle, { color: colors.ink, fontSize: 15 }]}>{p.label}</Text>
                <Text style={[styles.planPrice, { color: colors.brand, fontSize: 18 }]}>{formatRs(p.price)}</Text>
                <Text style={[styles.planPeriod, { color: colors.muted }]}>/ month</Text>
                <Text style={[styles.planPeriod, { color: colors.muted }]}>{p.blurb}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.label, { color: colors.muted }]}>FEATURES (tick what you need)</Text>
        {ALL_FEATURES.map((f) => {
          const on = enabled.has(f);
          const inPlan = included.includes(f);
          const activeNow = has(f);
          const amt = prices[f] ?? DEFAULT_FEATURE_PRICE[f];
          return (
            <Pressable
              key={f}
              onPress={() => toggle(f)}
              style={[
                styles.featureRow,
                {
                  borderColor: on ? colors.brand : colors.hairline,
                  backgroundColor: on ? colors.gradientTop : colors.white,
                },
              ]}
            >
              <Text style={{ color: colors.ink, fontFamily: fonts.bold, fontSize: 16 }}>{on ? '☑' : '☐'}</Text>
              <View style={styles.featureText}>
                <Text style={{ color: colors.ink, fontFamily: fonts.semibold, fontSize: 14 }}>{FEATURE_TITLE[f]}</Text>
                <Text style={{ color: colors.muted, fontFamily: fonts.regular, fontSize: 11 }}>
                  {inPlan ? 'Included in plan' : `Add-on · ${formatRs(amt)}`}
                  {activeNow ? ' · on now' : ''}
                </Text>
              </View>
              {!inPlan ? (
                <Text style={{ color: colors.brand, fontFamily: fonts.bold, fontSize: 13 }}>+{formatRs(amt)}</Text>
              ) : (
                <Text style={{ color: colors.muted, fontFamily: fonts.semibold, fontSize: 12 }}>incl.</Text>
              )}
            </Pressable>
          );
        })}

        <View style={[styles.planCard, { borderColor: colors.hairline, backgroundColor: colors.white }]}>
          <Text style={[styles.planPeriod, { color: colors.muted }]}>
            Plan {formatRs(planPrice)} + add-ons {formatRs(Math.max(0, total - planPrice))}
          </Text>
          <Text style={[styles.planPrice, { color: colors.brand }]}>{formatRs(total)} / month</Text>
          <FillButton label={`Activate · ${formatRs(total)} / mo → WhatsApp`} onPress={activate} />
        </View>

        <PlanComparison />
        {notice ? <Text style={[styles.ok, { color: colors.saleText }]}>{notice}</Text> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: 16,
    gap: 12,
  },
  menuBody: {
    padding: 16,
  },
  menuCard: {
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
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
  planPick: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 12,
    gap: 2,
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
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  featureText: {
    flex: 1,
    gap: 2,
  },
});
