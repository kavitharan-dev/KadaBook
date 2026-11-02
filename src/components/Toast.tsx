import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { fonts } from '../theme/fonts';

export type ToastKind = 'success' | 'error' | 'info';
export type ToastMessage = { id: number; kind: ToastKind; text: string };

/** Holds the current toast. `show` replaces whatever is on screen; it hides itself after a moment. */
export function useToast() {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const nextId = useRef(1);
  const show = useCallback((kind: ToastKind, text: string) => {
    setToast({ id: nextId.current++, kind, text });
  }, []);
  const hide = useCallback(() => setToast(null), []);
  return { toast, show, hide };
}

const ICON: Record<ToastKind, string> = { success: '✓', error: '!', info: 'i' };

/**
 * Slides a message down from the top with a little bounce, then slides it away.
 * Render it last inside the screen (or inside a Modal, which sits above the screen).
 */
export function Toast({ toast, onHide }: { toast: ToastMessage | null; onHide: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const y = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const [shown, setShown] = useState<ToastMessage | null>(null);

  useEffect(() => {
    if (!toast) return;
    setShown(toast);
    y.setValue(-120);
    opacity.setValue(0);
    scale.setValue(0.9);
    Animated.parallel([
      Animated.spring(y, { toValue: 0, friction: 7, tension: 90, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(
      () => {
        Animated.parallel([
          Animated.timing(y, { toValue: -120, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
        ]).start(({ finished }) => {
          if (finished) {
            setShown(null);
            onHide();
          }
        });
      },
      toast.kind === 'error' ? 3200 : 2200,
    );
    return () => clearTimeout(timer);
  }, [toast, y, opacity, scale, onHide]);

  if (!shown) return null;

  const tone =
    shown.kind === 'success'
      ? { bg: colors.saleWash, fg: colors.saleText, dot: colors.sale }
      : shown.kind === 'error'
        ? { bg: colors.expenseWash, fg: colors.expenseText, dot: colors.danger }
        : { bg: colors.white, fg: colors.ink, dot: colors.brand };

  return (
    <View pointerEvents="box-none" style={[styles.layer, { top: insets.top + 8 }]}>
      <Animated.View style={{ opacity, transform: [{ translateY: y }, { scale }] }}>
        <Pressable
          accessibilityRole="alert"
          onPress={onHide}
          style={[styles.toast, { backgroundColor: tone.bg, borderColor: tone.dot }]}
        >
          <View style={[styles.icon, { backgroundColor: tone.dot }]}>
            <Text style={[styles.iconText, { color: colors.onFill }]}>{ICON[shown.kind]}</Text>
          </View>
          <Text style={[styles.text, { color: tone.fg }]} numberOfLines={3}>
            {shown.text}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 1000, elevation: 1000 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: 480,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  icon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontFamily: fonts.bold, fontSize: 14 },
  text: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 14, lineHeight: 19 },
});
