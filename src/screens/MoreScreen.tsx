import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { markSignedOut, usePinLock } from '../components/PinLockGate';
import { ErrorText, Field, FillButton, Header, Screen } from '../components/ui';
import type { Locale } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { useBooks } from '../context/BooksContext';
import { ROLE_LABEL, useRole } from '../lib/roles';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../context/LocaleContext';
import { useShopGate } from '../context/ShopGateContext';
import { displayAccount } from '../data/repository';
import { resolveQuickSaleProfitPercent } from '../lib/dayClose';
import type { AppStackParamList, TabParamList } from '../navigation/types';
import { APP_VERSION, BUILD_TAG } from '../config/build';
import * as Updates from 'expo-updates';
import { printThermalText } from '../lib/thermalPrinter';
import { usesKitchenStock } from '../lib/shopType';
import type { ColorPalette } from '../theme/palettes';
import { useStyleSheet } from '../theme/useStyleSheet';
import { fonts } from '../theme/fonts';

const LANGS: { code: Locale; labelKey: 'langEn' | 'langTa' | 'langSi' }[] = [
  { code: 'en', labelKey: 'langEn' },
  { code: 'ta', labelKey: 'langTa' },
  { code: 'si', labelKey: 'langSi' },
];

function Section({ label, children }: { label: string; children: ReactNode }) {
  const styles = useStyleSheet(moreStyles);
  return (
    <View>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Row({
  title,
  subtitle,
  onPress,
  last,
  right,
}: {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  last?: boolean;
  right?: ReactNode;
}) {
  const styles = useStyleSheet(moreStyles);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, !last && styles.rowLine, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? (
          <Text style={styles.rowSub} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress ? <Text style={styles.chevron}>›</Text> : null)}
    </Pressable>
  );
}

/** Phone accounts are stored as <number>@phone.kadabook.app; show just the number. */
const prettyAccount = (value: string) => value.replace(/@phone\.kadabook\.app$/i, '');

export function MoreScreen() {
  const styles = useStyleSheet(moreStyles);
  const navigation = useNavigation<
    CompositeNavigationProp<BottomTabNavigationProp<TabParamList, 'More'>, NativeStackNavigationProp<AppStackParamList>>
  >();
  const { user, cloud, signOut, updateShopName } = useAuth();
  const { books, setQuickSaleProfitPercent } = useBooks();
  const { role, can } = useRole();
  const isOwner = role === 'owner';
  const { profile, status, trialDays, subscription } = useShopGate();
  const { changePin, pinEnabled, enablePin, disablePin } = usePinLock();
  const { colors } = useTheme();
  const { locale, setLocale, t } = useI18n();
  const { width } = useWindowDimensions();
  const wide = width >= 700;

  // Real shop name comes from the account profile; fall back to the signed-in user.
  const currentName =
    profile?.shopName && profile.shopName !== 'Shop' ? profile.shopName : (user?.shopName ?? '');
  const account = prettyAccount(
    (user ? displayAccount(user) : '') || profile?.email || profile?.phone || '-',
  );
  const shopType = profile?.shopType ?? user?.shopType;
  const showKitchen = usesKitchenStock(shopType);
  const savedQuickPct = resolveQuickSaleProfitPercent(books.meta);

  const [shopName, setShopName] = useState(currentName);
  const [quickPctInput, setQuickPctInput] = useState(String(savedQuickPct));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setShopName(currentName);
  }, [currentName]);

  useEffect(() => {
    setQuickPctInput(String(savedQuickPct));
  }, [savedQuickPct]);

  async function saveName() {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      await updateShopName(shopName.trim());
      setMessage(t((m) => m.more.shopSaved));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t((m) => m.more.shopError));
    } finally {
      setBusy(false);
    }
  }

  async function saveQuickProfit() {
    setError(null);
    setMessage(null);
    const value = Math.round(Number(quickPctInput));
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      setError(t((m) => m.more.quickProfitError));
      return;
    }
    setBusy(true);
    try {
      await setQuickSaleProfitPercent(value);
      setMessage(t((m) => m.more.quickProfitSaved));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t((m) => m.more.quickProfitError));
    } finally {
      setBusy(false);
    }
  }

  async function testPrinter() {
    try {
      const device = await printThermalText(`KadaBook\n${currentName || 'Shop'}\nPrinter test OK\n`);
      Alert.alert('Printer connected', device.name || device.address);
    } catch (caught) {
      Alert.alert('Printer', caught instanceof Error ? caught.message : 'Could not print.');
    }
  }

  const planName = subscription?.plan
    ? subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)
    : '';
  const chip =
    status === 'trial'
      ? `Trial · ${trialDays} days left`
      : status === 'active'
        ? planName
          ? `Active · ${planName}`
          : 'Active'
        : status === 'expired'
          ? 'Plan expired'
          : String(status);
  const initial = (currentName.trim()[0] ?? 'K').toUpperCase();

  return (
    <Screen>
      <Header title={t((m) => m.more.title)} onBack={() => navigation.navigate('Home')} />
      <ScrollView
        contentContainerStyle={[styles.body, wide && styles.bodyWide]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={['#1D5FE0', '#3B82F6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroTop}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroName} numberOfLines={1}>
                {currentName || 'KadaBook'}
              </Text>
              <Text style={styles.heroAccount} numberOfLines={1}>
                {account}
              </Text>
            </View>
          </View>
          <View style={styles.heroRow}>
            <View style={styles.chip}>
              <Text style={styles.chipText}>{chip}</Text>
            </View>
            {isOwner ? (
              <Pressable onPress={() => navigation.navigate('UpgradePlan')} style={styles.upgradeBtn}>
                <Text style={styles.upgradeText}>
                  {status === 'expired' ? t((m) => m.gate.renewWhatsApp) : t((m) => m.settings.upgradeTitle)}
                </Text>
              </Pressable>
            ) : (
              <View style={[styles.upgradeBtn, { opacity: 0.85 }]}>
                <Text style={styles.upgradeText}>{ROLE_LABEL[role]}</Text>
              </View>
            )}
          </View>
        </LinearGradient>

        <Section label={t((m) => m.common.account)}>
          <View style={styles.cardPad}>
            <View>
              <Text style={styles.fieldLabel}>Signed in as</Text>
              <Text style={styles.fieldValue} numberOfLines={1}>
                {user?.staffName ? `${user.staffName} · ` : ''}
                {account} · {ROLE_LABEL[role]}
              </Text>
            </View>
            {can('shopSettings') ? (
              <>
                <View style={styles.divider} />
                <Text style={styles.fieldLabel}>{t((m) => m.more.shopName)}</Text>
                <Field value={shopName} onChangeText={setShopName} placeholder={t((m) => m.more.shopName)} />
                <FillButton
                  label={t((m) => m.more.saveShop)}
                  onPress={saveName}
                  busy={busy}
                  disabled={busy || !shopName.trim() || shopName.trim() === currentName}
                />
                <View style={styles.divider} />
                <Text style={styles.fieldLabel}>{t((m) => m.more.quickProfitPercent)}</Text>
                <Text style={styles.fieldHint}>{t((m) => m.more.quickProfitPercentHint)}</Text>
                <Field
                  value={quickPctInput}
                  onChangeText={setQuickPctInput}
                  placeholder="10"
                  keyboardType="number-pad"
                />
                <FillButton
                  label={t((m) => m.more.saveQuickProfit)}
                  onPress={saveQuickProfit}
                  busy={busy}
                  disabled={busy || String(savedQuickPct) === quickPctInput.trim()}
                />
              </>
            ) : null}
            <ErrorText message={error} />
            {message ? <Text style={styles.ok}>{message}</Text> : null}
          </View>
        </Section>

        <Section label="Security">
          <Row
            title="PIN lock"
            subtitle={pinEnabled ? 'Ask for a PIN when the app opens' : 'Off. Anyone can open the app'}
            onPress={pinEnabled ? disablePin : enablePin}
            last={!pinEnabled}
            right={
              <Switch
                value={pinEnabled}
                onValueChange={(on) => (on ? enablePin() : disablePin())}
                trackColor={{ true: colors.brand, false: colors.hairline }}
                thumbColor={colors.white}
              />
            }
          />
          {pinEnabled ? (
            <Row title="Change PIN" subtitle="Set a new 4-digit PIN" onPress={changePin} last />
          ) : null}
        </Section>

        <Section label={t((m) => m.more.language)}>
          <View style={styles.cardPad}>
            <View style={styles.langRow}>
              {LANGS.map((item) => {
                const active = locale === item.code;
                return (
                  <Pressable
                    key={item.code}
                    onPress={() => setLocale(item.code)}
                    style={[styles.langChip, active && styles.langChipOn]}
                  >
                    <Text style={[styles.langChipText, active && styles.langChipTextOn]}>
                      {t((m) => m.more[item.labelKey])}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Section>

        <Section label="Shop tools">
          {can('collectCredit') ? (
            <Row
              title="Credit book"
              subtitle="Customer dues, collect payments, WhatsApp reminders"
              onPress={() => navigation.navigate('CreditBook')}
            />
          ) : null}
          {can('manageStock') && showKitchen ? (
            <Row
              title="Kitchen & Stock"
              subtitle="Raw materials, recipe cost, branches, transfers, variance"
              onPress={() => navigation.navigate('Kitchen')}
            />
          ) : null}
          {can('exportData') ? (
            <Row
              title="Excel export & import"
              subtitle="Export sales, expenses, stock to .xlsx · bulk import products"
              onPress={() => navigation.navigate('DataTools')}
            />
          ) : null}
          {can('manageStaff') ? (
            <Row
              title="Staff & roles"
              subtitle="Branches, cashier and manager logins, what each person can do"
              onPress={() => navigation.navigate('Staff')}
            />
          ) : null}
          {can('viewAudit') ? (
            <Row
              title="Audit log"
              subtitle="Who deleted, edited or changed what, and when"
              onPress={() => navigation.navigate('AuditLog')}
            />
          ) : null}
          {can('shopSettings') ? (
            <Row
              title={t((m) => m.settings.openSettings)}
              subtitle={t((m) => m.settings.receiptSub)}
              onPress={() => navigation.navigate('SettingsMenu')}
            />
          ) : null}
          <Row
            title={t((m) => m.settings.themeTitle)}
            subtitle={t((m) => m.settings.themeSub)}
            onPress={() => navigation.navigate('ThemeSettings')}
          />
          <Row
            title="Bluetooth printer"
            subtitle="Switch on the PT-210 printer, then tap to print a test."
            onPress={testPrinter}
          />
          <Row
            title={t((m) => m.tips.title)}
            subtitle={t((m) => m.tips.endSaleTitle)}
            onPress={() => navigation.navigate('TipsHelp')}
            last
          />
        </Section>

        {!cloud ? (
          <View style={styles.setup}>
            <Text style={styles.setupTitle}>{t((m) => m.more.firebaseTitle)}</Text>
            <Text style={styles.hint}>
              1. Create a project at console.firebase.google.com{'\n'}
              2. Turn on Authentication → Email/Password{'\n'}
              3. Create Firestore database{'\n'}
              4. Copy web app keys into .env (see .env.example){'\n'}
              5. Run: firebase deploy --only firestore:rules{'\n'}
              6. Restart Expo (npx expo start)
            </Text>
          </View>
        ) : null}

        <Section label="About">
          <Row title="Developed by" subtitle="Matrix Smart Store" />
          <Row title="Version" subtitle={`KadaBook v${APP_VERSION}`} />
          <Row title="Update tag" subtitle={BUILD_TAG} />
          <Row
            title="Check for update"
            subtitle="Tap to download the latest OTA now"
            last
            onPress={async () => {
              try {
                if (__DEV__ || !Updates.isEnabled) {
                  Alert.alert('Update', 'Updates are off in this build (dev or disabled). Install the preview APK.');
                  return;
                }
                const channel = Updates.channel ?? '(none)';
                const runtime = Updates.runtimeVersion ?? '(none)';
                const check = await Updates.checkForUpdateAsync();
                if (!check.isAvailable) {
                  Alert.alert(
                    'Update',
                    `No new update.\nChannel: ${channel}\nRuntime: ${runtime}\nCurrent: ${Updates.updateId ?? 'embedded'}`,
                  );
                  return;
                }
                Alert.alert('Update', 'Downloading…');
                await Updates.fetchUpdateAsync();
                await Updates.reloadAsync();
              } catch (error) {
                Alert.alert('Update failed', error instanceof Error ? error.message : String(error));
              }
            }}
          />
        </Section>

        <Pressable
          onPress={async () => {
            await markSignedOut(user?.uid);
            await signOut();
          }}
          style={styles.signOut}
        >
          <Text style={styles.signOutText}>{t((m) => m.more.signOut)}</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function moreStyles(c: ColorPalette) {
  return {
    body: {
      paddingHorizontal: 16,
      paddingBottom: 28,
      gap: 18,
      flexGrow: 1,
    },
    bodyWide: {
      width: '100%',
      maxWidth: 560,
      alignSelf: 'center',
    },
    hero: {
      borderRadius: 22,
      padding: 18,
      gap: 16,
    },
    heroTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: 'rgba(255,255,255,0.22)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontFamily: fonts.bold,
      fontSize: 24,
      color: '#FFFFFF',
    },
    heroCopy: {
      flex: 1,
      gap: 2,
    },
    heroName: {
      fontFamily: fonts.bold,
      fontSize: 19,
      color: '#FFFFFF',
    },
    heroAccount: {
      fontFamily: fonts.regular,
      fontSize: 13,
      color: 'rgba(255,255,255,0.88)',
    },
    heroRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    chip: {
      flexShrink: 1,
      borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.2)',
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    chipText: {
      fontFamily: fonts.semibold,
      fontSize: 12,
      color: '#FFFFFF',
    },
    upgradeBtn: {
      borderRadius: 12,
      backgroundColor: '#FFFFFF',
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    upgradeText: {
      fontFamily: fonts.semibold,
      fontSize: 13,
      color: '#1D5FE0',
    },
    sectionLabel: {
      marginBottom: 8,
      marginLeft: 4,
      fontFamily: fonts.semibold,
      fontSize: 12,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: c.muted,
    },
    card: {
      borderWidth: 1,
      borderColor: c.hairline,
      borderRadius: 18,
      backgroundColor: c.white,
      overflow: 'hidden',
    },
    cardPad: {
      padding: 16,
      gap: 12,
    },
    divider: {
      height: 1,
      backgroundColor: c.rowLine,
    },
    row: {
      minHeight: 60,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    rowLine: {
      borderBottomWidth: 1,
      borderBottomColor: c.rowLine,
    },
    rowCopy: {
      flex: 1,
      gap: 2,
    },
    rowTitle: {
      fontFamily: fonts.semibold,
      fontSize: 15,
      color: c.ink,
    },
    rowSub: {
      fontFamily: fonts.regular,
      fontSize: 12,
      lineHeight: 17,
      color: c.muted,
    },
    chevron: {
      fontSize: 26,
      lineHeight: 28,
      color: c.muted,
    },
    fieldLabel: {
      fontFamily: fonts.regular,
      fontSize: 12,
      color: c.muted,
    },
    fieldHint: {
      fontFamily: fonts.regular,
      fontSize: 12,
      lineHeight: 17,
      color: c.muted,
      marginBottom: 4,
    },
    typeHint: {
      fontFamily: fonts.regular,
      fontSize: 12,
      lineHeight: 17,
      color: c.muted,
      marginTop: -4,
    },
    typeRow: {
      flexDirection: 'row',
      gap: 8,
    },
    typeChip: {
      flex: 1,
      minHeight: 44,
      borderWidth: 1.5,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    typeChipText: {
      fontFamily: fonts.semibold,
      fontSize: 13,
      textAlign: 'center',
    },
    fieldValue: {
      marginTop: 2,
      fontFamily: fonts.semibold,
      fontSize: 15,
      color: c.ink,
    },
    logoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
    logo: { width: 56, height: 56, borderRadius: 12 },
    logoActions: { gap: 6 },
    langRow: {
      flexDirection: 'row',
      gap: 8,
    },
    langChip: {
      flex: 1,
      minHeight: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.line,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    langChipOn: {
      borderColor: c.brand,
      backgroundColor: c.gradientTop,
    },
    langChipText: {
      fontFamily: fonts.semibold,
      fontSize: 13,
      color: c.ink,
      textAlign: 'center',
    },
    langChipTextOn: {
      color: c.brand,
    },
    ok: {
      textAlign: 'center',
      fontFamily: fonts.semibold,
      fontSize: 13,
      color: c.saleText,
    },
    setup: {
      borderWidth: 1,
      borderColor: c.hairline,
      borderRadius: 18,
      padding: 16,
      gap: 6,
    },
    setupTitle: {
      fontFamily: fonts.semibold,
      fontSize: 15,
      color: c.ink,
      marginBottom: 4,
    },
    hint: {
      fontFamily: fonts.regular,
      fontSize: 13,
      lineHeight: 18,
      color: c.muted,
    },
    signOut: {
      height: 52,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    signOutText: {
      fontFamily: fonts.semibold,
      fontSize: 15,
      color: c.expenseText,
    },
  };
}
