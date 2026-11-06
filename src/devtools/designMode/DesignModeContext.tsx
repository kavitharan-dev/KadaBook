import { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { NativeModules, Platform } from 'react-native';

export type NumMap = Record<string, number>;

type Registry = Record<string, Record<string, NumMap>>;

export type DesignModeApi = {
  active: boolean;
  toggle: () => void;
  selectedId: string | null;
  select: (fullId: string | null, base?: NumMap) => void;
  selectedBase: NumMap | null;
  register: (screen: string, id: string, base: NumMap) => void;
  unregister: (screen: string, id: string) => void;
  getValue: (screen: string, id: string, base: NumMap) => NumMap;
  setValue: (screen: string, id: string, value: NumMap) => void;
  resetScreen: (screen: string) => void;
  saveScreen: (screen: string) => Promise<void>;
  saving: boolean;
  lastSaveError: string | null;
};

const Ctx = createContext<DesignModeApi | null>(null);

function getDevServerOrigin(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  // Native (Expo Go / dev client): derive the Metro server's host from the
  // bundle's own script URL. Avoids adding expo-constants just for this.
  const scriptURL: string | undefined = (NativeModules as any)?.SourceCode?.scriptURL;
  const match = scriptURL ? scriptURL.match(/^(https?:\/\/[^/]+)/) : null;
  return match ? match[1] : '';
}

export function DesignModeProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedBase, setSelectedBase] = useState<NumMap | null>(null);
  const [edits, setEdits] = useState<Record<string, Record<string, NumMap>>>({});
  const [saving, setSaving] = useState(false);
  const [lastSaveError, setLastSaveError] = useState<string | null>(null);
  const basesRef = useRef<Registry>({});

  const toggle = useCallback(() => {
    setActive((v) => !v);
    setSelectedId(null);
    setSelectedBase(null);
  }, []);

  const select = useCallback((fullId: string | null, base?: NumMap) => {
    setSelectedId(fullId);
    setSelectedBase(base ?? null);
  }, []);

  const register = useCallback((screen: string, id: string, base: NumMap) => {
    basesRef.current[screen] = basesRef.current[screen] || {};
    basesRef.current[screen][id] = base;
  }, []);

  const unregister = useCallback((screen: string, id: string) => {
    if (basesRef.current[screen]) delete basesRef.current[screen][id];
  }, []);

  const getValue = useCallback(
    (screen: string, id: string, base: NumMap) => ({ ...base, ...(edits[screen]?.[id] ?? {}) }),
    [edits],
  );

  const setValue = useCallback((screen: string, id: string, value: NumMap) => {
    setEdits((prev) => ({ ...prev, [screen]: { ...(prev[screen] ?? {}), [id]: value } }));
  }, []);

  const resetScreen = useCallback((screen: string) => {
    setEdits((prev) => {
      if (!prev[screen]) return prev;
      const next = { ...prev };
      delete next[screen];
      return next;
    });
  }, []);

  const saveScreen = useCallback(
    async (screen: string) => {
      setSaving(true);
      setLastSaveError(null);
      try {
        const bases = basesRef.current[screen] ?? {};
        const screenEdits = edits[screen] ?? {};
        const merged: Record<string, NumMap> = {};
        for (const id of Object.keys(bases)) {
          merged[id] = { ...bases[id], ...(screenEdits[id] ?? {}) };
        }
        const origin = getDevServerOrigin();
        const res = await fetch(`${origin}/__design/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ screen, values: merged }),
        });
        if (!res.ok) throw new Error(`Save failed (${res.status})`);
        resetScreen(screen);
        // The selected widget's snapshot is now stale (the config file has
        // moved on); deselect rather than show outdated values until Fast
        // Refresh catches up. Re-tapping the widget re-selects with fresh data.
        setSelectedId(null);
        setSelectedBase(null);
      } catch (err) {
        setLastSaveError(err instanceof Error ? err.message : String(err));
      } finally {
        setSaving(false);
      }
    },
    [edits, resetScreen],
  );

  const value = useMemo<DesignModeApi>(
    () => ({
      active,
      toggle,
      selectedId,
      select,
      selectedBase,
      register,
      unregister,
      getValue,
      setValue,
      resetScreen,
      saveScreen,
      saving,
      lastSaveError,
    }),
    [active, toggle, selectedId, select, selectedBase, register, unregister, getValue, setValue, resetScreen, saveScreen, saving, lastSaveError],
  );

  if (!__DEV__) return <>{children}</>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Returns null outside __DEV__ (or outside the provider) — callers must handle that. */
export function useDesignMode(): DesignModeApi | null {
  return useContext(Ctx);
}
