import { useEffect, type ComponentType } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useIconPress } from '../hooks/useIconPress';
import { useTheme } from '../context/ThemeContext';
import { FadeUp } from './FadeUp';
import { fonts } from '../theme/fonts';

type HomeActionTileProps = {
  delay: number;
  gradient: readonly [string, string, ...string[]];
  label: string;
  Icon: ComponentType<{ color?: string; size?: number }>;
  onPress: () => void;
};

/** `#RRGGBB` → `rgba(r,g,b,alpha)`, used to tint a tile with its own icon color. */
function tint(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Quick-action tile: pastel tint matching the icon color, flat icon chip, label. */
export function HomeActionTile({ delay, gradient, label, Icon, onPress }: HomeActionTileProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const { style: pressStyle, onPressIn, onPressOut } = useIconPress(0.95);
  const pop = useSharedValue(reduced ? 1 : 0.5);
  const tilt = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    pop.value = withDelay(delay + 100, withSpring(1, { damping: 9, stiffness: 220 }));
  }, [delay, pop, reduced]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }, { rotate: `${tilt.value}deg` }],
  }));

  function handlePressIn() {
    onPressIn();
    if (reduced) return;
    tilt.value = withSequence(
      withTiming(-10, { duration: 90 }),
      withTiming(8, { duration: 110 }),
      withSpring(0, { damping: 6, stiffness: 260 }),
    );
  }

  return (
    <FadeUp delay={delay} style={styles.wrap}>
      <Animated.View style={[styles.tile, { backgroundColor: tint(gradient[0], 0.12) }, pressStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={onPressOut}
          style={styles.press}
        >
          <Animated.View style={[styles.iconBox, iconStyle]}>
            <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.iconFill}>
              <Icon color="#FFFFFF" size={26} />
            </LinearGradient>
          </Animated.View>
          <Text style={[styles.label, { color: colors.ink }]} numberOfLines={1}>
            {label}
          </Text>
        </Pressable>
      </Animated.View>
    </FadeUp>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '31.6%',
  },
  tile: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  press: {
    alignItems: 'center',
    paddingTop: 13,
    paddingBottom: 10,
    paddingHorizontal: 4,
    gap: 6,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 13,
  },
  iconFill: {
    flex: 1,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 12,
  },
});
