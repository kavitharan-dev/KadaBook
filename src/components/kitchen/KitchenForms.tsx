import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useBooks } from '../../context/BooksContext';
import { useKitchen } from '../../context/KitchenContext';
import { useTheme } from '../../context/ThemeContext';
import { ITEM_KIND_LABEL, type ItemKind, type MaterialUnit, type RawMaterial } from '../../data/kitchenTypes';
import { formatRs } from '../../lib/format';
import { formatQty, roundMoney, roundQty } from '../../lib/kitchenOps';
import { itemKind, makeNeeds, previewAssemble, stockRowId } from '../../lib/stockEngine';
import { useTier } from '../../lib/useTier';
import { fonts } from '../../theme/fonts';
import type { KitchenBurstKind } from './KitchenSuccessBurst';
import { BranchChips, Chip, Input, ItemIconGrid, Label, Sheet } from './KitchenUi';

const KINDS: ItemKind[] = ['raw', 'finished', 'direct'];
const number = (v: string) => v.replace(/[^\d.]/g, '').slice(0, 10);

type Done = (message: string, kind?: KitchenBurstKind) => void;

/* ------------------------------------------------------------------ */
/* + Food: one sheet → ready item (+ recipe) + menu product            */
/* ------------------------------------------------------------------ */

export function QuickFoodForm({ visible, onClose, onDone }: { visible: boolean; onClose: () => void; onDone: Done }) {
  const { colors } = useTheme();
  const k = useKitchen();
  const { addProduct } = useBooks();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [mode, setMode] = useState<'recipe' | 'menu'>('recipe');
  const [pickId, setPickId] = useState('');
  const [partQty, setPartQty] = useState('1');
  const [recipe, setRecipe] = useState<{ materialId: string; qty: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName('');
    setPrice('');
    setMode('recipe');
    setPickId('');
    setPartQty('1');
    setRecipe([]);
    setError(null);
  }, [visible]);

  const ingredients = k.data.materials.filter((m) => itemKind(m) === 'raw');

  function addRecipePart() {
    if (!pickId) {
      setError('Tap an ingredient.');
      return;
    }
    const qty = Number(partQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Enter qty.');
      return;
    }
    setRecipe((prev) => {
      const hit = prev.find((row) => row.materialId === pickId);
      if (hit) return prev.map((row) => (row.materialId === pickId ? { ...row, qty: roundQty(row.qty + qty) } : row));
      return [...prev, { materialId: pickId, qty }];
    });
    setPartQty('1');
    setError(null);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const label = name.trim();
      const selling = Number(price);
      if (!label) throw new Error('Enter food name.');
      if (!selling || selling <= 0) throw new Error('Enter selling price.');
      if (mode === 'recipe' && !recipe.length) throw new Error('Add recipe ingredients, or choose Menu only.');
      let stockItemId = '';
      if (mode === 'recipe') {
        stockItemId = await k.saveMaterial(null, {
          name: label,
          kind: 'finished',
          unit: 'pcs',
          reorderLevel: 0,
          avgCost: 0,
          inputs: recipe,
        });
      }
      await addProduct({
        name: label,
        sellingPrice: selling,
        purchasePrice: 0,
        stock: 0,
        unit: 'pcs',
        category: 'Food',
        sellKind: 'menu',
        ...(stockItemId ? { stockItemId } : {}),
        portionQty: 0,
      });
      onDone(mode === 'recipe' ? `${label} added · Make to cook` : `${label} on menu`, 'food');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  const pickedIngredient = ingredients.find((m) => m.id === pickId);

  return (
    <Sheet
      visible={visible}
      title="+ Food"
      subtitle="Name + price. Recipe optional (juice = Menu only)."
      onClose={onClose}
      actionLabel="Save food"
      onAction={save}
      busy={busy}
      error={error}
      dock={
        mode === 'recipe' && pickId ? (
          <View style={[styles.buyPanel, { borderColor: colors.hairline, backgroundColor: colors.gradientTop }]}>
            <Text style={[styles.strong, { color: colors.ink }]} numberOfLines={1}>
              {pickedIngredient?.name ?? 'Ingredient'}
            </Text>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Label>QTY FOR ONE</Label>
                <Input value={partQty} onChangeText={(v) => setPartQty(number(v))} keyboardType="decimal-pad" placeholder="1" />
              </View>
              <Pressable onPress={addRecipePart} style={[styles.addCart, styles.flex, { backgroundColor: colors.brand, marginTop: 18 }]}>
                <Text style={[styles.addCartText, { color: colors.onFill }]}>Add</Text>
              </Pressable>
            </View>
          </View>
        ) : null
      }
    >
      <Label>NAME</Label>
      <Input value={name} onChangeText={(v) => setName(v.slice(0, 60))} placeholder="e.g. Fish Burger" />
      <Label>SELL PRICE (Rs)</Label>
      <Input value={price} onChangeText={(v) => setPrice(number(v))} keyboardType="number-pad" placeholder="0" />
      <Label>TYPE</Label>
      <View style={styles.wrap}>
        <Chip label="With recipe" on={mode === 'recipe'} onPress={() => setMode('recipe')} />
        <Chip label="Menu only" on={mode === 'menu'} onPress={() => setMode('menu')} />
      </View>
      {mode === 'recipe' ? (
        <>
          <Label>RECIPE — TAP INGREDIENT</Label>
          {ingredients.length === 0 ? (
            <Text style={[styles.hint, { color: colors.muted }]}>Add raw first (+ Raw), then recipe.</Text>
          ) : (
            <ItemIconGrid materials={ingredients} selectedId={pickId} onSelect={setPickId} />
          )}
          {recipe.map((row) => {
            const m = ingredients.find((x) => x.id === row.materialId);
            return (
              <View key={row.materialId} style={styles.row}>
                <Text style={[styles.hint, styles.flex, { color: colors.ink }]} numberOfLines={1}>
                  {row.qty} × {m?.name ?? 'Item'}
                </Text>
                <Pressable onPress={() => setRecipe((prev) => prev.filter((x) => x.materialId !== row.materialId))} hitSlop={8}>
                  <Text style={{ color: colors.expenseText, fontFamily: fonts.bold }}>✕</Text>
                </Pressable>
              </View>
            );
          })}
        </>
      ) : (
        <Text style={[styles.hint, { color: colors.muted }]}>Juice / lassi — sells with no stock cut.</Text>
      )}
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* + Raw: one sheet → ingredient                                       */
/* ------------------------------------------------------------------ */

export function QuickRawForm({ visible, onClose, onDone }: { visible: boolean; onClose: () => void; onDone: Done }) {
  const { colors } = useTheme();
  const k = useKitchen();
  const [name, setName] = useState('');
  const [unit, setUnit] = useState<MaterialUnit>('pcs');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName('');
    setUnit('pcs');
    setError(null);
  }, [visible]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      if (!name.trim()) throw new Error('Enter ingredient name.');
      await k.saveMaterial(null, {
        name,
        kind: 'raw',
        unit,
        reorderLevel: 0,
        avgCost: 0,
        inputs: [],
      });
      onDone(`${name.trim()} added · Buy to fill stock`, 'raw');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      visible={visible}
      title="+ Raw"
      subtitle="Ingredient name → unit → Save. Then Buy."
      onClose={onClose}
      actionLabel="Save ingredient"
      onAction={save}
      busy={busy}
      error={error}
    >
      <Label>NAME</Label>
      <Input value={name} onChangeText={(v) => setName(v.slice(0, 60))} placeholder="e.g. Burger bun" />
      <Label>UNIT</Label>
      <View style={styles.wrap}>
        {(['pcs', 'g'] as MaterialUnit[]).map((option) => (
          <Chip key={option} label={option} on={unit === option} onPress={() => setUnit(option)} />
        ))}
      </View>
      <Text style={[styles.hint, { color: colors.muted }]}>After save, use Buy to add quantity.</Text>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Item: raw, finished (with its recipe) or direct-sale                */
/* ------------------------------------------------------------------ */

export function ItemForm({ target, onClose, onDone }: { target: RawMaterial | 'new' | null; onClose: () => void; onDone: Done }) {
  const { colors } = useTheme();
  const k = useKitchen();
  const existing = target && target !== 'new' ? target : null;
  const [name, setName] = useState('');
  const [kind, setKind] = useState<ItemKind>('raw');
  const [unit, setUnit] = useState<MaterialUnit>('pcs');
  const [pickId, setPickId] = useState('');
  const [partQty, setPartQty] = useState('1');
  const [recipe, setRecipe] = useState<{ materialId: string; qty: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    setName(existing?.name ?? '');
    setKind(existing ? itemKind(existing) : 'raw');
    setUnit(existing?.unit ?? 'pcs');
    setRecipe(existing?.inputs?.map((part) => ({ materialId: part.materialId, qty: part.qty })) ?? []);
    setPickId('');
    setPartQty('1');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const ingredients = k.data.materials.filter((m) => itemKind(m) === 'raw' && m.id !== existing?.id);

  function addRecipePart() {
    if (!pickId) {
      setError('Tap a raw item for the recipe.');
      return;
    }
    const qty = Number(partQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Enter recipe quantity.');
      return;
    }
    setRecipe((prev) => {
      const hit = prev.find((row) => row.materialId === pickId);
      if (hit) return prev.map((row) => (row.materialId === pickId ? { ...row, qty: roundQty(row.qty + qty) } : row));
      return [...prev, { materialId: pickId, qty }];
    });
    setPartQty('1');
    setError(null);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      if (!name.trim()) throw new Error('Enter a name.');
      if (kind === 'finished' && !recipe.length) throw new Error('Tap raw items for the recipe.');
      await k.saveMaterial(existing?.id ?? null, {
        name,
        kind,
        unit,
        reorderLevel: 0,
        avgCost: existing?.avgCost ?? 0,
        inputs: kind === 'finished' ? recipe : [],
      });
      onDone(`${name.trim()} saved`, 'item');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!existing) return;
    setBusy(true);
    setError(null);
    try {
      await k.deleteMaterial(existing.id);
      onDone(`${existing.name} deleted`, 'item');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not delete.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      visible={!!target}
      title={existing ? 'Edit item' : 'New item'}
      subtitle="Ingredient, ready food, or by-weight / pack."
      onClose={onClose}
      actionLabel="Save item"
      onAction={save}
      busy={busy}
      error={error}
      dock={
        kind === 'finished' && pickId ? (
          <View style={[styles.buyPanel, { borderColor: colors.hairline, backgroundColor: colors.gradientTop }]}>
            <Text style={[styles.strong, { color: colors.ink }]} numberOfLines={1}>
              {ingredients.find((m) => m.id === pickId)?.name ?? 'Ingredient'}
            </Text>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Label>QTY FOR ONE</Label>
                <Input value={partQty} onChangeText={(v) => setPartQty(number(v))} keyboardType="decimal-pad" placeholder="1" />
              </View>
              <Pressable onPress={addRecipePart} style={[styles.addCart, styles.flex, { backgroundColor: colors.brand, marginTop: 18 }]}>
                <Text style={[styles.addCartText, { color: colors.onFill }]}>Add</Text>
              </Pressable>
            </View>
          </View>
        ) : null
      }
    >
      <Label>NAME</Label>
      <Input value={name} onChangeText={(v) => setName(v.slice(0, 60))} placeholder="Chicken burger (patty)" />
      <Label>TYPE</Label>
      <View style={styles.wrap}>
        {KINDS.map((option) => (
          <Chip
            key={option}
            label={ITEM_KIND_LABEL[option]}
            on={kind === option}
            onPress={() => {
              setKind(option);
              if (!existing) setUnit(option === 'direct' ? 'g' : 'pcs');
            }}
          />
        ))}
      </View>
      <Label>UNIT</Label>
      <View style={styles.wrap}>
        {(['pcs', 'g'] as MaterialUnit[]).map((option) => (
          <Chip key={option} label={option} on={unit === option} onPress={() => setUnit(option)} />
        ))}
      </View>
      {kind === 'finished' ? (
        <>
          <Label>RECIPE — TAP RAW</Label>
          <ItemIconGrid materials={ingredients} selectedId={pickId} onSelect={setPickId} />
          {recipe.map((row) => {
            const m = ingredients.find((x) => x.id === row.materialId);
            return (
              <View key={row.materialId} style={styles.row}>
                <Text style={[styles.hint, styles.flex, { color: colors.ink }]} numberOfLines={1}>
                  {row.qty} × {m?.name ?? 'Item'}
                </Text>
                <Pressable onPress={() => setRecipe((prev) => prev.filter((x) => x.materialId !== row.materialId))} hitSlop={8}>
                  <Text style={{ color: colors.expenseText, fontFamily: fonts.bold }}>✕</Text>
                </Pressable>
              </View>
            );
          })}
        </>
      ) : null}
      {existing ? (
        <Pressable onPress={remove} disabled={busy}>
          <Text style={[styles.delete, { color: colors.expenseText }]}>Delete item</Text>
        </Pressable>
      ) : null}
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Buy                                                                 */
/* ------------------------------------------------------------------ */

export function BuyForm({ visible, onClose, onDone }: { visible: boolean; onClose: () => void; onDone: Done }) {
  const { colors } = useTheme();
  const k = useKitchen();
  const { has } = useTier();
  const canSuppliers = has('suppliers');
  const { addExpense, addSupplierPayable } = useBooks();
  const [branchId, setBranchId] = useState('');
  const [pickId, setPickId] = useState('');
  const [qty, setQty] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [cart, setCart] = useState<{ materialId: string; qty: number; unitCost: number }[]>([]);
  const [pay, setPay] = useState<'cash' | 'credit' | 'stock'>('cash');
  const [supplier, setSupplier] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buyable = useMemo(
    () => k.data.materials.filter((m) => itemKind(m) !== 'finished'),
    [k.data.materials],
  );
  const branchStock = k.stockAt(branchId);
  const picked = buyable.find((m) => m.id === pickId);
  const total = cart.reduce((sum, row) => sum + row.qty * row.unitCost, 0);

  useEffect(() => {
    if (!visible) return;
    setBranchId(k.activeBranchId ?? '');
    setPickId('');
    setQty('');
    setUnitCost('');
    setCart([]);
    setPay('cash');
    setSupplier('');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, canSuppliers]);

  function selectItem(id: string) {
    const item = buyable.find((m) => m.id === id);
    setPickId(id);
    setQty('1');
    setUnitCost(item && item.avgCost > 0 ? String(item.avgCost) : '');
    setError(null);
  }

  function addToCart() {
    if (!pickId) {
      setError('Tap an item first.');
      return;
    }
    const amount = Number(qty);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter quantity.');
      return;
    }
    const cost = Number(unitCost) || 0;
    setCart((prev) => {
      const existing = prev.find((row) => row.materialId === pickId);
      if (existing) {
        return prev.map((row) =>
          row.materialId === pickId
            ? { ...row, qty: roundQty(row.qty + amount), unitCost: cost || row.unitCost }
            : row,
        );
      }
      return [...prev, { materialId: pickId, qty: amount, unitCost: cost }];
    });
    setQty('');
    setError(null);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (!cart.length) throw new Error('Add at least one item to the cart.');
      const who = supplier.trim();
      if (pay === 'credit' && !canSuppliers) throw new Error('Suppliers add-on is not on this plan.');
      if (pay === 'credit' && !who) throw new Error('Enter supplier name for credit.');
      const paid = await k.purchase(branchId, cart, who || undefined, undefined);
      if (pay === 'credit') {
        await addSupplierPayable(who, paid);
        onDone(`Bought on credit · ${formatRs(paid)}`, 'buy');
      } else if (pay === 'cash' && paid > 0) {
        await addExpense(paid, 'Stock Purchase', {
          note: who ? `Supplier: ${who}` : 'Stock purchase',
          branchId,
        });
        onDone(`Purchase saved · ${formatRs(paid)}`, 'buy');
      } else {
        onDone(`Stock added · ${formatRs(paid)}`, 'buy');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      visible={visible}
      title="Buy stock"
      subtitle="Tap item → qty below → Add → Save"
      onClose={onClose}
      actionLabel={cart.length ? `Save · ${formatRs(total)}` : 'Save purchase'}
      onAction={submit}
      busy={busy}
      error={error}
      actionDisabled={!cart.length}
      dock={
        picked ? (
          <View style={[styles.buyPanel, { borderColor: colors.hairline, backgroundColor: colors.gradientTop }]}>
            <Text style={[styles.strong, { color: colors.ink }]}>{picked.name}</Text>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Label>{`QTY (${picked.unit})`}</Label>
                <Input value={qty} onChangeText={(v) => setQty(number(v))} keyboardType="decimal-pad" placeholder="0" autoFocus />
              </View>
              <View style={styles.flex}>
                <Label>COST / UNIT</Label>
                <Input value={unitCost} onChangeText={(v) => setUnitCost(number(v))} keyboardType="decimal-pad" placeholder="0" />
              </View>
            </View>
            <Pressable onPress={addToCart} style={[styles.addCart, { backgroundColor: colors.brand }]}>
              <Text style={[styles.addCartText, { color: colors.onFill }]}>Add to cart</Text>
            </Pressable>
          </View>
        ) : null
      }
    >
      {k.visibleBranches.length > 1 ? (
        <>
          <Label>BRANCH</Label>
          <BranchChips branches={k.visibleBranches} value={branchId} onChange={setBranchId} allowAll={false} />
        </>
      ) : null}

      <Label>TAP ITEM</Label>
      <ItemIconGrid materials={buyable} selectedId={pickId} onSelect={selectItem} stock={branchStock} />

      {cart.length ? (
        <>
          <Label>CART</Label>
          {cart.map((row) => {
            const m = buyable.find((x) => x.id === row.materialId);
            return (
              <View key={row.materialId} style={styles.row}>
                <Text style={[styles.hint, styles.flex, { color: colors.ink }]} numberOfLines={1}>
                  {m?.name ?? 'Item'} · {row.qty} {m?.unit ?? ''}
                </Text>
                <Text style={[styles.strong, { color: colors.ink }]}>{formatRs(row.qty * row.unitCost)}</Text>
                <Pressable
                  onPress={() => setCart((prev) => prev.filter((x) => x.materialId !== row.materialId))}
                  hitSlop={8}
                >
                  <Text style={{ color: colors.expenseText, fontFamily: fonts.bold }}>✕</Text>
                </Pressable>
              </View>
            );
          })}
        </>
      ) : null}

      <Label>PAY</Label>
      <View style={styles.wrap}>
        <Chip label="Cash" on={pay === 'cash'} onPress={() => setPay('cash')} />
        {canSuppliers ? (
          <Chip label="Credit" on={pay === 'credit'} onPress={() => setPay('credit')} />
        ) : null}
        <Chip label="Qty only" on={pay === 'stock'} onPress={() => setPay('stock')} />
      </View>
      {pay !== 'stock' ? (
        <Input
          value={supplier}
          onChangeText={(v) => setSupplier(v.slice(0, 60))}
          placeholder={pay === 'credit' ? 'Supplier name' : 'Supplier (optional)'}
        />
      ) : null}
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Send: one screen, any mix, with the assemble preview                */
/* ------------------------------------------------------------------ */

export function SendForm({ visible, onClose, onDone }: { visible: boolean; onClose: () => void; onDone: Done }) {
  const { colors } = useTheme();
  const k = useKitchen();
  const { data } = k;
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [pickId, setPickId] = useState('');
  const [qty, setQty] = useState('');
  const [cart, setCart] = useState<{ itemId: string; qty: number }[]>([]);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [reviewOpen, setReviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    const start = data.branches.find((b) => b.isMain)?.id ?? data.branches[0]?.id ?? '';
    setFromId(start);
    setToId(data.branches.find((b) => b.id !== start)?.id ?? '');
    setPickId('');
    setQty('');
    setCart([]);
    setEdited({});
    setReviewOpen(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const stock = k.stockAt(fromId);
  const picked = data.materials.find((m) => m.id === pickId);
  const fromName = data.branches.find((b) => b.id === fromId)?.name ?? 'From';
  const toName = data.branches.find((b) => b.id === toId)?.name ?? 'Branch';
  const preview = useMemo(() => previewAssemble(cart, data.materials), [cart, data.materials]);
  const madeOf = (finishedId: string, fallback: number) => {
    const typed = edited[finishedId];
    return typed === undefined ? fallback : Math.floor(Number(typed) || 0);
  };

  function addToCart() {
    if (!pickId) {
      setError('Tap an item first.');
      return;
    }
    const amount = Number(qty);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter quantity.');
      return;
    }
    setCart((prev) => {
      const hit = prev.find((row) => row.itemId === pickId);
      if (hit) return prev.map((row) => (row.itemId === pickId ? { ...row, qty: roundQty(row.qty + amount) } : row));
      return [...prev, { itemId: pickId, qty: amount }];
    });
    setEdited({});
    setQty('');
    setError(null);
  }

  function openReview() {
    if (!toId) {
      setError('Add a second branch to send to.');
      return;
    }
    if (!cart.length) {
      setError('Add items to send.');
      return;
    }
    setError(null);
    setReviewOpen(true);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (!toId) throw new Error('Add a second branch to send to.');
      if (!cart.length) throw new Error('Add items to send.');
      const assemble = preview.map((run) => ({ itemId: run.finishedId, qty: madeOf(run.finishedId, run.qty) }));
      await k.send(fromId, toId, cart, assemble);
      const made = assemble.filter((run) => run.qty > 0).reduce((sum, run) => sum + run.qty, 0);
      setReviewOpen(false);
      onDone(`Sent to ${toName}${made ? ` · ${made} made` : ''}`, 'send');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not send.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
    <Sheet
      visible={visible}
      title="Send to branch"
      subtitle="Tap item → qty below → Add → Review"
      onClose={onClose}
      actionLabel="Review send"
      onAction={openReview}
      busy={busy}
      error={error}
      actionDisabled={!cart.length}
      dock={
        picked ? (
          <View style={[styles.buyPanel, { borderColor: colors.hairline, backgroundColor: colors.gradientTop }]}>
            <Text style={[styles.strong, { color: colors.ink }]}>{picked.name}</Text>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Label>{`QTY (${picked.unit})`}</Label>
                <Input value={qty} onChangeText={(v) => setQty(number(v))} keyboardType="decimal-pad" placeholder="0" autoFocus />
              </View>
              <Pressable onPress={addToCart} style={[styles.addCart, styles.flex, { backgroundColor: colors.brand, marginTop: 18 }]}>
                <Text style={[styles.addCartText, { color: colors.onFill }]}>Add</Text>
              </Pressable>
            </View>
          </View>
        ) : null
      }
    >
      <Label>FROM</Label>
      <BranchChips branches={data.branches} value={fromId} onChange={setFromId} allowAll={false} />
      <Label>TO</Label>
      <BranchChips branches={data.branches.filter((b) => b.id !== fromId)} value={toId} onChange={setToId} allowAll={false} />
      <Label>TAP ITEM</Label>
      <ItemIconGrid materials={data.materials} selectedId={pickId} onSelect={setPickId} stock={stock} />
      {cart.length ? (
        <>
          <Label>SENDING</Label>
          {cart.map((row) => {
            const m = data.materials.find((x) => x.id === row.itemId);
            return (
              <View key={row.itemId} style={styles.row}>
                <Text style={[styles.hint, styles.flex, { color: colors.ink }]} numberOfLines={1}>
                  {m?.name ?? 'Item'} · {row.qty} {m?.unit ?? ''}
                </Text>
                <Pressable
                  onPress={() => {
                    setCart((prev) => prev.filter((x) => x.itemId !== row.itemId));
                    setEdited({});
                  }}
                  hitSlop={8}
                >
                  <Text style={{ color: colors.expenseText, fontFamily: fonts.bold }}>✕</Text>
                </Pressable>
              </View>
            );
          })}
        </>
      ) : null}
      {preview.length ? (
        <View style={[styles.preview, { backgroundColor: colors.gradientTop }]}>
          <Label>MAKES AT BRANCH</Label>
          {preview.map((run) => (
            <View key={run.finishedId} style={styles.previewRun}>
              <View style={styles.previewLine}>
                <Input
                  value={edited[run.finishedId] ?? String(run.qty)}
                  onChangeText={(v) => setEdited((all) => ({ ...all, [run.finishedId]: v.replace(/\D/g, '').slice(0, 6) }))}
                  keyboardType="number-pad"
                  style={styles.previewInput}
                />
                <Text style={[styles.previewText, styles.flex, { color: colors.ink }]} numberOfLines={2}>
                  {run.name}
                </Text>
              </View>
              {run.short.map((s) => (
                <Text key={s.itemId} style={[styles.hint, { color: colors.expenseText }]}>
                  {roundQty(s.qty)} {s.name} short
                </Text>
              ))}
            </View>
          ))}
        </View>
      ) : null}
    </Sheet>

    <Modal visible={reviewOpen} transparent animationType="fade" onRequestClose={() => setReviewOpen(false)}>
      <View style={styles.reviewBackdrop}>
        <View style={[styles.reviewCard, { backgroundColor: colors.white }]}>
          <Text style={[styles.reviewTitle, { color: colors.ink }]}>Verify send</Text>
          <Text style={[styles.hint, { color: colors.muted }]}>
            {fromName} → {toName}
          </Text>
          <Label>ITEMS</Label>
          {cart.map((row) => {
            const m = data.materials.find((x) => x.id === row.itemId);
            return (
              <View key={row.itemId} style={styles.row}>
                <Text style={[styles.hint, styles.flex, { color: colors.ink }]} numberOfLines={1}>
                  {m?.name ?? 'Item'}
                </Text>
                <Text style={[styles.strong, { color: colors.ink }]}>
                  {row.qty} {m?.unit ?? ''}
                </Text>
              </View>
            );
          })}
          {preview.length ? (
            <View style={[styles.preview, { backgroundColor: colors.gradientTop }]}>
              <Label>{`MAKES AT ${toName.toUpperCase()}`}</Label>
              {preview.map((run) => (
                <View key={run.finishedId} style={styles.previewRun}>
                  <Text style={[styles.hint, { color: colors.ink }]}>
                    {madeOf(run.finishedId, run.qty)} × {run.name}
                  </Text>
                  {run.short.map((s) => (
                    <Text key={s.itemId} style={[styles.hint, { color: colors.expenseText }]}>
                      {roundQty(s.qty)} {s.name} short
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          ) : null}
          {preview.some((run) => run.short.length > 0) ? (
            <Text style={[styles.hint, { color: colors.expenseText }]}>
              Short on ingredients — send may fail or make fewer. Edit if needed.
            </Text>
          ) : null}
          {error ? <Text style={[styles.hint, { color: colors.expenseText }]}>{error}</Text> : null}
          <View style={styles.reviewActions}>
            <Pressable
              onPress={() => setReviewOpen(false)}
              disabled={busy}
              style={[styles.reviewBtn, { borderColor: colors.hairline }]}
            >
              <Text style={[styles.addCartText, { color: colors.ink }]}>Edit</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                void submit();
              }}
              disabled={busy}
              style={[styles.reviewBtn, styles.flex, { backgroundColor: colors.brand, borderColor: colors.brand }]}
            >
              <Text style={[styles.addCartText, { color: colors.onFill }]}>{busy ? 'Sending…' : 'Send now ✈️'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Make: production at any branch                                      */
/* ------------------------------------------------------------------ */

export function MakeForm({ visible, onClose, onDone }: { visible: boolean; onClose: () => void; onDone: Done }) {
  const { colors } = useTheme();
  const k = useKitchen();
  const { data } = k;
  const [branchId, setBranchId] = useState('');
  const [finishedId, setFinishedId] = useState('');
  const [qty, setQty] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setBranchId(k.activeBranchId ?? '');
    setFinishedId('');
    setQty('');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const finished = data.materials.filter((m) => itemKind(m) === 'finished' && m.inputs?.length);
  const picked = finished.find((m) => m.id === finishedId);
  const count = Number(qty) || 0;
  const needs = finishedId && count > 0 ? makeNeeds(data.stock, data.materials, branchId, finishedId, count) : [];

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (!finishedId) throw new Error('Tap a food first.');
      if (count <= 0) throw new Error('Enter how many.');
      await k.make(branchId, finishedId, count);
      onDone(`Made ${count} ${picked?.name ?? ''}`, 'make');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      visible={visible}
      title="Make food"
      subtitle="Cuts ingredients · adds ready food to fridge"
      onClose={onClose}
      actionLabel="Confirm"
      onAction={submit}
      busy={busy}
      error={error}
      actionDisabled={!finishedId || count <= 0}
      dock={
        picked ? (
          <View style={[styles.buyPanel, { borderColor: colors.hairline, backgroundColor: colors.gradientTop }]}>
            <Text style={[styles.strong, { color: colors.ink }]}>{picked.name}</Text>
            <Label>HOW MANY</Label>
            <Input
              value={qty}
              onChangeText={(v) => setQty(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              placeholder="0"
              autoFocus
            />
          </View>
        ) : null
      }
    >
      {k.visibleBranches.length > 1 ? (
        <>
          <Label>BRANCH</Label>
          <BranchChips branches={k.visibleBranches} value={branchId} onChange={setBranchId} allowAll={false} />
        </>
      ) : null}
      <Label>TAP FOOD</Label>
      <ItemIconGrid materials={finished} selectedId={finishedId} onSelect={setFinishedId} stock={k.stockAt(branchId)} />
      {needs.length ? (
        <View style={[styles.preview, { backgroundColor: colors.gradientTop }]}>
          <Label>USES</Label>
          {needs.map((row) => (
            <View key={row.itemId} style={styles.row}>
              <Text style={[styles.hint, styles.flex, { color: colors.ink }]} numberOfLines={1}>
                {row.name}
              </Text>
              <Text style={[styles.strong, { color: row.need > row.have ? colors.expenseText : colors.ink }]}>
                Need {row.need} · Have {row.have}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Day-end count                                                       */
/* ------------------------------------------------------------------ */

export function CountForm({ visible, onClose, onDone }: { visible: boolean; onClose: () => void; onDone: Done }) {
  const { colors } = useTheme();
  const k = useKitchen();
  const { data } = k;
  const [branchId, setBranchId] = useState('');
  const [pickId, setPickId] = useState('');
  const [qty, setQty] = useState('');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setBranchId(k.activeBranchId ?? '');
    setPickId('');
    setQty('');
    setCounts({});
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const items = data.materials.filter((m) => itemKind(m) !== 'raw');
  const stock = k.stockAt(branchId);
  const picked = items.find((m) => m.id === pickId);
  const countedIds = Object.keys(counts);

  function selectItem(id: string) {
    setPickId(id);
    setQty(counts[id] !== undefined ? String(counts[id]) : '');
    setError(null);
  }

  function addCount() {
    if (!pickId) {
      setError('Tap an item first.');
      return;
    }
    if (qty.trim() === '' || !Number.isFinite(Number(qty))) {
      setError('Enter counted qty.');
      return;
    }
    setCounts((prev) => ({ ...prev, [pickId]: Number(qty) }));
    setQty('');
    setError(null);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (!countedIds.length) throw new Error('Count at least one item.');
      await k.stockCount(branchId, counts);
      onDone(`Count saved · ${countedIds.length} item(s)`, 'count');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      visible={visible}
      title="Day-end count"
      subtitle="Tap item → enter qty below → Add"
      onClose={onClose}
      actionLabel="Save count"
      onAction={submit}
      busy={busy}
      error={error}
      actionDisabled={!countedIds.length}
      dock={
        picked ? (
          <View style={[styles.buyPanel, { borderColor: colors.hairline, backgroundColor: colors.gradientTop }]}>
            <Text style={[styles.strong, { color: colors.ink }]}>{picked.name}</Text>
            <Text style={[styles.hint, { color: colors.muted }]}>System shows {formatQty(stock[picked.id] ?? 0, picked.unit)}</Text>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Label>{`COUNTED (${picked.unit})`}</Label>
                <Input value={qty} onChangeText={(v) => setQty(number(v))} keyboardType="decimal-pad" placeholder="0" autoFocus />
              </View>
              <Pressable onPress={addCount} style={[styles.addCart, styles.flex, { backgroundColor: colors.brand, marginTop: 18 }]}>
                <Text style={[styles.addCartText, { color: colors.onFill }]}>Add</Text>
              </Pressable>
            </View>
          </View>
        ) : null
      }
    >
      {k.visibleBranches.length > 1 ? (
        <>
          <Label>BRANCH</Label>
          <BranchChips branches={k.visibleBranches} value={branchId} onChange={setBranchId} allowAll={false} />
        </>
      ) : null}
      <Label>TAP ITEM</Label>
      {items.length === 0 ? (
        <Text style={[styles.hint, { color: colors.muted }]}>No ready / by-weight items yet.</Text>
      ) : (
        <ItemIconGrid materials={items} selectedId={pickId} onSelect={selectItem} stock={stock} />
      )}
      {countedIds.length ? (
        <>
          <Label>COUNTED</Label>
          {countedIds.map((id) => {
            const item = items.find((m) => m.id === id);
            if (!item) return null;
            const diff = roundQty(counts[id] - (stock[id] ?? 0));
            const value = roundMoney(diff * (data.stock[stockRowId(branchId, id)]?.avgCost ?? 0));
            return (
              <View key={id} style={styles.row}>
                <View style={styles.flex}>
                  <Text style={[styles.hint, { color: colors.ink }]} numberOfLines={1}>
                    {item.name} · {counts[id]} {item.unit}
                  </Text>
                  {diff !== 0 ? (
                    <Text style={[styles.hint, { color: diff < 0 ? colors.expenseText : colors.saleText }]}>
                      {diff < 0 ? 'Loss' : 'Gain'} {formatQty(Math.abs(diff), item.unit)} · {formatRs(Math.abs(value))}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  onPress={() => {
                    setCounts((prev) => {
                      const next = { ...prev };
                      delete next[id];
                      return next;
                    });
                    if (pickId === id) setQty('');
                  }}
                  hitSlop={8}
                >
                  <Text style={{ color: colors.expenseText, fontFamily: fonts.bold }}>✕</Text>
                </Pressable>
              </View>
            );
          })}
        </>
      ) : null}
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Wastage                                                             */
/* ------------------------------------------------------------------ */

export function WasteForm({ visible, onClose, onDone }: { visible: boolean; onClose: () => void; onDone: Done }) {
  const { colors } = useTheme();
  const k = useKitchen();
  const [branchId, setBranchId] = useState('');
  const [pickId, setPickId] = useState('');
  const [qty, setQty] = useState('');
  const [cart, setCart] = useState<{ materialId: string; qty: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setBranchId(k.activeBranchId ?? '');
    setPickId('');
    setQty('');
    setCart([]);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const stock = k.stockAt(branchId);
  const picked = k.data.materials.find((m) => m.id === pickId);

  function addToCart() {
    if (!pickId) {
      setError('Tap an item first.');
      return;
    }
    const amount = Number(qty);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter quantity.');
      return;
    }
    setCart((prev) => {
      const hit = prev.find((row) => row.materialId === pickId);
      if (hit) return prev.map((row) => (row.materialId === pickId ? { ...row, qty: roundQty(row.qty + amount) } : row));
      return [...prev, { materialId: pickId, qty: amount }];
    });
    setQty('');
    setError(null);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (!cart.length) throw new Error('Add items first.');
      await k.wastage(branchId, cart);
      onDone('Wastage recorded', 'waste');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      visible={visible}
      title="Wastage"
      subtitle="Tap item → qty below → Add"
      onClose={onClose}
      actionLabel="Save wastage"
      onAction={submit}
      busy={busy}
      error={error}
      actionDisabled={!cart.length}
      dock={
        picked ? (
          <View style={[styles.buyPanel, { borderColor: colors.hairline, backgroundColor: colors.gradientTop }]}>
            <Text style={[styles.strong, { color: colors.ink }]}>{picked.name}</Text>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Label>{`QTY (${picked.unit})`}</Label>
                <Input value={qty} onChangeText={(v) => setQty(number(v))} keyboardType="decimal-pad" placeholder="0" autoFocus />
              </View>
              <Pressable onPress={addToCart} style={[styles.addCart, styles.flex, { backgroundColor: colors.brand, marginTop: 18 }]}>
                <Text style={[styles.addCartText, { color: colors.onFill }]}>Add</Text>
              </Pressable>
            </View>
          </View>
        ) : null
      }
    >
      {k.visibleBranches.length > 1 ? (
        <>
          <Label>BRANCH</Label>
          <BranchChips branches={k.visibleBranches} value={branchId} onChange={setBranchId} allowAll={false} />
        </>
      ) : null}
      <Label>TAP ITEM</Label>
      <ItemIconGrid materials={k.data.materials} selectedId={pickId} onSelect={setPickId} stock={stock} />
      {cart.length ? (
        <>
          <Label>WASTED</Label>
          {cart.map((row) => {
            const m = k.data.materials.find((x) => x.id === row.materialId);
            return (
              <View key={row.materialId} style={styles.row}>
                <Text style={[styles.hint, styles.flex, { color: colors.ink }]} numberOfLines={1}>
                  {m?.name ?? 'Item'} · {row.qty} {m?.unit ?? ''}
                </Text>
                <Pressable onPress={() => setCart((prev) => prev.filter((x) => x.materialId !== row.materialId))} hitSlop={8}>
                  <Text style={{ color: colors.expenseText, fontFamily: fonts.bold }}>✕</Text>
                </Pressable>
              </View>
            );
          })}
        </>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hint: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17 },
  strong: { fontFamily: fonts.semibold, fontSize: 13 },
  delete: { fontFamily: fonts.semibold, fontSize: 14, textAlign: 'center', paddingVertical: 10 },
  preview: { borderRadius: 12, padding: 12, gap: 10 },
  previewRun: { gap: 4 },
  previewLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewText: { fontFamily: fonts.semibold, fontSize: 14 },
  previewInput: { width: 70, textAlign: 'center' },
  buyPanel: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 8 },
  addCart: { minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  addCartText: { fontFamily: fonts.semibold, fontSize: 15 },
  reviewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center',
    padding: 20,
  },
  reviewCard: { borderRadius: 20, padding: 16, gap: 10 },
  reviewTitle: { fontFamily: fonts.bold, fontSize: 18 },
  reviewActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  reviewBtn: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
});
