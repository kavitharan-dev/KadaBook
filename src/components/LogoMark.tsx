import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';
import { useBarGrow } from '../hooks/useBarGrow';
import { useLogoEntrance } from '../hooks/useLogoEntrance';
import { colors } from '../theme/colors';

const SCALE = 76 / 72;

const BARS = [
  { x: 22, y: 42, width: 7, height: 14, color: colors.white },
  { x: 33, y: 35, width: 7, height: 21, color: colors.barYellow },
  { x: 44, y: 29, width: 7, height: 27, color: colors.barOrange },
] as const;

function LogoBar({
  index,
  x,
  y,
  width,
  height,
  color,
}: {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}) {
  const growStyle = useBarGrow(index);

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          left: x * SCALE,
          top: y * SCALE,
          width: width * SCALE,
          height: height * SCALE,
          borderRadius: 2 * SCALE,
          backgroundColor: color,
        },
        growStyle,
      ]}
    />
  );
}

export function LogoMark() {
  const entranceStyle = useLogoEntrance();

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.logo, entranceStyle]}
    >
      <Svg width={76} height={76} viewBox="0 0 72 72">
        <Rect x={8} y={18} width={56} height={48} rx={12} fill={colors.brand} />
        <Path
          d="M26 24v-5a10 10 0 0 1 20 0v5"
          fill="none"
          stroke={colors.brand}
          strokeWidth={5}
          strokeLinecap="round"
        />
      </Svg>
      {BARS.map((bar, index) => (
        <LogoBar key={bar.color} index={index} {...bar} />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  logo: {
    width: 76,
    height: 76,
  },
  bar: {
    position: 'absolute',
  },
});
