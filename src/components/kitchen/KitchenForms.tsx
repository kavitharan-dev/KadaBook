import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useBooks } from '../../context/BooksContext';
import { itemCosting, useKitchen } from '../../context/KitchenContext';
import { useTheme } from '../../context/ThemeContext';
import { MATERIAL_UNITS, type MaterialUnit, type RawMaterial } from '../../data/kitchenTypes';
import type { Product } from '../../data/types';
import { formatQty, readyMaterialFor, recipeFor, stockLevels } from '../../lib/kitchenOps';
import { formatRs } from '../../lib/format';
import { fonts } from '../../theme/fonts';
import { BranchChips, Chip, Input, Label, LinesEditor, Sheet, newLine, parsedLines, type EditLine } from './KitchenUi';

const toLines = (rows?: { materialId: string; qty: number }[]): EditLine[] =>
  rows?.length ? rows.map((r) => ({ ...newLine(), materialId: r.materialId, qty: String(r.qty) })) : [newLine()];

/* ------------------------------------------------------------------ */
/* Material                                                            */
/* ------------------------------------------------------------------ */

export function MaterialForm({ material, visible, onClose, onDone }: {
  material: RawMaterial | null;
  visible: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const { colors } = useTheme();
  const { data, saveMaterial, deleteMaterial } = useKitchen();
  const [name, setName] = useState('');
  const [unit, setUnit] = useState<MaterialUnit>('pcs');
  const [category, setCategory] = useState('');
  const [cost, setCost] = useState('');
  const [reorder, setReorder] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isReadyLinked = !!material?.productId;

  useEffect(() => {
    if (!visible) return;
    setName(material?.name ?? '');
    setUnit(material?.unit ?? 'pcs');
    setCategory(material?.category ?? '');
    setCost(material ? String(material.avgCost) : '');
    setReorder(material ? String(material.reorderLevel) : '');
    setError(null);
  }, [visible, material]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      if (isReadyLinked) throw new Error('Edit this food’s recipe under Recipes — not here.');
      await saveMaterial(material?.id ?? null, {
        name,
        unit,
        avgCost: Number(cost) || 0,
        reorderLevel: Number(reorder) || 0,
        category: category.trim() || undefined,
        inputs: [],
      });
      onDone(material ? `${name.trim()} updated` : `${name.trim()} added`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!material) return;
    try {
      await deleteMaterial(material.id);
      onDone(`${material.name} deleted`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not delete.');
    }
  }

  return (
    <Sheet
      visible={visible}
      title={material ? 'Edit raw material' : 'New raw material'}
      subtitle="Buy items only — buns, patties, cheese, sauces… Food recipes are under Recipes."
      onClose={onClose}
      actionLabel="Save material"
      onAction={save}
      busy={busy}
      error={error}
      actionDisabled={isReadyLinked}
    >
      <Label>NAME</Label>
      <Input value={name} onChangeText={(v) => setName(v.slice(0, 60))} placeholder="e.g. Burger bun" editable={!isReadyLinked} />
      <Label>CATEGORY (OPTIONAL)</Label>
      <Input value={category} onChangeText={(v) => setCategory(v.slice(0, 40))} placeholder="e.g. Meat & Protein" editable={!isReadyLinked} />
      <Label>UNIT</Label>
      <View style={styles.wrap}>
        {MATERIAL_UNITS.map((u) => (
          <Chip key={u} label={u} on={unit === u} onPress={() => !isReadyLinked && setUnit(u)} />
        ))}
      </View>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Label>{`COST PER ${unit.toUpperCase()} (RS)`}</Label>
          <Input value={cost} onChangeText={(v) => setCost(v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" placeholder="0" editable={!isReadyLinked} />
        </View>
        <View style={styles.flex}>
          <Label>REORDER BELOW</Label>
          <Input value={reorder} onChangeText={(v) => setReorder(v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" placeholder="0" editable={!isReadyLinked} />
        </View>
      </View>
      <Text style={[styles.hint, { color: colors.muted }]}>
        Enter price when you Purchase. Average cost updates after each buy.
      </Text>
      {isReadyLinked ? (
        <Text style={[styles.hint, { color: colors.brand }]}>
          This is kitchen-ready stock for a food item. Change the formula under Recipes.
        </Text>
      ) : null}
      {material && !isReadyLinked ? (
        <Pressable onPress={remove} style={styles.danger}>
          <Text style={[styles.dangerText, { color: colors.expenseText }]}>Delete material</Text>
        </Pressable>
      ) : null}
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Recipe for a menu item                                              */
/* ------------------------------------------------------------------ */

export function RecipeForm({ product, visible, onClose, onDone }: {
  product: Product | null;
  visible: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const { colors } = useTheme();
  const { data, saveRecipe, deleteRecipe } = useKitchen();
  const existing = product ? data.recipes.find((r) => r.productId === product.id) : undefined;
  const [lines, setLines] = useState<EditLine[]>([newLine()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setLines(toLines(existing?.lines));
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, product?.id]);

  if (!product) return null;
  const rows = parsedLines(lines).map(({ materialId, qty }) => ({ materialId, qty }));
  const costing = itemCosting(product.sellingPrice, rows, data);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await saveRecipe(product!.id, rows);
      onDone(`Recipe saved · cost ${formatRs(costing.cost)} per ${product!.name}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      visible={visible}
      title={`Recipe · ${product.name}`}
      subtitle="Materials used to make ONE of this item"
      onClose={onClose}
      actionLabel="Save recipe"
      onAction={save}
      busy={busy}
      error={error}
    >
      <LinesEditor lines={lines} onChange={setLines} materials={data.materials.filter((m) => !m.productId)} />
      <View style={[styles.costCard, { backgroundColor: colors.gradientTop }]}>
        <CostRow label="Selling price" value={formatRs(product.sellingPrice)} />
        <CostRow label="Material cost" value={formatRs(costing.cost)} />
        {rows.map((r) => {
          const m = data.materials.find((x) => x.id === r.materialId);
          return m ? (
            <CostRow key={r.materialId} small label={`  ${m.name} × ${formatQty(r.qty, m.unit)}`} value={formatRs(m.avgCost * r.qty)} />
          ) : null;
        })}
        <CostRow
          strong
          label="Margin"
          value={`${formatRs(costing.margin)} (${costing.marginPercent}%)`}
          tone={costing.margin >= 0 ? colors.saleText : colors.expenseText}
        />
      </View>
      <Text style={[styles.hint, { color: colors.muted }]}>
        After save: Produce this food, then Transfer to Foods so it appears for the cashier.
      </Text>
      {existing ? (
        <Pressable
          onPress={async () => {
            await deleteRecipe(product.id);
            onDone('Recipe removed');
          }}
          style={styles.danger}
        >
          <Text style={[styles.dangerText, { color: colors.expenseText }]}>Remove recipe</Text>
        </Pressable>
      ) : null}
    </Sheet>
  );
}

function CostRow({ label, value, strong, small, tone }: { label: string; value: string; strong?: boolean; small?: boolean; tone?: string }) {
  const { colors } = useTheme();
  const font = strong ? fonts.bold : fonts.regular;
  const size = small ? 12 : strong ? 15 : 13;
  return (
    <View style={styles.costRow}>
      <Text style={{ fontFamily: font, fontSize: size, color: tone ?? (small ? colors.muted : colors.ink), flex: 1 }} numberOfLines={1}>
        {label}
      </Text>
      <Text style={{ fontFamily: font, fontSize: size, color: tone ?? colors.ink }}>{value}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Stock movements                                                     */
/* ------------------------------------------------------------------ */

export type MoveKind = 'purchase' | 'transfer' | 'produce' | 'toFoods' | 'wastage' | 'count';

const MOVE_COPY: Record<MoveKind, { title: string; sub: string; action: string }> = {
  purchase: { title: 'Stock in (Purchase)', sub: 'Raw materials bought — qty + price', action: 'Save purchase' },
  transfer: { title: 'Branch transfer', sub: 'Send raw materials to another branch', action: 'Send stock' },
  produce: { title: 'Produce', sub: 'Make food from a saved recipe (kitchen-ready)', action: 'Save production' },
  toFoods: { title: 'Transfer to Foods', sub: 'Send kitchen-ready food to Products for the cashier', action: 'Send to Foods' },
  wastage: { title: 'Wastage', sub: 'Spoiled, dropped or expired stock', action: 'Record wastage' },
  count: { title: 'Stock count', sub: 'What is physically on the shelf now', action: 'Save count' },
};

export function MoveForm({
  kind,
  onClose,
  onDone,
  prefillProductId,
}: {
  kind: MoveKind | null;
  onClose: () => void;
  onDone: (message: string) => void;
  /** When Produce / To Foods is opened from a recipe row. */
  prefillProductId?: string | null;
}) {
  const { colors } = useTheme();
  const k = useKitchen();
  const { books, addExpense, addSupplierPayable } = useBooks();
  const { data } = k;
  const [branchId, setBranchId] = useState<string>('');
  const [toId, setToId] = useState<string>('');
  const [lines, setLines] = useState<EditLine[]>([newLine()]);
  const [productId, setProductId] = useState('');
  const [outputQty, setOutputQty] = useState('');
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [supplier, setSupplier] = useState('');
  const [note, setNote] = useState('');
  const [asExpense, setAsExpense] = useState(true);
  const [onCredit, setOnCredit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!kind) return;
    const start = k.activeBranchId ?? data.branches[0]?.id ?? '';
    setBranchId(start);
    setToId(data.branches.find((b) => b.id !== start)?.id ?? '');
    setLines([newLine()]);
    setProductId(prefillProductId ?? '');
    setOutputQty('');
    setCounts({});
    setSupplier('');
    setNote('');
    setAsExpense(true);
    setOnCredit(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, prefillProductId]);

  if (!kind) return null;
  const copy = MOVE_COPY[kind];
  const stock = stockLevels(data, branchId || 'all');
  const rows = parsedLines(lines);
  const recipeProducts = books.products.filter((p) => recipeFor(p.id, data.recipes));
  const readyProducts = books.products.filter((p) => {
    const ready = readyMaterialFor(p.id, data.materials);
    return ready && (stock[ready.id] ?? 0) > 0;
  });
  const selectedProduct = books.products.find((p) => p.id === productId);
  const selectedRecipe = recipeFor(productId, data.recipes);
  const selectedReady = readyMaterialFor(productId, data.materials);
  const rawMaterials = data.materials.filter((m) => !m.productId);
  const purchaseTotal = rows.reduce((sum, r) => sum + r.qty * r.unitCost, 0);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (!branchId) throw new Error('Create a branch first.');
      let message = '';
      if (kind === 'purchase') {
        const expiry = Object.fromEntries(
          rows.filter((r) => r.expiry).map((r) => [r.materialId, r.expiry as string]),
        );
        const purchaseLines = rows.map(({ materialId, qty, unitCost }) => ({ materialId, qty, unitCost }));
        const total = await k.purchase(branchId, purchaseLines, supplier, note, expiry);
        const who = supplier.trim();
        if (onCredit) {
          if (!who) throw new Error('Enter a supplier name for credit purchases.');
          if (total <= 0) throw new Error('Enter purchase items with cost.');
          await addSupplierPayable(who, total);
          message = `Purchase on credit · ${formatRs(total)} owed to ${who}`;
        } else if (asExpense && total > 0) {
          await addExpense(total, 'Stock Purchase', {
            note: [who ? `Supplier: ${who}` : null, note.trim() || null].filter(Boolean).join(' · ') || 'Kitchen purchase',
            branchId,
          });
          message = `Purchase + expense saved · ${formatRs(total)}`;
        } else {
          message = `Purchase saved · ${formatRs(total)}`;
        }
      } else if (kind === 'transfer') {
        if (!toId) throw new Error('Add a second branch to transfer to.');
        await k.transfer(branchId, toId, rows, note);
        message = `Sent to ${data.branches.find((b) => b.id === toId)?.name ?? 'branch'}`;
      } else if (kind === 'produce') {
        if (!productId) throw new Error('Choose which food you made.');
        await k.produceFromRecipe(branchId, productId, Number(outputQty), note);
        message = `Made ${outputQty} × ${selectedProduct?.name ?? 'food'} (kitchen-ready)`;
      } else if (kind === 'toFoods') {
        if (!productId) throw new Error('Choose which food to send.');
        await k.transferToFoods(branchId, productId, Number(outputQty), note);
        message = `Sent ${outputQty} × ${selectedProduct?.name ?? 'food'} to Foods / cashier`;
      } else if (kind === 'wastage') {
        await k.wastage(branchId, rows, note);
        message = 'Wastage recorded';
      } else {
        const counted = Object.fromEntries(
          Object.entries(counts).filter(([, v]) => v.trim() !== '').map(([id, v]) => [id, Number(v)]),
        );
        await k.stockCount(branchId, counted, note);
        message = `Stock count saved · ${Object.keys(counted).length} item(s)`;
      }
      onDone(message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible title={copy.title} subtitle={copy.sub} onClose={onClose} actionLabel={copy.action} onAction={submit} busy={busy} error={error}>
      <Label>{kind === 'transfer' ? 'FROM BRANCH' : 'BRANCH'}</Label>
      <BranchChips branches={k.visibleBranches} value={branchId} onChange={(v) => setBranchId(v)} allowAll={false} />
      {kind === 'transfer' ? (
        <>
          <Label>TO BRANCH</Label>
          <BranchChips branches={data.branches.filter((b) => b.id !== branchId)} value={toId} onChange={(v) => setToId(v)} allowAll={false} />
        </>
      ) : null}

      {kind === 'produce' ? (
        <>
          <Label>RECIPE / FOOD</Label>
          {recipeProducts.length === 0 ? (
            <Text style={[styles.hint, { color: colors.muted }]}>
              No recipes yet. Open the Recipes tab, tap a food (e.g. Burger), and save Bun + Patty + Cheese first.
            </Text>
          ) : (
            <View style={styles.chipWrap}>
              {recipeProducts.map((p) => (
                <Chip key={p.id} label={p.name} on={productId === p.id} onPress={() => setProductId(p.id)} />
              ))}
            </View>
          )}
          <Input
            value={outputQty}
            onChangeText={(v) => setOutputQty(v.replace(/[^\d.]/g, ''))}
            keyboardType="decimal-pad"
            placeholder="How many pcs did you make?"
          />
          {selectedRecipe?.lines.length && Number(outputQty) > 0 ? (
            <View style={[styles.costCard, { backgroundColor: colors.gradientTop }]}>
              <Text style={[styles.hint, { color: colors.muted }]}>This will use:</Text>
              {selectedRecipe.lines.map((part) => {
                const m = data.materials.find((x) => x.id === part.materialId);
                if (!m) return null;
                const needQty = part.qty * Number(outputQty);
                const short = needQty > (stock[m.id] ?? 0);
                return (
                  <CostRow
                    key={part.materialId}
                    small
                    label={`${m.name}`}
                    value={`${formatQty(needQty, m.unit)}${short ? '  ⚠ short' : ''}`}
                    tone={short ? colors.expenseText : undefined}
                  />
                );
              })}
            </View>
          ) : null}
        </>
      ) : null}

      {kind === 'toFoods' ? (
        <>
          <Label>KITCHEN-READY FOOD</Label>
          {readyProducts.length === 0 && recipeProducts.length === 0 ? (
            <Text style={[styles.hint, { color: colors.muted }]}>
              Save a recipe, Produce it, then transfer here so cashier Foods stock goes up.
            </Text>
          ) : (
            <View style={styles.chipWrap}>
              {(readyProducts.length ? readyProducts : recipeProducts).map((p) => {
                const ready = readyMaterialFor(p.id, data.materials);
                const q = ready ? stock[ready.id] ?? 0 : 0;
                return (
                  <Chip
                    key={p.id}
                    label={`${p.name}${ready ? ` · ${formatQty(q, ready.unit)}` : ''}`}
                    on={productId === p.id}
                    onPress={() => setProductId(p.id)}
                  />
                );
              })}
            </View>
          )}
          {selectedReady ? (
            <Text style={[styles.hint, { color: colors.ink }]}>
              Ready in kitchen: {formatQty(stock[selectedReady.id] ?? 0, selectedReady.unit)} · On Foods now:{' '}
              {selectedProduct?.stock ?? 0} {selectedProduct?.unit ?? 'pcs'}
            </Text>
          ) : null}
          <Input
            value={outputQty}
            onChangeText={(v) => setOutputQty(v.replace(/[^\d.]/g, ''))}
            keyboardType="decimal-pad"
            placeholder="How many to send to cashier?"
          />
        </>
      ) : null}

      {kind === 'purchase' || kind === 'transfer' || kind === 'wastage' ? (
        <>
          <Label>ITEMS</Label>
          <LinesEditor
            lines={lines}
            onChange={setLines}
            materials={kind === 'purchase' ? rawMaterials : data.materials}
            withCost={kind === 'purchase'}
            withExpiry={kind === 'purchase'}
            stock={kind === 'purchase' ? undefined : stock}
          />
        </>
      ) : null}
      {kind === 'purchase' ? (
        <>
          <Text style={[styles.total, { color: colors.ink }]}>Total {formatRs(purchaseTotal)}</Text>
          <Input value={supplier} onChangeText={(v) => setSupplier(v.slice(0, 60))} placeholder="Supplier name" />
          {books.suppliers.length > 0 ? (
            <View style={styles.chipWrap}>
              {books.suppliers.slice(0, 8).map((s) => (
                <Chip key={s.id} label={s.name} on={supplier.trim().toLowerCase() === s.name.toLowerCase()} onPress={() => setSupplier(s.name)} />
              ))}
            </View>
          ) : null}
          <Pressable
            onPress={() => {
              setOnCredit((v) => !v);
              if (!onCredit) setAsExpense(false);
            }}
            style={[styles.toggle, { borderColor: onCredit ? colors.brand : colors.line }]}
          >
            <Text style={[styles.toggleBox, { color: colors.brand }]}>{onCredit ? '☑' : '☐'}</Text>
            <View style={styles.flex}>
              <Text style={[styles.toggleTitle, { color: colors.ink }]}>Buy on credit (payable)</Text>
              <Text style={[styles.hint, { color: colors.muted }]}>
                Adds the total to this supplier’s unpaid balance instead of posting an expense now.
              </Text>
            </View>
          </Pressable>
          {!onCredit ? (
            <Pressable onPress={() => setAsExpense((v) => !v)} style={[styles.toggle, { borderColor: asExpense ? colors.brand : colors.line }]}>
              <Text style={[styles.toggleBox, { color: colors.brand }]}>{asExpense ? '☑' : '☐'}</Text>
              <View style={styles.flex}>
                <Text style={[styles.toggleTitle, { color: colors.ink }]}>Also save as expense</Text>
                <Text style={[styles.hint, { color: colors.muted }]}>
                  Posts the same total under Expenses → Stock Purchase, so profit reports stay correct.
                </Text>
              </View>
            </Pressable>
          ) : null}
        </>
      ) : null}

      {kind === 'count' ? (
        <>
          <Text style={[styles.hint, { color: colors.muted }]}>
            Enter what you counted. Leave blank to skip an item. The difference is saved as an adjustment and shows in the variance report.
          </Text>
          {rawMaterials.map((m) => {
            const book = stock[m.id] ?? 0;
            const typed = counts[m.id];
            const diff = typed !== undefined && typed.trim() !== '' ? Number(typed) - book : null;
            return (
              <View key={m.id} style={[styles.countRow, { borderBottomColor: colors.hairline }]}>
                <View style={styles.flex}>
                  <Text style={[styles.toggleTitle, { color: colors.ink }]} numberOfLines={1}>{m.name}</Text>
                  <Text style={[styles.hint, { color: diff ? (diff < 0 ? colors.expenseText : colors.saleText) : colors.muted }]}>
                    Book {formatQty(book, m.unit)}
                    {diff ? ` · ${diff > 0 ? '+' : ''}${formatQty(diff, m.unit)}` : ''}
                  </Text>
                </View>
                <Input
                  value={typed ?? ''}
                  onChangeText={(v) => setCounts((c) => ({ ...c, [m.id]: v.replace(/[^\d.]/g, '') }))}
                  keyboardType="decimal-pad"
                  placeholder="Counted"
                  style={styles.countInput}
                />
              </View>
            );
          })}
        </>
      ) : null}

      <Input value={note} onChangeText={(v) => setNote(v.slice(0, 120))} placeholder="Note (optional)" />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  hint: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17 },
  toggle: { flexDirection: 'row', gap: 10, borderWidth: 1.5, borderRadius: 14, padding: 12, alignItems: 'flex-start' },
  toggleBox: { fontSize: 20, lineHeight: 22 },
  toggleTitle: { fontFamily: fonts.semibold, fontSize: 14 },
  danger: { alignItems: 'center', paddingVertical: 8 },
  dangerText: { fontFamily: fonts.semibold, fontSize: 13 },
  costCard: { borderRadius: 14, padding: 12, gap: 4 },
  costRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  total: { fontFamily: fonts.bold, fontSize: 16, textAlign: 'right' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  countInput: { width: 110 },
});
