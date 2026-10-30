import { useCallback, useEffect } from 'react';
import {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useAnimationFinishFallback } from '../animation/ensureVisible';
import { timings } from '../animation/timings';

export function useLogoEntrance() {
  const reduced = useReducedMotion();
  const translateY = useSharedValue(reduced ? 0 : timings.logoFromY);
  const opacity = useSharedValue(reduced ? 1 : 0);

  const snapVisible = useCallback(() => {
    translateY.value = 0;
    opacity.value = 1;
  }, [opacity, translateY]);

  useAnimationFinishFallback(!reduced, timings.logoFadeMs + 200, snapVisible);

  useEffect(() => {
    cancelAnimation(translateY);
    cancelAnimation(opacity);

    if (reduced) {
      translateY.value = 0;
      opacity.value = 1;
      return;
    }

    translateY.value = timings.logoFromY;
    opacity.value = 0;
    translateY.value = withSpring(0, { damping: timings.logoDamping });
    opacity.value = withTiming(1, {
      duration: timings.logoFadeMs,
      easing: Easing.out(Easing.cubic),
    });
  }, [opacity, reduced, translateY]);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
}
