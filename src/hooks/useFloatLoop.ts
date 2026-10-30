import { useEffect } from 'react';
import {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { timings } from '../animation/timings';

export function useFloatLoop() {
  const reduced = useReducedMotion();
  const translateY = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(translateY);

    if (reduced) {
      translateY.value = 0;
      return;
    }

    translateY.value = 0;
    translateY.value = withRepeat(
      withTiming(timings.floatY, {
        duration: timings.floatHalfMs,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
  }, [reduced, translateY]);

  return useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
}
