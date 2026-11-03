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
export const ScanIcon = createIcon(
  'M4 7V5a1 1 0 0 1 1-1h2M4 17v2a1 1 0 0 0 1 1h2M20 7V5a1 1 0 0 0-1-1h-2M20 17v2a1 1 0 0 1-1 1h-2M8 12h8',
);

/** Two-tone glyph: soft filled shape under a stroked outline. */
function Duo({ fill, d, color, size = 22 }: IconProps & { fill: string; d: string }) {
  const { colors } = useTheme();
  const tone = color ?? colors.ink;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={fill} fill={tone} fillOpacity={0.32} />
      <Path d={d} stroke={tone} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function createDuoIcon(fill: string, d: string) {
  return function Icon(props: IconProps) {
    return <Duo fill={fill} d={d} {...props} />;
  };
}

export const ChevronRightIcon = createIcon('M9 6l6 6-6 6');
export const ClockIcon = createIcon('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2');
export const CartDuoIcon = createDuoIcon(
  'M6 7h14l-2 8H7.6z',
  'M3 4h2l2.4 11h10.2l2-8H6M9 20h.01M17 20h.01',
);
export const ReceiptDuoIcon = createDuoIcon(
  'M6 3h12v18l-3-2-3 2-3-2-3 2z',
  'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3',
);
export const BoxDuoIcon = createDuoIcon(
  'M12 12l8-4.5v9L12 21z',
  'M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9',
);
export const ChartDuoIcon = createDuoIcon(
  'M4 13h3v7H4zM10.5 4h3v16h-3zM17 9h3v11h-3z',
  'M4 13h3v7H4zM10.5 4h3v16h-3zM17 9h3v11h-3zM3 20h18',
);
export const TrendDuoIcon = createDuoIcon(
  'M3 20v-3l6-6 4 4 8-8v13z',
  'M3 17l6-6 4 4 8-8M15 7h6v6',
);
export const TrophyDuoIcon = createDuoIcon(
  'M7 4h10v5a5 5 0 0 1-10 0z',
  'M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 14v4M8 21h8M9 18h6',
);
export const GridDuoIcon = createDuoIcon(
  'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
);
export const BookDuoIcon = createDuoIcon(
  'M4 5h7a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4z',
  'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 5v14.5A2.5 2.5 0 0 0 6.5 22H20V7a2 2 0 0 0-2-2H6.5A2.5 2.5 0 0 0 4 7.5z',
);
