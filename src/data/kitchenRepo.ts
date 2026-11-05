import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getFirestoreDb, readStockRows, writeStockPlan } from '../firebase/client';
import { roundQty, stockRowId, type StockPlan, type StockRows } from '../lib/stockEngine';
import {
  EMPTY_KITCHEN,
  MATERIAL_UNITS,
  type Branch,
  type ItemKind,
  type KitchenData,
  type MaterialQty,
  type MaterialUnit,
  type MoveType,
  type RawMaterial,
  type Recipe,
  type StockMove,
  type StockRow,
} from './kitchenTypes';
import { applyLocalStock, listenLocalKitchen, newLocalId, readLocalKitchen, writeLocalKitchen } from './localStock';
import { usingCloud } from './services';

export type MaterialInput = {
  name: string;
  unit: MaterialUnit;
  kind?: ItemKind;
  reorderLevel: number;
  avgCost: number;
  category?: string;
  /** Links kitchen-ready stock to a Products / Foods item (older shops). */
  productId?: string;
  /** The recipe of a finished item. */
  inputs?: MaterialQty[];
};

/** Old rows waiting for a branch id, by collection. */
export type StampCollection = 'sales' | 'expenses' | 'creditPayments' | 'returns' | 'savedOrders';

export type KitchenRepo = {
  /** `branchId`: staff tied to one branch only load that branch's stock and ledger. */
  watch(uid: string, onData: (data: KitchenData) => void, onError?: (message: string) => void, branchId?: string): () => void;
  addBranch(uid: string, input: { name: string; isMain: boolean }): Promise<string>;
  renameBranch(uid: string, id: string, name: string): Promise<void>;
  /** Removes the branch doc + its stock rows. Caller must keep ≥1 branch. */
  deleteBranch(uid: string, id: string): Promise<void>;
  saveMaterial(uid: string, id: string | null, input: MaterialInput): Promise<string>;
  /** Adds many materials at once (skips names that already exist). Returns how many were created. */
  addMaterials(uid: string, inputs: MaterialInput[]): Promise<number>;
  deleteMaterial(uid: string, id: string): Promise<void>;
  /**
   * Kitchen reset: wipe materials, stock rows and recipe docs so a shop can load a fresh catalog.
   * Does not touch sales, branches or products (callers delete products separately).
   */
  clearStockCatalog(uid: string): Promise<void>;
  /** Reads the rows, plans, and writes rows and ledger in one transaction. Returns the plan. */
  applyStock<P extends StockPlan>(uid: string, rowIds: string[], plan: (rows: StockRows) => P): Promise<P>;
  /**
   * One time, for shops from before per-branch stock: builds the rows from the old ledger, and moves
   * stock held on old linked products to the main branch. Does nothing once any row exists.
   */
  backfillStock(uid: string, items: RawMaterial[], products: { id: string; stock: number }[], mainBranchId: string): Promise<number>;
  linkProducts(uid: string, links: { productId: string; itemId: string }[]): Promise<void>;
  /** "Old documents without a branch are the main branch": writes that on them for good. */
  stampBranch(uid: string, name: StampCollection, ids: string[], branchId: string): Promise<void>;
};

/* ------------------------------------------------------------------ */
/* Mapping                                                             */
/* ------------------------------------------------------------------ */

const MOVE_TYPES: MoveType[] = [
  'purchase',
  'sale',
  'transferOut',
  'transferIn',
  'productionIn',
  'productionOut',
  'assembleIn',
  'assembleOut',
  'saleReturn',
  'counterOut',
  'wastage',
  'adjust',
];

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
  const productId = typeof d.productId === 'string' && d.productId.trim() ? d.productId.trim() : undefined;
  return {
    id,
    name: String(d.name ?? 'Material'),
    unit,
    ...(d.kind === 'raw' || d.kind === 'finished' || d.kind === 'direct' ? { kind: d.kind as ItemKind } : {}),
    avgCost: Number(d.avgCost) || 0,
    reorderLevel: Number(d.reorderLevel) || 0,
    ...(category ? { category } : {}),
    ...(productId ? { productId } : {}),
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

function mapStock(d: Record<string, unknown>): StockRow {
  return {
    branchId: String(d.branchId ?? ''),
    itemId: String(d.itemId ?? ''),
    qty: Number(d.qty) || 0,
    avgCost: Number(d.avgCost) || 0,
  };
}

/** Sums an old ledger into stock rows. Costs come from the item, the only cost the old model kept. */
function rowsFromLedger(
  moves: Pick<StockMove, 'branchId' | 'qty'>[],
  items: RawMaterial[],
  products: { id: string; stock: number }[],
  mainBranchId: string,
): StockRows {
  const rows: StockRows = {};
  const add = (branchId: string, itemId: string, qty: number) => {
    const id = stockRowId(branchId, itemId);
    const avgCost = items.find((i) => i.id === itemId)?.avgCost ?? 0;
    rows[id] = { branchId, itemId, qty: roundQty((rows[id]?.qty ?? 0) + qty), avgCost };
  };
  for (const move of moves) {
    for (const [itemId, qty] of Object.entries(move.qty)) add(move.branchId || mainBranchId, itemId, qty);
  }
  for (const item of items) {
    const product = item.productId ? products.find((p) => p.id === item.productId) : undefined;
    if (product?.stock) add(mainBranchId, item.id, product.stock);
  }
  for (const id of Object.keys(rows)) {
    if (rows[id].qty === 0) delete rows[id];
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/* Firestore                                                           */
/* ------------------------------------------------------------------ */

const db = () => getFirestoreDb();
const col = (uid: string, name: string) => collection(db(), 'users', uid, name);

const cloudKitchen: KitchenRepo = {
  watch(uid, onData, onError, branchId) {
    const data: KitchenData = { ...EMPTY_KITCHEN };
    // Nothing is reported until every list has loaded once, so no screen sees half a shop.
    const waiting = new Set(['branches', 'materials', 'recipes', 'stock', 'moves']);
    const push = (name: string) => {
      waiting.delete(name);
      if (!waiting.size) onData({ ...data });
    };
    const fail = (error: { message?: string }) => {
      onError?.(error.message || 'Could not read kitchen stock.');
      // One refused list must not leave every kitchen screen empty.
      waiting.clear();
      onData({ ...data });
    };
    const oldestMove = Timestamp.fromMillis(Date.now() - 62 * 24 * 60 * 60 * 1000);
    const movesQuery = branchId
      ? query(col(uid, 'stockMoves'), where('branchId', '==', branchId))
      : query(col(uid, 'stockMoves'), where('createdAt', '>=', oldestMove), orderBy('createdAt', 'desc'));
    const stockQuery = branchId ? query(col(uid, 'stock'), where('branchId', '==', branchId)) : col(uid, 'stock');
    const subs = [
      onSnapshot(query(col(uid, 'branches'), orderBy('createdAt', 'asc')), (snap) => {
        data.branches = snap.docs.map((d) => mapBranch(d.id, d.data()));
        push('branches');
      }, fail),
      onSnapshot(query(col(uid, 'materials'), orderBy('createdAt', 'asc')), (snap) => {
        data.materials = snap.docs.map((d) => mapMaterial(d.id, d.data()));
        push('materials');
      }, fail),
      onSnapshot(col(uid, 'recipes'), (snap) => {
        data.recipes = snap.docs.map((d) => mapRecipe(d.id, d.data()));
        push('recipes');
      }, fail),
      onSnapshot(stockQuery, (snap) => {
        data.stock = Object.fromEntries(snap.docs.map((d) => [d.id, mapStock(d.data())]));
        push('stock');
      }, fail),
      onSnapshot(movesQuery, (snap) => {
        data.moves = snap.docs.map((d) => mapMove(d.id, d.data())).sort((a, b) => b.createdAt - a.createdAt);
        push('moves');
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
  async deleteBranch(uid, id) {
    const branchSnap = await getDocs(query(col(uid, 'branches'), orderBy('createdAt', 'asc')));
    const branches = branchSnap.docs.map((d) => mapBranch(d.id, d.data()));
    if (branches.length <= 1) throw new Error('Keep at least one branch.');
    const target = branches.find((b) => b.id === id);
    if (!target) throw new Error('Branch not found.');

    const stockSnap = await getDocs(query(col(uid, 'stock'), where('branchId', '==', id)));
    for (let i = 0; i < stockSnap.docs.length; i += 400) {
      const batch = writeBatch(db());
      for (const row of stockSnap.docs.slice(i, i + 400)) batch.delete(row.ref);
      await batch.commit();
    }
    await deleteDoc(doc(col(uid, 'branches'), id));

    if (target.isMain) {
      const survivor = branches.find((b) => b.id !== id);
      if (survivor) {
        await setDoc(doc(col(uid, 'branches'), survivor.id), { isMain: true }, { merge: true });
      }
    }
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
        ...(input.kind ? { kind: input.kind } : {}),
        ...(input.category !== undefined ? { category: input.category.trim() || null } : {}),
        ...(input.productId !== undefined ? { productId: input.productId.trim() || null } : {}),
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
        ...(input.kind ? { kind: input.kind } : {}),
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
  async clearStockCatalog(uid) {
    for (const name of ['materials', 'stock', 'recipes'] as const) {
      const snap = await getDocs(col(uid, name));
      for (let i = 0; i < snap.docs.length; i += 400) {
        const batch = writeBatch(db());
        for (const row of snap.docs.slice(i, i + 400)) batch.delete(row.ref);
        await batch.commit();
      }
    }
  },
  async applyStock(uid, rowIds, plan) {
    return runTransaction(db(), async (tx) => {
      const planned = plan(await readStockRows(tx, uid, rowIds));
      writeStockPlan(tx, uid, planned);
      return planned;
    });
  },
  async backfillStock(uid, items, products, mainBranchId) {
    const any = await getDocs(query(col(uid, 'stock'), limit(1)));
    if (!any.empty) return 0;
    const moves = await getDocs(col(uid, 'stockMoves'));
    const rows = rowsFromLedger(moves.docs.map((d) => mapMove(d.id, d.data())), items, products, mainBranchId);
    const entries = Object.entries(rows);
    for (let i = 0; i < entries.length; i += 400) {
      const batch = writeBatch(db());
      for (const [id, row] of entries.slice(i, i + 400)) batch.set(doc(col(uid, 'stock'), id), row);
      await batch.commit();
    }
    return entries.length;
  },
  async linkProducts(uid, links) {
    if (!links.length) return;
    const batch = writeBatch(db());
    for (const link of links) batch.update(doc(col(uid, 'products'), link.productId), { stockItemId: link.itemId });
    await batch.commit();
  },
  async stampBranch(uid, name, ids, branchId) {
    for (let i = 0; i < ids.length; i += 400) {
      const batch = writeBatch(db());
      for (const id of ids.slice(i, i + 400)) batch.update(doc(col(uid, name), id), { branchId });
      await batch.commit();
    }
  },
};

/* ------------------------------------------------------------------ */
/* On the phone only (no Firebase configured)                          */
/* ------------------------------------------------------------------ */

async function change(uid: string, fn: (data: KitchenData) => void) {
  const data = await readLocalKitchen(uid);
  fn(data);
  await writeLocalKitchen(uid, data);
}

const localKitchen: KitchenRepo = {
  watch(uid, onData) {
    return listenLocalKitchen(uid, onData);
  },
  async addBranch(uid, input) {
    const id = newLocalId();
    await change(uid, (d) => d.branches.push({ id, name: input.name.trim(), isMain: input.isMain, createdAt: Date.now() }));
    return id;
  },
  async renameBranch(uid, id, name) {
    await change(uid, (d) => {
      d.branches = d.branches.map((b) => (b.id === id ? { ...b, name: name.trim() } : b));
    });
  },
  async deleteBranch(uid, id) {
    await change(uid, (d) => {
      d.branches = d.branches.filter((b) => b.id !== id);
      d.stock = Object.fromEntries(Object.entries(d.stock ?? {}).filter(([, row]) => row.branchId !== id));
      if (d.branches.length && !d.branches.some((b) => b.isMain)) {
        d.branches = d.branches.map((b, i) => (i === 0 ? { ...b, isMain: true } : b));
      }
    });
  },
  async saveMaterial(uid, id, input) {
    const materialId = id ?? newLocalId();
    await change(uid, (d) => {
      const existing = d.materials.find((m) => m.id === materialId);
      const productId = input.productId !== undefined ? input.productId.trim() || undefined : existing?.productId;
      const category = input.category !== undefined ? input.category.trim() || undefined : existing?.category;
      const next: RawMaterial = {
        name: input.name.trim(),
        unit: input.unit,
        avgCost: input.avgCost,
        reorderLevel: input.reorderLevel,
        id: materialId,
        createdAt: existing?.createdAt ?? Date.now(),
        ...(input.kind ? { kind: input.kind } : existing?.kind ? { kind: existing.kind } : {}),
        ...(category ? { category } : {}),
        ...(productId ? { productId } : {}),
        ...(input.inputs?.length ? { inputs: input.inputs } : {}),
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
          id: newLocalId(),
          name: input.name.trim(),
          unit: input.unit,
          avgCost: input.avgCost,
          reorderLevel: input.reorderLevel,
          ...(input.kind ? { kind: input.kind } : {}),
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
  async clearStockCatalog(uid) {
    await change(uid, (d) => {
      d.materials = [];
      d.stock = {};
      d.recipes = [];
    });
  },
  async applyStock(uid, _rowIds, plan) {
    return applyLocalStock(uid, plan);
  },
  async backfillStock(uid, items, products, mainBranchId) {
    const data = await readLocalKitchen(uid);
    if (Object.keys(data.stock ?? {}).length) return 0;
    data.stock = rowsFromLedger(data.moves, items, products, mainBranchId);
    await writeLocalKitchen(uid, data);
    return Object.keys(data.stock).length;
  },
  // Phone-only books hold their own copy of these fields; a phone has one login, so nothing to scope.
  async linkProducts() {},
  async stampBranch() {},
};

export const kitchenRepo: KitchenRepo = usingCloud ? cloudKitchen : localKitchen;
