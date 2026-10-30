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

export function useBarGrow(index: number) {
  const reduced = useReducedMotion();
  const scaleY = useSharedValue(reduced ? 1 : 0);
  const startMs = timings.barStartMs + index * timings.barStaggerMs;

  const snapVisible = useCallback(() => {
    scaleY.value = 1;
  }, [scaleY]);

  useAnimationFinishFallback(!reduced, startMs + timings.barDurationMs + 100, snapVisible);

  useEffect(() => {
    cancelAnimation(scaleY);

    if (reduced) {
      scaleY.value = 1;
      return;
    }

    scaleY.value = 0;
    scaleY.value = withDelay(
      startMs,
      withTiming(1, {
        duration: timings.barDurationMs,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [index, reduced, scaleY, startMs]);

  return useAnimatedStyle(() => ({
    transformOrigin: 'bottom',
    transform: [{ scaleY: scaleY.value }],
  }));
}
