import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignMode } from './DesignModeContext';

/**
 * Mounted once near the app root (see App.tsx). Dev-only: renders nothing
 * outside __DEV__. Shows a floating toggle always, and — once Design Mode is
 * on and a widget is selected — a small panel with steppers for each of that
 * widget's numeric values plus Save/Reset.
 */
export function DesignModeOverlay() {
  const dm = useDesignMode();
  if (!__DEV__ || !dm) return null;

  const [screen, id] = dm.selectedId ? dm.selectedId.split('.') : [null, null];
  const value = screen && id && dm.selectedBase ? dm.getValue(screen, id, dm.selectedBase) : null;

  const api = dm;
  function bump(key: string, delta: number) {
    if (!screen || !id || !value) return;
    api.setValue(screen, id, { ...value, [key]: Math.round(value[key] + delta) });
  }

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Pressable onPress={dm.toggle} style={[styles.fab, dm.active && styles.fabActive]}>
        <Text style={styles.fabIcon}>🎨</Text>
      </Pressable>

      {dm.active ? (
        <View style={styles.panel}>
          {value && screen && id ? (
            <>
              <Text style={styles.selLabel}>{id}</Text>
              {Object.keys(value).map((key) => (
                <View key={key} style={styles.stepperRow}>
                  <Text style={styles.stepperLabel}>{key}</Text>
                  <Pressable onPress={() => bump(key, -2)} style={styles.stepBtn}>
                    <Text style={styles.stepBtnText}>−</Text>
                  </Pressable>
                  <Text style={styles.stepValue}>{Math.round(value[key])}</Text>
                  <Pressable onPress={() => bump(key, 2)} style={styles.stepBtn}>
                    <Text style={styles.stepBtnText}>+</Text>
                  </Pressable>
                </View>
              ))}
              <View style={styles.actionsRow}>
                <Pressable onPress={() => screen && dm.resetScreen(screen)} style={styles.resetBtn}>
                  <Text style={styles.resetText}>Reset</Text>
                </Pressable>
                <Pressable onPress={() => screen && dm.saveScreen(screen)} style={styles.saveBtn} disabled={dm.saving}>
                  <Text style={styles.saveText}>{dm.saving ? 'Saving…' : 'Save as default'}</Text>
                </Pressable>
              </View>
              {dm.lastSaveError ? <Text style={styles.errorText}>{dm.lastSaveError}</Text> : null}
            </>
          ) : (
            <Text style={styles.hint}>Design Mode on — tap an outlined widget to edit it.</Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(20,20,30,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabActive: { backgroundColor: '#FF3D9A' },
  fabIcon: { fontSize: 20 },
  panel: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 66,
    backgroundColor: 'rgba(20,20,30,0.95)',
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  hint: { color: '#FFFFFF', fontSize: 13 },
  selLabel: { color: '#FF8FC6', fontSize: 13, fontWeight: '700', marginBottom: 2 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepperLabel: { color: '#FFFFFF', fontSize: 13, flex: 1 },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  stepValue: { color: '#FFFFFF', fontSize: 13, width: 40, textAlign: 'center' },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  resetBtn: { flex: 1, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  resetText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  saveBtn: { flex: 2, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A5FE5' },
  saveText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  errorText: { color: '#FCA5A5', fontSize: 12 },
});
