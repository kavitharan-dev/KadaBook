import { Image, StyleSheet, Text, View } from 'react-native';
import { fonts } from '../theme/fonts';

const logo = require('../../assets/logo-main.png');

type BrandWordmarkProps = {
  /** Multiplies the base sizing — pass the screen's responsive `scale` (from AuthScreenFrame) when used there. */
  scale?: number;
};

/** The KadaBook mark: icon + wordmark + tagline, stacked and centered. Not currently used on any screen — pull it in wherever that lockup is needed next. */
export function BrandWordmark({ scale = 1 }: BrandWordmarkProps) {
  return (
    <View style={styles.block}>
      <Image source={logo} resizeMode="contain" style={{ width: 132 * scale, height: 121 * scale }} />
      <Text style={styles.wordmark}>Kada<Text style={styles.wordmarkAccent}>Book</Text></Text>
      <Text style={styles.tagline}>Digital Accounting, Simplified for All Shops</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { width: '100%', alignItems: 'center' },
  wordmark: { marginTop: -8, color: '#092C69', fontFamily: fonts.bold, fontSize: 36, lineHeight: 41, letterSpacing: -1.5 },
  wordmarkAccent: { color: '#0867F1' },
  tagline: { color: '#092A61', fontFamily: fonts.semibold, fontSize: 12.5, textAlign: 'center' },
});
