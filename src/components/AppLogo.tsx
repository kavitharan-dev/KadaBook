import { Image, type ImageStyle, type StyleProp } from 'react-native';

const localLogo = require('../../assets/logo-app.png');

export function AppLogo({
  size = 44,
  style,
}: {
  size?: number;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      accessibilityLabel="KadaBook"
      accessibilityIgnoresInvertColors
      source={localLogo}
      resizeMode="contain"
      style={[{ width: size, height: size, backgroundColor: 'transparent' }, style]}
    />
  );
}
