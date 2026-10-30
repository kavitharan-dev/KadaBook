import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import * as Updates from 'expo-updates';

/**
 * Checks EAS Update on launch and when the app returns to the foreground.
 * No-ops in dev and if updates are not embedded in the binary.
 */
export function useAppUpdate() {
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (__DEV__) return;
    let cancelled = false;

    async function run() {
      try {
        if (!Updates.isEnabled) return;
        const check = await Updates.checkForUpdateAsync();
        if (!check.isAvailable || cancelled) return;
        setUpdating(true);
        await Updates.fetchUpdateAsync();
        if (cancelled) return;
        await Updates.reloadAsync();
      } catch {
        if (!cancelled) setUpdating(false);
      }
    }

    void run();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void run();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  return { updating };
}
