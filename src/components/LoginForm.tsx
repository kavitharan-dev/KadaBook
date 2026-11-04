import { useState, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { LoginButton } from './LoginButton';
import { useI18n } from '../context/LocaleContext';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../theme/palettes';
import { useStyleSheet } from '../theme/useStyleSheet';
import { fonts } from '../theme/fonts';

const webInputFix =
  Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : undefined;

function MailIcon({ stroke }: { stroke: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Rect
        x={1.75}
        y={3.75}
        width={14.5}
        height={10.5}
        rx={2}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
      />
      <Path
        d="M2.5 5.2 9 9.6l6.5-4.4"
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function LockIcon({ stroke }: { stroke: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Rect
        x={3.25}
        y={8}
        width={11.5}
        height={7.75}
        rx={2}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
      />
      <Path
        d="M6 8V6.1a3 3 0 0 1 6 0V8"
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function EyeIcon({ stroke, open }: { stroke: string; open: boolean }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Path
        d="M1.75 10S4.5 4.75 10 4.75 18.25 10 18.25 10 15.5 15.25 10 15.25 1.75 10 1.75 10Z"
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Path
        d="M10 12.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z"
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
      />
      {open ? null : (
        <Path
          d="M3.5 3.5 16.5 16.5"
          fill="none"
          stroke={stroke}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      )}
    </Svg>
  );
}

function Field({
  icon,
  trailing,
  ...inputProps
}: TextInputProps & { icon: 'mail' | 'lock'; trailing?: ReactNode }) {
  const { colors } = useTheme();
  const styles = useStyleSheet(loginFormStyles);
  return (
    <View style={styles.field}>
      {icon === 'mail' ? <MailIcon stroke={colors.placeholder} /> : <LockIcon stroke={colors.placeholder} />}
      <TextInput
        {...inputProps}
        placeholderTextColor={colors.placeholder}
        underlineColorAndroid="transparent"
        style={[styles.input, webInputFix]}
      />
      {trailing}
    </View>
  );
}

type LoginFormProps = {
  busy?: boolean;
  error?: string | null;
  onLogin: (identity: string, password: string) => void;
  onForgot: () => void;
  onCreate: () => void;
};

export function LoginForm({ busy, error, onLogin, onForgot, onCreate }: LoginFormProps) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyleSheet(loginFormStyles);
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={styles.form}>
      <Field
        icon="mail"
        value={identity}
        onChangeText={setIdentity}
        placeholder={t((m) => m.login.emailPhone)}
        accessibilityLabel={t((m) => m.login.emailPhone)}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="username"
        autoComplete="username"
        returnKeyType="next"
      />
      <Field
        icon="lock"
        value={password}
        onChangeText={setPassword}
        placeholder={t((m) => m.login.password)}
        accessibilityLabel={t((m) => m.login.password)}
        secureTextEntry={!showPassword}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="password"
        autoComplete="password"
        returnKeyType="done"
        trailing={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            hitSlop={8}
            onPress={() => setShowPassword((v) => !v)}
            style={styles.eyeBtn}
          >
            <EyeIcon stroke={colors.placeholder} open={showPassword} />
          </Pressable>
        }
      />
      <LoginButton disabled={busy} label={t((m) => m.login.login)} onPress={() => onLogin(identity, password)} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        accessibilityRole="button"
        onPress={onForgot}
        style={styles.forgot}
        android_ripple={{ color: 'rgba(29,95,224,0.12)' }}
      >
        <Text style={styles.forgotText}>{t((m) => m.login.forgot)}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={onCreate}
        style={styles.create}
        android_ripple={{ color: 'rgba(17,24,39,0.08)' }}
      >
        <Text style={styles.createText}>{t((m) => m.login.create)}</Text>
      </Pressable>
    </View>
  );
}

function loginFormStyles(c: ColorPalette) {
  return {
  form: {
    width: '100%',
    marginTop: 36,
    gap: 14,
  },
  field: {
    height: 52,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 12,
    backgroundColor: c.white,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    height: 50,
    padding: 0,
    margin: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    fontFamily: fonts.regular,
    fontSize: 15,
    color: c.ink,
    includeFontPadding: false,
  },
  eyeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forgot: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forgotText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: c.brand,
    includeFontPadding: false,
  },
  create: {
    height: 52,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 12,
    backgroundColor: c.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: c.ink,
    includeFontPadding: false,
  },
  error: {
    color: c.expenseText,
    fontFamily: fonts.regular,
    fontSize: 13,
    textAlign: 'center',
  },
};
}
