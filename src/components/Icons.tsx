import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

type IconProps = {
  color?: string;
  size?: number;
};

function Stroke({ d, color, size = 22 }: IconProps & { d: string }) {
  const { colors } = useTheme();
  const stroke = color ?? colors.ink;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={d}
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function createIcon(d: string) {
  return function Icon(props: IconProps) {
    return <Stroke d={d} {...props} />;
  };
}

export const MenuIcon = createIcon('M4 7h16M4 12h16M4 17h16');
export const BellIcon = createIcon('M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4');
export const HomeIcon = createIcon('M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z');
export const SaleIcon = createIcon('M3 4h2l2.4 11h10.2l2-8H6M9 20h.01M17 20h.01');
export const ProductIcon = createIcon('M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9');
export const ReportIcon = createIcon('M5 20V10M12 20V4M19 20v-7');
export const MoreIcon = createIcon('M5 12h.01M12 12h.01M19 12h.01');
export const BackIcon = createIcon('M19 12H5M12 19l-7-7 7-7');
export const CalendarIcon = createIcon('M4 6h16v14H4zM4 10h16M8 3v4M16 3v4');
export const ExpenseIcon = createIcon('M7 3h8l4 4v14H7zM11 12h4M11 16h4');
