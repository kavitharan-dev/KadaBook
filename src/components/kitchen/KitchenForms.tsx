import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { itemCosting, useKitchen } from '../../context/KitchenContext';
import { useTheme } from '../../context/ThemeContext';
import { MATERIAL_UNITS, type MaterialUnit, type RawMaterial } from '../../data/kitchenTypes';
import type { Product } from '../../data/types';
import { formatQty, linesCost, stockLevels } from '../../lib/kitchenOps';
import { formatRs } from '../../lib/format';
import { fonts } from '../../theme/fonts';
import { BranchChips, Chip, Input, Label, LinesEditor, MaterialSelect, Sheet, newLine, parsedLines, type EditLine } from './KitchenUi';

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
  const [cost, setCost] = useState('');
  const [reorder, setReorder] = useState('');
  const [prepared, setPrepared] = useState(false);
  const [inputs, setInputs] = useState<EditLine[]>([newLine()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName(material?.name ?? '');
    setUnit(material?.unit ?? 'pcs');
    setCost(material ? String(material.avgCost) : '');
    setReorder(material ? String(material.reorderLevel) : '');
    setPrepared(!!material?.inputs?.length);
    setInputs(toLines(material?.inputs));
    setError(null);
  }, [visible, material]);

  const others = data.materials.filter((m) => m.id !== material?.id);
  const inputRows = parsedLines(inputs).map(({ materialId, qty }) => ({ materialId, qty }));

  async function save() {
    setBusy(true);
    setError(null);
    try {
      if (prepared && !inputRows.length) throw new Error('Add what one unit is made from, or turn off "Prepared item".');
      await saveMaterial(material?.id ?? null, {
        name,
        unit,
        avgCost: Number(cost) || 0,
        reorderLevel: Number(reorder) || 0,
        inputs: prepared ? inputRows : [],
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
      title={material ? 'Edit material' : 'New raw material'}
      subtitle="Buns, patties, cheese, sauces, vegetables, packaging…"
      onClose={onClose}
      actionLabel="Save material"
      onAction={save}
      busy={busy}
      error={error}
    >
      <Label>NAME</Label>
      <Input value={name} onChangeText={(v) => setName(v.slice(0, 60))} placeholder="e.g. Burger bun" />
      <Label>UNIT</Label>
      <View style={styles.wrap}>
        {MATERIAL_UNITS.map((u) => (
          <Chip key={u} label={u} on={unit === u} onPress={() => setUnit(u)} />
        ))}
      </View>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Label>{`COST PER ${unit.toUpperCase()} (RS)`}</Label>
          <Input value={cost} onChangeText={(v) => setCost(v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" placeholder="0" />
        </View>
        <View style={styles.flex}>
          <Label>REORDER BELOW</Label>
          <Input value={reorder} onChangeText={(v) => setReorder(v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" placeholder="0" />
        </View>
      </View>
      <Text style={[styles.hint, { color: colors.muted }]}>
        The cost becomes a weighted average automatically after each purchase.
      </Text>

      <Pressable onPress={() => setPrepared((v) => !v)} style={[styles.toggle, { borderColor: prepared ? colors.brand : colors.line }]}>
        <Text style={[styles.toggleBox, { color: colors.brand }]}>{prepared ? '☑' : '☐'}</Text>
        <View style={styles.flex}>
          <Text style={[styles.toggleTitle, { color: colors.ink }]}>Prepared item</Text>
          <Text style={[styles.hint, { color: colors.muted }]}>
            Made in the kitchen from other materials (e.g. "Burger (ready)", "Sauce mix"). Use Produce to make it.
          </Text>
        </View>
      </Pressable>
      {prepared ? (
        <>
          <Label>{`ONE ${unit.toUpperCase()} IS MADE FROM`}</Label>
          <LinesEditor lines={inputs} onChange={setInputs} materials={others} />
          <Text style={[styles.hint, { color: colors.ink }]}>
            Cost to make one: {formatRs(linesCost(inputRows, data.materials))}
          </Text>
        </>
      ) : null}
      {material ? (
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
      <LinesEditor lines={lines} onChange={setLines} materials={data.materials} />
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

export type MoveKind = 'purchase' | 'transfer' | 'produce' | 'wastage' | 'count';

const MOVE_COPY: Record<MoveKind, { title: string; sub: string; action: string }> = {
  purchase: { title: 'Purchase', sub: 'Raw materials bought from a supplier', action: 'Save purchase' },
  transfer: { title: 'Transfer', sub: 'Send stock to another branch at average cost', action: 'Send stock' },
  produce: { title: 'Produce', sub: 'Make prepared items from raw materials', action: 'Save production' },
  wastage: { title: 'Wastage', sub: 'Spoiled, dropped or expired stock', action: 'Record wastage' },
  count: { title: 'Stock count', sub: 'What is physically on the shelf now', action: 'Save count' },
};

export function MoveForm({ kind, onClose, onDone }: { kind: MoveKind | null; onClose: () => void; onDone: (message: string) => void }) {
  const { colors } = useTheme();
  const k = useKitchen();
  const { data } = k;
  const [branchId, setBranchId] = useState<string>('');
  const [toId, setToId] = useState<string>('');
  const [lines, setLines] = useState<EditLine[]>([newLine()]);
  const [outputId, setOutputId] = useState('');
  const [outputQty, setOutputQty] = useState('');
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [supplier, setSupplier] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!kind) return;
    const start = k.activeBranchId ?? data.branches[0]?.id ?? '';
    setBranchId(start);
    setToId(data.branches.find((b) => b.id !== start)?.id ?? '');
    setLines([newLine()]);
    setOutputId('');
    setOutputQty('');
    setCounts({});
    setSupplier('');
    setNote('');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  if (!kind) return null;
  const copy = MOVE_COPY[kind];
  const stock = stockLevels(data, branchId || 'all');
  const rows = parsedLines(lines);
  const prepared = data.materials.filter((m) => m.inputs?.length);
  const output = data.materials.find((m) => m.id === outputId);
  const purchaseTotal = rows.reduce((sum, r) => sum + r.qty * r.unitCost, 0);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (!branchId) throw new Error('Create a branch first.');
      let message = '';
      if (kind === 'purchase') {
        await k.purchase(branchId, rows, supplier, note);
        message = `Purchase saved · ${formatRs(purchaseTotal)}`;
      } else if (kind === 'transfer') {
        if (!toId) throw new Error('Add a second branch to transfer to.');
        await k.transfer(branchId, toId, rows, note);
        message = `Sent to ${data.branches.find((b) => b.id === toId)?.name ?? 'branch'}`;
      } else if (kind === 'produce') {
        if (!outputId) throw new Error('Choose what you made.');
        await k.produce(branchId, outputId, Number(outputQty), note);
        message = `Made ${outputQty} ${output?.unit ?? ''} ${output?.name ?? ''}`;
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
      <BranchChips branches={data.branches} value={branchId} onChange={(v) => setBranchId(v)} allowAll={false} />
      {kind === 'transfer' ? (
        <>
          <Label>TO BRANCH</Label>
          <BranchChips branches={data.branches.filter((b) => b.id !== branchId)} value={toId} onChange={(v) => setToId(v)} allowAll={false} />
        </>
      ) : null}

      {kind === 'produce' ? (
        <>
          <Label>WHAT DID YOU MAKE?</Label>
          {prepared.length === 0 ? (
            <Text style={[styles.hint, { color: colors.muted }]}>
              No prepared items yet. Add a material and tick "Prepared item" (e.g. Burger (ready) made from bun + patty + cheese).
            </Text>
          ) : (
            <MaterialSelect materials={prepared} value={outputId} onChange={setOutputId} stock={stock} />
          )}
          <Input value={outputQty} onChangeText={(v) => setOutputQty(v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" placeholder={`How many${output ? ` (${output.unit})` : ''}`} />
          {output?.inputs?.length && Number(outputQty) > 0 ? (
            <View style={[styles.costCard, { backgroundColor: colors.gradientTop }]}>
              <Text style={[styles.hint, { color: colors.muted }]}>This will use:</Text>
              {output.inputs.map((part) => {
                const m = data.materials.find((x) => x.id === part.materialId);
                if (!m) return null;
                const need = part.qty * Number(outputQty);
                const short = need > (stock[m.id] ?? 0);
                return (
                  <CostRow key={part.materialId} small label={`${m.name}`} value={`${formatQty(need, m.unit)}${short ? '  ⚠ short' : ''}`} tone={short ? colors.expenseText : undefined} />
                );
              })}
            </View>
          ) : null}
        </>
      ) : null}

      {kind === 'purchase' || kind === 'transfer' || kind === 'wastage' ? (
        <>
          <Label>ITEMS</Label>
          <LinesEditor lines={lines} onChange={setLines} materials={data.materials} withCost={kind === 'purchase'} stock={kind === 'purchase' ? undefined : stock} />
        </>
      ) : null}
      {kind === 'purchase' ? (
        <>
          <Text style={[styles.total, { color: colors.ink }]}>Total {formatRs(purchaseTotal)}</Text>
          <Input value={supplier} onChangeText={(v) => setSupplier(v.slice(0, 60))} placeholder="Supplier (optional)" />
        </>
      ) : null}

      {kind === 'count' ? (
        <>
          <Text style={[styles.hint, { color: colors.muted }]}>
            Enter what you counted. Leave blank to skip an item. The difference is saved as an adjustment and shows in the variance report.
          </Text>
          {data.materials.map((m) => {
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
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  countInput: { width: 110 },
});
