import { ReactNode, useState } from 'react';
import { ImageBackground, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type ImageSourcePropType } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Animated from 'react-native-reanimated';
import { ChevronLeftIcon } from './LoginIcons';
import { useIconPress } from '../hooks/useIconPress';
import { useResponsive } from '../lib/useResponsive';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Design was tuned against a ~393dp-wide phone; scale the hero art to match the real device. */
const BASE_WIDTH = 393;

type AuthScreenFrameProps = {
  bg: ImageSourcePropType;
  /** Shows a back button top-left when provided. */
  onBack?: () => void;
  /** Rendered top-right, e.g. the language picker on the login screen. */
  topRight?: ReactNode;
  children: (scale: number) => ReactNode;
};

/**
 * Shared shell for the auth screens (Login / Forgot Password / Create Account):
 * full-bleed background + scroll content + a width-based scale factor for the hero
 * art, and a tablet-safe centered column. See the kadabook-auth-screen skill for the
 * reasoning behind this structure (especially why the background sizes itself from
 * measured content height instead of percentage heights).
 */
export function AuthScreenFrame({ bg, onBack, topRight, children }: AuthScreenFrameProps) {
  const { width, height: screenHeight } = useWindowDimensions();
  const { contentMaxWidth, isTablet } = useResponsive();
  const effectiveWidth = Math.min(width, contentMaxWidth ?? width);
  const scale = Math.min(Math.max(effectiveWidth / BASE_WIDTH, 0.86), 1.18);

  // Percentage heights don't reliably resolve through a ScrollView's content chain
  // (especially on web). Measure the real content height and size the background to
  // the larger of that or the screen, so it always covers exactly the scrollable area.
  const [contentHeight, setContentHeight] = useState(0);
  const bgHeight = Math.max(screenHeight, contentHeight);

  const backPress = useIconPress(0.9);

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView style={styles.scrollOuter} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" bounces={false} showsVerticalScrollIndicator={false} keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}>
        <ImageBackground source={bg} resizeMode="cover" style={[styles.background, { height: bgHeight }]}>
          <View
            onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}
            style={[styles.inner, { paddingTop: 28 * scale, paddingBottom: 34 * scale }, isTablet && { maxWidth: contentMaxWidth, alignSelf: 'center' }]}
          >
            {onBack || topRight ? (
              <View style={styles.topbar}>
                {onBack ? (
                  <AnimatedPressable
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                    onPress={onBack}
                    onPressIn={backPress.onPressIn}
                    onPressOut={backPress.onPressOut}
                    style={[styles.backBtn, backPress.style]}
                  >
                    <ChevronLeftIcon />
                  </AnimatedPressable>
                ) : (
                  <View />
                )}
                {topRight ?? <View />}
              </View>
            ) : null}
            {children(scale)}
          </View>
        </ImageBackground>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, width: '100%', backgroundColor: '#0755D8' },
  scrollOuter: { flex: 1, width: '100%' },
  scrollContent: { flexGrow: 1, minHeight: '100%', width: '100%' },
  background: { width: '100%' },
  inner: { width: '100%', paddingHorizontal: 18 },
  topbar: { width: '100%', minHeight: 38, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#123E92',
    shadowOpacity: 0.16,
    shadowRadius: 9,
    elevation: 3,
  },
});
