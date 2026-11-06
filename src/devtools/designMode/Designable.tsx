import { ReactNode, useEffect, useMemo, useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { type NumMap, useDesignMode } from './DesignModeContext';

// On web, dragging the handle can trigger the browser's native text-selection
// (it visually sits close to text) instead of the Pan gesture — these CSS-only
// properties stop that without affecting native.
const webDragFix =
  Platform.OS === 'web'
    ? ({ userSelect: 'none', touchAction: 'none', cursor: 'grab' } as unknown as Record<string, unknown>)
    : {};

type DesignableProps = {
  screen: string;
  id: string;
  base: NumMap;
  /** [widthKey, heightKey] — shows a corner handle that drags both at once. */
  resizeKeys?: [string, string];
  /** A single key nudged by dragging the widget vertically (e.g. a margin/padding). */
  offsetKey?: string;
  /**
   * The screen's current responsive scale factor (from AuthScreenFrame). Drag
   * deltas are measured in real screen pixels, but `base` values are
   * *pre-scale* design units (the screen multiplies by `scale` when
   * rendering) — without dividing by it here, a drag would move the base
   * value by more or less than it visually looks like, and the saved value
   * would render wrong-sized on a different device than the one used to
   * edit it. Defaults to 1 for widgets that don't scale.
   */
  scale?: number;
  children: (value: NumMap) => ReactNode;
};

/**
 * Wraps one visually-tunable piece of a screen. Outside __DEV__, or when
 * Design Mode is off, this is a transparent passthrough — zero behavior
 * change. See src/designConfig/<screen>.ts for where `base` comes from and
 * the kadabook-design-mode skill for the overall pattern.
 */
export function Designable({ screen, id, base, resizeKeys, offsetKey, scale, children }: DesignableProps) {
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
    <DesignableActive dm={dm} screen={screen} id={id} fullId={fullId} base={base} resizeKeys={resizeKeys} offsetKey={offsetKey} scale={scale ?? 1}>
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
  scale,
  children,
}: {
  dm: NonNullable<ReturnType<typeof useDesignMode>>;
  screen: string;
  id: string;
  fullId: string;
  base: NumMap;
  resizeKeys?: [string, string];
  offsetKey?: string;
  scale: number;
  children: (value: NumMap) => ReactNode;
}) {
  const value = dm.getValue(screen, id, base);
  const selected = dm.active && dm.selectedId === fullId;

  // Snapshot of `value` taken once per drag (in onStart), read from a ref so
  // onUpdate always computes deltas from a single fixed baseline instead of
  // the (reactive, changing-every-frame) `value` above.
  const dragStart = useRef(value);
  const setValue = dm.setValue;

  // Memoized so the SAME gesture instance survives re-renders triggered by
  // our own onUpdate -> setValue -> re-render loop. Recreating Gesture.Pan()
  // on every frame while a drag is in progress is what caused the erratic
  // "size keeps jumping/shrinking" behavior — GestureDetector re-attaching a
  // brand new gesture mid-drag loses track of the true start point.
  const resizePan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .onStart(() => {
          dragStart.current = value;
        })
        .onUpdate((e) => {
          if (!resizeKeys) return;
          const [wKey, hKey] = resizeKeys;
          setValue(screen, id, {
            ...dragStart.current,
            [wKey]: Math.max(16, Math.round((dragStart.current[wKey] ?? 0) + e.translationX / scale)),
            [hKey]: Math.max(16, Math.round((dragStart.current[hKey] ?? 0) + e.translationY / scale)),
          });
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [screen, id, scale, resizeKeys?.[0], resizeKeys?.[1], setValue],
  );

  const offsetPan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .onStart(() => {
          dragStart.current = value;
        })
        .onUpdate((e) => {
          if (!offsetKey) return;
          setValue(screen, id, {
            ...dragStart.current,
            [offsetKey]: Math.round((dragStart.current[offsetKey] ?? 0) + e.translationY / scale),
          });
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [screen, id, scale, offsetKey, setValue],
  );

  resizePan.enabled(selected && !!resizeKeys);
  offsetPan.enabled(selected && !!offsetKey);

  return (
    <View style={dm.active ? [styles.wrap, selected && styles.wrapSelected] : undefined}>
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
  // Siblings rendered after a Designable (e.g. the wordmark text under the
  // logo) paint on top of its absolutely-positioned handles otherwise —
  // z-index only resolves within a shared stacking context, and `wrap`
  // didn't establish one on its own. Only bump it while a handle is
  // actually showing, so normal (non-selected) layout is untouched.
  wrapSelected: { position: 'relative', zIndex: 50, elevation: 50 },
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
    zIndex: 10,
    elevation: 10,
    ...webDragFix,
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
    zIndex: 10,
    elevation: 10,
    ...webDragFix,
  },
  handleIcon: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
