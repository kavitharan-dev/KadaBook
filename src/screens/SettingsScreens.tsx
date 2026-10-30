import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SettingsRow } from '../components/SettingsRow';
import { ErrorText, Field, FillButton, Header, Screen } from '../components/ui';
import { useI18n } from '../context/LocaleContext';
import { useTheme } from '../context/ThemeContext';
import { loadReceiptSettings, saveReceiptSettings, type ReceiptSettings } from '../lib/receiptSettings';
import { PLANS, loadSubscription, saveSubscription, type PlanId } from '../lib/subscription';
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

export function UpgradePlanScreen() {
  const navigation = useNavigation();
  const { t } = useI18n();
  const { colors } = useTheme();
  const [plan, setPlan] = useState<PlanId>('free');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    loadSubscription().then((s) => setPlan(s.plan));
  }, []);

  async function choose(id: PlanId) {
    await saveSubscription(id);
    setPlan(id);
    setNotice(t((m) => m.settings.planUpdated));
  }

  return (
    <Screen>
      <Header title={t((m) => m.settings.upgradeTitle)} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.hint, { color: colors.muted }]}>{t((m) => m.settings.upgradeHint)}</Text>
        {PLANS.filter((p) => p.id !== 'free').map((item) => {
          const active = plan === item.id;
          return (
            <View key={item.id} style={[styles.planCard, { borderColor: colors.hairline }]}>
              <Text style={[styles.planTitle, { color: colors.ink }]}>{item.label}</Text>
              <Text style={[styles.planPrice, { color: colors.brand }]}>Rs {item.priceRs.toLocaleString('en-IN')}</Text>
              <Text style={[styles.planPeriod, { color: colors.muted }]}>{item.period}</Text>
              <FillButton
                label={active ? t((m) => m.settings.currentPlan) : t((m) => m.settings.buyNow)}
                onPress={() => choose(item.id)}
                color={active ? colors.muted : colors.brand}
                disabled={active}
              />
            </View>
          );
        })}
        {notice ? <Text style={[styles.ok, { color: colors.saleText }]}>{notice}</Text> : null}
        <ErrorText message={null} />
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
