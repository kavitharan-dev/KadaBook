import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ErrorText, Field, FillButton, Header, Screen } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/LocaleContext';
import type { SignUpInput } from '../data/signUpTypes';
import type { AuthStackParamList } from '../navigation/types';
import type { ColorPalette } from '../theme/palettes';
import { useStyleSheet } from '../theme/useStyleSheet';
import { fonts } from '../theme/fonts';

export function SignUpScreen() {
  const styles = useStyleSheet(authScreensStyles);
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { signUp } = useAuth();
  const { t } = useI18n();
  const [form, setForm] = useState<SignUpInput>({
    shopName: '',
    ownerName: '',
    phone: '',
    district: '',
  });
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await signUp(identity, password, form);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t((m) => m.common.errorGeneric));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Header title={t((m) => m.auth.createTitle)} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Field value={form.shopName} onChangeText={(v) => setForm((f) => ({ ...f, shopName: v }))} placeholder={t((m) => m.auth.shopName)} />
        <Field value={form.ownerName} onChangeText={(v) => setForm((f) => ({ ...f, ownerName: v }))} placeholder={t((m) => m.auth.ownerName)} />
        <Field value={form.phone} onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))} placeholder={t((m) => m.auth.phone)} keyboardType="phone-pad" />
        <Field value={form.district} onChangeText={(v) => setForm((f) => ({ ...f, district: v }))} placeholder={t((m) => m.auth.district)} />
        <Field
          value={identity}
          onChangeText={setIdentity}
          placeholder={t((m) => m.login.emailPhone)}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />
        <Field
          value={password}
          onChangeText={setPassword}
          placeholder={t((m) => m.login.password)}
          secureTextEntry
          autoCapitalize="none"
        />
        <Text style={styles.hint}>{t((m) => m.auth.pendingNote)}</Text>
        <FillButton label={t((m) => m.auth.createBtn)} onPress={submit} busy={busy} />
        <ErrorText message={error} />
        <Pressable onPress={() => navigation.goBack()} style={styles.link}>
          <Text style={styles.linkText}>{t((m) => m.auth.haveAccount)}</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

export function ForgotPasswordScreen() {
  const styles = useStyleSheet(authScreensStyles);
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { resetPassword, cloud } = useAuth();
  const { t } = useI18n();
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      setMessage(await resetPassword(identity, cloud ? undefined : password));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t((m) => m.common.errorGeneric));
    } finally {
      setBusy(false);
    }
  }

  const digitsOnly = identity.replace(/\D/g, '');
  const looksLikePhone = digitsOnly.length >= 8 && !identity.includes('@');

  return (
    <Screen>
      <Header title={t((m) => m.auth.forgotTitle)} onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <Text style={styles.copy}>
          {cloud
            ? looksLikePhone
              ? t((m) => m.auth.forgotPhoneCloud)
              : t((m) => m.auth.forgotCloud)
            : t((m) => m.auth.forgotLocal)}
        </Text>
        <Field
          value={identity}
          onChangeText={setIdentity}
          placeholder={t((m) => m.login.emailPhone)}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />
        {cloud ? null : (
          <Field
            value={password}
            onChangeText={setPassword}
            placeholder={t((m) => m.auth.newPassword)}
            secureTextEntry
            autoCapitalize="none"
          />
        )}
        <FillButton label={t((m) => m.auth.sendReset)} onPress={submit} busy={busy} />
        {message ? <Text style={styles.ok}>{message}</Text> : null}
        <ErrorText message={error} />
      </View>
    </Screen>
  );
}

function authScreensStyles(c: ColorPalette) {
  return {
    body: {
      paddingHorizontal: 20,
      paddingBottom: 24,
      gap: 14,
    },
    hint: {
      fontFamily: fonts.regular,
      fontSize: 12,
      lineHeight: 17,
      color: c.muted,
    },
    link: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    linkText: {
      fontFamily: fonts.semibold,
      fontSize: 14,
      color: c.brand,
    },
    copy: {
      fontFamily: fonts.regular,
      fontSize: 14,
      lineHeight: 20,
      color: c.muted,
    },
    ok: {
      textAlign: 'center',
      fontFamily: fonts.semibold,
      fontSize: 13,
      color: c.saleText,
    },
  };
}
