import Animated from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { useFloatLoop } from '../hooks/useFloatLoop';
import { colors } from '../theme/colors';

export function ShopIllustration() {
  const floatStyle = useFloatLoop();

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={floatStyle}
    >
      <Svg width={240} height={130} viewBox="0 0 240 130">
        <Ellipse cx={120} cy={120} rx={118} ry={10} fill={colors.ground} />
        <Rect
          x={62}
          y={52}
          width={116}
          height={66}
          rx={4}
          fill={colors.white}
          stroke={colors.brand}
          strokeWidth={2}
        />
        <Path d="M54 52l10-26h112l10 26z" fill={colors.barOrange} />
        <Path
          d="M78 52l4-26M102 52l2-26M126 52v-26M150 52l-2-26M174 52l-4-26"
          stroke={colors.white}
          strokeWidth={5}
        />
        <Rect x={108} y={76} width={24} height={42} rx={3} fill={colors.brand} />
        <Rect x={72} y={72} width={26} height={22} rx={3} fill={colors.window} />
        <Rect x={142} y={72} width={26} height={22} rx={3} fill={colors.window} />
        <Circle cx={30} cy={84} r={16} fill={colors.tree} />
        <Rect x={28} y={96} width={4} height={22} fill={colors.trunk} />
        <Circle cx={212} cy={90} r={12} fill={colors.tree} />
        <Rect x={210} y={100} width={4} height={18} fill={colors.trunk} />
      </Svg>
    </Animated.View>
  );
}
