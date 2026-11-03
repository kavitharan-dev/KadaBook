import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { getFirestoreDb } from '../firebase/client';
import { dayKeyOf } from '../lib/kitchenOps';
import {
  EMPTY_KITCHEN,
  MATERIAL_UNITS,
  type Branch,
  type KitchenData,
  type MaterialQty,
  type MaterialUnit,
  type MoveType,
  type RawMaterial,
  type Recipe,
  type StockMove,
} from './kitchenTypes';
import { usingCloud } from './services';

export type MaterialInput = {
  name: string;
  unit: MaterialUnit;
  reorderLevel: number;
  avgCost: number;
  category?: string;
  inputs?: MaterialQty[];
};

export type NewMove = Omit<StockMove, 'id' | 'createdAt'> & { createdAt?: number };

export type KitchenRepo = {
  watch(uid: string, onData: (data: KitchenData) => void, onError?: (message: string) => void): () => void;
  addBranch(uid: string, input: { name: string; isMain: boolean }): Promise<string>;
  renameBranch(uid: string, id: string, name: string): Promise<void>;
  saveMaterial(uid: string, id: string | null, input: MaterialInput): Promise<string>;
  /** Adds many materials at once (skips names that already exist). Returns how many were created. */
  addMaterials(uid: string, inputs: MaterialInput[]): Promise<number>;
  deleteMaterial(uid: string, id: string): Promise<void>;
  saveRecipe(uid: string, productId: string, lines: MaterialQty[]): Promise<void>;
  deleteRecipe(uid: string, productId: string): Promise<void>;
  /** Writes the moves and the new average costs together, so stock and cost never disagree. */
  addMoves(uid: string, moves: NewMove[], avgCosts?: Record<string, number>): Promise<void>;
  /** Adds a bill's material usage to the branch's sales-usage document for that day. */
  addSaleUsage(uid: string, branchId: string, at: number, qty: Record<string, number>, cost: Record<string, number>): Promise<void>;
  deleteMove(uid: string, id: string): Promise<void>;
};

/* ------------------------------------------------------------------ */
/* Mapping                                                             */
/* ------------------------------------------------------------------ */

const MOVE_TYPES: MoveType[] = ['purchase', 'sale', 'transferOut', 'transferIn', 'productionIn', 'productionOut', 'wastage', 'adjust'];

function ms(value: unknown) {
  if (value && typeof value === 'object' && 'toMillis' in value) return (value as Timestamp).toMillis();
  if (typeof value === 'number') return value;
  return Date.now();
}

/** Reads a materialId → number map. Zeros are dropped unless `keepZero` (a counted zero means "none left"). */
function numberMap(raw: unknown, keepZero = false): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(v);
    if (Number.isFinite(n) && (keepZero || n !== 0)) out[k] = n;
  }
  return out;
}

function qtyLines(raw: unknown): MaterialQty[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => ({ materialId: String((row as MaterialQty)?.materialId ?? ''), qty: Number((row as MaterialQty)?.qty) || 0 }))
    .filter((row) => row.materialId && row.qty > 0);
}

function mapBranch(id: string, d: Record<string, unknown>): Branch {
  return { id, name: String(d.name ?? 'Branch'), isMain: d.isMain === true, createdAt: ms(d.createdAt) };
}

function mapMaterial(id: string, d: Record<string, unknown>): RawMaterial {
  const unit = MATERIAL_UNITS.includes(d.unit as MaterialUnit) ? (d.unit as MaterialUnit) : 'pcs';
  const inputs = qtyLines(d.inputs);
  const category = typeof d.category === 'string' && d.category.trim() ? d.category.trim() : undefined;
  return {
    id,
    name: String(d.name ?? 'Material'),
    unit,
    avgCost: Number(d.avgCost) || 0,
    reorderLevel: Number(d.reorderLevel) || 0,
    ...(category ? { category } : {}),
    ...(inputs.length ? { inputs } : {}),
    createdAt: ms(d.createdAt),
  };
}

function mapRecipe(id: string, d: Record<string, unknown>): Recipe {
  return { productId: String(d.productId ?? id), lines: qtyLines(d.lines), updatedAt: ms(d.updatedAt) };
}

function mapMove(id: string, d: Record<string, unknown>): StockMove {
  const type = MOVE_TYPES.includes(d.type as MoveType) ? (d.type as MoveType) : 'adjust';
  return {
    id,
    type,
    branchId: String(d.branchId ?? ''),
    qty: numberMap(d.qty),
    cost: numberMap(d.cost),
    ...(d.counted ? { counted: numberMap(d.counted, true) } : {}),
    ...(typeof d.refId === 'string' ? { refId: d.refId } : {}),
    ...(typeof d.otherBranchId === 'string' ? { otherBranchId: d.otherBranchId } : {}),
    ...(typeof d.supplier === 'string' && d.supplier ? { supplier: d.supplier } : {}),
    ...(d.expiry && typeof d.expiry === 'object' && !Array.isArray(d.expiry)
      ? {
          expiry: Object.fromEntries(
            Object.entries(d.expiry as Record<string, unknown>)
              .filter(([, v]) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v))
              .map(([k, v]) => [k, String(v).slice(0, 10)]),
          ),
        }
      : {}),
    ...(typeof d.note === 'string' && d.note ? { note: d.note } : {}),
    createdAt: ms(d.createdAt),
  };
}

function clean<T extends Record<string, unknown>>(row: T) {
  return Object.fromEntries(Object.entries(row).filter(([, v]) => v !== undefined)) as T;
}

/* ------------------------------------------------------------------ */
/* Firestore                                                           */
/* ------------------------------------------------------------------ */

const db = () => getFirestoreDb();
const col = (uid: string, name: string) => collection(db(), 'users', uid, name);

const cloudKitchen: KitchenRepo = {
  watch(uid, onData, onError) {
    const data: KitchenData = { ...EMPTY_KITCHEN };
    const push = () => onData({ ...data });
    const fail = (error: { message?: string }) => onError?.(error.message || 'Could not read kitchen stock.');
    const subs = [
      onSnapshot(query(col(uid, 'branches'), orderBy('createdAt', 'asc')), (snap) => {
        data.branches = snap.docs.map((d) => mapBranch(d.id, d.data()));
        push();
      }, fail),
      onSnapshot(query(col(uid, 'materials'), orderBy('createdAt', 'asc')), (snap) => {
        data.materials = snap.docs.map((d) => mapMaterial(d.id, d.data()));
        push();
      }, fail),
      onSnapshot(col(uid, 'recipes'), (snap) => {
        data.recipes = snap.docs.map((d) => mapRecipe(d.id, d.data()));
        push();
      }, fail),
      onSnapshot(query(col(uid, 'stockMoves'), orderBy('createdAt', 'desc')), (snap) => {
        data.moves = snap.docs.map((d) => mapMove(d.id, d.data()));
        push();
      }, fail),
    ];
    return () => subs.forEach((unsub) => unsub());
  },
  async addBranch(uid, input) {
    const ref = doc(col(uid, 'branches'));
    await setDoc(ref, { name: input.name.trim(), isMain: input.isMain, createdAt: serverTimestamp() });
    return ref.id;
  },
  async renameBranch(uid, id, name) {
    await setDoc(doc(col(uid, 'branches'), id), { name: name.trim() }, { merge: true });
  },
  async saveMaterial(uid, id, input) {
    const ref = id ? doc(col(uid, 'materials'), id) : doc(col(uid, 'materials'));
    await setDoc(
      ref,
      {
        name: input.name.trim(),
        unit: input.unit,
        reorderLevel: input.reorderLevel,
        avgCost: input.avgCost,
        inputs: input.inputs ?? [],
        ...(input.category !== undefined ? { category: input.category.trim() || null } : {}),
        ...(id ? {} : { createdAt: serverTimestamp() }),
      },
      { merge: true },
    );
    return ref.id;
  },
  async addMaterials(uid, inputs) {
    if (!inputs.length) return 0;
    // Catalog is < 100 items; one batch is enough (Firestore limit 500).
    const batch = writeBatch(db());
    for (const input of inputs) {
      batch.set(doc(col(uid, 'materials')), {
        name: input.name.trim(),
        unit: input.unit,
        reorderLevel: input.reorderLevel,
        avgCost: input.avgCost,
        inputs: input.inputs ?? [],
        ...(input.category ? { category: input.category.trim() } : {}),
        createdAt: serverTimestamp(),
      });
    }
    await batch.commit();
    return inputs.length;
  },
  async deleteMaterial(uid, id) {
    await deleteDoc(doc(col(uid, 'materials'), id));
  },
  async saveRecipe(uid, productId, lines) {
    await setDoc(doc(col(uid, 'recipes'), productId), { productId, lines, updatedAt: serverTimestamp() });
  },
  async deleteRecipe(uid, productId) {
    await deleteDoc(doc(col(uid, 'recipes'), productId));
  },
  async addMoves(uid, moves, avgCosts) {
    const batch = writeBatch(db());
    for (const move of moves) {
      const { createdAt, ...rest } = move;
      batch.set(doc(col(uid, 'stockMoves')), clean({ ...rest, createdAt: createdAt ? Timestamp.fromMillis(createdAt) : serverTimestamp() }));
    }
    for (const [materialId, avgCost] of Object.entries(avgCosts ?? {})) {
      batch.set(doc(col(uid, 'materials'), materialId), { avgCost }, { merge: true });
    }
    await batch.commit();
  },
  async addSaleUsage(uid, branchId, at, qty, cost) {
    const day = new Date(at);
    day.setHours(0, 0, 0, 0);
    const ref = doc(col(uid, 'stockMoves'), `sale_${branchId}_${dayKeyOf(at)}`);
    await setDoc(
      ref,
      {
        type: 'sale',
        branchId,
        createdAt: Timestamp.fromMillis(day.getTime()),
        qty: Object.fromEntries(Object.entries(qty).map(([k, v]) => [k, increment(v)])),
        cost: Object.fromEntries(Object.entries(cost).map(([k, v]) => [k, increment(v)])),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  },
  async deleteMove(uid, id) {
    await deleteDoc(doc(col(uid, 'stockMoves'), id));
  },
};

/* ------------------------------------------------------------------ */
/* On the phone only (no Firebase configured)                          */
/* ------------------------------------------------------------------ */

const listeners = new Map<string, Set<(data: KitchenData) => void>>();
const key = (uid: string) => `kb_kitchen_${uid}`;
const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

async function read(uid: string): Promise<KitchenData> {
  try {
    const raw = await AsyncStorage.getItem(key(uid));
    return raw ? { ...EMPTY_KITCHEN, ...(JSON.parse(raw) as KitchenData) } : { ...EMPTY_KITCHEN };
  } catch {
    return { ...EMPTY_KITCHEN };
  }
}

async function write(uid: string, data: KitchenData) {
  data.moves.sort((a, b) => b.createdAt - a.createdAt);
  await AsyncStorage.setItem(key(uid), JSON.stringify(data));
  listeners.get(uid)?.forEach((fn) => fn({ ...data }));
}

async function change(uid: string, fn: (data: KitchenData) => void) {
  const data = await read(uid);
  fn(data);
  await write(uid, data);
}

const localKitchen: KitchenRepo = {
  watch(uid, onData) {
    const set = listeners.get(uid) ?? new Set();
    set.add(onData);
    listeners.set(uid, set);
    read(uid).then(onData);
    return () => set.delete(onData);
  },
  async addBranch(uid, input) {
    const id = newId();
    await change(uid, (d) => d.branches.push({ id, name: input.name.trim(), isMain: input.isMain, createdAt: Date.now() }));
    return id;
  },
  async renameBranch(uid, id, name) {
    await change(uid, (d) => {
      d.branches = d.branches.map((b) => (b.id === id ? { ...b, name: name.trim() } : b));
    });
  },
  async saveMaterial(uid, id, input) {
    const materialId = id ?? newId();
    await change(uid, (d) => {
      const existing = d.materials.find((m) => m.id === materialId);
      const next: RawMaterial = {
        ...input,
        name: input.name.trim(),
        id: materialId,
        createdAt: existing?.createdAt ?? Date.now(),
        ...(input.category !== undefined ? { category: input.category.trim() || undefined } : { category: existing?.category }),
      };
      d.materials = existing ? d.materials.map((m) => (m.id === materialId ? next : m)) : [...d.materials, next];
    });
    return materialId;
  },
  async addMaterials(uid, inputs) {
    if (!inputs.length) return 0;
    await change(uid, (d) => {
      for (const input of inputs) {
        d.materials.push({
          id: newId(),
          name: input.name.trim(),
          unit: input.unit,
          avgCost: input.avgCost,
          reorderLevel: input.reorderLevel,
          ...(input.category ? { category: input.category.trim() } : {}),
          ...(input.inputs?.length ? { inputs: input.inputs } : {}),
          createdAt: Date.now(),
        });
      }
    });
    return inputs.length;
  },
  async deleteMaterial(uid, id) {
    await change(uid, (d) => {
      d.materials = d.materials.filter((m) => m.id !== id);
    });
  },
  async saveRecipe(uid, productId, lines) {
    await change(uid, (d) => {
      d.recipes = [...d.recipes.filter((r) => r.productId !== productId), { productId, lines, updatedAt: Date.now() }];
    });
  },
  async deleteRecipe(uid, productId) {
    await change(uid, (d) => {
      d.recipes = d.recipes.filter((r) => r.productId !== productId);
    });
  },
  async addMoves(uid, moves, avgCosts) {
    await change(uid, (d) => {
      for (const move of moves) d.moves.push({ ...move, id: newId(), createdAt: move.createdAt ?? Date.now() });
      d.materials = d.materials.map((m) => (avgCosts?.[m.id] !== undefined ? { ...m, avgCost: avgCosts[m.id] } : m));
    });
  },
  async addSaleUsage(uid, branchId, at, qty, cost) {
    const id = `sale_${branchId}_${dayKeyOf(at)}`;
    const day = new Date(at);
    day.setHours(0, 0, 0, 0);
    await change(uid, (d) => {
      const existing = d.moves.find((m) => m.id === id);
      const target: StockMove = existing ?? { id, type: 'sale', branchId, qty: {}, cost: {}, createdAt: day.getTime() };
      for (const [k, v] of Object.entries(qty)) target.qty[k] = (target.qty[k] ?? 0) + v;
      for (const [k, v] of Object.entries(cost)) target.cost[k] = (target.cost[k] ?? 0) + v;
      if (!existing) d.moves.push(target);
    });
  },
  async deleteMove(uid, id) {
    await change(uid, (d) => {
      d.moves = d.moves.filter((m) => m.id !== id);
    });
  },
};

export const kitchenRepo: KitchenRepo = usingCloud ? cloudKitchen : localKitchen;
