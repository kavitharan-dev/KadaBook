import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { AnimatedIconPress } from './AnimatedIconPress';
import { BackIcon } from './Icons';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../theme/palettes';
import { fonts } from '../theme/fonts';

export function Screen({
  children,
  background,
  edgeToEdgeTop = false,
}: {
  children: ReactNode;
  /** Rendered behind everything, above the safe-area padding — use for a full-bleed background that must extend under the status bar. Only meaningful with `edgeToEdgeTop`. */
  background?: ReactNode;
  /** Lets `background` paint behind the status bar instead of the padded content starting there too. */
  edgeToEdgeTop?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  if (edgeToEdgeTop) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.white }]}>
        {background}
        <View style={[styles.screen, { paddingTop: insets.top }]}>{children}</View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: colors.white }]}>{children}</View>
  );
}

export function Header({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.header, { borderBottomColor: colors.hairline }]}>
      {onBack ? (
        <AnimatedIconPress
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          hitSlop={6}
          style={[styles.iconButton, { backgroundColor: colors.canvas, borderColor: colors.hairline }]}
        >
          <BackIcon color={colors.ink} />
        </AnimatedIconPress>
      ) : (
        <View style={styles.iconButtonSpacer} />
      )}
      <Text style={[styles.headerTitle, { color: colors.ink }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.headerEnd}>{right}</View>
    </View>
  );
}

export function Field(props: TextInputProps) {
  const { colors } = useTheme();
  return (
    <TextInput
      {...props}
      placeholderTextColor={colors.placeholder}
      underlineColorAndroid="transparent"
      style={[
        styles.field,
        {
          borderColor: colors.line,
          backgroundColor: colors.white,
          color: colors.ink,
        },
        props.style,
      ]}
    />
  );
}

export function FillButton({
  label,
  onPress,
  color,
  gradient,
  disabled,
  busy,
  icon,
}: {
  label: string;
  onPress: () => void;
  color?: string;
  /** Optional 3D-style gradient fill (e.g. the Close Day button); overrides `color` when given. */
  gradient?: readonly [string, string, ...string[]];
  disabled?: boolean;
  busy?: boolean;
  /** Optional leading icon, rendered before the label. */
  icon?: ReactNode;
}) {
  const { colors } = useTheme();
  const bg = color ?? colors.brand;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.fill,
        { backgroundColor: gradient ? 'transparent' : bg, opacity: disabled ? 0.55 : pressed ? 0.92 : 1 },
      ]}
    >
      {gradient ? (
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, styles.fillGradient]}
        />
      ) : null}
      {busy ? (
        <ActivityIndicator color={colors.onFill} />
      ) : (
        <>
          {icon}
          <Text style={[styles.fillLabel, { color: colors.onFill }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconField({
  icon,
  iconTint,
  containerStyle,
  style,
  ...inputProps
}: TextInputProps & { icon: ReactNode; iconTint?: string; containerStyle?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const tint = iconTint ?? colors.brand;
  return (
    <View style={[styles.iconFieldWrap, { borderColor: colors.line, backgroundColor: colors.white }, containerStyle]}>
      <View style={[styles.iconFieldIcon, { backgroundColor: `${tint}1F` }]}>{icon}</View>
      <TextInput
        {...inputProps}
        placeholderTextColor={colors.placeholder}
        underlineColorAndroid="transparent"
        style={[styles.iconFieldInput, { color: colors.ink }, style]}
      />
    </View>
  );
}

export function ErrorText({ message }: { message: string | null }) {
  const { colors } = useTheme();
  if (!message) return null;
  return <Text style={[styles.error, { color: colors.expenseText }]}>{message}</Text>;
}

export function SyncNotice({ message }: { message: string | null }) {
  const { colors } = useTheme();
  if (!message) return null;
  return (
    <View style={[styles.sync, { backgroundColor: colors.expenseWash }]}>
      <Text style={[styles.syncText, { color: colors.expenseText }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    minHeight: 56,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonSpacer: {
    width: 38,
    height: 38,
  },
  headerEnd: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 19,
  },
  field: {
    height: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  iconFieldWrap: {
    height: 56,
    borderWidth: 1,
    borderRadius: 14,
    paddingLeft: 8,
    paddingRight: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconFieldIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconFieldInput: {
    flex: 1,
    height: '100%',
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  fill: {
    height: 54,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  fillGradient: {
    borderRadius: 14,
  },
  fillLabel: {
    fontFamily: fonts.semibold,
    fontSize: 17,
  },
  error: {
    fontFamily: fonts.regular,
    fontSize: 13,
    textAlign: 'center',
  },
  sync: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  syncText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
});

export function useThemedStyles<T>(factory: (colors: ColorPalette) => T): T {
  const { colors } = useTheme();
  return factory(colors);
}
