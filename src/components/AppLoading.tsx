import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../theme/palettes';
import { useStyleSheet } from '../theme/useStyleSheet';

type AppLoadingProps = {
  message?: string;
};

export function AppLoading({ message = 'Loading…' }: AppLoadingProps) {
  const { colors } = useTheme();
  const styles = useStyleSheet(appLoadingStyles);

  return (
    <LinearGradient
      colors={[colors.gradientTop, colors.white]}
      locations={[0, 0.75]}
      style={[styles.shell, Platform.OS === 'web' ? styles.webShell : null]}
    >
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.brand} />
        <Text style={styles.title}>
          Kada<Text style={styles.accent}>Book</Text>
        </Text>
        <Text style={styles.message}>{message}</Text>
      </View>
    </LinearGradient>
  );
}

function appLoadingStyles(c: ColorPalette) {
  return {
    shell: {
      flex: 1,
    },
    webShell: {
      minHeight: '100vh' as unknown as number,
      width: '100%' as unknown as number,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      paddingHorizontal: 24,
    },
    title: {
      marginTop: 4,
      fontSize: 28,
      fontWeight: '700',
      color: c.ink,
    },
    accent: {
      color: c.brand,
      fontWeight: '700',
    },
    message: {
      fontSize: 14,
      color: c.muted,
      textAlign: 'center',
    },
  };
}
