import { useEffect, type ComponentType } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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

/** Quick-action card: accent bar on top, gradient icon box, label. */
export function HomeActionTile({ delay, gradient, label, Icon, onPress }: HomeActionTileProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const { style: pressStyle, onPressIn, onPressOut } = useIconPress(0.95);
  const bar = useSharedValue(reduced ? 1 : 0);
  const pop = useSharedValue(reduced ? 1 : 0.5);
  const tilt = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    bar.value = withDelay(delay + 150, withTiming(1, { duration: 550, easing: Easing.out(Easing.cubic) }));
    pop.value = withDelay(delay + 100, withSpring(1, { damping: 9, stiffness: 220 }));
  }, [bar, delay, pop, reduced]);

  const barStyle = useAnimatedStyle(() => ({ width: `${bar.value * 100}%` }));
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
      <Animated.View
        style={[styles.tile, { backgroundColor: colors.white, borderColor: colors.hairline }, pressStyle]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={onPressOut}
          style={styles.press}
        >
          <View style={styles.barTrack}>
            <Animated.View style={[styles.bar, barStyle]}>
              <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            </Animated.View>
          </View>
          <Animated.View style={[styles.iconBox, { boxShadow: `0px 6px 14px ${gradient[1]}55` }, iconStyle]}>
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
    borderWidth: 1,
    overflow: 'hidden',
    boxShadow: '0px 4px 12px rgba(15,23,42,0.06)',
  },
  press: {
    alignItems: 'center',
    paddingTop: 11,
    paddingBottom: 9,
    paddingHorizontal: 4,
    gap: 6,
  },
  barTrack: {
    position: 'absolute',
    top: 0,
    left: 8,
    right: 8,
    height: 3,
    alignItems: 'center',
  },
  bar: {
    height: 3,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    overflow: 'hidden',
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
