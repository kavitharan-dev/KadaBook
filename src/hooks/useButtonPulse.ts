import { useEffect } from 'react';
import {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { timings } from '../animation/timings';

export function useButtonPulse() {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const glow = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(scale);
    cancelAnimation(glow);

    if (reduced) {
      scale.value = 1;
      glow.value = 0;
      return;
    }

    scale.value = 1;
    glow.value = 0;

    const easing = Easing.inOut(Easing.sin);
    scale.value = withDelay(
      timings.pulseDelayMs,
      withRepeat(
        withSequence(
          withTiming(timings.pulseScale, { duration: timings.pulseHalfMs, easing }),
          withTiming(1, { duration: timings.pulseHalfMs, easing }),
        ),
        -1,
        false,
      ),
    );
    glow.value = withDelay(
      timings.pulseDelayMs,
      withRepeat(
        withSequence(
          withTiming(0.42, { duration: timings.pulseHalfMs, easing }),
          withTiming(0.1, { duration: timings.pulseHalfMs, easing }),
        ),
        -1,
        false,
      ),
    );
  }, [glow, reduced, scale]);

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
  }));

  return { buttonStyle, glowStyle };
}
