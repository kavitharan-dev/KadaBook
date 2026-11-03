import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

/** Rolls a number from its previous value to `target` with an ease-out curve. */
export function useCountUp(target: number, { duration = 900, delay = 0 } = {}) {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(reduced ? target : 0);
  const current = useRef(reduced ? target : 0);

  useEffect(() => {
    if (reduced) {
      current.current = target;
      setValue(target);
      return;
    }
    const from = current.current;
    let frame = 0;
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      const p = Math.min(1, (now - start) / duration);
      const next = from + (target - from) * (1 - Math.pow(1 - p, 3));
      current.current = next;
      setValue(next);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    const id = setTimeout(() => {
      frame = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(id);
      cancelAnimationFrame(frame);
    };
  }, [target, duration, delay, reduced]);

  return value;
}
