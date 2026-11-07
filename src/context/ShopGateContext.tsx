import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, doc, increment, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { usingCloud } from '../data/services';
import { getFirestoreDb, waitForFirebaseAuth } from '../firebase/client';
import { canAccessFeature, mergeAccessMatrix } from '../lib/accessControl';
import type {
  AccessFeature,
  AccessMatrix,
  AnnouncementDoc,
  AppConfigMain,
  ShopProfile,
  ShopStatus,
  SubscriptionDoc,
} from '../lib/shopAccessTypes';
import {
  audienceMatches,
  compareAppVersion,
  DEFAULT_APP_CONFIG,
  effectiveStatus,
  graceDaysLeft,
  millis,
  trialDaysLeft,
} from '../lib/statusEngine';
import { APP_VERSION } from '../config/build';

const SEEN_KEY = 'kb_ann_seen';

export type GateMode =
  | 'loading'
  | 'maintenance'
  | 'update_required'
  | 'pending'
  | 'rejected'
  | 'suspended'
  | 'app';

type ShopGateValue = {
  gate: GateMode;
  profile: ShopProfile | null;
  subscription: SubscriptionDoc | null;
  status: ShopStatus;
  appConfig: AppConfigMain;
  accessMatrix: AccessMatrix;
  trialDays: number;
  graceDaysLeft: number;
  renewWhatsApp: string;
  banner: AnnouncementDoc | null;
  popup: AnnouncementDoc | null;
  canAccess: (feature: AccessFeature) => boolean;
  openRenewWhatsApp: (message?: unknown) => void;
  dismissAnnouncement: (id: string, kind: 'banner' | 'popup') => Promise<void>;
  markAnnouncementView: (id: string) => void;
};

const ShopGateContext = createContext<ShopGateValue | null>(null);

function mapProfile(data: Record<string, unknown> | undefined): ShopProfile {
  return {
    shopName: String(data?.shopName ?? 'Shop'),
    ownerName: data?.ownerName ? String(data.ownerName) : undefined,
    phone: data?.phone ? String(data.phone) : null,
    email: data?.email ? String(data.email) : undefined,
    district: data?.district ? String(data.district) : undefined,
    gstin: data?.gstin ? String(data.gstin) : undefined,
    shopType: data?.shopType === 'retail' || data?.shopType === 'kitchen' ? data.shopType : undefined,
    status: typeof data?.status === 'string' ? (data.status as ShopStatus) : 'active',
    rejectReason: data?.rejectReason ? String(data.rejectReason) : undefined,
    overrides: data?.overrides as ShopProfile['overrides'],
    overrideReason: data?.overrideReason ? String(data.overrideReason) : undefined,
    tierOverride:
      data?.tierOverride === 'basic' || data?.tierOverride === 'pro' || data?.tierOverride === 'premium'
        ? data.tierOverride
        : undefined,
  };
}

export function ShopGateProvider({ children }: { children: ReactNode }) {
  const { user, cloud } = useAuth();
  const [profile, setProfile] = useState<ShopProfile | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionDoc | null>(null);
  const [appConfig, setAppConfig] = useState<AppConfigMain>(DEFAULT_APP_CONFIG);
  const [accessMatrix, setAccessMatrix] = useState<AccessMatrix>(mergeAccessMatrix(undefined));
  const [announcements, setAnnouncements] = useState<AnnouncementDoc[]>([]);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(!usingCloud);

  useEffect(() => {
    AsyncStorage.getItem(SEEN_KEY).then((raw) => {
      if (raw) {
        try {
          setSeenIds(new Set(JSON.parse(raw) as string[]));
        } catch {
          /* ignore */
        }
      }
    });
  }, []);

  useEffect(() => {
    if (!usingCloud || !cloud || !user) {
      setReady(true);
      return;
    }
    setReady(false);
    let cancelled = false;
    const unsubs: Array<() => void> = [];

    (async () => {
      try {
        await waitForFirebaseAuth();
      } catch {
        /* ignore */
      }
      if (cancelled) return;

      const db = getFirestoreDb();
      unsubs.push(
        onSnapshot(
          doc(db, 'users', user.uid),
          (snap) => {
            setProfile(mapProfile(snap.data()));
            setReady(true);
          },
          () => setReady(true),
        ),
      );
      unsubs.push(
        onSnapshot(doc(db, 'subscriptions', user.uid), (snap) => {
          if (!snap.exists()) {
            setSubscription(null);
            return;
          }
          const d = snap.data();
          setSubscription({
            plan: String(d.plan ?? 'trial'),
            planId: d.planId ? String(d.planId) : undefined,
            planName: d.planName ? String(d.planName) : undefined,
            tier: d.tier === 'basic' || d.tier === 'pro' || d.tier === 'premium' ? d.tier : undefined,
            startsAt: millis(d.startsAt),
            expiresAt: millis(d.expiresAt),
            status: (d.status as SubscriptionDoc['status']) ?? 'trial',
            featuresConfigured: d.featuresConfigured === true,
            enabledFeatures: Array.isArray(d.enabledFeatures)
              ? d.enabledFeatures.filter((x: unknown) => typeof x === 'string')
              : undefined,
            planPrice: typeof d.planPrice === 'number' ? d.planPrice : undefined,
            featureAmounts:
              d.featureAmounts && typeof d.featureAmounts === 'object'
                ? (d.featureAmounts as Record<string, number>)
                : undefined,
            monthlyTotal: typeof d.monthlyTotal === 'number' ? d.monthlyTotal : undefined,
            staffSeats: typeof d.staffSeats === 'number' ? d.staffSeats : undefined,
            branchLimit: typeof d.branchLimit === 'number' ? d.branchLimit : undefined,
          });
        }),
      );
      unsubs.push(
        onSnapshot(doc(db, 'appConfig', 'main'), (snap) => {
          if (!snap.exists()) return;
          const d = snap.data();
          setAppConfig({
            ...DEFAULT_APP_CONFIG,
            ...d,
            features: { ...DEFAULT_APP_CONFIG.features, ...(d.features as object) },
          } as AppConfigMain);
        }),
      );
      unsubs.push(
        onSnapshot(doc(db, 'appConfig', 'access'), (snap) => {
          const matrix = snap.data()?.matrix as Partial<AccessMatrix> | undefined;
          setAccessMatrix(mergeAccessMatrix(matrix));
        }),
      );
      unsubs.push(
        onSnapshot(collection(db, 'users', user.uid, 'seen'), (snap) => {
          setSeenIds((prev) => {
            const next = new Set(prev);
            snap.docs.forEach((d) => next.add(d.id));
            return next;
          });
        }),
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'announcements'), where('active', '==', true)),
          (snap) => {
            const rows: AnnouncementDoc[] = snap.docs.map((d) => {
              const data = d.data();
              return {
                id: d.id,
                titleEn: String(data.titleEn ?? data.title ?? ''),
                titleTa: String(data.titleTa ?? data.title ?? ''),
                messageEn: String(data.messageEn ?? data.message ?? ''),
                messageTa: String(data.messageTa ?? data.message ?? ''),
                type: data.type === 'popup' ? 'popup' : 'banner',
                audience: (data.audience as AnnouncementDoc['audience']) ?? 'all',
                active: Boolean(data.active),
                startAt: millis(data.startAt),
                endAt: data.endAt ? millis(data.endAt) : undefined,
                showOnce: Boolean(data.showOnce),
                dismissible: data.dismissible !== false,
                priority: Number(data.priority) || 0,
                viewCount: Number(data.viewCount) || 0,
                dismissCount: Number(data.dismissCount) || 0,
              };
            });
            setAnnouncements(rows);
          },
          () => setAnnouncements([]),
        ),
      );
    })();

    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
    };
  }, [cloud, user]);

  const status = useMemo(() => {
    if (!usingCloud || !cloud) return 'active' as ShopStatus;
    return effectiveStatus(profile ?? { status: 'pending' }, subscription, appConfig.graceDays);
  }, [profile, subscription, appConfig.graceDays, cloud]);

  const gate: GateMode = useMemo(() => {
    if (!usingCloud || !cloud) return 'app';
    if (!ready || !profile) return 'loading';
    if (appConfig.maintenance) return 'maintenance';
    if (compareAppVersion(APP_VERSION, appConfig.minVersion) < 0) return 'update_required';
    if (status === 'pending') return 'pending';
    if (status === 'rejected') return 'rejected';
    if (status === 'suspended') return 'suspended';
    return 'app';
  }, [ready, profile, appConfig, status, cloud]);

  const now = Date.now();
  const liveAnnouncements = useMemo(() => {
    return announcements
      .filter((a) => a.active && a.startAt <= now && (!a.endAt || a.endAt >= now))
      .filter((a) => audienceMatches(a.audience, status, subscription, appConfig.graceDays, now))
      .filter((a) => !a.showOnce || !seenIds.has(a.id))
      .sort((a, b) => b.priority - a.priority);
  }, [announcements, status, subscription, appConfig.graceDays, seenIds, now]);

  const banner = liveAnnouncements.find((a) => a.type === 'banner') ?? null;
  const popup = liveAnnouncements.find((a) => a.type === 'popup') ?? null;

  const canAccess = useCallback(
    (feature: AccessFeature) => {
      if (!usingCloud || !cloud) return true;
      if (gate !== 'app' && feature !== 'editProfile') return false;
      return canAccessFeature(feature, status, accessMatrix, profile?.overrides);
    },
    [gate, status, accessMatrix, profile?.overrides, cloud],
  );

const openRenewWhatsApp = useCallback((message?: unknown) => {
  const phone = appConfig.renewWhatsApp.replace(/\D/g, '');
  if (!phone) return;
  const query = typeof message === 'string' && message ? `?text=${encodeURIComponent(message)}` : '';
  Linking.openURL(`https://wa.me/${phone}${query}`);
}, [appConfig.renewWhatsApp]);

  const dismissAnnouncement = useCallback(
    async (id: string, _kind: 'banner' | 'popup') => {
      const next = new Set(seenIds);
      next.add(id);
      setSeenIds(next);
      await AsyncStorage.setItem(SEEN_KEY, JSON.stringify([...next]));
      if (user && cloud) {
        const db = getFirestoreDb();
        await setDoc(doc(db, 'users', user.uid, 'seen', id), { dismissedAt: Date.now() });
        try {
          await updateDoc(doc(db, 'announcements', id), { dismissCount: increment(1) });
        } catch {
          /* non-critical */
        }
      }
    },
    [seenIds, user, cloud],
  );

  const markAnnouncementView = useCallback(
    (id: string) => {
      if (!user || !cloud || !usingCloud) return;
      const db = getFirestoreDb();
      updateDoc(doc(db, 'announcements', id), { viewCount: increment(1) }).catch(() => {});
    },
    [user, cloud],
  );

  const value = useMemo<ShopGateValue>(
    () => ({
      gate,
      profile,
      subscription,
      status,
      appConfig,
      accessMatrix,
      trialDays: trialDaysLeft(subscription),
      graceDaysLeft: graceDaysLeft(subscription, appConfig.graceDays),
      renewWhatsApp: appConfig.renewWhatsApp,
      banner,
      popup,
      canAccess,
      openRenewWhatsApp,
      dismissAnnouncement,
      markAnnouncementView,
    }),
    [
      gate,
      profile,
      subscription,
      status,
      appConfig,
      accessMatrix,
      banner,
      popup,
      canAccess,
      openRenewWhatsApp,
      dismissAnnouncement,
      markAnnouncementView,
    ],
  );

  return <ShopGateContext.Provider value={value}>{children}</ShopGateContext.Provider>;
}

export function useShopGate() {
  const ctx = useContext(ShopGateContext);
  if (!ctx) throw new Error('useShopGate outside ShopGateProvider');
  return ctx;
}

export function useAccess(feature: AccessFeature) {
  const { canAccess } = useShopGate();
  return canAccess(feature);
}
