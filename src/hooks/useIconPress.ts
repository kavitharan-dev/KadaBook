import { useEffect } from 'react';
import {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const SPRING_PRESS = { damping: 14, stiffness: 420 };
const SPRING_RELEASE = { damping: 12, stiffness: 280 };

/** Scale-down on press for icon buttons. */
export function useIconPress(scaleDown = 0.86) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  function onPressIn() {
    if (reduced) return;
    scale.value = withSpring(scaleDown, SPRING_PRESS);
  }

  function onPressOut() {
    scale.value = withSpring(1, SPRING_RELEASE);
  }

  return { style, onPressIn, onPressOut };
}

/** Quick pop when a tab becomes active. */
export function useTabIconPop(active: boolean) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (reduced) {
      scale.value = 1;
      return;
    }
    if (active) {
      scale.value = withSequence(
        withSpring(1.2, { damping: 9, stiffness: 380 }),
        withSpring(1, { damping: 11, stiffness: 260 }),
      );
    } else {
      scale.value = withTiming(1, { duration: 120 });
    }
  }, [active, reduced, scale]);

  return useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
}
