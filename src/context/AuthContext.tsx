import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authService, repository } from '../data/services';
import type { ShopUser } from '../data/types';
import type { SignUpInput } from '../data/signUpTypes';

type AuthContextValue = {
  user: ShopUser | null;
  ready: boolean;
  cloud: boolean;
  signIn: (identity: string, password: string) => Promise<void>;
  signUp: (identity: string, password: string, input: SignUpInput) => Promise<void>;
  resetPassword: (identity: string, nextPassword?: string) => Promise<string>;
  signOut: () => Promise<void>;
  updateShopName: (shopName: string) => Promise<void>;
  updateShopType: (shopType: 'retail' | 'kitchen') => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ShopUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};

    try {
      unsubscribe = authService.subscribe((next) => {
        if (cancelled) return;
        setUser(next);
        setReady(true);
      });
    } catch {
      setReady(true);
    }

    const timer = setTimeout(() => {
      if (!cancelled) setReady(true);
    }, 4000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    ready,
    cloud: authService.cloud,
    async signIn(identity, password) {
      setUser(await authService.signIn(identity, password));
    },
    async signUp(identity, password, input) {
      setUser(await authService.signUp(identity, password, input));
    },
    resetPassword(identity, nextPassword) {
      return authService.resetPassword(identity, nextPassword);
    },
    async signOut() {
      await authService.signOut();
      setUser(null);
    },
    async updateShopName(shopName) {
      if (!user) return;
      const name = shopName.trim();
      if (!name) throw new Error('Enter your shop name.');
      await repository.updateShopName(user.uid, name);
      setUser({ ...user, shopName: name });
    },
    async updateShopType(shopType) {
      if (!user) return;
      await repository.updateShopType(user.uid, shopType);
      setUser({ ...user, shopType });
    },
  }), [ready, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
