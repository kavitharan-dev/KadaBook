import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import type { UpdateCheckPhase } from '../hooks/useUpdateCheck';
import { fonts } from '../theme/fonts';

const COPY: Record<UpdateCheckPhase, { title: string; body: string }> = {
  disabled: {
    title: 'Updates are off',
    body: 'This is a dev build, so over-the-air updates are disabled here. Install the preview APK to get updates.',
  },
  idle: { title: 'Checking for updates…', body: 'Looking for the latest version of KadaBook.' },
  checking: { title: 'Checking for updates…', body: 'Looking for the latest version of KadaBook.' },
  available: { title: 'Update found', body: 'Getting the latest version ready to download.' },
  downloading: { title: 'Downloading update…', body: 'Getting the latest version ready — stay on this screen.' },
  ready: { title: 'Update ready', body: 'The new version is downloaded. Restart now to start using it.' },
  latest: { title: "You're updated", body: "You're already on the latest version of KadaBook." },
  error: { title: 'Update failed', body: 'Something went wrong while checking for updates.' },
};

export function UpdateModal({
  visible,
  phase,
  error,
  onClose,
  onRestart,
}: {
  visible: boolean;
  phase: UpdateCheckPhase;
  error: string | null;
  onClose: () => void;
  onRestart: () => void;
}) {
  const { colors } = useTheme();
  const busy = phase === 'checking' || phase === 'downloading';
  const copy = COPY[phase];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={busy ? undefined : onClose}>
      <Pressable style={styles.backdrop} onPress={busy ? undefined : onClose}>
        <Pressable onPress={(e) => e.stopPropagation()} style={[styles.card, { backgroundColor: colors.white }]}>
          {busy ? <ActivityIndicator size="large" color={colors.brand} style={styles.spinner} /> : null}
          <Text style={[styles.title, { color: colors.ink }]}>{copy.title}</Text>
          <Text style={[styles.body, { color: colors.muted }]}>{phase === 'error' && error ? error : copy.body}</Text>
          {!busy ? (
            <Pressable
              onPress={phase === 'ready' ? onRestart : onClose}
              style={[styles.primaryBtn, { backgroundColor: colors.brand }]}
            >
              <Text style={styles.primaryBtnText}>{phase === 'ready' ? 'Restart now' : 'Close'}</Text>
            </Pressable>
          ) : (
            <View style={styles.spacer} />
          )}
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
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  spinner: {
    marginBottom: 14,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 17,
    textAlign: 'center',
  },
  body: {
    marginTop: 6,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  primaryBtn: {
    marginTop: 18,
    minWidth: 150,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  spacer: {
    height: 4,
  },
});
