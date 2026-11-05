import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { fonts } from '../../theme/fonts';

export type KitchenBurstKind = 'send' | 'buy' | 'make' | 'food' | 'raw' | 'count' | 'waste' | 'item' | 'ok';

const ICON: Record<KitchenBurstKind, string> = {
  send: '✈️',
  buy: '🛒',
  make: '🍔',
  food: '✨',
  raw: '📦',
  count: '✅',
  waste: '🗑️',
  item: '✏️',
  ok: '✓',
};

const TITLE: Record<KitchenBurstKind, string> = {
  send: 'On the way!',
  buy: 'Stock added',
  make: 'Food ready',
  food: 'Food saved',
  raw: 'Ingredient saved',
  count: 'Count saved',
  waste: 'Wastage saved',
  item: 'Saved',
  ok: 'Done',
};

export function KitchenSuccessBurst({
  kind,
  text,
  onDone,
}: {
  kind: KitchenBurstKind | null;
  text: string;
  onDone: () => void;
}) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const fly = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (!kind) return;
    opacity.setValue(0);
    fly.setValue(0);
    scale.setValue(0.6);
    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }),
      ]),
      Animated.timing(fly, {
        toValue: 1,
        duration: kind === 'send' ? 900 : 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) onDone();
    });
  }, [kind, fly, onDone, opacity, scale]);

  if (!kind) return null;

  const translateY = fly.interpolate({
    inputRange: [0, 1],
    outputRange: [0, kind === 'send' ? -140 : -40],
  });
  const translateX = fly.interpolate({
    inputRange: [0, 1],
    outputRange: [0, kind === 'send' ? 90 : 0],
  });
  const iconScale = fly.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, kind === 'send' ? 1.15 : 1.08, kind === 'send' ? 0.35 : 0.9],
  });

  return (
    <Modal visible transparent animationType="none" onRequestClose={onDone}>
      <Pressable style={styles.backdrop} onPress={onDone}>
        <Animated.View style={[styles.card, { backgroundColor: colors.white, opacity, transform: [{ scale }] }]}>
          <Animated.Text
            style={[
              styles.icon,
              {
                transform: [{ translateX }, { translateY }, { scale: iconScale }],
              },
            ]}
          >
            {ICON[kind]}
          </Animated.Text>
          <Text style={[styles.title, { color: colors.ink }]}>{TITLE[kind]}</Text>
          <Text style={[styles.text, { color: colors.muted }]} numberOfLines={3}>
            {text}
          </Text>
          <View style={[styles.pill, { backgroundColor: colors.gradientTop }]}>
            <Text style={[styles.pillText, { color: colors.brand }]}>Saved</Text>
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 22,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 8,
  },
  icon: { fontSize: 52, marginBottom: 4 },
  title: { fontFamily: fonts.bold, fontSize: 20 },
  text: { fontFamily: fonts.regular, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  pill: { marginTop: 8, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
  pillText: { fontFamily: fonts.semibold, fontSize: 12 },
});
