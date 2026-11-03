import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { fonts } from '../theme/fonts';

const BARCODE_TYPES = [
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'code128',
  'code39',
  'code93',
  'codabar',
  'itf14',
  'qr',
] as const;

type Props = {
  visible: boolean;
  title?: string;
  hint?: string;
  onClose: () => void;
  onScan: (code: string) => void;
};

export function BarcodeScannerModal({
  visible,
  title = 'Scan barcode',
  hint = 'Point your phone camera at the barcode',
  onClose,
  onScan,
}: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const locked = useRef(false);

  useEffect(() => {
    if (!visible) {
      locked.current = false;
      setTorch(false);
      return;
    }
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [visible, permission, requestPermission]);

  const handleScan = useCallback(
    (result: BarcodeScanningResult) => {
      const code = result.data?.trim();
      if (!code || locked.current) return;
      locked.current = true;
      onScan(code);
    },
    [onScan],
  );

  const granted = permission?.granted === true;
  const webUnsupported = Platform.OS === 'web';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: '#0B1220', paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close scanner"
            onPress={onClose}
            style={styles.topBtn}
          >
            <Text style={styles.topBtnText}>Close</Text>
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={torch ? 'Turn torch off' : 'Turn torch on'}
            onPress={() => setTorch((v) => !v)}
            disabled={!granted || webUnsupported}
            style={[styles.topBtn, (!granted || webUnsupported) && styles.topBtnDisabled]}
          >
            <Text style={styles.topBtnText}>{torch ? 'Torch on' : 'Torch'}</Text>
          </Pressable>
        </View>

        <Text style={[styles.hint, { color: colors.muted }]}>{hint}</Text>

        <View style={styles.stage}>
          {webUnsupported ? (
            <View style={styles.fallback}>
              <Text style={styles.fallbackTitle}>Camera scan needs a phone</Text>
              <Text style={styles.fallbackBody}>
                Open KadaBook on your Android or iPhone and tap Scan. On web, type the barcode in the search box instead.
              </Text>
            </View>
          ) : !permission ? (
            <View style={styles.fallback}>
              <Text style={styles.fallbackBody}>Checking camera permission…</Text>
            </View>
          ) : !granted ? (
            <View style={styles.fallback}>
              <Text style={styles.fallbackTitle}>Camera permission needed</Text>
              <Text style={styles.fallbackBody}>
                Allow camera access so you can scan product barcodes with this phone.
              </Text>
              <Pressable
                onPress={() => void requestPermission()}
                style={[styles.allowBtn, { backgroundColor: colors.brand }]}
              >
                <Text style={styles.allowBtnText}>Allow camera</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                enableTorch={torch}
                barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
                onBarcodeScanned={handleScan}
              />
              <View pointerEvents="none" style={styles.overlay}>
                <View style={styles.frame}>
                  <View style={[styles.corner, styles.tl]} />
                  <View style={[styles.corner, styles.tr]} />
                  <View style={[styles.corner, styles.bl]} />
                  <View style={[styles.corner, styles.br]} />
                </View>
              </View>
            </>
          )}
        </View>

        <View style={{ height: Math.max(16, insets.bottom) }} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  topBtn: {
    minWidth: 72,
    minHeight: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10,
  },
  topBtnDisabled: {
    opacity: 0.4,
  },
  topBtnText: {
    color: '#FFFFFF',
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    color: '#FFFFFF',
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  hint: {
    textAlign: 'center',
    fontFamily: fonts.regular,
    fontSize: 13,
    paddingHorizontal: 20,
    marginBottom: 12,
    color: '#A8B3C7',
  },
  stage: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#111827',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: '72%',
    aspectRatio: 1.4,
    maxWidth: 280,
    maxHeight: 200,
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#FFFFFF',
  },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  fallbackTitle: {
    color: '#FFFFFF',
    fontFamily: fonts.bold,
    fontSize: 17,
    textAlign: 'center',
  },
  fallbackBody: {
    color: '#A8B3C7',
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  allowBtn: {
    marginTop: 8,
    minHeight: 48,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allowBtnText: {
    color: '#FFFFFF',
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
});
