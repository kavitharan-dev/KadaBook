import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { useBarGrow } from '../hooks/useBarGrow';

const BRAND = '#075BE2';

export function GlobeIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3.6 9h16.8M3.6 15h16.8M12 3c2.1 2.4 3.1 5.4 3.1 9s-1 6.6-3.1 9c-2.1-2.4-3.1-5.4-3.1-9s1-6.6 3.1-9Z"
        stroke="#0758D9"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function UsersIcon() {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <Circle cx="9" cy="8" r="3.2" stroke={BRAND} strokeWidth={1.8} />
      <Path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke={BRAND} strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx="17.2" cy="9.2" r="2.5" stroke={BRAND} strokeWidth={1.7} />
      <Path d="M14.9 13.3c2.3.4 4 2.1 4.1 4.3" stroke={BRAND} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}

export function SalesIcon() {
  return (
    <Svg width={23} height={23} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 3h12v16.5l-1.7-1-1.6 1-1.7-1-1.7 1-1.6-1-1.7 1-1.6-1L6 19.5V3Z"
        stroke={BRAND}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <Path d="M9 7.5h6M9 11h6M9 14.3h3.5" stroke={BRAND} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

export function StockIcon() {
  return (
    <Svg width={23} height={23} viewBox="0 0 24 24" fill="none">
      <Path d="M3.5 7.5 12 3.5l8.5 4-8.5 4-8.5-4Z" stroke={BRAND} strokeWidth={1.7} strokeLinejoin="round" />
      <Path d="M3.5 7.5v9l8.5 4 8.5-4v-9" stroke={BRAND} strokeWidth={1.7} strokeLinejoin="round" />
      <Path d="M12 11.5v9" stroke={BRAND} strokeWidth={1.7} />
    </Svg>
  );
}

function Bar({ index, height }: { index: number; height: number }) {
  const style = useBarGrow(index);
  return <Animated.View style={[{ width: 5, height, borderRadius: 2, backgroundColor: BRAND }, style]} />;
}

export function ReportsIcon() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 23 }}>
      <Bar index={0} height={10} />
      <Bar index={1} height={16} />
      <Bar index={2} height={23} />
    </View>
  );
}

export function CloudIcon() {
  return (
    <Svg width={23} height={23} viewBox="0 0 24 24" fill="none">
      <Path
        d="M17.5 19H6.5a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 16.76 9.3 4 4 0 0 1 17.5 19Z"
        stroke={BRAND}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <Path d="M9.5 13.3a2.7 2.7 0 0 1 4.6-1.9" stroke={BRAND} strokeWidth={1.3} strokeLinecap="round" />
      <Path d="M13.6 10.5l1 .3-.3 1.1" stroke={BRAND} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M14.5 13.7a2.7 2.7 0 0 1-4.6 1.9" stroke={BRAND} strokeWidth={1.3} strokeLinecap="round" />
      <Path d="M10.4 16.5l-1-.3.3-1.1" stroke={BRAND} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function PersonPlusIcon() {
  return (
    <Svg width={21} height={21} viewBox="0 0 24 24" fill="none">
      <Circle cx="10" cy="8" r="3.3" stroke={BRAND} strokeWidth={1.8} />
      <Path d="M4 19c0-3.3 2.7-5.6 6-5.6s6 2.3 6 5.6" stroke={BRAND} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M19 7.5v5M16.5 10h5" stroke={BRAND} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function EyeIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7-10-7-10-7Z" stroke="#72839F" strokeWidth={1.8} strokeLinejoin="round" />
      <Circle cx="12" cy="12" r="3" stroke="#72839F" strokeWidth={1.8} />
    </Svg>
  );
}

export function EyeOffIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2 12s3.8-7 10-7c1.8 0 3.4.5 4.7 1.2M22 12s-3.8 7-10 7c-1.8 0-3.4-.5-4.7-1.2M4.5 4.5l15 15"
        stroke="#72839F"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M14.1 14.1a3 3 0 0 1-4.2-4.2" stroke="#72839F" strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function ShopIcon() {
  return (
    <Svg width={25} height={23} viewBox="0 0 24 24" fill="none">
      <Path d="M4 9.5 5 4h14l1 5.5" stroke="#FFFFFF" strokeWidth={1.6} strokeLinejoin="round" />
      <Path
        d="M3.5 9.5c0 1.5 1.2 2.6 2.6 2.6S8.7 11 8.7 9.5c0 1.5 1.2 2.6 2.6 2.6s2.6-1.1 2.6-2.6c0 1.5 1.2 2.6 2.6 2.6s2.6-1.1 2.6-2.6"
        stroke="#FFFFFF"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M5 12v8h14v-8" stroke="#FFFFFF" strokeWidth={1.6} />
      <Path d="M10 20v-5h4v5" stroke="#FFFFFF" strokeWidth={1.6} />
    </Svg>
  );
}

export function LaurelBranch({ flip }: { flip?: boolean }) {
  return (
    <Svg width={32} height={16} viewBox="0 0 32 16" fill="none" style={flip ? { transform: [{ scaleX: -1 }] } : undefined}>
      <Path d="M2 14C10 14 15 10 15 2" stroke="rgba(255,255,255,0.85)" strokeWidth={1.4} strokeLinecap="round" />
      <Path
        d="M5 13c1.5-.5 2.5-1.8 2.2-3.2M7.8 11.2c1.5-.3 2.6-1.5 2.5-3M10.5 9c1.4-.1 2.5-1.1 2.6-2.5M12.9 6.6c1.2.1 2.3-.6 2.7-1.9"
        stroke="rgba(255,255,255,0.85)"
        strokeWidth={1.1}
        strokeLinecap="round"
      />
    </Svg>
  );
}
