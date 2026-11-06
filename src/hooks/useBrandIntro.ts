import { useCallback, useEffect, useRef } from 'react';
import type { LayoutChangeEvent } from 'react-native';
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

/**
 * Login screen's logo/wordmark/tagline block: pops in once on mount, holds
 * briefly, then collapses away so the shop illustration below can claim that
 * space instead of the block sitting there permanently. Reduced-motion users
 * keep the old static, always-visible block — an abrupt disappearance reads
 * as more jarring than a parked logo, and reduced motion is about motion, not
 * about removing the brand entirely.
 */
export function useBrandIntro() {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(reduced ? 1 : 0);
  const scale = useSharedValue(reduced ? 1 : timings.brandPopFromScale);
  const height = useSharedValue<number | undefined>(undefined);
  const measured = useRef(0);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    if (!measured.current) measured.current = e.nativeEvent.layout.height;
  }, []);

  const snapHidden = useCallback(() => {
    opacity.value = 0;
    scale.value = 0.85;
    height.value = 0;
  }, [height, opacity, scale]);

  useAnimationFinishFallback(!reduced, timings.brandHoldMs + timings.brandHideMs + 300, snapHidden);

  useEffect(() => {
    cancelAnimation(opacity);
    cancelAnimation(scale);
    cancelAnimation(height);

    if (reduced) {
      opacity.value = 1;
      scale.value = 1;
      height.value = undefined;
      return;
    }

    opacity.value = 0;
    scale.value = timings.brandPopFromScale;
    opacity.value = withTiming(1, { duration: timings.brandPopFadeMs, easing: Easing.out(Easing.cubic) });
    scale.value = withSpring(1, { damping: timings.brandPopDamping });

    const hideTimer = setTimeout(() => {
      height.value = measured.current;
      opacity.value = withTiming(0, { duration: timings.brandHideMs, easing: Easing.in(Easing.cubic) });
      scale.value = withTiming(0.85, { duration: timings.brandHideMs, easing: Easing.in(Easing.cubic) });
      height.value = withTiming(0, { duration: timings.brandHideMs, easing: Easing.in(Easing.cubic) });
    }, timings.brandHoldMs);

    return () => clearTimeout(hideTimer);
  }, [height, opacity, reduced, scale]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    height: height.value,
    overflow: 'hidden',
    transform: [{ scale: scale.value }],
  }));

  return { style, onLayout };
}
