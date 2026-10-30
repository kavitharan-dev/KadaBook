import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { fonts } from '../theme/fonts';

export function SettingsRow({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle?: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, { borderBottomColor: colors.rowLine, backgroundColor: colors.white }]}
    >
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
        {subtitle ? <Text style={[styles.sub, { color: colors.muted }]}>{subtitle}</Text> : null}
      </View>
      <Text style={[styles.chevron, { color: colors.ink }]}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  copy: {
    flex: 1,
    gap: 2,
    paddingVertical: 10,
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  sub: {
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  chevron: {
    fontSize: 22,
    paddingLeft: 8,
  },
});
