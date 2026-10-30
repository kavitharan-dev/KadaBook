import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { getDb } from '../lib/firebase';

export function useCollection<T>(path: string, map: (id: string, data: Record<string, unknown>) => T) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(
      collection(getDb(), path),
      (snap) => {
        setRows(snap.docs.map((d) => map(d.id, d.data() as Record<string, unknown>)));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    return unsub;
    // map is stable per page import
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  return { rows, loading, error };
}
