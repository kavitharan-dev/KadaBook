import { ReactNode } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useFadeUp } from '../hooks/useFadeUp';

type FadeUpProps = {
  delay: number;
  duration?: number;
  distance?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

export function FadeUp({ delay, duration, distance, style, children }: FadeUpProps) {
  const animatedStyle = useFadeUp({ delay, duration, distance });

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
