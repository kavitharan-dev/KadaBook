import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  inMemoryPersistence,
  initializeAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut as firebaseSignOut,
  type Auth,
  type Persistence,
} from 'firebase/auth';
import * as FirebaseAuthModule from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  initializeFirestore,
  onSnapshot,
  orderBy,
  persistentLocalCache,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { accountIdentity, assertPassword, isPhoneAuthEmail, type AuthService, type Repository } from '../data/repository';
import type { SignUpInput } from '../data/signUpTypes';
import type { Books, BranchDay, Expense, PermissionOverrides, Product, Sale, SaleLine, SaleReturn, SavedOrder, ShopUser, StaffMember, StaffRole } from '../data/types';
import { type PaymentMode, type SaleDiscount, type SaleExtras } from '../data/saleExtras';
import { normalizeBooks } from '../lib/booksNormalize';
import { branchDayId, dayKey as dayKeyOf } from '../lib/dayKey';
import { fifoSettledIds } from '../lib/shopPlus';
import { expenseCategoriesForShop, normalizeCustomExpenseCategory } from '../lib/expenseCategories';
import {
  assertBillItems,
  assertStock,
  billTotal,
  buildBillSale,
  buildQuickSale,
  chargedAmount,
  draftFields,
} from '../lib/saleOps';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export function isFirebaseConfigured() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
}

/** Wait until Auth has restored the session (avoids permission-denied on first Firestore listen). */
export async function waitForFirebaseAuth() {
  if (!isFirebaseConfigured()) return;
  await firebaseAuth().authStateReady();
}

export function firebaseProjectId() {
  return firebaseConfig.projectId ?? '';
}

/** Shared Firestore instance for gate/access listeners. */
export function getFirestoreDb() {
  return firestore();
}

/** For Cloud Functions calls (AI assistant, voice billing). */
export function getFirebaseApp() {
  return firebaseApp();
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

function firebaseApp() {
  if (!isFirebaseConfigured()) {
    throw new Error('Add your Firebase keys in a .env file, then restart Expo.');
  }
  if (!app) app = initializeApp(firebaseConfig);
  return app;
}

function firebaseAuth() {
  if (auth) return auth;
  const instance = firebaseApp();
  if (Platform.OS === 'web') {
    auth = getAuth(instance);
    return auth;
  }
  try {
    const persistence = (
      FirebaseAuthModule as typeof FirebaseAuthModule & {
        getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
      }
    ).getReactNativePersistence(AsyncStorage);
    auth = initializeAuth(instance, { persistence });
  } catch {
    auth = getAuth(instance);
  }
  return auth;
}

function firestore() {
  if (db) return db;
  const instance = firebaseApp();
  try {
    db = initializeFirestore(instance, { localCache: persistentLocalCache() });
  } catch {
    db = getFirestore(instance);
  }
  return db;
}

function millis(value: unknown) {
  if (value && typeof value === 'object' && 'toMillis' in value) {
    return (value as Timestamp).toMillis();
  }
  return Date.now();
}

function friendlyAuthError(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  if (code === 'auth/configuration-not-found') {
    return new Error(
      'Firebase login is not set up yet. In console.firebase.com → KadaBook → Build → Authentication: click Get started, then Sign-in method → enable Email/Password → Save.',
    );
  }
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
    return new Error('Email or password is incorrect.');
  }
  if (code === 'auth/user-not-found') {
    return new Error('No account with that email. Use the same email you used when you signed up.');
  }
  if (code === 'auth/email-already-in-use') {
    return new Error('An account with that email or phone already exists.');
  }
  if (code === 'auth/weak-password') {
    return new Error('Use a password of at least 6 characters.');
  }
  if (code === 'auth/invalid-email') {
    return new Error('Enter a valid email or phone number.');
  }
  if (code === 'auth/too-many-requests') {
    return new Error('Too many attempts. Wait a moment and try again.');
  }
  if (code === 'auth/network-request-failed') {
    return new Error('No internet connection. Check the network and try again.');
  }
  if (error instanceof Error && error.message) return error;
  return new Error('Something went wrong. Try again.');
}

async function readProfile(uid: string, fallbackEmail: string): Promise<ShopUser> {
  const snap = await getDoc(doc(firestore(), 'users', uid));
  const data = snap.data();
  return {
    uid,
    email: typeof data?.email === 'string' ? data.email : fallbackEmail,
    shopName: typeof data?.shopName === 'string' && data.shopName ? data.shopName : 'My Shop',
    phone: typeof data?.phone === 'string' ? data.phone : null,
    shopType: data?.shopType === 'retail' || data?.shopType === 'kitchen' ? data.shopType : undefined,
  };
}

type StaffLink = {
  shopUid: string;
  role: Exclude<StaffRole, 'owner'>;
  name: string;
  active: boolean;
  branchId?: string;
  permissions?: PermissionOverrides;
};

function readPermissions(raw: unknown): PermissionOverrides | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const rows = Object.entries(raw as Record<string, unknown>).filter(
    (row): row is [string, boolean] => typeof row[1] === 'boolean',
  );
  return rows.length ? Object.fromEntries(rows) : undefined;
}

function readBranchId(raw: unknown) {
  return typeof raw === 'string' && raw ? raw : undefined;
}

function staffLinkFrom(shopUid: string, data: Record<string, unknown>): StaffLink {
  return {
    shopUid,
    role: data.role === 'manager' ? 'manager' : 'cashier',
    name: typeof data.name === 'string' ? data.name : 'Staff',
    active: data.active === true,
    branchId: readBranchId(data.branchId),
    permissions: readPermissions(data.permissions),
  };
}

/** If this account is a staff login, the shop it belongs to and its role. */
async function readStaffLink(authUid: string): Promise<StaffLink | null> {
  const index = await getDoc(doc(firestore(), 'staffIndex', authUid));
  const shopUid = index.data()?.shopUid;
  if (typeof shopUid !== 'string' || !shopUid) return null;
  const member = await getDoc(doc(firestore(), 'users', shopUid, 'members', authUid));
  const data = member.data();
  if (!data) return null;
  return staffLinkFrom(shopUid, data);
}

function staffFields(authUid: string, link: StaffLink) {
  return {
    role: link.role,
    authUid,
    staffName: link.name,
    ...(link.branchId ? { branchId: link.branchId } : {}),
    ...(link.permissions ? { permissions: link.permissions } : {}),
  };
}

async function staffProfile(authUid: string, email: string, link: StaffLink): Promise<ShopUser> {
  const shop = await readProfile(link.shopUid, email);
  return { ...shop, email, ...staffFields(authUid, link) };
}

const STAFF_OFF = 'Your staff login is switched off. Ask the shop owner to turn it back on.';

export const cloudAuth: AuthService = {
  cloud: true,
  subscribe(onUser) {
    let stopMember = () => {};
    const stopAuth = onAuthStateChanged(firebaseAuth(), async (user) => {
      stopMember();
      stopMember = () => {};
      if (!user) {
        onUser(null);
        return;
      }
      // Staff must never be shown as the owner of an empty shop, so check this first.
      try {
        const link = await readStaffLink(user.uid);
        if (link) {
          if (!link.active) {
            await firebaseSignOut(firebaseAuth());
            onUser(null);
            return;
          }
          let profile: ShopUser;
          try {
            profile = await staffProfile(user.uid, user.email ?? '', link);
          } catch {
            // Shop profile may be briefly unreadable; still bind to the shop, never to a blank owner account.
            profile = {
              uid: link.shopUid,
              email: user.email ?? '',
              shopName: 'My Shop',
              phone: null,
              ...staffFields(user.uid, link),
            };
          }
          if (firebaseAuth().currentUser?.uid !== user.uid) return;
          onUser(profile);
          // The owner's changes to role, branch or ticks apply at once, not at the next sign-in.
          let current = JSON.stringify(link);
          stopMember = onSnapshot(
            doc(firestore(), 'users', link.shopUid, 'members', user.uid),
            (snap) => {
              const data = snap.data();
              if (!data) return;
              const next = staffLinkFrom(link.shopUid, data);
              if (!next.active) {
                void firebaseSignOut(firebaseAuth());
                return;
              }
              const nextKey = JSON.stringify(next);
              if (nextKey === current) return;
              current = nextKey;
              const { branchId: _branch, permissions: _permissions, ...shop } = profile;
              profile = { ...shop, ...staffFields(user.uid, next) };
              onUser(profile);
            },
            () => undefined,
          );
          return;
        }
      } catch {
        // staffIndex unavailable (offline): fall through to owner profile for real owners only.
      }
      onUser({
        uid: user.uid,
        email: user.email ?? '',
        shopName: 'My Shop',
        phone: null,
      });
      readProfile(user.uid, user.email ?? '')
        .then(onUser)
        .catch(() =>
          onUser({
            uid: user.uid,
            email: user.email ?? '',
            shopName: 'My Shop',
            phone: null,
          }),
        );
    });
    return () => {
      stopMember();
      stopAuth();
    };
  },
  async signIn(identity, password) {
    assertPassword(password);
    const { email } = accountIdentity(identity);
    try {
      const cred = await signInWithEmailAndPassword(firebaseAuth(), email, password);
      const link = await readStaffLink(cred.user.uid).catch(() => null);
      if (link) {
        if (!link.active) {
          await firebaseSignOut(firebaseAuth());
          throw new Error(STAFF_OFF);
        }
        try {
          return await staffProfile(cred.user.uid, email, link);
        } catch {
          return {
            uid: link.shopUid,
            email,
            shopName: 'My Shop',
            phone: null,
            ...staffFields(cred.user.uid, link),
          };
        }
      }
      const profile = await readProfile(cred.user.uid, email);
      await setDoc(
        doc(firestore(), 'users', cred.user.uid),
        {
          email: profile.email,
          phone: profile.phone,
          shopName: profile.shopName,
        },
        { merge: true },
      );
      return profile;
    } catch (error) {
      throw friendlyAuthError(error);
    }
  },
  async signUp(identity, password, input) {
    assertPassword(password);
    const name = input.shopName.trim();
    if (!name) throw new Error('Enter your shop name.');
    if (!input.ownerName.trim()) throw new Error('Enter owner name.');
    if (!input.district.trim()) throw new Error('Enter district.');
    const { email, phone } = accountIdentity(identity);
    try {
      const cred = await createUserWithEmailAndPassword(firebaseAuth(), email, password);
      const shopType = input.shopType === 'retail' ? 'retail' : 'kitchen';
      const user: ShopUser = {
        uid: cred.user.uid,
        email,
        phone: input.phone.trim() || phone,
        shopName: name,
        shopType,
      };
      await setDoc(doc(firestore(), 'users', user.uid), {
        email,
        phone: input.phone.trim() || phone,
        shopName: name,
        ownerName: input.ownerName.trim(),
        district: input.district.trim(),
        shopType,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      if (!phone) {
        try {
          await sendEmailVerification(cred.user);
        } catch {
          // Optional; login does not require verified email
        }
      }
      return user;
    } catch (error) {
      throw friendlyAuthError(error);
    }
  },
  async resetPassword(identity) {
    const { email, phone } = accountIdentity(identity);
    if (phone || isPhoneAuthEmail(email)) {
      throw new Error(
        'Phone login has no real email inbox, so reset links cannot arrive. Use your phone number and old password to sign in, or create a new account with a real Gmail/email address.',
      );
    }
    try {
      await sendPasswordResetEmail(firebaseAuth(), email);
    } catch (error) {
      throw friendlyAuthError(error);
    }
    return 'If this email is registered, check your inbox and spam folder for the reset link from Firebase.';
  },
  async signOut() {
    await firebaseSignOut(firebaseAuth());
  },
};

function firestoreErrorMessage(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes('index')) {
    return 'Firestore needs an index. Check Metro/console for a link to create it in Firebase Console.';
  }
  if (lower.includes('permission') || lower.includes('insufficient')) {
    const pid = firebaseConfig.projectId || 'unknown';
    return `Firestore permission denied (project ${pid}). Force-close the app, reopen, run: npm run deploy:rules. Check .env matches Firebase.`;
  }
  if (lower.includes('no document to update') || lower.includes('not-found')) {
    return 'Shop profile was missing in Firebase. Try saving again — if it repeats, sign out and create account again.';
  }
  return message;
}

function watchCollection<T>(
  uid: string,
  name: string,
  map: (id: string, data: Record<string, unknown>) => T,
  onRows: (rows: T[]) => void,
  onError?: (message: string) => void,
) {
  const rowsQuery = query(collection(firestore(), 'users', uid, name), orderBy('createdAt', 'desc'));
  return onSnapshot(
    rowsQuery,
    (snap) => {
      onRows(snap.docs.map((item) => map(item.id, item.data() as Record<string, unknown>)));
    },
    (error) => onError?.(firestoreErrorMessage(error.message || 'Could not read the shop book.')),
  );
}

function readDiscount(raw: unknown): SaleDiscount | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const row = raw as Record<string, unknown>;
  const type = row.type === 'percent' ? 'percent' : row.type === 'amount' ? 'amount' : undefined;
  const value = Number(row.value);
  const amount = Number(row.amount);
  if (!type || !Number.isFinite(amount) || amount <= 0) return undefined;
  return { type, value: Number.isFinite(value) ? value : amount, amount };
}

function readPayment(raw: unknown): PaymentMode | undefined {
  return raw === 'cash' || raw === 'card' || raw === 'credit' ? raw : undefined;
}

function readSaleExtras(data: Record<string, unknown>): SaleExtras {
  const extras: SaleExtras = {};
  const paymentMode = readPayment(data.paymentMode);
  const discount = readDiscount(data.discount);
  if (paymentMode) extras.paymentMode = paymentMode;
  if (discount) extras.discount = discount;
  if (Number(data.subtotal) > 0) extras.subtotal = Number(data.subtotal);
  if (typeof data.customerName === 'string' && data.customerName) extras.customerName = data.customerName;
  if (typeof data.customerPhone === 'string' && data.customerPhone) extras.customerPhone = data.customerPhone;
  if (typeof data.customerId === 'string' && data.customerId) extras.customerId = data.customerId;
  if (typeof data.note === 'string' && data.note) extras.note = data.note;
  if (Number(data.paidAmount) > 0) extras.paidAmount = Number(data.paidAmount);
  if (data.editedAt != null) extras.editedAt = millis(data.editedAt);
  if (typeof data.branchId === 'string' && data.branchId) extras.branchId = data.branchId;
  if (typeof data.soldByUid === 'string' && data.soldByUid) extras.soldByUid = data.soldByUid;
  if (typeof data.soldByName === 'string' && data.soldByName) extras.soldByName = data.soldByName;
  return extras;
}

function stamp(createdAt?: number) {
  return createdAt ? Timestamp.fromMillis(createdAt) : serverTimestamp();
}

function defined(row: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined));
}

function mapSale(id: string, data: Record<string, unknown>): Sale {
  const items = Array.isArray(data.items)
    ? (data.items as SaleLine[]).map((line) => ({
        productId: line.productId,
        name: line.name,
        qty: Number(line.qty) || 0,
        unitPrice: Number(line.unitPrice) || 0,
        lineTotal: Number(line.lineTotal) || 0,
        unitCost:
          line.unitCost != null && Number.isFinite(Number(line.unitCost))
            ? Math.round(Number(line.unitCost))
            : undefined,
      }))
    : undefined;
  return {
    id,
    amount: Number(data.amount) || 0,
    createdAt: millis(data.createdAt),
    invoiceNo: data.invoiceNo != null ? Number(data.invoiceNo) : undefined,
    kind: data.kind === 'bill' || data.kind === 'quick' ? data.kind : undefined,
    items,
    settled: data.settled !== false,
    ...readSaleExtras(data),
  };
}

function mapProduct(id: string, data: Record<string, unknown>): Product {
  const sellingPrice = Number(data.sellingPrice ?? data.price) || 0;
  return {
    id,
    name: typeof data.name === 'string' ? data.name : 'Product',
    sellingPrice,
    purchasePrice: Number(data.purchasePrice) || 0,
    stock: Number(data.stock) || 0,
    unit: typeof data.unit === 'string' ? data.unit : 'pcs',
    category: typeof data.category === 'string' ? data.category : 'General',
    barcode: typeof data.barcode === 'string' ? data.barcode : undefined,
    reorderLevel: data.reorderLevel != null ? Number(data.reorderLevel) : undefined,
    batchNo: typeof data.batchNo === 'string' ? data.batchNo : undefined,
    expiry: typeof data.expiry === 'string' ? data.expiry : undefined,
    sellKind: data.sellKind === 'menu' ? 'menu' : data.sellKind === 'simple' ? 'simple' : undefined,
    createdAt: millis(data.createdAt),
  };
}

async function allocateInvoice(uid: string) {
  const ref = doc(firestore(), 'users', uid);
  const snap = await getDoc(ref);
  const current = Number(snap.data()?.nextInvoice) || 1;
  await setDoc(ref, { nextInvoice: current + 1 }, { merge: true });
  return current;
}

async function applyStockUpdates(uid: string, items: SaleLine[], products: Product[]) {
  assertStock(
    normalizeBooks({ products, sales: [], expenses: [], savedOrders: [], meta: { nextInvoice: 1 } }),
    items,
  );
  for (const line of items) {
    if (!line.productId) continue;
    const product = products.find((p) => p.id === line.productId);
    if (!product || product.stock <= 0) continue;
    await updateDoc(doc(firestore(), 'users', uid, 'products', line.productId), {
      stock: Math.max(0, product.stock - line.qty),
    });
  }
}

export const cloudRepository: Repository = {
  watchBooks(uid, onData, onError) {
    let sales: Sale[] = [];
    let expenses: Expense[] = [];
    let products: Product[] = [];
    let savedOrders: SavedOrder[] = [];
    let customers: Books['customers'] = [];
    let creditPayments: Books['creditPayments'] = [];
    let suppliers: Books['suppliers'] = [];
    let staff: Books['staff'] = [];
    let returns: Books['returns'] = [];
    let audit: Books['audit'] = [];
    let nextInvoice = 1;
    let openingBalances: Record<string, number> = {};
    let closedDays: Record<string, number> = {};
    let branchDays: Record<string, BranchDay> = {};
    let quickSaleProfitPercent: number | undefined;
    let customExpenseCategories: string[] = [];

    const push = () =>
      onData(
        normalizeBooks({
          sales,
          expenses,
          products,
          savedOrders,
          customers,
          creditPayments,
          suppliers,
          staff,
          returns,
          audit,
          meta: { nextInvoice, openingBalances, closedDays, branchDays, quickSaleProfitPercent, customExpenseCategories },
        }),
      );

    push();

    const fail = (message: string) => {
      onError?.(firestoreErrorMessage(message));
      push();
    };

    const unsubProfile = onSnapshot(
      doc(firestore(), 'users', uid),
      (snap) => {
        nextInvoice = Number(snap.data()?.nextInvoice) || 1;
        const raw = snap.data()?.openingBalances;
        // Older saves wrote a literal top-level "openingBalances.YYYY-MM-DD" field; nested values win.
        const legacyOpening = Object.entries(snap.data() ?? {})
          .filter(([k]) => k.startsWith('openingBalances.'))
          .map(([k, v]) => [k.slice('openingBalances.'.length), v] as const);
        const nestedOpening =
          raw && typeof raw === 'object' && !Array.isArray(raw) ? Object.entries(raw as Record<string, unknown>) : [];
        openingBalances = Object.fromEntries(
          [...legacyOpening, ...nestedOpening].map(([k, v]) => [k, Math.round(Number(v) || 0)]),
        );
        const rawClosed = snap.data()?.closedDays;
        if (rawClosed && typeof rawClosed === 'object' && !Array.isArray(rawClosed)) {
          closedDays = Object.fromEntries(
            Object.entries(rawClosed as Record<string, unknown>)
              .map(([k, v]) => [k, Math.round(Number(v) || 0)] as const)
              .filter(([, v]) => v > 0),
          );
        } else {
          closedDays = {};
        }
        const rawQuickPct = snap.data()?.quickSaleProfitPercent;
        quickSaleProfitPercent =
          typeof rawQuickPct === 'number' && Number.isFinite(rawQuickPct)
            ? Math.min(100, Math.max(0, Math.round(rawQuickPct)))
            : undefined;
        const rawCustom = snap.data()?.customExpenseCategories;
        customExpenseCategories = Array.isArray(rawCustom)
          ? rawCustom.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          : [];
        push();
      },
      (error) => fail(error.message),
    );

    const unsubSales = watchCollection<Sale>(uid, 'sales', mapSale, (rows) => {
      sales = rows;
      push();
    }, fail);
    const unsubExpenses = watchCollection<Expense>(
      uid,
      'expenses',
      (id, data) => ({
        id,
        amount: Number(data.amount) || 0,
        category: typeof data.category === 'string' ? data.category : 'Other',
        createdAt: millis(data.createdAt),
        note: typeof data.note === 'string' ? data.note : undefined,
        branchId: typeof data.branchId === 'string' ? data.branchId : undefined,
      }),
      (rows) => {
        expenses = rows;
        push();
      },
      fail,
    );
    const unsubProducts = watchCollection<Product>(uid, 'products', mapProduct, (rows) => {
      products = rows;
      push();
    }, fail);

    const savedQuery = query(collection(firestore(), 'users', uid, 'savedOrders'), orderBy('savedAt', 'desc'));
    const unsubSaved = onSnapshot(
      savedQuery,
      (snap) => {
        savedOrders = snap.docs.map((item) => {
          const data = item.data() as Record<string, unknown>;
          const items = Array.isArray(data.items) ? (data.items as SaleLine[]) : [];
          return {
            id: item.id,
            items,
            total: Number(data.total) || billTotal(items),
            savedAt: millis(data.savedAt),
            ...draftFields({
              kind: data.kind === 'quick' ? 'quick' : data.kind === 'bill' ? 'bill' : undefined,
              customerName: typeof data.customerName === 'string' ? data.customerName : undefined,
              customerPhone: typeof data.customerPhone === 'string' ? data.customerPhone : undefined,
            }),
          };
        });
        push();
      },
      (error) => fail(error.message),
    );

    // Enough history for the monthly report; older days are never shown.
    const oldestBranchDay = dayKeyOf(Date.now() - 62 * 24 * 60 * 60 * 1000);
    const unsubBranchDays = onSnapshot(
      query(collection(firestore(), 'users', uid, 'branchDays'), where('day', '>=', oldestBranchDay)),
      (snap) => {
        branchDays = Object.fromEntries(
          snap.docs.map((item) => {
            const data = item.data() as Record<string, unknown>;
            const row: BranchDay = { branchId: String(data.branchId ?? ''), day: String(data.day ?? '') };
            if (typeof data.opening === 'number') row.opening = Math.round(data.opening);
            if (typeof data.closedAt === 'number' || data.closedAt === null) row.closedAt = data.closedAt;
            return [item.id, row];
          }),
        );
        push();
      },
      (error) => fail(error.message),
    );

    const listen = <T,>(name: string, map: (id: string, data: Record<string, unknown>) => T, set: (rows: T[]) => void) =>
      watchCollection(uid, name, map, (rows) => {
        set(rows);
        push();
      }, fail);

    const unsubCustomers = listen('customers', (id, data) => ({
      id,
      name: String(data.name ?? ''),
      phone: String(data.phone ?? ''),
      note: typeof data.note === 'string' ? data.note : undefined,
      points: Number(data.points) || 0,
      createdAt: millis(data.createdAt),
    }), (rows) => {
      customers = rows;
    });
    const unsubPayments = listen('creditPayments', (id, data) => ({
      id,
      customerId: String(data.customerId ?? ''),
      amount: Number(data.amount) || 0,
      method: data.method === 'card' ? 'card' as const : 'cash' as const,
      note: typeof data.note === 'string' ? data.note : undefined,
      branchId: readBranchId(data.branchId),
      createdAt: millis(data.createdAt),
    }), (rows) => {
      creditPayments = rows;
    });
    const unsubSuppliers = listen('suppliers', (id, data) => ({
      id,
      name: String(data.name ?? ''),
      phone: typeof data.phone === 'string' ? data.phone : undefined,
      payable: Number(data.payable) || 0,
      createdAt: millis(data.createdAt),
    }), (rows) => {
      suppliers = rows;
    });
    // Staff logins (users/{shop}/members/{staffUid}).
    const unsubStaff = listen('members', (id, data) => ({
      id,
      name: String(data.name ?? ''),
      role: (data.role === 'manager' ? 'manager' : 'cashier') as StaffMember['role'],
      active: data.active === true,
      login: typeof data.login === 'string' ? data.login : undefined,
      branchId: readBranchId(data.branchId),
      permissions: readPermissions(data.permissions),
      createdAt: millis(data.createdAt),
    }), (rows) => {
      staff = rows;
    });
    const unsubReturns = listen('returns', (id, data) => ({
      id,
      saleId: String(data.saleId ?? ''),
      items: Array.isArray(data.items) ? (data.items as SaleLine[]) : [],
      refundAmount: Number(data.refundAmount) || 0,
      method: (data.method === 'card' || data.method === 'credit' ? data.method : 'cash') as SaleReturn['method'],
      createdAt: millis(data.createdAt),
    }), (rows) => {
      returns = rows;
    });
    const unsubAudit = listen('audit', (id, data) => ({
      id,
      action: String(data.action ?? ''),
      detail: String(data.detail ?? ''),
      actorUid: typeof data.actorUid === 'string' ? data.actorUid : undefined,
      actorName: typeof data.actorName === 'string' ? data.actorName : undefined,
      role: (data.role === 'manager' || data.role === 'cashier' ? data.role : 'owner') as StaffMember['role'],
      createdAt: millis(data.createdAt),
    }), (rows) => {
      audit = rows;
    });

    return () => {
      unsubProfile();
      unsubBranchDays();
      unsubSales();
      unsubExpenses();
      unsubProducts();
      unsubSaved();
      unsubCustomers();
      unsubPayments();
      unsubSuppliers();
      unsubStaff();
      unsubReturns();
      unsubAudit();
    };
  },
  async addQuickSale(uid, input) {
    const invoiceNo = await allocateInvoice(uid);
    const items = input.items?.length ? input.items : undefined;
    const subtotal = items ? billTotal(items) : input.amount;
    const priced = chargedAmount(subtotal, input.discount?.amount ?? 0);
    const { createdAt, ...extras } = input;
    const payload = buildQuickSale(priced.amount, invoiceNo, items);
    await addDoc(
      collection(firestore(), 'users', uid, 'sales'),
      defined({
        ...payload,
        ...extras,
        subtotal: priced.subtotal,
        amount: priced.amount,
        settled: input.paymentMode === 'credit' ? false : true,
        createdAt: stamp(createdAt),
      }),
    );
  },
  async checkoutBill(uid, input) {
    assertBillItems(input.items);
    const productDocs = await getDocs(collection(firestore(), 'users', uid, 'products'));
    const products = productDocs.docs.map((d) => mapProduct(d.id, d.data() as Record<string, unknown>));
    const invoiceNo = await allocateInvoice(uid);
    await applyStockUpdates(uid, input.items, products);
    const priced = chargedAmount(billTotal(input.items), input.discount?.amount ?? 0);
    const { createdAt, ...extras } = input;
    const payload = buildBillSale(input.items, invoiceNo);
    await addDoc(
      collection(firestore(), 'users', uid, 'sales'),
      defined({
        ...payload,
        ...extras,
        subtotal: priced.subtotal,
        amount: priced.amount,
        settled: input.paymentMode === 'credit' ? false : true,
        createdAt: stamp(createdAt),
      }),
    );
  },
  async deleteSale(uid, id) {
    await deleteDoc(doc(firestore(), 'users', uid, 'sales', id));
  },
  async addExpense(uid, amount, category, extra) {
    await addDoc(
      collection(firestore(), 'users', uid, 'expenses'),
      defined({
        amount,
        category,
        note: extra?.note,
        branchId: extra?.branchId,
        createdAt: stamp(extra?.createdAt),
      }),
    );
  },
  async deleteExpense(uid, id) {
    await deleteDoc(doc(firestore(), 'users', uid, 'expenses', id));
  },
  async addProduct(uid, input) {
    await addDoc(
      collection(firestore(), 'users', uid, 'products'),
      defined({
        name: input.name.trim(),
        sellingPrice: Math.round(input.sellingPrice),
        purchasePrice: Math.round(input.purchasePrice),
        stock: input.stock,
        unit: input.unit.trim() || 'pcs',
        category: input.category.trim() || 'General',
        barcode: input.barcode?.trim() || null,
        reorderLevel:
          input.reorderLevel != null && Number.isFinite(input.reorderLevel) ? input.reorderLevel : null,
        batchNo: input.batchNo?.trim() || null,
        expiry: input.expiry?.trim() || null,
        sellKind: input.sellKind === 'menu' ? 'menu' : 'simple',
        createdAt: serverTimestamp(),
      }),
    );
  },
  async deleteProduct(uid, id) {
    await deleteDoc(doc(firestore(), 'users', uid, 'products', id));
  },
  async updateProduct(uid, id, input) {
    await setDoc(
      doc(firestore(), 'users', uid, 'products', id),
      {
        name: input.name.trim(),
        sellingPrice: Math.round(input.sellingPrice),
        purchasePrice: Math.round(input.purchasePrice),
        stock: input.stock,
        unit: input.unit.trim() || 'pcs',
        category: input.category.trim() || 'General',
        sellKind: input.sellKind === 'menu' ? 'menu' : 'simple',
        ...(input.barcode !== undefined ? { barcode: input.barcode.trim() || null } : {}),
        ...(input.reorderLevel !== undefined ? { reorderLevel: input.reorderLevel } : {}),
        ...(input.batchNo !== undefined ? { batchNo: input.batchNo.trim() || null } : {}),
        ...(input.expiry !== undefined ? { expiry: input.expiry.trim() || null } : {}),
      },
      { merge: true },
    );
  },
  async saveOrder(uid, items, info) {
    assertBillItems(items);
    await addDoc(collection(firestore(), 'users', uid, 'savedOrders'), {
      items,
      total: billTotal(items),
      savedAt: serverTimestamp(),
      ...draftFields(info),
    });
  },
  async deleteSavedOrder(uid, id) {
    await deleteDoc(doc(firestore(), 'users', uid, 'savedOrders', id));
  },
  async updateShopName(uid, shopName) {
    await setDoc(doc(firestore(), 'users', uid), { shopName: shopName.trim() }, { merge: true });
  },
  async updateShopType(uid, shopType) {
    await setDoc(doc(firestore(), 'users', uid), { shopType }, { merge: true });
  },
  async setOpeningBalance(uid, dayKey, amount) {
    const ref = doc(firestore(), 'users', uid);
    // setDoc treats a dotted key as one literal field name, so nest the day key for the merge.
    await setDoc(ref, { openingBalances: { [dayKey]: Math.round(amount) } }, { merge: true });
  },
  async setDayClosed(uid, dayKey, closedAt) {
    const ref = doc(firestore(), 'users', uid);
    if (closedAt == null) {
      await updateDoc(ref, { [`closedDays.${dayKey}`]: deleteField() });
      return;
    }
    // updateDoc field path is reliable for nested day keys (YYYY-MM-DD).
    await updateDoc(ref, { [`closedDays.${dayKey}`]: Math.round(closedAt) });
  },
  async setBranchOpening(uid, branchId, dayKey, amount) {
    await setDoc(
      doc(firestore(), 'users', uid, 'branchDays', branchDayId(branchId, dayKey)),
      { branchId, day: dayKey, opening: Math.round(amount) },
      { merge: true },
    );
  },
  async setBranchClosed(uid, branchId, dayKey, closedAt) {
    await setDoc(
      doc(firestore(), 'users', uid, 'branchDays', branchDayId(branchId, dayKey)),
      { branchId, day: dayKey, closedAt: closedAt == null ? null : Math.round(closedAt) },
      { merge: true },
    );
  },
  async setQuickSaleProfitPercent(uid, percent) {
    const value = Math.min(100, Math.max(0, Math.round(percent)));
    await setDoc(doc(firestore(), 'users', uid), { quickSaleProfitPercent: value }, { merge: true });
  },
  async addCustomExpenseCategory(uid, name) {
    const label = normalizeCustomExpenseCategory(name);
    if (!label) throw new Error('Enter a category name.');
    const ref = doc(firestore(), 'users', uid);
    const snap = await getDoc(ref);
    const raw = snap.data()?.customExpenseCategories;
    const prev = Array.isArray(raw)
      ? raw.filter((item): item is string => typeof item === 'string')
      : [];
    const meta = normalizeBooks({
      meta: { nextInvoice: 1, customExpenseCategories: prev },
    }).meta;
    const existing = expenseCategoriesForShop(meta);
    if (existing.some((item) => item.toLowerCase() === label.toLowerCase())) {
      throw new Error('That category already exists.');
    }
    await setDoc(
      ref,
      { customExpenseCategories: [...(meta.customExpenseCategories ?? []), label] },
      { merge: true },
    );
    return label;
  },
  async updateSale(uid, id, patch) {
    await updateDoc(
      doc(firestore(), 'users', uid, 'sales', id),
      defined({
        ...patch,
        createdAt: patch.createdAt ? Timestamp.fromMillis(patch.createdAt) : undefined,
        editedAt: Date.now(),
      }),
    );
  },
  async addCustomer(uid, input) {
    const ref = await addDoc(collection(firestore(), 'users', uid, 'customers'), {
      name: input.name.trim(),
      phone: input.phone.trim(),
      note: input.note?.trim() || null,
      points: 0,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  },
  async addCreditPayment(uid, input) {
    const [salesSnap, paidSnap] = await Promise.all([
      getDocs(collection(firestore(), 'users', uid, 'sales')),
      getDocs(collection(firestore(), 'users', uid, 'creditPayments')),
    ]);
    const mine = salesSnap.docs
      .map((item) => mapSale(item.id, item.data() as Record<string, unknown>))
      .filter((sale) => sale.customerId === input.customerId && sale.paymentMode === 'credit');
    const collected =
      paidSnap.docs
        .map((item) => item.data() as Record<string, unknown>)
        .filter((row) => row.customerId === input.customerId)
        .reduce((sum, row) => sum + (Number(row.amount) || 0), 0) + input.amount;
    const cleared = new Set(fifoSettledIds(mine, collected));
    const batch = writeBatch(firestore());
    for (const sale of mine) {
      if (cleared.has(sale.id) && sale.settled === false) {
        batch.update(doc(firestore(), 'users', uid, 'sales', sale.id), { settled: true });
      }
    }
    const pay = doc(collection(firestore(), 'users', uid, 'creditPayments'));
    batch.set(pay, defined({
      customerId: input.customerId,
      amount: input.amount,
      method: input.method,
      note: input.note,
      branchId: input.branchId,
      createdAt: serverTimestamp(),
    }));
    await batch.commit();
  },
  async addSupplier(uid, input) {
    await addDoc(collection(firestore(), 'users', uid, 'suppliers'), {
      name: input.name.trim(),
      phone: input.phone?.trim() || null,
      payable: Math.round(input.payable),
      createdAt: serverTimestamp(),
    });
  },
  async addSupplierPayable(uid, name, amount, phone) {
    const label = name.trim();
    if (!label) throw new Error('Enter a supplier name.');
    const add = Math.round(amount);
    if (!Number.isFinite(add) || add <= 0) throw new Error('Enter a valid amount.');
    const snap = await getDocs(collection(firestore(), 'users', uid, 'suppliers'));
    const match = snap.docs.find((d) => String(d.data().name ?? '').toLowerCase() === label.toLowerCase());
    if (match) {
      const current = Number(match.data().payable) || 0;
      await updateDoc(match.ref, {
        payable: Math.max(0, Math.round(current) + add),
        ...(phone?.trim() ? { phone: phone.trim() } : {}),
      });
      return;
    }
    await addDoc(collection(firestore(), 'users', uid, 'suppliers'), {
      name: label,
      phone: phone?.trim() || null,
      payable: add,
      createdAt: serverTimestamp(),
    });
  },
  async paySupplier(uid, supplierId, amount) {
    const ref = doc(firestore(), 'users', uid, 'suppliers', supplierId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Supplier not found.');
    const pay = Math.round(amount);
    if (!Number.isFinite(pay) || pay <= 0) throw new Error('Enter a valid payment.');
    const owed = Number(snap.data()?.payable) || 0;
    if (pay > owed) throw new Error(`Only ${owed} is owed to this supplier.`);
    await updateDoc(ref, { payable: Math.max(0, owed - pay) });
  },
  async addStaff(uid, input) {
    await addDoc(collection(firestore(), 'users', uid, 'staff'), {
      name: input.name.trim(),
      role: input.role,
      createdAt: serverTimestamp(),
    });
  },
  async addAudit(uid, input) {
    await addDoc(collection(firestore(), 'users', uid, 'audit'), defined({
      action: input.action.slice(0, 60),
      detail: input.detail.slice(0, 300),
      actorUid: input.actorUid,
      actorName: input.actorName?.slice(0, 60),
      role: input.role,
      createdAt: serverTimestamp(),
    }));
  },
  async addReturn(uid, input) {
    const batch = writeBatch(firestore());
    const ref = doc(collection(firestore(), 'users', uid, 'returns'));
    batch.set(ref, { ...input, createdAt: serverTimestamp() });
    for (const line of input.items) {
      if (!line.productId) continue;
      const snap = await getDoc(doc(firestore(), 'users', uid, 'products', line.productId));
      const stock = Number(snap.data()?.stock) || 0;
      batch.update(doc(firestore(), 'users', uid, 'products', line.productId), { stock: stock + line.qty });
    }
    await batch.commit();
  },
  async importProducts(uid, rows) {
    let count = 0;
    for (let i = 0; i < rows.length; i += 400) {
      const batch = writeBatch(firestore());
      rows.slice(i, i + 400).forEach((input) => {
        const ref = doc(collection(firestore(), 'users', uid, 'products'));
        batch.set(ref, {
          name: input.name.trim(),
          sellingPrice: Math.round(input.sellingPrice),
          purchasePrice: Math.round(input.purchasePrice),
          stock: input.stock,
          unit: input.unit.trim() || 'pcs',
          category: input.category.trim() || 'General',
          barcode: input.barcode?.trim() || null,
          reorderLevel: input.reorderLevel ?? 5,
          createdAt: serverTimestamp(),
        });
        count += 1;
      });
      await batch.commit();
    }
    return count;
  },
};

/* ------------------------------------------------------------------ */
/* Staff logins (owner only)                                           */
/* ------------------------------------------------------------------ */

/**
 * A second Firebase app just for creating staff accounts. Creating a user signs that user in,
 * so doing it here keeps the owner signed in on the main app.
 */
function staffCreatorAuth() {
  const name = 'kadabook-staff-creator';
  const existing = getApps().find((a) => a.name === name);
  const secondary = existing ?? initializeApp(firebaseConfig, name);
  try {
    return initializeAuth(secondary, { persistence: inMemoryPersistence });
  } catch {
    return getAuth(secondary);
  }
}

export async function createStaffAccount(
  shopUid: string,
  input: { name: string; identity: string; password: string; role: Exclude<StaffRole, 'owner'>; branchId?: string },
) {
  const name = input.name.trim().slice(0, 60);
  if (!name) throw new Error('Enter the name of the staff member.');
  assertPassword(input.password);
  const { email, phone } = accountIdentity(input.identity);
  const creator = staffCreatorAuth();
  let staffUid: string;
  try {
    const cred = await createUserWithEmailAndPassword(creator, email, input.password);
    staffUid = cred.user.uid;
  } catch (error) {
    throw friendlyAuthError(error);
  } finally {
    await firebaseSignOut(creator).catch(() => undefined);
  }
  const batch = writeBatch(firestore());
  batch.set(doc(firestore(), 'users', shopUid, 'members', staffUid), defined({
    name,
    role: input.role,
    active: true,
    login: phone ?? email,
    branchId: input.branchId,
    createdAt: serverTimestamp(),
  }));
  batch.set(doc(firestore(), 'staffIndex', staffUid), { shopUid });
  await batch.commit();
  return staffUid;
}

export async function updateStaffMember(
  shopUid: string,
  staffUid: string,
  patch: {
    role?: Exclude<StaffRole, 'owner'>;
    active?: boolean;
    name?: string;
    branchId?: string;
    permissions?: PermissionOverrides;
  },
) {
  const ref = doc(firestore(), 'users', shopUid, 'members', staffUid);
  const snap = await getDoc(ref);
  const current = snap.data();
  if (!current) throw new Error('That staff member was not found.');
  await setDoc(ref, { ...current, ...defined(patch) });
}
