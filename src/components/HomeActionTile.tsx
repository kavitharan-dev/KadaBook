import type { ComponentType } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import { useIconPress } from '../hooks/useIconPress';
import { FadeUp } from './FadeUp';
import { fonts } from '../theme/fonts';

type HomeActionTileProps = {
  delay: number;
  backgroundColor: string;
  label: string;
  Icon: ComponentType<{ color?: string; size?: number }>;
  onPress: () => void;
};

export function HomeActionTile({ delay, backgroundColor, label, Icon, onPress }: HomeActionTileProps) {
  const { style: iconStyle, onPressIn, onPressOut } = useIconPress(0.92);

  return (
    <FadeUp delay={delay} style={styles.wrap}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[styles.tile, { backgroundColor }]}
      >
        <Animated.View style={iconStyle}>
          <Icon color="#FFFFFF" size={28} />
        </Animated.View>
        <Text style={styles.label}>{label}</Text>
      </Pressable>
    </FadeUp>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '48%',
  },
  tile: {
    height: 96,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: '#FFFFFF',
  },
});
