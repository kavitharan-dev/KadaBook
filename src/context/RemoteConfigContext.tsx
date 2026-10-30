import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isFirebaseConfigured, getFirestoreDb } from '../firebase/client';
import {
  DEFAULT_REMOTE_CONFIG,
  listenRemoteConfig,
  readCachedRemoteConfig,
  type RemoteAppConfig,
  type RemoteFeatureKey,
} from '../services/remoteConfig';

type RemoteConfigValue = {
  config: RemoteAppConfig;
  ready: boolean;
};

const RemoteConfigContext = createContext<RemoteConfigValue>({
  config: DEFAULT_REMOTE_CONFIG,
  ready: false,
});

export function RemoteConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<RemoteAppConfig>(DEFAULT_REMOTE_CONFIG);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let unsub = () => {};
    let cancelled = false;
    (async () => {
      const cached = await readCachedRemoteConfig();
      if (!cancelled && cached) setConfig(cached);
      if (!isFirebaseConfigured()) {
        if (!cancelled) setReady(true);
        return;
      }
      if (cancelled) return;
      unsub = listenRemoteConfig(getFirestoreDb(), (next) => {
        setConfig(next);
        setReady(true);
      });
      setReady(true);
    })();
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const value = useMemo(() => ({ config, ready }), [config, ready]);
  return <RemoteConfigContext.Provider value={value}>{children}</RemoteConfigContext.Provider>;
}

export function useRemoteConfig() {
  return useContext(RemoteConfigContext);
}

/** Missing feature flags stay enabled so a partial config document cannot turn the app off. */
export function useFeature(feature: RemoteFeatureKey) {
  const { config } = useRemoteConfig();
  return config.features[feature] !== false;
}
