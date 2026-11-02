import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { fonts } from '../theme/fonts';

type Props = {
  name: string;
  price: string;
  stockLabel: string;
  low: boolean;
  out: boolean;
  /** Quantity already in the bill; > 0 keeps the tile highlighted with a count badge. */
  qty: number;
  onPress: () => void;
};

export function ProductTile({ name, price, stockLabel, low, out, qty, onPress }: Props) {
  const { colors } = useTheme();
  const flash = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const selected = qty > 0;

  function handlePress() {
    Vibration.vibrate(12);
    flash.setValue(1);
    Animated.parallel([
      Animated.timing(flash, { toValue: 0, duration: 480, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(pop, { toValue: 0.94, duration: 70, useNativeDriver: true }),
        Animated.spring(pop, { toValue: 1, friction: 4, useNativeDriver: true }),
      ]),
    ]).start();
    onPress();
  }

  return (
    <Animated.View style={[styles.wrap, { transform: [{ scale: pop }] }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${price}${selected ? `, ${qty} in bill` : ''}`}
        disabled={out}
        onPress={handlePress}
        style={[
          styles.tile,
          {
            borderColor: selected ? colors.brand : colors.hairline,
            borderWidth: selected ? 2 : 1,
            backgroundColor: selected ? colors.gradientTop : colors.white,
          },
          out && { opacity: 0.45 },
        ]}
      >
        {low ? (
          <Text style={[styles.lowTag, { color: colors.onFill, backgroundColor: colors.danger }]}>Low</Text>
        ) : null}
        <Text style={[styles.name, { color: colors.ink }]} numberOfLines={2}>
          {name}
        </Text>
        <Text style={[styles.price, { color: colors.ink }]}>{price}</Text>
        <Text style={[styles.stock, { color: colors.muted }]}>{stockLabel}</Text>
        {selected ? (
          <View style={[styles.badge, { backgroundColor: colors.brand }]}>
            <Text style={[styles.badgeText, { color: colors.onFill }]}>×{qty}</Text>
          </View>
        ) : null}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.flash, { backgroundColor: colors.brand, opacity: flash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.3] }) }]}
        />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '48%',
    flexGrow: 1,
  },
  tile: {
    minHeight: 96,
    borderRadius: 14,
    padding: 10,
    gap: 4,
    overflow: 'hidden',
  },
  flash: {
    borderRadius: 14,
  },
  lowTag: {
    position: 'absolute',
    left: 0,
    top: 8,
    fontFamily: fonts.semibold,
    fontSize: 9,
    paddingHorizontal: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  name: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    paddingRight: 28,
  },
  price: {
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  stock: {
    fontFamily: fonts.regular,
    fontSize: 11,
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 28,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: fonts.bold,
    fontSize: 12,
  },
});
