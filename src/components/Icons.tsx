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

export const GearIcon = createIcon(
  'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z' +
    'M19.4 13a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V19a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
);
export const ShieldIcon = createIcon('M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6z');
export const UsersDuoIcon = createDuoIcon(
  'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2z',
  'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M17 11a4 4 0 0 0 0-8M21 21v-2a4 4 0 0 0-3-3.87',
);
export const ClipboardDuoIcon = createDuoIcon(
  'M8 4h8a1 1 0 0 1 1 1v2H7V5a1 1 0 0 1 1-1z',
  'M8 4h8a1 1 0 0 1 1 1v1h2a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h2V5a1 1 0 0 1 1-1zM9 12h6M9 16h4',
);
export const SunIcon = createIcon(
  'M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
);
export const PrinterIcon = createIcon(
  'M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M6 14h12v7H6z',
);
export const HelpCircleIcon = createIcon(
  'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 3.5M12 17h.01',
);
export const InfoCircleIcon = createIcon('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8h.01M11 12h1v5h1');
export const LockIcon = createIcon(
  'M6 10V7a6 6 0 1 1 12 0v3M5 10h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z',
);
export const CameraIcon = createIcon(
  'M4 8a1 1 0 0 1 1-1h2l1.5-2h7L17 7h2a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
);
export const FileExportDuoIcon = createDuoIcon(
  'M7 3h7l4 4v14H7z',
  'M7 3h7l4 4v14H7zM14 3v4h4M9 14l3 3 3-3M12 10v7',
);
export const LogOutIcon = createIcon('M15 17l5-5-5-5M20 12H9M13 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7');
export const StoreIcon = createIcon(
  'M3 9l1.5-5h15L21 9M3 9v10a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9M9 20v-6h6v6M3 9h18',
);
export const DocumentDuoIcon = createDuoIcon(
  'M7 3h7l4 4v14H7z',
  'M7 3h7l4 4v14H7zM14 3v4h4M9 9h3M9 13h6M9 17h6',
);
export const StarDuoIcon = createDuoIcon(
  'M12 3l2.6 5.6 6 .7-4.4 4.2 1.1 6-5.3-3-5.3 3 1.1-6L3.4 9.3l6-.7z',
  'M12 3l2.6 5.6 6 .7-4.4 4.2 1.1 6-5.3-3-5.3 3 1.1-6L3.4 9.3l6-.7z',
);
export const ChatDuoIcon = createDuoIcon(
  'M4 5h16v11H9l-5 4z',
  'M4 5h16v11H9l-5 4zM8 9h8M8 12.5h5',
);
export const GlobeOutlineIcon = createIcon(
  'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
);
export const SearchIcon = createIcon(
  'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
);
export const CloseIcon = createIcon('M18 6L6 18M6 6l12 12');
export const CheckIcon = createIcon('M5 13l4 4L19 7');
export const TagIcon = createIcon(
  'M20.59 13.41L13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01',
);
export const LayersIcon = createIcon('M12 2L2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5');
/** Fork + knife — food/menu items, distinct from the notification BellIcon. */
export const UtensilsIcon = createIcon(
  'M6 2v6a2 2 0 0 0 4 0V2M8 2v20M16 2c-1.5 2-2 4-2 6a3 3 0 0 0 3 3v11',
);
export const PersonIcon = createIcon(
  'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
);
export const PhoneIcon = createIcon(
  'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z',
);
export const CardIcon = createIcon(
  'M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM1 10h22M5.5 15h3',
);
export const CashIcon = createIcon(
  'M2 6h20a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM5.5 9h.01M18.5 9h.01M5.5 15h.01M18.5 15h.01',
);
