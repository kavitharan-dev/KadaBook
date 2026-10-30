import { useEffect } from 'react';

/** If Reanimated does not finish (common on some web / low-end devices), snap to the final frame. */
export function useAnimationFinishFallback(active: boolean, afterMs: number, finish: () => void) {
  useEffect(() => {
    if (!active) return;
    const id = setTimeout(finish, afterMs);
    return () => clearTimeout(id);
  }, [active, afterMs, finish]);
}
