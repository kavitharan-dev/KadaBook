import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
  /** Rendered after the label, e.g. an arrow or send icon. */
  icon?: ReactNode;
};

/** Pill-shaped gradient CTA shared by the auth screens (Login, Forgot Password, Create Account). */
export function LoginButton({ onPress, disabled, label = 'Login', icon }: LoginButtonProps) {
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
        <LinearGradient
          colors={['#079EFA', '#0957E5', '#062FAE']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {disabled ? (
            <ActivityIndicator color={colors.onFill} />
          ) : (
            <View style={styles.content}>
              <Text style={styles.label}>{label}</Text>
              {icon}
            </View>
          )}
        </LinearGradient>
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
    borderRadius: 33,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  button: {
    height: 54,
    borderRadius: 27,
    backgroundColor: c.brand,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.92,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 17,
    color: c.onFill,
    includeFontPadding: false,
  },
  gradient: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
};
}
