import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { colors } from '../theme/colors';

export function MiniLogo() {
  return (
    <View>
      <Svg width={28} height={28} viewBox="0 0 72 72">
        <Rect x={8} y={18} width={56} height={48} rx={12} fill={colors.brand} />
        <Rect x={22} y={42} width={7} height={14} rx={2} fill={colors.white} />
        <Rect x={33} y={35} width={7} height={21} rx={2} fill={colors.barYellow} />
        <Rect x={44} y={29} width={7} height={27} rx={2} fill={colors.barOrange} />
      </Svg>
    </View>
  );
}
