import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ErrorText, Field, FillButton, Header, Screen } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/LocaleContext';
import { useTheme } from '../context/ThemeContext';
import type { SignUpInput } from '../data/signUpTypes';
import type { ShopType } from '../data/types';
import { SHOP_TYPE_HELP, SHOP_TYPE_LABEL } from '../lib/shopType';
import type { AuthStackParamList } from '../navigation/types';
import type { ColorPalette } from '../theme/palettes';
import { useStyleSheet } from '../theme/useStyleSheet';
import { fonts } from '../theme/fonts';

type SignUpStep = 'account' | 'shopType';

export function SignUpScreen() {
  const styles = useStyleSheet(authScreensStyles);
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { signUp } = useAuth();
  const { t } = useI18n();
  const { colors } = useTheme();
  const [step, setStep] = useState<SignUpStep>('account');
  const [form, setForm] = useState<SignUpInput>({
    shopName: '',
    ownerName: '',
    phone: '',
    district: '',
    shopType: 'retail',
  });
  const [shopTypePicked, setShopTypePicked] = useState(false);
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function goToShopType() {
    setError(null);
    if (!identity.trim()) {
      setError('Enter your email or phone number.');
      return;
    }
    if (password.length < 6) {
      setError('Use a password of at least 6 characters.');
      return;
    }
    if (!form.shopName.trim()) {
      setError('Enter your shop name.');
      return;
    }
    setStep('shopType');
  }

  async function submit() {
    if (!shopTypePicked) {
      setError('Choose Retail shop or Kitchen / Restaurant.');
      return;
    }
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
      <Header
        title={t((m) => m.auth.createTitle)}
        onBack={() => {
          if (step === 'shopType') {
            setStep('account');
            setError(null);
            return;
          }
          navigation.goBack();
        }}
      />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {step === 'account' ? (
          <>
            <Text style={[styles.stepHint, { color: colors.muted }]}>Step 1 of 2 · Account</Text>
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
            <FillButton label="Continue" onPress={goToShopType} />
            <ErrorText message={error} />
            <Pressable onPress={() => navigation.goBack()} style={styles.link}>
              <Text style={styles.linkText}>{t((m) => m.auth.haveAccount)}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={[styles.stepHint, { color: colors.muted }]}>Step 2 of 2 · Shop type</Text>
            <Text style={[styles.sectionLabel, { color: colors.ink }]}>What kind of shop is this?</Text>
            <Text style={[styles.typeIntro, { color: colors.muted }]}>
              Retail hides Kitchen & Stock. Kitchen / Restaurant unlocks raw materials, recipes and branch stock on the dashboard.
            </Text>
            <View style={styles.typeRow}>
              {(['retail', 'kitchen'] as ShopType[]).map((type) => {
                const on = shopTypePicked && form.shopType === type;
                return (
                  <Pressable
                    key={type}
                    onPress={() => {
                      setShopTypePicked(true);
                      setForm((f) => ({ ...f, shopType: type }));
                      setError(null);
                    }}
                    style={[
                      styles.typeCard,
                      {
                        borderColor: on ? colors.brand : colors.line,
                        backgroundColor: on ? colors.gradientTop : colors.white,
                      },
                    ]}
                  >
                    <Text style={[styles.typeTitle, { color: colors.ink }]}>{SHOP_TYPE_LABEL[type]}</Text>
                    <Text style={[styles.typeHelp, { color: colors.muted }]}>{SHOP_TYPE_HELP[type]}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.hint}>{t((m) => m.auth.pendingNote)}</Text>
            <FillButton label={t((m) => m.auth.createBtn)} onPress={submit} busy={busy} />
            <ErrorText message={error} />
          </>
        )}
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
    stepHint: {
      fontFamily: fonts.semibold,
      fontSize: 12,
      letterSpacing: 0.3,
    },
    sectionLabel: {
      fontFamily: fonts.bold,
      fontSize: 18,
    },
    typeIntro: {
      fontFamily: fonts.regular,
      fontSize: 13,
      lineHeight: 19,
      marginTop: -4,
    },
    typeRow: {
      gap: 10,
    },
    typeCard: {
      borderWidth: 1.5,
      borderRadius: 14,
      padding: 14,
      gap: 4,
    },
    typeTitle: {
      fontFamily: fonts.bold,
      fontSize: 16,
    },
    typeHelp: {
      fontFamily: fonts.regular,
      fontSize: 12,
      lineHeight: 17,
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
