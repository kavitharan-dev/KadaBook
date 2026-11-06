import { ReactNode, useState } from 'react';
import { Image, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated from 'react-native-reanimated';
import { AuthScreenFrame } from '../components/AuthScreenFrame';
import { LoginButton } from '../components/LoginButton';
import {
  ChevronDownIcon,
  CloudIcon,
  EyeIcon,
  EyeOffIcon,
  LockFieldIcon,
  MailFieldIcon,
  PersonFieldIcon,
  PhoneFieldIcon,
  PinFieldIcon,
  ReportsIcon,
  SalesIcon,
  SendIcon,
  StockIcon,
  StoreFieldIcon,
} from '../components/LoginIcons';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/LocaleContext';
import { useFloatLoop } from '../hooks/useFloatLoop';
import { useIconPress } from '../hooks/useIconPress';
import type { SignUpInput } from '../data/signUpTypes';
import type { ShopType } from '../data/types';
import { SHOP_TYPE_HELP, SHOP_TYPE_LABEL } from '../lib/shopType';
import type { AuthStackParamList } from '../navigation/types';
import { fonts } from '../theme/fonts';

const background = require('../../assets/auth-screens/auth-bg.png');
const lockImg = require('../../assets/auth-screens/forgotpassword-lock-img.png');
const createShopImg = require('../../assets/auth-screens/createnew-shop-img.png');
const AnimatedImage = Animated.createAnimatedComponent(Image);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const webInputFix = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : undefined;

/** Shared field row (icon + input, optional trailing element) used by both auth forms. */
function AuthField({ icon, rightElement, ...props }: { icon: ReactNode; rightElement?: ReactNode } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={fieldStyle.field}>
      {icon}
      <TextInput {...props} placeholderTextColor="#72839F" underlineColorAndroid="transparent" style={[fieldStyle.input, webInputFix]} />
      {rightElement}
    </View>
  );
}

function PasswordToggle({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  const press = useIconPress(0.8);
  return (
    <AnimatedPressable accessibilityRole="button" accessibilityLabel={visible ? 'Hide password' : 'Show password'} hitSlop={8} onPress={onToggle} onPressIn={press.onPressIn} onPressOut={press.onPressOut} style={press.style}>
      {visible ? <EyeOffIcon /> : <EyeIcon />}
    </AnimatedPressable>
  );
}

function FeatureRow() {
  return (
    <View style={fieldStyle.features}>
      <Feature icon={<SalesIcon />} label={`Sales &\nBilling`} />
      <Feature icon={<StockIcon />} label={`Stock\nManagement`} />
      <Feature icon={<ReportsIcon />} label={`Reports &\nAnalytics`} />
      <Feature icon={<CloudIcon />} label={`Cloud\nSync`} />
    </View>
  );
}
function Feature({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <View style={fieldStyle.feature}>
      <View style={fieldStyle.featureIconWrap}>{icon}</View>
      <Text style={fieldStyle.featureText}>{label}</Text>
    </View>
  );
}

const fieldStyle = {
  field: {
    height: 53,
    backgroundColor: 'rgba(255,255,255,.92)',
    borderColor: '#CBD8EA',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 15,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    shadowColor: '#244D8D',
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
  },
  input: { flex: 1, height: 52, padding: 0, color: '#102B59', fontFamily: fonts.regular, fontSize: 16, includeFontPadding: false },
  features: { marginTop: 22, flexDirection: 'row' as const, justifyContent: 'space-between' as const },
  feature: { flex: 1, alignItems: 'center' as const, minHeight: 58 },
  featureIconWrap: { height: 23, justifyContent: 'center' as const, alignItems: 'center' as const, marginBottom: 5 },
  featureText: { color: '#122B59', fontFamily: fonts.semibold, fontSize: 10.5, lineHeight: 13, textAlign: 'center' as const, marginTop: 2 },
};

// ---------------------------------------------------------------------------
// Forgot Password
// ---------------------------------------------------------------------------

export function ForgotPasswordScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { resetPassword, cloud } = useAuth();
  const { t } = useI18n();
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const floatStyle = useFloatLoop();

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
  const copy = cloud ? (looksLikePhone ? t((m) => m.auth.forgotPhoneCloud) : t((m) => m.auth.forgotCloud)) : t((m) => m.auth.forgotLocal);

  return (
    <AuthScreenFrame bg={background} onBack={() => navigation.goBack()}>
      {(scale) => (
        <>
          <AnimatedImage source={lockImg} resizeMode="contain" style={[authStyles.hero, { height: 190 * scale }, floatStyle]} />
          <Text style={authStyles.title}>
            Forgot <Text style={authStyles.titleAccent}>Password?</Text>
          </Text>
          <Text style={authStyles.subtitle}>{copy}</Text>
          <View style={authStyles.form}>
            <AuthField
              icon={<MailFieldIcon />}
              value={identity}
              onChangeText={setIdentity}
              placeholder={t((m) => m.login.emailPhone)}
              accessibilityLabel={t((m) => m.login.emailPhone)}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType={cloud ? 'done' : 'next'}
            />
            {cloud ? null : (
              <AuthField
                icon={<LockFieldIcon />}
                value={password}
                onChangeText={setPassword}
                placeholder={t((m) => m.auth.newPassword)}
                accessibilityLabel={t((m) => m.auth.newPassword)}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="done"
                rightElement={<PasswordToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />}
              />
            )}
            <LoginButton disabled={busy} label={t((m) => m.auth.sendReset)} icon={<SendIcon />} onPress={submit} />
            {message ? <Text style={authStyles.ok}>{message}</Text> : null}
            {error ? <Text style={authStyles.error}>{error}</Text> : null}
          </View>
          <FeatureRow />
        </>
      )}
    </AuthScreenFrame>
  );
}

// ---------------------------------------------------------------------------
// Create New Account (sign up)
// ---------------------------------------------------------------------------

type SignUpStep = 'account' | 'shopType';

function Stepper({ onStep2 }: { onStep2: boolean }) {
  return (
    <View style={authStyles.stepper}>
      <View style={authStyles.stepperDots}>
        <View style={[authStyles.stepDot, authStyles.stepDotActive]}>
          <Text style={authStyles.stepDotText}>1</Text>
        </View>
        <View style={[authStyles.stepLine, onStep2 && authStyles.stepLineActive]} />
        <View style={[authStyles.stepDot, onStep2 && authStyles.stepDotActive]}>
          <Text style={[authStyles.stepDotText, !onStep2 && authStyles.stepDotTextInactive]}>2</Text>
        </View>
      </View>
      <View style={authStyles.stepperLabels}>
        <Text style={[authStyles.stepLabel, !onStep2 && authStyles.stepLabelActive]}>Account Details</Text>
        <Text style={[authStyles.stepLabel, onStep2 && authStyles.stepLabelActive]}>Confirmation</Text>
      </View>
    </View>
  );
}

export function SignUpScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { signUp } = useAuth();
  const { t } = useI18n();
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
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const floatStyle = useFloatLoop();

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
    <AuthScreenFrame
      bg={background}
      onBack={() => {
        if (step === 'shopType') {
          setStep('account');
          setError(null);
          return;
        }
        navigation.goBack();
      }}
    >
      {(scale) => (
        <>
          <AnimatedImage source={createShopImg} resizeMode="contain" style={[authStyles.hero, { height: 170 * scale }, floatStyle]} />
          <Text style={authStyles.title}>
            Create New <Text style={authStyles.titleAccent}>Account</Text>
          </Text>
          <Text style={authStyles.subtitle}>Set up your shop and get started with KadaBook</Text>
          <Stepper onStep2={step === 'shopType'} />
          {step === 'account' ? (
            <View style={authStyles.panel}>
              <AuthField icon={<StoreFieldIcon />} value={form.shopName} onChangeText={(v) => setForm((f) => ({ ...f, shopName: v }))} placeholder={t((m) => m.auth.shopName)} />
              <AuthField icon={<PersonFieldIcon />} value={form.ownerName} onChangeText={(v) => setForm((f) => ({ ...f, ownerName: v }))} placeholder={t((m) => m.auth.ownerName)} />
              <AuthField icon={<PhoneFieldIcon />} value={form.phone} onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))} placeholder={t((m) => m.auth.phone)} keyboardType="phone-pad" />
              <AuthField icon={<PinFieldIcon />} value={form.district} onChangeText={(v) => setForm((f) => ({ ...f, district: v }))} placeholder={t((m) => m.auth.district)} rightElement={<ChevronDownIcon />} />
              <AuthField icon={<MailFieldIcon />} value={identity} onChangeText={setIdentity} placeholder={t((m) => m.login.emailPhone)} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />
              <AuthField
                icon={<LockFieldIcon />}
                value={password}
                onChangeText={setPassword}
                placeholder={t((m) => m.login.password)}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                rightElement={<PasswordToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />}
              />
              <LoginButton label="Continue  →" onPress={goToShopType} />
              {error ? <Text style={authStyles.error}>{error}</Text> : null}
              <Pressable onPress={() => navigation.goBack()} style={authStyles.link}>
                <Text style={authStyles.linkText}>
                  Already have an account? <Text style={authStyles.linkAccent}>Login</Text>
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={authStyles.panel}>
              <Text style={authStyles.sectionLabel}>What kind of shop is this?</Text>
              <Text style={authStyles.typeIntro}>
                Retail hides Kitchen & Stock. Kitchen / Restaurant unlocks raw materials, recipes and branch stock on the dashboard.
              </Text>
              <View style={authStyles.typeRow}>
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
                      style={[authStyles.typeCard, on && authStyles.typeCardActive]}
                    >
                      <Text style={[authStyles.typeTitle, on && authStyles.typeTitleActive]}>{SHOP_TYPE_LABEL[type]}</Text>
                      <Text style={[authStyles.typeHelp, on && authStyles.typeHelpActive]}>{SHOP_TYPE_HELP[type]}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={authStyles.hint}>{t((m) => m.auth.pendingNote)}</Text>
              <LoginButton label={t((m) => m.auth.createBtn)} disabled={busy} onPress={submit} />
              {error ? <Text style={authStyles.error}>{error}</Text> : null}
            </View>
          )}
        </>
      )}
    </AuthScreenFrame>
  );
}

const authStyles = {
  hero: { width: '100%' as const, alignSelf: 'center' as const, marginBottom: 6 },
  title: { marginTop: 4, color: '#09265E', fontFamily: fonts.bold, fontSize: 30, textAlign: 'center' as const, letterSpacing: -0.5 },
  titleAccent: { color: '#0867F1' },
  subtitle: { marginTop: 8, color: '#5D7195', fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, textAlign: 'center' as const, paddingHorizontal: 8 },
  form: { width: '100%', marginTop: 22, gap: 12 },
  ok: { color: '#1F9D55', fontFamily: fonts.semibold, fontSize: 13, textAlign: 'center' as const },
  error: { color: '#D92D3A', fontFamily: fonts.regular, fontSize: 12, textAlign: 'center' as const },

  stepper: { width: '100%', marginTop: 18, alignItems: 'center' as const },
  stepperDots: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const },
  stepDot: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: '#CBD8EA', alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: '#FFFFFF' },
  stepDotActive: { backgroundColor: '#0A5FE5', borderColor: '#0A5FE5' },
  stepDotText: { color: '#FFFFFF', fontFamily: fonts.bold, fontSize: 14 },
  stepDotTextInactive: { color: '#7C8CAD' },
  stepLine: { width: 56, height: 2, backgroundColor: '#CBD8EA', marginHorizontal: 6 },
  stepLineActive: { backgroundColor: '#0A5FE5' },
  stepperLabels: { flexDirection: 'row' as const, marginTop: 6, width: 212, justifyContent: 'space-between' as const },
  stepLabel: { color: '#7C8CAD', fontFamily: fonts.semibold, fontSize: 12.5, width: 110, textAlign: 'center' as const },
  stepLabelActive: { color: '#09265E' },

  panel: { width: '100%', marginTop: 18, gap: 12 },
  link: { marginTop: 2, minHeight: 40, alignItems: 'center' as const, justifyContent: 'center' as const },
  linkText: { color: '#5D7195', fontFamily: fonts.semibold, fontSize: 13.5 },
  linkAccent: { color: '#075BE2', fontFamily: fonts.bold },

  sectionLabel: { color: '#09265E', fontFamily: fonts.bold, fontSize: 18 },
  typeIntro: { marginTop: -4, color: '#5D7195', fontFamily: fonts.regular, fontSize: 13, lineHeight: 19 },
  typeRow: { gap: 10 },
  typeCard: { borderWidth: 1.5, borderColor: '#CBD8EA', backgroundColor: 'rgba(255,255,255,.92)', borderRadius: 16, padding: 14, gap: 4 },
  typeCardActive: { borderColor: '#075BE2', backgroundColor: '#EAF2FF' },
  typeTitle: { color: '#09265E', fontFamily: fonts.bold, fontSize: 16 },
  typeTitleActive: { color: '#075BE2' },
  typeHelp: { color: '#5D7195', fontFamily: fonts.regular, fontSize: 12, lineHeight: 17 },
  typeHelpActive: { color: '#2A4A86' },
  hint: { color: '#5D7195', fontFamily: fonts.regular, fontSize: 12, lineHeight: 17 },
} as const;
