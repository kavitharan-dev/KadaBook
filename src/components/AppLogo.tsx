import { Image, type ImageStyle, type StyleProp } from 'react-native';
import { useRemoteConfig } from '../context/RemoteConfigContext';

const localLogo = require('../../assets/icon.png');

export function AppLogo({
  size = 28,
  style,
}: {
  size?: number;
  style?: StyleProp<ImageStyle>;
}) {
  const { config } = useRemoteConfig();
  const source = config.logoUrl ? { uri: config.logoUrl } : localLogo;
  return (
    <Image
      accessibilityIgnoresInvertColors
      source={source}
      style={[{ width: size, height: size, borderRadius: size * 0.22 }, style]}
    />
  );
}
