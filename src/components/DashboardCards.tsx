import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { FadeUp } from './FadeUp';
import { CalendarIcon, ChevronRightIcon, ClockIcon } from './Icons';
import { useIconPress } from '../hooks/useIconPress';
import { useCountUp } from '../hooks/useCountUp';
import { useTheme } from '../context/ThemeContext';
import { formatDay, formatRs } from '../lib/format';
import { fonts } from '../theme/fonts';

type IconType = ComponentType<{ color?: string; size?: number }>;

const DASHBOARD_SHOP_IMAGE = require('../../assets/dashboard/dashboard-card-shop-img.png');

/** Sampled directly from assets/screens-ui/dashboard-ui.png's hero card — not shared, only HeroSalesCard uses this. */
const HERO_GRADIENT = ['#002FBA', '#004ADF', '#0176F8'] as const;

/** Colors sampled pixel-for-pixel from assets/screens-ui/dashboard-ui.png (Quick Action badges + the This Month cards). */
export const gradients = {
  blue: ['#004AE0', '#4D86ED', '#9BC3FA'],
  purple: ['#6E28F2', '#844DF3', '#9E78F4'],
  teal: ['#027B62', '#029C7E', '#2AB89A'],
  orange: ['#FD6402', '#FE820E', '#FDA63F'],
  green: ['#028625', '#0BA02C', '#4BC14A'],
  red: ['#F3282A', '#F65C57', '#F8908A'],
} as const;

/** Money that rolls up to its value. */
export function CountUpText({ value, delay, style }: { value: number; delay?: number; style?: StyleProp<TextStyle> }) {
  const shown = useCountUp(value, { delay });
  return <Text style={style}>{formatRs(shown)}</Text>;
}

/** Slow-drifting translucent circle used as card decoration. */
function FloatingOrb({ size, style, phase = 0 }: { size: number; style: ViewStyle; phase?: number }) {
  const reduced = useReducedMotion();
  const drift = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    drift.value = withDelay(
      phase,
      withRepeat(withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }), -1, true),
    );
  }, [drift, phase, reduced]);

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateY: drift.value * -8 }, { scale: 1 + drift.value * 0.06 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2 }, style, animated]}
    />
  );
}

/** Light band that sweeps across the card every few seconds. */
function ShimmerSweep({ every = 4200 }: { every?: number }) {
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const p = useSharedValue(0);

  useEffect(() => {
    if (reduced || !width) return;
    p.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 0 }),
        withDelay(every, withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) })),
      ),
      -1,
    );
  }, [every, p, reduced, width]);

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateX: -120 + p.value * (width + 240) }, { rotate: '18deg' }],
  }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <Animated.View style={[styles.shimmer, animated]}>
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

/**
 * Layered ellipse "hills" + a bright bottom highlight — a color-only stand-in
 * for the old background photo's glossy wave art. Dark/light overlays (not
 * fixed hex colors) so it reads correctly over every gradient color this
 * card shell is used with, not just blue.
 */
function WaveAccent() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.hillDarkBack} />
      <View style={styles.hillDarkFront} />
      <View style={styles.hillLight} />
    </View>
  );
}

function CardShell({
  delay,
  gradient,
  glow,
  onPress,
  onLongPress,
  accessibilityLabel,
  style,
  innerStyle,
  children,
}: {
  delay: number;
  gradient: readonly [string, string, ...string[]];
  glow: string;
  onPress: () => void;
  onLongPress?: () => void;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const { style: pressStyle, onPressIn, onPressOut } = useIconPress(0.97);
  return (
    <FadeUp delay={delay} style={style}>
      <Animated.View style={[styles.shell, { boxShadow: `0px 10px 22px ${glow}` }, pressStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          onPress={onPress}
          onLongPress={onLongPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
        >
          <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.card, innerStyle]}>
            <FloatingOrb size={150} style={styles.orbBig} />
            <FloatingOrb size={90} style={styles.orbSmall} phase={900} />
            <WaveAccent />
            <ShimmerSweep />
            {children}
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </FadeUp>
  );
}

function IconBadge({ Icon, size = 36 }: { Icon: IconType; size?: number }) {
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size * 0.3 }]}>
      <Icon color="#FFFFFF" size={size * 0.55} />
    </View>
  );
}

function ViewLink({ label }: { label: string }) {
  return (
    <View style={styles.viewLink}>
      <Text style={styles.viewText}>{label}</Text>
      <ChevronRightIcon color="#FFFFFF" size={13} />
    </View>
  );
}

function TrendChip({ percent, suffix }: { percent: number; suffix: string }) {
  const reduced = useReducedMotion();
  const bob = useSharedValue(0);
  const up = percent >= 0;

  useEffect(() => {
    if (reduced) return;
    bob.value = withDelay(
      1200,
      withRepeat(withTiming(1, { duration: 650, easing: Easing.inOut(Easing.sin) }), -1, true),
    );
  }, [bob, reduced]);

  const arrow = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value * (up ? -2.5 : 2.5) }] }));

  return (
    <View style={styles.chip}>
      <Animated.Text style={[styles.chipText, arrow]}>{up ? '▲' : '▼'}</Animated.Text>
      <Text style={styles.chipText}>
        {Math.abs(percent)}% <Text style={styles.chipSoft}>{suffix}</Text>
      </Text>
    </View>
  );
}

/** Dashboard + today's sales in one gradient card. */
export function HeroSalesCard({
  delay,
  title,
  subtitle,
  label,
  amount,
  percent,
  hint,
  vsLabel,
  viewLabel,
  Icon,
  onPress,
  onLongPress,
}: {
  delay: number;
  title: string;
  subtitle: string;
  label: string;
  amount: number;
  percent: number;
  hint: string;
  vsLabel: string;
  viewLabel: string;
  Icon: IconType;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const clock = [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');

  return (
    <CardShell
      delay={delay}
      gradient={HERO_GRADIENT}
      glow="rgba(0,74,224,0.35)"
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityLabel={`${title}. ${label}`}
      innerStyle={styles.heroCard}
    >
      <View style={styles.heroTop}>
        <View style={styles.heroTopText}>
          <Text style={styles.heroTitle}>{title}</Text>
          <Text style={styles.heroSub} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <View style={styles.heroMeta}>
          <View style={styles.heroMetaRow}>
            <CalendarIcon color="rgba(255,255,255,0.85)" size={12} />
            <Text style={styles.heroMetaText}>{formatDay(now.getTime())}</Text>
          </View>
          <View style={styles.heroMetaRow}>
            <ClockIcon color="#FFFFFF" size={12} />
            <Text style={styles.heroClock}>{clock}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.headRow, styles.headRowSpaced]}>
        <Text style={styles.cardLabel}>{label}</Text>
        <IconBadge Icon={Icon} size={34} />
      </View>
      <Image source={DASHBOARD_SHOP_IMAGE} resizeMode="contain" style={styles.shopImage} accessibilityIgnoresInvertColors />
      <CountUpText value={amount} delay={delay + 150} style={styles.heroAmount} />
      <Text style={styles.heroHint} numberOfLines={1}>
        {hint}
      </Text>
      <View style={styles.footRow}>
        <TrendChip percent={percent} suffix={vsLabel} />
        <ViewLink label={viewLabel} />
      </View>
    </CardShell>
  );
}

/** Compact gradient metric card (month totals). */
export function GradientStatCard({
  delay,
  gradient,
  glow,
  label,
  value,
  chip,
  viewLabel,
  Icon,
  onPress,
  style,
}: {
  delay: number;
  gradient: readonly [string, string, ...string[]];
  glow: string;
  label: string;
  value: number;
  chip: string;
  viewLabel: string;
  Icon: IconType;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <CardShell
      delay={delay}
      gradient={gradient}
      glow={glow}
      onPress={onPress}
      accessibilityLabel={label}
      style={style}
      innerStyle={styles.statCard}
    >
      <View style={styles.headRow}>
        <Text style={[styles.cardLabel, styles.statLabel]} numberOfLines={2}>
          {label}
        </Text>
        <IconBadge Icon={Icon} size={34} />
      </View>
      <CountUpText value={value} delay={delay + 150} style={styles.statAmount} />
      <View style={styles.footRow}>
        <View style={[styles.chip, styles.chipShrink]}>
          <Text style={styles.chipText} numberOfLines={1}>
            {chip}
          </Text>
        </View>
        <ViewLink label={viewLabel} />
      </View>
    </CardShell>
  );
}

/** Page title panel with today's date and a live clock. */
export function DashboardHeader({ title, subtitle }: { title: string; subtitle: string }) {
  const { colors } = useTheme();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const clock = [now.getHours(), now.getMinutes(), now.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');

  return (
    <FadeUp delay={0} style={[styles.panel, { backgroundColor: colors.white, borderColor: colors.hairline }]}>
      <View style={styles.panelText}>
        <Text style={[styles.panelTitle, { color: colors.brand }]}>{title}</Text>
        <Text style={[styles.panelSub, { color: colors.muted }]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <View style={styles.panelMeta}>
        <View style={styles.metaRow}>
          <CalendarIcon color={colors.muted} size={13} />
          <Text style={[styles.metaText, { color: colors.muted }]}>{formatDay(now.getTime())}</Text>
        </View>
        <View style={styles.metaRow}>
          <ClockIcon color={colors.ink} size={13} />
          <Text style={[styles.clock, { color: colors.ink }]}>{clock}</Text>
        </View>
      </View>
    </FadeUp>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: 20,
  },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  heroCard: {
    padding: 16,
    minHeight: 170,
    gap: 2,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  heroTopText: {
    flex: 1,
    paddingRight: 4,
  },
  heroTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: '#FFFFFF',
  },
  heroSub: {
    marginTop: 2,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.82)',
  },
  heroMeta: {
    alignItems: 'flex-end',
    gap: 4,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  heroMetaText: {
    fontFamily: fonts.semibold,
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.88)',
  },
  heroClock: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  statCard: {
    padding: 12,
    minHeight: 112,
  },
  orbBig: {
    top: -55,
    right: -40,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  orbSmall: {
    bottom: -40,
    left: -25,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  hillDarkBack: {
    position: 'absolute',
    width: '120%',
    height: '320%',
    borderRadius: 999,
    top: '-220%',
    right: '-30%',
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  hillDarkFront: {
    position: 'absolute',
    width: '110%',
    height: '300%',
    borderRadius: 999,
    bottom: '-210%',
    left: '-25%',
    backgroundColor: 'rgba(0,0,0,0.09)',
  },
  hillLight: {
    position: 'absolute',
    width: '140%',
    height: '260%',
    borderRadius: 999,
    bottom: '-215%',
    left: '-10%',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  shimmer: {
    position: 'absolute',
    top: -60,
    bottom: -60,
    width: 70,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  headRowSpaced: {
    marginTop: 10,
  },
  cardLabel: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.92)',
    paddingTop: 4,
  },
  statLabel: {
    fontSize: 10.5,
    letterSpacing: 0.8,
    paddingTop: 2,
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  heroAmount: {
    marginTop: 4,
    fontFamily: fonts.bold,
    fontSize: 36,
    lineHeight: 39,
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  heroHint: {
    marginTop: 2,
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
  },
  shopImage: {
    position: 'absolute',
    right: 44,
    bottom: 21,
    width: 174,
    height: 116,
  },
  statAmount: {
    marginTop: 10,
    fontFamily: fonts.bold,
    fontSize: 21,
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  footRow: {
    marginTop: 'auto',
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipShrink: {
    flexShrink: 1,
  },
  chipText: {
    fontFamily: fonts.semibold,
    fontSize: 11.5,
    color: '#FFFFFF',
  },
  chipSoft: {
    fontFamily: fonts.regular,
    color: 'rgba(255,255,255,0.85)',
  },
  viewLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  panel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    boxShadow: '0px 4px 14px rgba(15,23,42,0.05)',
  },
  panelText: {
    flex: 1,
  },
  panelTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
  },
  panelSub: {
    marginTop: 2,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  panelMeta: {
    alignItems: 'flex-end',
    gap: 3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontFamily: fonts.semibold,
    fontSize: 11.5,
  },
  clock: {
    fontFamily: fonts.bold,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
});
