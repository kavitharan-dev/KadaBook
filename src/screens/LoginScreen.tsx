import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { FadeUp } from '../components/FadeUp';
import { LoginForm } from '../components/LoginForm';
import { AppLogo } from '../components/AppLogo';
import { ShopIllustration } from '../components/ShopIllustration';
import { timings } from '../animation/timings';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/LocaleContext';
import { useTheme } from '../context/ThemeContext';
import type { AuthStackParamList } from '../navigation/types';
import { fonts } from '../theme/fonts';

export function LoginScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { signIn } = useAuth();
  const { locale, t } = useI18n();
  const { theme, colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function login(identity: string, password: string) {
    setError(null);
    setBusy(true);
    try {
      await signIn(identity, password);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <LinearGradient
      colors={[colors.gradientTop, colors.white]}
      locations={[0, 0.75]}
      style={styles.screen}
    >
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        bounces={false}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        <AppLogo size={132} />
        <FadeUp delay={timings.copyDelayMs} style={styles.copy}>
          <Text style={[styles.wordmark, { color: colors.ink }]}>
            Kada<Text style={[styles.wordmarkAccent, { color: colors.brand }]}>Book</Text>
          </Text>
          <Text style={[styles.tagline, { color: colors.muted }]}>{t((m) => m.login.taglineEn)}</Text>
          <Text style={[styles.tamil, { color: colors.brand }]}>
            {locale === 'si' ? t((m) => m.login.taglineSi) : t((m) => m.login.taglineTa)}
          </Text>
        </FadeUp>
        <FadeUp delay={timings.formDelayMs} style={styles.formWrap}>
          <LoginForm
            busy={busy}
            error={error}
            onLogin={login}
            onForgot={() => navigation.navigate('ForgotPassword')}
            onCreate={() => navigation.navigate('SignUp')}
          />
        </FadeUp>
        <View style={styles.footer}>
          <ShopIllustration />
          <Text style={[styles.footerText, { color: colors.brand }]}>
            {t((m) => m.login.footerLine1)}{'\n'}{t((m) => m.login.footerLine2)}
          </Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingTop: 64,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  copy: {
    alignItems: 'center',
  },
  wordmark: {
    marginTop: 8,
    fontFamily: fonts.bold,
    fontSize: 34,
    includeFontPadding: false,
  },
  wordmarkAccent: {
    fontFamily: fonts.bold,
  },
  tagline: {
    marginTop: 2,
    fontFamily: fonts.regular,
    fontSize: 13,
    textAlign: 'center',
    includeFontPadding: false,
  },
  tamil: {
    marginTop: 2,
    fontFamily: fonts.tamilSemibold,
    fontSize: 14,
    textAlign: 'center',
    includeFontPadding: false,
  },
  formWrap: {
    width: '100%',
  },
  cloudNote: {
    marginTop: 12,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  footer: {
    width: '100%',
    marginTop: 'auto',
    alignItems: 'center',
    paddingBottom: 28,
  },
  footerText: {
    marginTop: 8,
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    includeFontPadding: false,
  },
});
