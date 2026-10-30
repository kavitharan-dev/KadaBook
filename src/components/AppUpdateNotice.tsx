import { StyleSheet, Text, View } from 'react-native';
import { useAppUpdate } from '../hooks/useAppUpdate';
import { fonts } from '../theme/fonts';

export function AppUpdateNotice() {
  const { updating } = useAppUpdate();
  if (!updating) return null;
  return (
    <View pointerEvents="none" style={styles.wrap}>
      <Text style={styles.text}>Updating...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    zIndex: 20,
    backgroundColor: '#1D5FE0',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  text: {
    color: '#fff',
    fontFamily: fonts.semibold,
    fontSize: 12,
  },
});
