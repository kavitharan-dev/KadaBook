import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedIconPress } from './AnimatedIconPress';
import { BackIcon } from './Icons';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../theme/palettes';
import { fonts } from '../theme/fonts';

export function Screen({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
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
    <View style={styles.header}>
      {onBack ? (
        <AnimatedIconPress
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          style={styles.iconButton}
        >
          <BackIcon />
        </AnimatedIconPress>
      ) : (
        <View style={styles.iconButton} />
      )}
      <Text style={[styles.headerTitle, { color: colors.ink }]}>{title}</Text>
      <View style={styles.iconButton}>{right}</View>
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
  disabled,
  busy,
}: {
  label: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
  busy?: boolean;
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
        { backgroundColor: bg, opacity: disabled ? 0.55 : pressed ? 0.92 : 1 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={colors.onFill} />
      ) : (
        <Text style={[styles.fillLabel, { color: colors.onFill }]}>{label}</Text>
      )}
    </Pressable>
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
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
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
  fill: {
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
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
