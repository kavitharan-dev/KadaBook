import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useIconPress } from '../hooks/useIconPress';

type AnimatedIconPressProps = Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function AnimatedIconPress({ children, style, ...pressable }: AnimatedIconPressProps) {
  const { style: animStyle, onPressIn, onPressOut } = useIconPress();

  return (
    <Pressable
      {...pressable}
      onPressIn={(e) => {
        onPressIn();
        pressable.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        onPressOut();
        pressable.onPressOut?.(e);
      }}
      style={style}
    >
      <Animated.View style={animStyle}>{children}</Animated.View>
    </Pressable>
  );
}
