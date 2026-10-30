import { useWindowDimensions } from 'react-native';

/** Phone vs tablet layout hints (Android tabs / large phones). */
export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 600;
  const isLargePhone = width >= 400;
  const contentMaxWidth = isTablet ? 520 : isLargePhone ? 440 : undefined;
  const padX = isTablet ? 28 : 16;
  const keySize = isTablet ? 68 : 60;
  return { width, height, isTablet, isLargePhone, contentMaxWidth, padX, keySize };
}
