import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, onSnapshot, type Firestore } from 'firebase/firestore';

const CACHE_KEY = 'kb_remote_config_v1';

export type RemoteFeatureKey = 'sales' | 'expenses' | 'products' | 'reports' | 'export';

export type RemoteBanner = {
  imageUrl: string;
  link: string;
  enabled: boolean;
};

export type RemoteAnnouncement = {
  enabled: boolean;
  title: string;
  message: string;
  type: string;
};

export type RemoteFeatures = Record<RemoteFeatureKey, boolean>;

export type RemoteAppConfig = {
  minAppVersion: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  announcement: RemoteAnnouncement;
  banners: RemoteBanner[];
  features: RemoteFeatures;
  logoUrl: string;
};

export const DEFAULT_REMOTE_CONFIG: RemoteAppConfig = {
  minAppVersion: '0.0.0',
  maintenanceMode: false,
  maintenanceMessage: '',
  announcement: { enabled: false, title: '', message: '', type: 'info' },
  banners: [],
  features: {
    sales: true,
    expenses: true,
    products: true,
    reports: true,
    export: true,
  },
  logoUrl: '',
};

function asBool(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

export function parseRemoteConfig(raw: unknown): RemoteAppConfig {
  const data = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const announcementRaw =
    data.announcement && typeof data.announcement === 'object'
      ? (data.announcement as Record<string, unknown>)
      : {};
  const featuresRaw =
    data.features && typeof data.features === 'object' ? (data.features as Record<string, unknown>) : {};
  const banners = Array.isArray(data.banners)
    ? data.banners
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const row = item as Record<string, unknown>;
          return {
            imageUrl: asString(row.imageUrl),
            link: asString(row.link),
            enabled: asBool(row.enabled, false),
          };
        })
        .filter((item): item is RemoteBanner => item !== null && item.imageUrl.length > 0)
    : [];

  return {
    minAppVersion: asString(data.minAppVersion, DEFAULT_REMOTE_CONFIG.minAppVersion),
    maintenanceMode: asBool(data.maintenanceMode, false),
    maintenanceMessage: asString(data.maintenanceMessage),
    announcement: {
      enabled: asBool(announcementRaw.enabled, false),
      title: asString(announcementRaw.title),
      message: asString(announcementRaw.message),
      type: asString(announcementRaw.type, 'info'),
    },
    banners,
    features: {
      sales: asBool(featuresRaw.sales, true),
      expenses: asBool(featuresRaw.expenses, true),
      products: asBool(featuresRaw.products, true),
      reports: asBool(featuresRaw.reports, true),
      export: asBool(featuresRaw.export, true),
    },
    logoUrl: asString(data.logoUrl),
  };
}

export async function readCachedRemoteConfig(): Promise<RemoteAppConfig | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return parseRemoteConfig(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function writeCachedRemoteConfig(config: RemoteAppConfig) {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(config));
  } catch {
    /* offline cache is best-effort */
  }
}

export function listenRemoteConfig(db: Firestore, onConfig: (config: RemoteAppConfig) => void) {
  return onSnapshot(
    doc(db, 'config', 'app'),
    (snap) => {
      const next = parseRemoteConfig(snap.data());
      onConfig(next);
      void writeCachedRemoteConfig(next);
    },
    () => {
      /* keep the last cached config */
    },
  );
}
