import { useCallback, useEffect } from 'react';
import {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useAnimationFinishFallback } from '../animation/ensureVisible';
import { timings } from '../animation/timings';

type FadeUpOptions = {
  delay: number;
  duration?: number;
  distance?: number;
};

export function useFadeUp({
  delay,
  duration = timings.fadeMs,
  distance = timings.fadeDistance,
}: FadeUpOptions) {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(reduced ? 1 : 0);
  const translateY = useSharedValue(reduced ? 0 : distance);

  const snapVisible = useCallback(() => {
    opacity.value = 1;
    translateY.value = 0;
  }, [opacity, translateY]);

  useAnimationFinishFallback(!reduced, delay + duration + 150, snapVisible);

  useEffect(() => {
    cancelAnimation(opacity);
    cancelAnimation(translateY);

    if (reduced) {
      opacity.value = 1;
      translateY.value = 0;
      return;
    }

    opacity.value = 0;
    translateY.value = distance;
    const easing = Easing.out(Easing.cubic);
    opacity.value = withDelay(delay, withTiming(1, { duration, easing }));
    translateY.value = withDelay(delay, withTiming(0, { duration, easing }));
  }, [delay, distance, duration, opacity, reduced, translateY]);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
}
