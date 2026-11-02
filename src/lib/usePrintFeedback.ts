import { useCallback, useEffect, useRef, useState } from 'react';
import { Vibration } from 'react-native';
import type { PrintResult } from './printReceipt';

export type PrintPhase = 'idle' | 'printing' | 'done' | 'error';

/**
 * Gives a print button visible feedback: Printing... -> Printed / Retry, with a short vibration.
 * `run` returns the print result so the caller can still show its own error message.
 */
export function usePrintFeedback() {
  const [phase, setPhase] = useState<PrintPhase>('idle');
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const run = useCallback(async (task: () => Promise<PrintResult>): Promise<PrintResult | null> => {
    if (busy.current) return null;
    busy.current = true;
    if (timer.current) clearTimeout(timer.current);
    setPhase('printing');
    Vibration.vibrate(20);
    try {
      const result = await task();
      setPhase(result.ok ? 'done' : 'error');
      Vibration.vibrate(result.ok ? [0, 35, 70, 35] : [0, 160]);
      return result;
    } catch (error) {
      setPhase('error');
      Vibration.vibrate([0, 160]);
      return { ok: false, message: error instanceof Error ? error.message : 'Could not print.' };
    } finally {
      busy.current = false;
      timer.current = setTimeout(() => setPhase('idle'), 3000);
    }
  }, []);

  return { phase, run };
}
