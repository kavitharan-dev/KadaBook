import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppLogo } from '../components/AppLogo';
import { SettingsRow } from '../components/SettingsRow';
import { ErrorText, Field, FillButton, Screen } from '../components/ui';
import type { Locale } from '../i18n';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/LocaleContext';
import { displayAccount } from '../data/repository';
import type { AppStackParamList, TabParamList } from '../navigation/types';
import { APP_VERSION, BUILD_TAG } from '../config/build';
import { printThermalText } from '../lib/thermalPrinter';
import type { ColorPalette } from '../theme/palettes';
import { useStyleSheet } from '../theme/useStyleSheet';
import { fonts } from '../theme/fonts';

const LANGS: { code: Locale; labelKey: 'langEn' | 'langTa' | 'langSi' }[] = [
  { code: 'en', labelKey: 'langEn' },
  { code: 'ta', labelKey: 'langTa' },
  { code: 'si', labelKey: 'langSi' },
];

export function MoreScreen() {
  const styles = useStyleSheet(moreStyles);
  const navigation = useNavigation<
    CompositeNavigationProp<BottomTabNavigationProp<TabParamList, 'More'>, NativeStackNavigationProp<AppStackParamList>>
  >();
  const { user, cloud, signOut, updateShopName } = useAuth();
  const { locale, setLocale, t } = useI18n();
  const [shopName, setShopName] = useState(user?.shopName ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function saveName() {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      await updateShopName(shopName);
      setMessage(t((m) => m.more.shopSaved));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t((m) => m.more.shopError));
    } finally {
      setBusy(false);
    }
  }

  const buildTag = BUILD_TAG;
  const appVersion = APP_VERSION;

  async function testPrinter() {
    try {
      const device = await printThermalText('KadaBook\nMatrix Smart Store\nPrinter test OK\n');
      Alert.alert('Printer connected', device.name || device.address);
    } catch (caught) {
      Alert.alert('Printer', caught instanceof Error ? caught.message : 'Could not print.');
    }
  }

  return (
    <Screen>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{t((m) => m.more.title)}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <SettingsRow
          title={t((m) => m.settings.openSettings)}
          subtitle={t((m) => m.settings.receiptSub)}
          onPress={() => navigation.navigate('SettingsMenu')}
        />
        <SettingsRow
          title={t((m) => m.tips.title)}
          subtitle={t((m) => m.tips.endSaleTitle)}
          onPress={() => navigation.navigate('TipsHelp')}
        />
        <SettingsRow
          title="Bluetooth printer"
          subtitle="Pair MTP / PT200 in phone settings. PIN 0000. Tap to print a test."
          onPress={testPrinter}
        />
        <Text style={styles.label}>{t((m) => m.more.language)}</Text>
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
        <Text style={styles.label}>{t((m) => m.more.shopName)}</Text>
        <Field value={shopName} onChangeText={setShopName} placeholder={t((m) => m.more.shopName)} />
        <FillButton label={t((m) => m.more.saveShop)} onPress={saveName} busy={busy} />
        <ErrorText message={error} />
        {message ? <Text style={styles.ok}>{message}</Text> : null}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t((m) => m.common.account)}</Text>
          <Text style={styles.cardValue}>{user ? displayAccount(user) : ''}</Text>
          <Text style={styles.cardLabel}>{t((m) => m.common.companyName)}</Text>
          <Text style={styles.cardValue}>Matrix Smart Store</Text>
        </View>
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
        <View style={{ alignItems: 'center', gap: 8, marginTop: 8 }}>
          <AppLogo size={48} />
          <Text style={styles.build}>
            KadaBook v{appVersion} · {buildTag}
          </Text>
        </View>
        <Pressable onPress={() => signOut()} style={styles.signOut}>
          <Text style={styles.signOutText}>{t((m) => m.more.signOut)}</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function moreStyles(c: ColorPalette) {
  return {
  titleRow: {
    minHeight: 56,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 19,
    color: c.ink,
  },
  body: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 12,
    flexGrow: 1,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: c.muted,
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
  card: {
    borderWidth: 1,
    borderColor: c.hairline,
    borderRadius: 16,
    padding: 16,
    gap: 4,
  },
  cardLabel: {
    marginTop: 6,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.muted,
  },
  cardValue: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: c.ink,
  },
  setup: {
    borderWidth: 1,
    borderColor: c.hairline,
    borderRadius: 16,
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
  apkBtn: {
    marginTop: 8,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: c.brand,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  apkBtnText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: '#fff',
  },
  build: {
    marginTop: 8,
    textAlign: 'center',
    fontFamily: fonts.regular,
    fontSize: 11,
    color: c.muted,
  },
  signOut: {
    height: 52,
    borderRadius: 12,
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
