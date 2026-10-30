import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { getDb, getFirebaseAuth, isFirebaseConfigured } from '../lib/firebase';
import type { AdminProfile, AdminRole } from '../types/models';

type AuthState = {
  ready: boolean;
  user: User | null;
  admin: AdminProfile | null;
  denied: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  role: AdminRole | null;
};

const AuthContext = createContext<AuthState | null>(null);

async function loadAdmin(uid: string, email: string): Promise<AdminProfile | null> {
  const snap = await getDoc(doc(getDb(), 'admins', uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  if (data.active === false) return null;
  return {
    uid,
    email,
    name: String(data.name ?? email),
    role: data.role === 'staff' ? 'staff' : 'super_admin',
    active: data.active !== false,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!isFirebaseConfigured());
  const [user, setUser] = useState<User | null>(null);
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [denied, setDenied] = useState<string | null>(
    isFirebaseConfigured() ? null : 'Firebase is not configured. Add .env from .env.example.',
  );

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, async (next) => {
      if (!next) {
        setUser(null);
        setAdmin(null);
        setDenied(null);
        setReady(true);
        return;
      }
      try {
        const profile = await loadAdmin(next.uid, next.email ?? '');
        if (!profile) {
          await firebaseSignOut(auth);
          setUser(null);
          setAdmin(null);
          setDenied('Access denied. This account is not an admin.');
        } else {
          setUser(next);
          setAdmin(profile);
          setDenied(null);
        }
      } catch (err) {
        await firebaseSignOut(auth);
        setUser(null);
        setAdmin(null);
        setDenied(
          err instanceof Error && err.message.includes('permission')
            ? 'Missing or insufficient permissions. Deploy Firestore rules and try again.'
            : 'Could not verify admin access.',
        );
      } finally {
        setReady(true);
      }
    });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setDenied(null);
    const cred = await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
    const profile = await loadAdmin(cred.user.uid, cred.user.email ?? email);
    if (!profile) {
      await firebaseSignOut(getFirebaseAuth());
      throw new Error('Access denied. This account is not an admin.');
    }
    setUser(cred.user);
    setAdmin(profile);
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(getFirebaseAuth());
    setUser(null);
    setAdmin(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      user,
      admin,
      denied,
      signIn,
      signOut,
      role: admin?.role ?? null,
    }),
    [admin, denied, ready, signIn, signOut, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
