import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useButtonPulse } from '../hooks/useButtonPulse';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../theme/palettes';
import { useStyleSheet } from '../theme/useStyleSheet';
import { fonts } from '../theme/fonts';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type LoginButtonProps = {
  onPress?: () => void;
  disabled?: boolean;
  label?: string;
};

export function LoginButton({ onPress, disabled, label = 'Login' }: LoginButtonProps) {
  const { buttonStyle, glowStyle } = useButtonPulse();
  const styles = useStyleSheet(loginButtonStyles);
  const { colors } = useTheme();

  return (
    <View style={styles.wrap}>
      <Animated.View pointerEvents="none" style={[styles.glow, glowStyle]} />
      <AnimatedPressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
        style={[styles.button, buttonStyle, disabled ? styles.pressed : null]}
      >
        {disabled ? (
          <ActivityIndicator color={colors.onFill} />
        ) : (
            <Text style={styles.label}>{label}</Text>
        )}
      </AnimatedPressable>
    </View>
  );
}

function loginButtonStyles(c: ColorPalette) {
  return {
  wrap: {
    position: 'relative',
  },
  glow: {
    position: 'absolute',
    top: -6,
    right: -6,
    bottom: -6,
    left: -6,
    borderRadius: 18,
    backgroundColor: c.brand,
  },
  button: {
    height: 54,
    borderRadius: 12,
    backgroundColor: c.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.92,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 17,
    color: c.onFill,
    includeFontPadding: false,
  },
};
}
