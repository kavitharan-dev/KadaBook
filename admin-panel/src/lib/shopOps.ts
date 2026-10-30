import {
  addDoc,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  writeBatch,
  type Timestamp,
} from 'firebase/firestore';
import { getDb } from './firebase';
import { writeAuditLog } from './audit';
import { daysFromNow } from './format';
import type { AppConfig, ShopStatus, Subscription } from '../types/models';
import { DEFAULT_APP_CONFIG } from '../types/models';
import type { AccessFeature, AccessMatrix } from './accessMatrix';
import { mergeAccessMatrix } from './accessMatrix';

function millis(v: unknown) {
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object' && 'toMillis' in v) return (v as Timestamp).toMillis();
  return Date.now();
}

export async function getAppConfig(): Promise<AppConfig> {
  const snap = await getDoc(doc(getDb(), 'appConfig', 'main'));
  if (!snap.exists()) return DEFAULT_APP_CONFIG;
  const d = snap.data();
  return {
    ...DEFAULT_APP_CONFIG,
    ...d,
    features: { ...DEFAULT_APP_CONFIG.features, ...(d.features as object) },
  } as AppConfig;
}

export async function approveShop(adminId: string, uid: string) {
  const cfg = await getAppConfig();
  const now = Date.now();
  const expiresAt = daysFromNow(cfg.trialDays);
  await updateDoc(doc(getDb(), 'users', uid), {
    status: 'trial',
    rejectReason: null,
  });
  await setDoc(doc(getDb(), 'subscriptions', uid), {
    plan: 'trial',
    startsAt: now,
    expiresAt,
    status: 'trial',
  });
  await writeAuditLog({
    adminId,
    action: 'approve_shop',
    targetUid: uid,
    details: `Trial ${cfg.trialDays} days`,
  });
}

export async function rejectShop(adminId: string, uid: string, reason: string) {
  await updateDoc(doc(getDb(), 'users', uid), {
    status: 'rejected',
    rejectReason: reason.trim(),
  });
  await writeAuditLog({ adminId, action: 'reject_shop', targetUid: uid, details: reason });
}

export async function setShopStatus(adminId: string, uid: string, status: ShopStatus, details?: string) {
  await updateDoc(doc(getDb(), 'users', uid), { status });
  await writeAuditLog({
    adminId,
    action: 'set_shop_status',
    targetUid: uid,
    details: `${status} ${details ?? ''}`.trim(),
  });
}

export async function extendSubscription(adminId: string, uid: string, extraDays: number, free = false) {
  const subSnap = await getDoc(doc(getDb(), 'subscriptions', uid));
  const now = Date.now();
  const sub = subSnap.exists() ? (subSnap.data() as Subscription) : ({} as Subscription);
  const base = Math.max(now, millis(sub.expiresAt) || now);
  const expiresAt = base + extraDays * 86400000;
  const status = expiresAt > now ? 'active' : 'expired';
  await setDoc(
    doc(getDb(), 'subscriptions', uid),
    {
      plan: sub.plan ?? 'manual',
      startsAt: millis(sub.startsAt) || now,
      expiresAt,
      status,
    },
    { merge: true },
  );
  await updateDoc(doc(getDb(), 'users', uid), { status: status === 'expired' ? 'expired' : 'active' });
  await writeAuditLog({
    adminId,
    action: free ? 'free_days' : 'extend_subscription',
    targetUid: uid,
    details: `+${extraDays} days`,
  });
}

export async function recordPayment(
  adminId: string,
  input: {
    uid: string;
    plan: string;
    amount: number;
    method: 'bank' | 'cash' | 'ezcash';
    reference?: string;
    planDays: number;
  },
) {
  await addDoc(collection(getDb(), 'payments'), {
    uid: input.uid,
    plan: input.plan,
    amount: Math.round(input.amount),
    method: input.method,
    reference: input.reference ?? '',
    paidAt: Date.now(),
    recordedBy: adminId,
  });
  await extendSubscription(adminId, input.uid, input.planDays, false);
  await writeAuditLog({
    adminId,
    action: 'record_payment',
    targetUid: input.uid,
    details: `${input.method} ${input.amount}`,
  });
}

export async function saveAppConfig(adminId: string, config: AppConfig) {
  await setDoc(doc(getDb(), 'appConfig', 'main'), config, { merge: true });
  await writeAuditLog({ adminId, action: 'update_app_config', details: JSON.stringify(config) });
}

export type StartMode = 'today' | 'extend';

export function computeSubscriptionExpiry(input: {
  startMode: StartMode;
  planDays: number;
  bonusDays: number;
  currentExpiresAt: number;
  now?: number;
}) {
  const now = input.now ?? Date.now();
  const startsAt = input.startMode === 'extend' ? Math.max(now, input.currentExpiresAt || now) : now;
  const expiresAt = startsAt + (input.planDays + input.bonusDays) * 86400000;
  return { startsAt, expiresAt };
}

export type AddSubscriptionInput = {
  uid: string;
  planId: string;
  planName: string;
  planDays: number;
  isTrialPlan: boolean;
  startMode: StartMode;
  bonusDays: number;
  method: 'bank' | 'cash' | 'ezcash';
  amount: number;
  reference?: string;
  note?: string;
};

export async function addSubscription(adminId: string, input: AddSubscriptionInput) {
  if (!input.uid) throw new Error('Shop is required');
  if (input.amount < 0) throw new Error('Amount must be ≥ 0');
  const db = getDb();
  const subRef = doc(db, 'subscriptions', input.uid);
  const subSnap = await getDoc(subRef);
  const currentExp = subSnap.exists() ? millis(subSnap.data().expiresAt) : 0;
  const now = Date.now();
  const { startsAt, expiresAt } = computeSubscriptionExpiry({
    startMode: input.startMode,
    planDays: input.planDays,
    bonusDays: input.bonusDays,
    currentExpiresAt: currentExp,
    now,
  });
  const subStatus = input.isTrialPlan ? 'trial' : 'active';
  const userStatus = input.isTrialPlan ? 'trial' : 'active';

  const batch = writeBatch(db);
  batch.set(
    subRef,
    {
      plan: input.planName,
      planId: input.planId,
      startsAt,
      expiresAt,
      status: subStatus,
    },
    { merge: true },
  );
  batch.update(doc(db, 'users', input.uid), { status: userStatus });

  if (!input.isTrialPlan) {
    const payRef = doc(collection(db, 'payments'));
    batch.set(payRef, {
      uid: input.uid,
      plan: input.planName,
      amount: Math.round(input.amount),
      method: input.method,
      reference: input.reference ?? '',
      note: input.note ?? '',
      paidAt: now,
      recordedBy: adminId,
    });
  }

  const auditRef = doc(collection(db, 'auditLogs'));
  batch.set(auditRef, {
    adminId,
    action: 'add_subscription',
    targetUid: input.uid,
    details: `${input.planName} until ${new Date(expiresAt).toISOString().slice(0, 10)}`,
    createdAt: now,
  });

  await batch.commit();
}

export async function saveAccessMatrix(adminId: string, matrix: AccessMatrix) {
  const merged = mergeAccessMatrix(matrix);
  await setDoc(doc(getDb(), 'appConfig', 'access'), { matrix: merged }, { merge: true });
  await writeAuditLog({ adminId, action: 'update_access_matrix', details: 'matrix saved' });
}

export async function setShopFeatureOverride(
  adminId: string,
  uid: string,
  feature: AccessFeature,
  allowed: boolean,
  reason: string,
) {
  await updateDoc(doc(getDb(), 'users', uid), {
    [`overrides.${feature}`]: allowed,
    overrideReason: reason.trim(),
  });
  await writeAuditLog({
    adminId,
    action: 'shop_feature_override',
    targetUid: uid,
    details: `${feature}=${allowed} ${reason}`,
  });
}
