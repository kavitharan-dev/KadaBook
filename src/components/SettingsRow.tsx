import type { ComponentType } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRightIcon } from './Icons';
import { useTheme } from '../context/ThemeContext';
import { fonts } from '../theme/fonts';

type IconType = ComponentType<{ color?: string; size?: number }>;

export function SettingsRow({
  title,
  subtitle,
  onPress,
  Icon,
  tint,
  last,
}: {
  title: string;
  subtitle?: string;
  onPress: () => void;
  Icon?: IconType;
  tint?: string;
  last?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, !last && { borderBottomWidth: 1, borderBottomColor: colors.rowLine }]}
    >
      {Icon ? (
        <View style={[styles.iconWrap, { backgroundColor: tint ?? '#64748B' }]}>
          <Icon color="#FFFFFF" size={17} />
        </View>
      ) : null}
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
        {subtitle ? <Text style={[styles.sub, { color: colors.muted }]}>{subtitle}</Text> : null}
      </View>
      <ChevronRightIcon color={colors.muted} size={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  sub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
  },
});
