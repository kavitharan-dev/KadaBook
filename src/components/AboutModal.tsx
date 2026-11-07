import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { APP_VERSION, BUILD_TAG } from '../config/build';
import { fonts } from '../theme/fonts';

const LOGO = require('../../assets/logo-main.png');

export function AboutModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()} style={[styles.card, { backgroundColor: colors.white }]}>
          <Image source={LOGO} resizeMode="contain" style={styles.logo} accessibilityIgnoresInvertColors />
          <Text style={[styles.name, { color: colors.ink }]}>
            Kada<Text style={{ color: colors.brand }}>Book</Text>
          </Text>
          <Text style={[styles.tagline, { color: colors.muted }]}>Digital accounting, simplified for every shop</Text>
          <View style={[styles.divider, { backgroundColor: colors.rowLine }]} />
          <Text style={[styles.devLabel, { color: colors.muted }]}>Developed by</Text>
          <Text style={[styles.devName, { color: colors.ink }]}>SMART PVT LTD</Text>
          <Text style={[styles.meta, { color: colors.muted }]}>
            Version {APP_VERSION} · {BUILD_TAG}
          </Text>
          <Pressable onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.brand }]}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5,15,35,0.55)',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    borderRadius: 22,
    paddingVertical: 26,
    paddingHorizontal: 22,
    alignItems: 'center',
    gap: 4,
  },
  logo: {
    width: 108,
    height: 108,
    marginBottom: 6,
  },
  name: {
    fontFamily: fonts.bold,
    fontSize: 24,
  },
  tagline: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    textAlign: 'center',
    marginTop: 2,
  },
  divider: {
    height: 1,
    alignSelf: 'stretch',
    marginVertical: 14,
  },
  devLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  devName: {
    fontFamily: fonts.bold,
    fontSize: 16,
    marginTop: 2,
  },
  meta: {
    fontFamily: fonts.regular,
    fontSize: 12,
    marginTop: 10,
  },
  closeBtn: {
    marginTop: 18,
    minWidth: 120,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: '#FFFFFF',
  },
});
