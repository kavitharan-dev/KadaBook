import { ReactNode, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { type NumMap, useDesignMode } from './DesignModeContext';

type DesignableProps = {
  screen: string;
  id: string;
  base: NumMap;
  /** [widthKey, heightKey] — shows a corner handle that drags both at once. */
  resizeKeys?: [string, string];
  /** A single key nudged by dragging the widget vertically (e.g. a margin/padding). */
  offsetKey?: string;
  children: (value: NumMap) => ReactNode;
};

/**
 * Wraps one visually-tunable piece of a screen. Outside __DEV__, or when
 * Design Mode is off, this is a transparent passthrough — zero behavior
 * change. See src/designConfig/<screen>.ts for where `base` comes from and
 * the kadabook-auth-screen skill for the overall pattern.
 */
export function Designable({ screen, id, base, resizeKeys, offsetKey, children }: DesignableProps) {
  const dm = useDesignMode();
  const fullId = `${screen}.${id}`;

  // Keep the registry's "base" (the config file's current value) up to date
  // even while not selected, so Save can reconstruct the full config.
  const baseKey = JSON.stringify(base);
  useEffect(() => {
    if (!dm) return;
    dm.register(screen, id, base);
    return () => dm.unregister(screen, id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dm, screen, id, baseKey]);

  if (!__DEV__ || !dm) {
    return <>{children(base)}</>;
  }

  return (
    <DesignableActive dm={dm} screen={screen} id={id} fullId={fullId} base={base} resizeKeys={resizeKeys} offsetKey={offsetKey}>
      {children}
    </DesignableActive>
  );
}

function DesignableActive({
  dm,
  screen,
  id,
  fullId,
  base,
  resizeKeys,
  offsetKey,
  children,
}: {
  dm: NonNullable<ReturnType<typeof useDesignMode>>;
  screen: string;
  id: string;
  fullId: string;
  base: NumMap;
  resizeKeys?: [string, string];
  offsetKey?: string;
  children: (value: NumMap) => ReactNode;
}) {
  const value = dm.getValue(screen, id, base);
  const selected = dm.active && dm.selectedId === fullId;
  const dragStart = useRef(value);

  const resizePan = Gesture.Pan()
    .runOnJS(true)
    .enabled(selected && !!resizeKeys)
    .onStart(() => {
      dragStart.current = value;
    })
    .onUpdate((e) => {
      if (!resizeKeys) return;
      const [wKey, hKey] = resizeKeys;
      dm.setValue(screen, id, {
        ...value,
        [wKey]: Math.max(16, Math.round((dragStart.current[wKey] ?? 0) + e.translationX)),
        [hKey]: Math.max(16, Math.round((dragStart.current[hKey] ?? 0) + e.translationY)),
      });
    });

  const offsetPan = Gesture.Pan()
    .runOnJS(true)
    .enabled(selected && !!offsetKey)
    .onStart(() => {
      dragStart.current = value;
    })
    .onUpdate((e) => {
      if (!offsetKey) return;
      dm.setValue(screen, id, {
        ...value,
        [offsetKey]: Math.round((dragStart.current[offsetKey] ?? 0) + e.translationY),
      });
    });

  return (
    <View style={dm.active ? styles.wrap : undefined}>
      <Pressable disabled={!dm.active} onPress={() => dm.select(dm.active ? fullId : null, base)}>
        {children(value)}
      </Pressable>
      {dm.active ? (
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          {selected ? <View pointerEvents="none" style={styles.outline} /> : null}
          {selected && offsetKey ? (
            <GestureDetector gesture={offsetPan}>
              <View style={styles.moveHandle}>
                <Text style={styles.handleIcon}>↕</Text>
              </View>
            </GestureDetector>
          ) : null}
          {selected && resizeKeys ? (
            <GestureDetector gesture={resizePan}>
              <View style={styles.resizeHandle}>
                <Text style={styles.handleIcon}>⤡</Text>
              </View>
            </GestureDetector>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  outline: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderWidth: 2,
    borderColor: '#FF3D9A',
    borderStyle: 'dashed',
    borderRadius: 6,
  },
  moveHandle: {
    position: 'absolute',
    top: -14,
    left: '50%',
    marginLeft: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FF3D9A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resizeHandle: {
    position: 'absolute',
    bottom: -14,
    right: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FF3D9A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleIcon: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
