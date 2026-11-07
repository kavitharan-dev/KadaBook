import { useCallback, useEffect, useState } from 'react';
import * as Updates from 'expo-updates';

export type UpdateCheckPhase = 'disabled' | 'idle' | 'checking' | 'available' | 'latest' | 'downloading' | 'ready' | 'error';

const updatesUsable = !__DEV__ && Updates.isEnabled;

/**
 * Manual "Check for update" flow for the Settings row — separate from useAppUpdate's silent
 * launch/foreground auto-check (that one just shows a small "Updating..." pill). This one
 * drives the Settings row's state (so it can say "Update available" without being tapped)
 * plus the UpdateModal's checking/downloading/ready states when the person taps it.
 */
export function useUpdateCheck() {
  const [phase, setPhase] = useState<UpdateCheckPhase>(updatesUsable ? 'idle' : 'disabled');
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Quiet background probe, just to populate the row's subtitle — failures here stay silent,
  // a real error only surfaces once the person actually taps to check.
  useEffect(() => {
    if (!updatesUsable) return;
    let cancelled = false;
    Updates.checkForUpdateAsync()
      .then((result) => {
        if (!cancelled) setPhase(result.isAvailable ? 'available' : 'latest');
      })
      .catch(() => {
        if (!cancelled) setPhase('latest');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openAndCheck = useCallback(async () => {
    if (!updatesUsable) {
      setModalOpen(true);
      return;
    }
    setModalOpen(true);
    setError(null);
    setPhase('checking');
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        setPhase('latest');
        return;
      }
      setPhase('downloading');
      await Updates.fetchUpdateAsync();
      setPhase('ready');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not check for updates.');
      setPhase('error');
    }
  }, []);

  const close = useCallback(() => setModalOpen(false), []);
  const restart = useCallback(() => Updates.reloadAsync(), []);

  return { phase, error, modalOpen, openAndCheck, close, restart };
}
