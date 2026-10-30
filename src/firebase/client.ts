import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
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
  updateDoc,
  type Firestore,
  type Timestamp,
} from 'firebase/firestore';
import { accountIdentity, assertPassword, isPhoneAuthEmail, type AuthService, type Repository } from '../data/repository';
import type { SignUpInput } from '../data/signUpTypes';
import type { Expense, Product, Sale, SaleLine, SavedOrder, ShopUser } from '../data/types';
import { normalizeBooks } from '../lib/booksNormalize';
import { expenseCategoriesForShop, normalizeCustomExpenseCategory } from '../lib/expenseCategories';
import {
  assertBillItems,
  assertStock,
  billTotal,
  buildBillSale,
  buildQuickSale,
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
  };
}

export const cloudAuth: AuthService = {
  cloud: true,
  subscribe(onUser) {
    return onAuthStateChanged(firebaseAuth(), (user) => {
      if (!user) {
        onUser(null);
        return;
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
  },
  async signIn(identity, password) {
    assertPassword(password);
    const { email } = accountIdentity(identity);
    try {
      const cred = await signInWithEmailAndPassword(firebaseAuth(), email, password);
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
      const user: ShopUser = { uid: cred.user.uid, email, phone: input.phone.trim() || phone, shopName: name };
      await setDoc(doc(firestore(), 'users', user.uid), {
        email,
        phone: input.phone.trim() || phone,
        shopName: name,
        ownerName: input.ownerName.trim(),
        district: input.district.trim(),
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

function mapSale(id: string, data: Record<string, unknown>): Sale {
  const items = Array.isArray(data.items)
    ? (data.items as SaleLine[]).map((line) => ({
        productId: line.productId,
        name: line.name,
        qty: Number(line.qty) || 0,
        unitPrice: Number(line.unitPrice) || 0,
        lineTotal: Number(line.lineTotal) || 0,
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
    let nextInvoice = 1;
    let openingBalances: Record<string, number> = {};
    let customExpenseCategories: string[] = [];

    const push = () =>
      onData(
        normalizeBooks({
          sales,
          expenses,
          products,
          savedOrders,
          meta: { nextInvoice, openingBalances, customExpenseCategories },
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
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
          openingBalances = Object.fromEntries(
            Object.entries(raw as Record<string, unknown>).map(([k, v]) => [k, Math.round(Number(v) || 0)]),
          );
        } else {
          openingBalances = {};
        }
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
          };
        });
        push();
      },
      (error) => fail(error.message),
    );

    return () => {
      unsubProfile();
      unsubSales();
      unsubExpenses();
      unsubProducts();
      unsubSaved();
    };
  },
  async addQuickSale(uid, input) {
    const invoiceNo = await allocateInvoice(uid);
    const items = input.items?.length ? input.items : undefined;
    const amount = items ? billTotal(items) : input.amount;
    const payload = buildQuickSale(amount, invoiceNo, items);
    await addDoc(collection(firestore(), 'users', uid, 'sales'), {
      ...payload,
      createdAt: serverTimestamp(),
    });
  },
  async checkoutBill(uid, input) {
    assertBillItems(input.items);
    const productDocs = await getDocs(collection(firestore(), 'users', uid, 'products'));
    const products = productDocs.docs.map((d) => mapProduct(d.id, d.data() as Record<string, unknown>));
    const invoiceNo = await allocateInvoice(uid);
    await applyStockUpdates(uid, input.items, products);
    const payload = buildBillSale(input.items, invoiceNo);
    await addDoc(collection(firestore(), 'users', uid, 'sales'), {
      ...payload,
      createdAt: serverTimestamp(),
    });
  },
  async deleteSale(uid, id) {
    await deleteDoc(doc(firestore(), 'users', uid, 'sales', id));
  },
  async addExpense(uid, amount, category) {
    await addDoc(collection(firestore(), 'users', uid, 'expenses'), {
      amount,
      category,
      createdAt: serverTimestamp(),
    });
  },
  async deleteExpense(uid, id) {
    await deleteDoc(doc(firestore(), 'users', uid, 'expenses', id));
  },
  async addProduct(uid, input) {
    await addDoc(collection(firestore(), 'users', uid, 'products'), {
      name: input.name.trim(),
      sellingPrice: Math.round(input.sellingPrice),
      purchasePrice: Math.round(input.purchasePrice),
      stock: input.stock,
      unit: input.unit.trim() || 'pcs',
      category: input.category.trim() || 'General',
      barcode: input.barcode?.trim() ?? null,
      createdAt: serverTimestamp(),
    });
  },
  async deleteProduct(uid, id) {
    await deleteDoc(doc(firestore(), 'users', uid, 'products', id));
  },
  async saveOrder(uid, items) {
    assertBillItems(items);
    await addDoc(collection(firestore(), 'users', uid, 'savedOrders'), {
      items,
      total: billTotal(items),
      savedAt: serverTimestamp(),
    });
  },
  async deleteSavedOrder(uid, id) {
    await deleteDoc(doc(firestore(), 'users', uid, 'savedOrders', id));
  },
  async updateShopName(uid, shopName) {
    await setDoc(doc(firestore(), 'users', uid), { shopName: shopName.trim() }, { merge: true });
  },
  async setOpeningBalance(uid, dayKey, amount) {
    const ref = doc(firestore(), 'users', uid);
    await setDoc(ref, { [`openingBalances.${dayKey}`]: Math.round(amount) }, { merge: true });
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
};
