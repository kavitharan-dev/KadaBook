import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Image, Pressable, ScrollView, Switch, Text, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import {
  BookDuoIcon,
  CameraIcon,
  ChevronRightIcon,
  ClipboardDuoIcon,
  DocumentDuoIcon,
  FileExportDuoIcon,
  GearIcon,
  GlobeOutlineIcon,
  GridDuoIcon,
  HelpCircleIcon,
  InfoCircleIcon,
  LockIcon,
  LogOutIcon,
  PrinterIcon,
  ShieldIcon,
  StoreIcon,
  SunIcon,
  TrendDuoIcon,
  UsersDuoIcon,
} from '../components/Icons';
import { AboutModal } from '../components/AboutModal';
import { markSignedOut, usePinLock } from '../components/PinLockGate';
import { ErrorText, Field, FillButton, Header, Screen } from '../components/ui';
import type { Locale } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { useAvatar } from '../hooks/useAvatar';
import { useBooks } from '../context/BooksContext';
import { ROLE_LABEL, useRole } from '../lib/roles';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../context/LocaleContext';
import { useShopGate } from '../context/ShopGateContext';
import { displayAccount } from '../data/repository';
import { resolveQuickSaleProfitPercent } from '../lib/dayClose';
import { formatShortDay } from '../lib/format';
import type { AppStackParamList, TabParamList } from '../navigation/types';
import { APP_VERSION, BUILD_TAG } from '../config/build';
import * as Updates from 'expo-updates';
import { printThermalText } from '../lib/thermalPrinter';
import { usesKitchenStock } from '../lib/shopType';
import { useTier } from '../lib/useTier';
import type { ColorPalette } from '../theme/palettes';
import { useStyleSheet } from '../theme/useStyleSheet';
import { fonts } from '../theme/fonts';

const LANGS: { code: Locale; labelKey: 'langEn' | 'langTa' | 'langSi' }[] = [
  { code: 'en', labelKey: 'langEn' },
  { code: 'ta', labelKey: 'langTa' },
  { code: 'si', labelKey: 'langSi' },
];

type IconType = typeof GearIcon;

function Section({
  label,
  Icon,
  tint,
  children,
}: {
  label: string;
  Icon?: IconType;
  tint?: string;
  children: ReactNode;
}) {
  const styles = useStyleSheet(moreStyles);
  const { colors } = useTheme();
  return (
    <View>
      <View style={styles.sectionHead}>
        {Icon ? (
          <View style={[styles.sectionIconWrap, { backgroundColor: (tint ?? colors.brand) + '1A' }]}>
            <Icon color={tint ?? colors.brand} size={14} />
          </View>
        ) : null}
        <Text style={styles.sectionLabel}>{label}</Text>
      </View>
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
  Icon,
  tint,
}: {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  last?: boolean;
  right?: ReactNode;
  Icon?: IconType;
  tint?: string;
}) {
  const styles = useStyleSheet(moreStyles);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, !last && styles.rowLine, pressed && { opacity: 0.7 }]}
    >
      {Icon ? (
        <View style={[styles.rowIconWrap, { backgroundColor: tint ?? '#64748B' }]}>
          <Icon color="#FFFFFF" size={17} />
        </View>
      ) : null}
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

/** Chevron that rotates to point down when the row it's attached to is expanded. */
function DisclosureChevron({ open, color }: { open: boolean; color: string }) {
  return (
    <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
      <ChevronRightIcon color={color} size={20} />
    </View>
  );
}

/** Phone accounts are stored as <number>@phone.kadabook.app; show just the number. */
const prettyAccount = (value: string) => value.replace(/@phone\.kadabook\.app$/i, '');

export function MoreScreen() {
  const styles = useStyleSheet(moreStyles);
  const navigation = useNavigation<
    CompositeNavigationProp<BottomTabNavigationProp<TabParamList, 'More'>, NativeStackNavigationProp<AppStackParamList>>
  >();
  const { user, signOut } = useAuth();
  const { books, setQuickSaleProfitPercent } = useBooks();
  const { role, can } = useRole();
  const isOwner = role === 'owner';
  const { profile, status, trialDays, subscription } = useShopGate();
  const { changePin, pinEnabled, enablePin, disablePin } = usePinLock();
  const { colors } = useTheme();
  const { locale, setLocale, t } = useI18n();
  const { width } = useWindowDimensions();
  const wide = width >= 700;
  const avatar = useAvatar(user?.uid);

  // Real shop name comes from the account profile; fall back to the signed-in user.
  const currentName =
    profile?.shopName && profile.shopName !== 'Shop' ? profile.shopName : (user?.shopName ?? '');
  const account = prettyAccount(
    (user ? displayAccount(user) : '') || profile?.email || profile?.phone || '-',
  );
  const shopType = profile?.shopType ?? user?.shopType;
  const showKitchen = usesKitchenStock(shopType);
  const { has } = useTier();
  const savedQuickPct = resolveQuickSaleProfitPercent(books.meta);

  const [quickPctInput, setQuickPctInput] = useState(String(savedQuickPct));
  const [quickExpanded, setQuickExpanded] = useState(false);
  const [langExpanded, setLangExpanded] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setQuickPctInput(String(savedQuickPct));
  }, [savedQuickPct]);

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
  const expiresAt = subscription?.expiresAt;
  const startsAt = subscription?.startsAt;
  const daysLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000))) : null;
  const chipTitle =
    status === 'trial'
      ? 'Trial'
      : status === 'active'
        ? planName || 'Active'
        : status === 'expired'
          ? 'Plan expired'
          : String(status);
  const chipDetail =
    status === 'trial'
      ? `${trialDays} days left`
      : status === 'active' && expiresAt
        ? `${startsAt ? `${formatShortDay(startsAt)} – ` : 'Till '}${formatShortDay(expiresAt)} · ${daysLeft}d left`
        : status === 'expired' && expiresAt
          ? `Expired ${formatShortDay(expiresAt)}`
          : null;
  const initial = (currentName.trim()[0] ?? 'K').toUpperCase();

  return (
    <Screen>
      <AboutModal visible={aboutOpen} onClose={() => setAboutOpen(false)} />
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
            <Pressable onPress={avatar.pick} style={styles.avatar} disabled={avatar.busy}>
              {avatar.uri ? (
                <Image source={{ uri: avatar.uri }} style={{ width: 64, height: 64, borderRadius: 32 }} />
              ) : (
                <Text style={styles.avatarText}>{initial}</Text>
              )}
              <View style={styles.avatarEditBadge}>
                <CameraIcon color="#1D5FE0" size={12} />
              </View>
            </Pressable>
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
              <Text style={styles.chipText}>{chipTitle}</Text>
              {chipDetail ? <Text style={styles.chipDetailText}>{chipDetail}</Text> : null}
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

        {can('shopSettings') ? (
          <Section label="Shop details" Icon={UsersDuoIcon} tint="#1D5FE0">
            <Row
              title="Shop details"
              subtitle={currentName || 'Add your shop name'}
              onPress={() => navigation.navigate('ShopDetails')}
              Icon={StoreIcon}
              tint="#1D5FE0"
            />
            <Row
              title={t((m) => m.more.quickProfitPercent)}
              subtitle={quickExpanded ? t((m) => m.more.quickProfitPercentHint) : `${savedQuickPct}%`}
              onPress={() => setQuickExpanded((v) => !v)}
              Icon={TrendDuoIcon}
              tint="#1D5FE0"
              last={!quickExpanded}
              right={<DisclosureChevron open={quickExpanded} color={colors.muted} />}
            />
            {quickExpanded ? (
              <View style={[styles.cardPad, styles.rowLine]}>
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
                <ErrorText message={error} />
                {message ? <Text style={styles.ok}>{message}</Text> : null}
              </View>
            ) : null}
          </Section>
        ) : null}

        <Section label="Preferences" Icon={SunIcon} tint="#D97706">
          <Row
            title={t((m) => m.more.language)}
            subtitle={t((m) => m.more[LANGS.find((l) => l.code === locale)?.labelKey ?? 'langEn'])}
            onPress={() => setLangExpanded((v) => !v)}
            Icon={GlobeOutlineIcon}
            tint="#D97706"
            right={<DisclosureChevron open={langExpanded} color={colors.muted} />}
          />
          {langExpanded ? (
            <View style={[styles.cardPad, styles.rowLine]}>
              <View style={styles.langRow}>
                {LANGS.map((item) => {
                  const active = locale === item.code;
                  return (
                    <Pressable
                      key={item.code}
                      onPress={() => {
                        setLocale(item.code);
                        setLangExpanded(false);
                      }}
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
          ) : null}
          <Row
            title={t((m) => m.settings.themeTitle)}
            subtitle={t((m) => m.settings.themeSub)}
            onPress={() => navigation.navigate('ThemeSettings')}
            Icon={SunIcon}
            tint="#D97706"
            last
          />
        </Section>

        <Section label="Security & team" Icon={ShieldIcon} tint="#DC2626">
          <Row
            title="PIN lock"
            subtitle={pinEnabled ? 'Ask for a PIN when the app opens' : 'Off. Anyone can open the app'}
            onPress={pinEnabled ? disablePin : enablePin}
            Icon={LockIcon}
            tint="#4F46E5"
            last={!pinEnabled && !can('manageStaff') && !can('viewAudit')}
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
            <Row
              title="Change PIN"
              subtitle="Set a new 4-digit PIN"
              onPress={changePin}
              Icon={LockIcon}
              tint="#4F46E5"
              last={!can('manageStaff') && !can('viewAudit')}
            />
          ) : null}
          {can('manageStaff') ? (
            <Row
              title={has('staff') ? 'Staff & roles' : '🔒 Staff & roles'}
              subtitle={
                has('staff')
                  ? 'Branches, cashier and manager logins, what each person can do'
                  : 'Locked — ask admin to enable staff add-on'
              }
              onPress={() => navigation.navigate('Staff')}
              Icon={UsersDuoIcon}
              tint="#7C3AED"
              last={!can('viewAudit')}
            />
          ) : null}
          {can('viewAudit') ? (
            <Row
              title={has('staff') ? 'Audit log' : '🔒 Audit log'}
              subtitle={
                has('staff')
                  ? 'Who deleted, edited or changed what, and when'
                  : 'Locked — ask admin to enable staff add-on'
              }
              onPress={() => navigation.navigate('AuditLog')}
              Icon={ClipboardDuoIcon}
              tint="#DB2777"
              last
            />
          ) : null}
        </Section>

        <Section label="Business tools" Icon={GridDuoIcon} tint="#15803D">
          {can('collectCredit') ? (
            <Row
              title={has('creditBook') ? 'Credit book' : '🔒 Credit book'}
              subtitle={
                has('creditBook')
                  ? 'Customer dues, collect payments, WhatsApp reminders'
                  : 'Locked — ask admin to enable this add-on'
              }
              onPress={() => navigation.navigate('CreditBook')}
              Icon={BookDuoIcon}
              tint="#0F766E"
            />
          ) : null}
          {can('manageStock') && showKitchen ? (
            <Row
              title={has('kitchenStock') ? 'Kitchen' : '🔒 Kitchen'}
              subtitle={
                has('kitchenStock')
                  ? 'Buy, send to branch, make food'
                  : 'Locked — ask admin to enable kitchen add-on'
              }
              onPress={() => navigation.navigate('Kitchen')}
              Icon={GridDuoIcon}
              tint="#EA580C"
            />
          ) : null}
          {can('exportData') ? (
            <Row
              title={has('exportData') ? 'Excel export & import' : '🔒 Excel export & import'}
              subtitle={
                has('exportData')
                  ? 'Export sales, expenses, stock to .xlsx · bulk import products'
                  : 'Locked — ask admin to enable this add-on'
              }
              onPress={() => navigation.navigate('DataTools')}
              Icon={FileExportDuoIcon}
              tint="#15803D"
            />
          ) : null}
          {can('shopSettings') ? (
            <Row
              title={t((m) => m.settings.openSettings)}
              subtitle={t((m) => m.settings.receiptSub)}
              onPress={() => navigation.navigate('SettingsMenu')}
              Icon={GearIcon}
              tint="#334155"
            />
          ) : null}
          <Row
            title="Bluetooth printer"
            subtitle="Switch on the PT-210 printer, then tap to print a test."
            onPress={testPrinter}
            Icon={PrinterIcon}
            tint="#475569"
            last
          />
        </Section>

        <Section label="Support" Icon={HelpCircleIcon} tint="#0369A1">
          <Row
            title={t((m) => m.tips.title)}
            subtitle={t((m) => m.tips.endSaleTitle)}
            onPress={() => navigation.navigate('TipsHelp')}
            Icon={HelpCircleIcon}
            tint="#0369A1"
          />
          <Row
            title="FAQ"
            subtitle="Quick answers to common questions"
            onPress={() => navigation.navigate('Faq')}
            Icon={HelpCircleIcon}
            tint="#0369A1"
            last
          />
        </Section>

        <Section label="Legal" Icon={DocumentDuoIcon} tint="#64748B">
          <Row
            title="Terms & Conditions"
            onPress={() => navigation.navigate('Terms')}
            Icon={DocumentDuoIcon}
            tint="#64748B"
          />
          <Row
            title="Privacy Policy"
            onPress={() => navigation.navigate('Privacy')}
            Icon={DocumentDuoIcon}
            tint="#64748B"
            last
          />
        </Section>

        <Section label="About" Icon={InfoCircleIcon} tint="#64748B">
          <Row title="Developed by" subtitle="SMART PVT LTD" onPress={() => setAboutOpen(true)} Icon={InfoCircleIcon} tint="#64748B" />
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
          <LogOutIcon color={colors.expenseText} size={18} />
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
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: 'rgba(255,255,255,0.22)',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    avatarText: {
      fontFamily: fonts.bold,
      fontSize: 26,
      color: '#FFFFFF',
    },
    avatarEditBadge: {
      position: 'absolute',
      right: -2,
      bottom: -2,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: '#1D5FE0',
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
    chipDetailText: {
      marginTop: 1,
      fontFamily: fonts.regular,
      fontSize: 11,
      color: 'rgba(255,255,255,0.85)',
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
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
      marginLeft: 4,
    },
    sectionIconWrap: {
      width: 22,
      height: 22,
      borderRadius: 7,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionLabel: {
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
    rowIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
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
    signOut: {
      height: 52,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.line,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    signOutText: {
      fontFamily: fonts.semibold,
      fontSize: 15,
      color: c.expenseText,
    },
  };
}
