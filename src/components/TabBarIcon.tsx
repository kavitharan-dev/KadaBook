import type { ComponentType } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import { useIconPress, useTabIconPop } from '../hooks/useIconPress';
import { fonts } from '../theme/fonts';

type TabBarIconProps = {
  active: boolean;
  color: string;
  label: string;
  Icon: ComponentType<{ color?: string; size?: number }>;
  onPress: () => void;
};

export function TabBarIcon({ active, color, label, Icon, onPress }: TabBarIconProps) {
  const popStyle = useTabIconPop(active);
  const { style: pressStyle, onPressIn, onPressOut } = useIconPress(0.9);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={styles.item}
    >
      <Animated.View style={popStyle}>
        <Animated.View style={pressStyle}>
          <Icon color={color} size={active ? 24 : 22} />
        </Animated.View>
      </Animated.View>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 11,
  },
});
