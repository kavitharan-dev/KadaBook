import { useMemo, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import type { Branch, BranchScope, RawMaterial } from '../../data/kitchenTypes';
import { formatQty } from '../../lib/kitchenOps';
import { fonts } from '../../theme/fonts';
import { ErrorText, FillButton } from '../ui';

/** Centered popup used by every kitchen form. */
export function Sheet({
  visible,
  title,
  subtitle,
  onClose,
  children,
  actionLabel,
  onAction,
  busy,
  error,
  actionColor,
  actionDisabled,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  busy?: boolean;
  error?: string | null;
  actionColor?: string;
  actionDisabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.card, { backgroundColor: colors.white }]}>
          <View style={styles.head}>
            <View style={styles.flex}>
              <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
              {subtitle ? <Text style={[styles.sub, { color: colors.muted }]}>{subtitle}</Text> : null}
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={[styles.close, { backgroundColor: colors.keypad }]}>
              <Text style={{ color: colors.muted, fontFamily: fonts.bold }}>✕</Text>
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
            {children}
            <ErrorText message={error ?? null} />
          </ScrollView>
          {actionLabel && onAction ? (
            <FillButton label={actionLabel} onPress={onAction} busy={busy} color={actionColor} disabled={actionDisabled} />
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Label({ children }: { children: string }) {
  const { colors } = useTheme();
  return <Text style={[styles.label, { color: colors.muted }]}>{children}</Text>;
}

export function Input(props: React.ComponentProps<typeof TextInput> & { grow?: boolean }) {
  const { colors } = useTheme();
  const { grow, style, ...rest } = props;
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      {...rest}
      style={[styles.input, grow ? styles.flex : null, { borderColor: colors.line, color: colors.ink, backgroundColor: colors.white }, style]}
    />
  );
}

export function Chip({ label, on, onPress, tone }: { label: string; on?: boolean; onPress: () => void; tone?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.chip, { backgroundColor: on ? tone ?? colors.brand : colors.keypad }]}>
      <Text style={[styles.chipText, { color: on ? colors.onFill : colors.ink }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Branch switcher: "All branches" plus every branch. */
export function BranchChips({
  branches,
  value,
  onChange,
  allowAll = true,
  onAdd,
}: {
  branches: Branch[];
  value: BranchScope;
  onChange: (next: BranchScope) => void;
  allowAll?: boolean;
  onAdd?: () => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {allowAll ? <Chip label="All branches" on={value === 'all'} onPress={() => onChange('all')} /> : null}
      {branches.map((b) => (
        <Chip key={b.id} label={b.isMain ? `★ ${b.name}` : b.name} on={value === b.id} onPress={() => onChange(b.id)} />
      ))}
      {onAdd ? <Chip label="＋ Branch" onPress={onAdd} /> : null}
    </ScrollView>
  );
}

/** Dropdown for the one branch a staff login belongs to. */
export function BranchSelect({
  branches,
  value,
  onChange,
  allOption,
  placeholder = 'Choose a branch',
}: {
  branches: Branch[];
  value: string | undefined;
  onChange: (next: string) => void;
  /** Label for the "not tied to one branch" row and the value it sends. */
  allOption?: { label: string; value: string };
  placeholder?: string;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const options = [
    ...(allOption ? [{ id: allOption.value, label: allOption.label }] : []),
    ...branches.map((b) => ({ id: b.id, label: b.isMain ? `★ ${b.name}` : b.name })),
  ];
  const chosen = options.find((o) => o.id === value);
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen((v) => !v)}
        style={[styles.input, styles.selectRow, { borderColor: colors.line, backgroundColor: colors.white }]}
      >
        <Text style={[styles.chipText, { color: chosen ? colors.ink : colors.muted }]} numberOfLines={1}>
          {chosen?.label ?? placeholder}
        </Text>
        <Text style={{ color: colors.muted, fontFamily: fonts.bold }}>{open ? '▲' : '▼'}</Text>
      </Pressable>
      {open
        ? options.map((option) => (
            <Pressable
              key={option.id}
              onPress={() => {
                setOpen(false);
                if (option.id !== value) onChange(option.id);
              }}
              style={[styles.selectOption, { borderColor: colors.hairline, backgroundColor: option.id === value ? colors.keypad : colors.white }]}
            >
              <Text style={[styles.chipText, { color: colors.ink }]} numberOfLines={1}>{option.label}</Text>
            </Pressable>
          ))
        : null}
    </View>
  );
}

/** Tap to choose a material from a searchable list. */
export function MaterialSelect({
  materials,
  value,
  onChange,
  stock,
  exclude,
}: {
  materials: RawMaterial[];
  value: string;
  onChange: (id: string) => void;
  stock?: Record<string, number>;
  exclude?: string[];
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const chosen = materials.find((m) => m.id === value);
  const list = useMemo(
    () =>
      materials
        .filter((m) => !exclude?.includes(m.id))
        .filter((m) => !q.trim() || m.name.toLowerCase().includes(q.trim().toLowerCase())),
    [materials, q, exclude],
  );
  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={[styles.select, { borderColor: colors.line, backgroundColor: colors.white }]}>
        <Text style={[styles.selectText, { color: chosen ? colors.ink : colors.muted }]} numberOfLines={1}>
          {chosen ? chosen.name : 'Choose material'}
        </Text>
        <Text style={{ color: colors.muted }}>▾</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={[styles.card, { backgroundColor: colors.white }]}>
            <Input value={q} onChangeText={setQ} placeholder="Search materials" autoFocus />
            <ScrollView keyboardShouldPersistTaps="handled">
              {list.length === 0 ? (
                <Text style={[styles.sub, { color: colors.muted, padding: 12 }]}>No materials. Add one on the Stock tab.</Text>
              ) : null}
              {list.map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => {
                    onChange(m.id);
                    setOpen(false);
                    setQ('');
                  }}
                  style={[styles.option, { borderBottomColor: colors.hairline }]}
                >
                  <Text style={[styles.optionName, { color: colors.ink }]}>{m.name}</Text>
                  <Text style={[styles.sub, { color: colors.muted }]}>
                    {stock ? `${formatQty(stock[m.id] ?? 0, m.unit)} · ` : ''}Rs. {m.avgCost.toLocaleString('en-IN')}/{m.unit}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

export type EditLine = { key: string; materialId: string; qty: string; unitCost: string; expiry?: string };

export function newLine(): EditLine {
  return { key: Math.random().toString(36).slice(2), materialId: '', qty: '', unitCost: '', expiry: '' };
}

/** Rows of material + quantity (+ unit cost for purchases). */
export function LinesEditor({
  lines,
  onChange,
  materials,
  withCost,
  withExpiry,
  stock,
}: {
  lines: EditLine[];
  onChange: (lines: EditLine[]) => void;
  materials: RawMaterial[];
  withCost?: boolean;
  withExpiry?: boolean;
  stock?: Record<string, number>;
}) {
  const { colors } = useTheme();
  const patch = (key: string, next: Partial<EditLine>) =>
    onChange(lines.map((l) => (l.key === key ? { ...l, ...next } : l)));
  const num = (v: string) => v.replace(/[^\d.]/g, '').slice(0, 10);
  const day = (v: string) => v.replace(/[^\d-]/g, '').slice(0, 10);
  return (
    <View style={styles.lines}>
      {lines.map((line) => {
        const m = materials.find((x) => x.id === line.materialId);
        return (
          <View key={line.key} style={[styles.lineCard, { borderColor: colors.hairline }]}>
            <View style={styles.row}>
              <View style={styles.flex}>
                <MaterialSelect
                  materials={materials}
                  value={line.materialId}
                  stock={stock}
                  onChange={(id) => {
                    const pick = materials.find((x) => x.id === id);
                    patch(line.key, { materialId: id, unitCost: line.unitCost || (withCost && pick ? String(pick.avgCost || '') : '') });
                  }}
                />
              </View>
              <Pressable
                onPress={() => onChange(lines.length > 1 ? lines.filter((l) => l.key !== line.key) : [newLine()])}
                hitSlop={8}
                style={styles.remove}
              >
                <Text style={{ color: colors.muted, fontSize: 20 }}>×</Text>
              </Pressable>
            </View>
            <View style={styles.row}>
              <Input grow value={line.qty} onChangeText={(v) => patch(line.key, { qty: num(v) })} placeholder={`Qty${m ? ` (${m.unit})` : ''}`} keyboardType="decimal-pad" />
              {withCost ? (
                <Input grow value={line.unitCost} onChangeText={(v) => patch(line.key, { unitCost: num(v) })} placeholder={`Rs per ${m?.unit ?? 'unit'}`} keyboardType="decimal-pad" />
              ) : null}
            </View>
            {withExpiry ? (
              <Input
                value={line.expiry ?? ''}
                onChangeText={(v) => patch(line.key, { expiry: day(v) })}
                placeholder="Expiry YYYY-MM-DD (optional)"
                autoCapitalize="none"
              />
            ) : null}
            {m && stock ? (
              <Text style={[styles.sub, { color: colors.muted }]}>In stock: {formatQty(stock[m.id] ?? 0, m.unit)}</Text>
            ) : null}
          </View>
        );
      })}
      <Pressable onPress={() => onChange([...lines, newLine()])} style={[styles.addLine, { borderColor: colors.brand }]}>
        <Text style={[styles.chipText, { color: colors.brand }]}>＋ Add another item</Text>
      </Pressable>
    </View>
  );
}

/** Lines with a material and a positive quantity, as numbers. */
export function parsedLines(lines: EditLine[]) {
  return lines
    .filter((l) => l.materialId && Number(l.qty) > 0)
    .map((l) => ({
      materialId: l.materialId,
      qty: Number(l.qty),
      unitCost: Number(l.unitCost) || 0,
      expiry: l.expiry && /^\d{4}-\d{2}-\d{2}$/.test(l.expiry) ? l.expiry : undefined,
    }));
}

export const kitchenStyles = StyleSheet.create({
  tile: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 12, gap: 2 },
  tileLabel: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.5 },
  tileValue: { fontFamily: fonts.bold, fontSize: 18 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: 'rgba(15,23,42,0.55)' },
  card: { width: '100%', maxWidth: 480, maxHeight: '90%', alignSelf: 'center', borderRadius: 22, padding: 16, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontFamily: fonts.bold, fontSize: 18 },
  sub: { fontFamily: fonts.regular, fontSize: 12 },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  body: { gap: 10, paddingBottom: 4 },
  label: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1, marginTop: 2 },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontFamily: fonts.regular, fontSize: 14 },
  chip: { minHeight: 36, borderRadius: 999, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontFamily: fonts.semibold, fontSize: 13 },
  chipRow: { gap: 8, paddingVertical: 2 },
  selectRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  selectOption: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 12, borderWidth: 1, borderRadius: 10, marginTop: 4 },
  select: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectText: { flex: 1, fontFamily: fonts.semibold, fontSize: 14 },
  option: { paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth, gap: 2 },
  optionName: { fontFamily: fonts.semibold, fontSize: 15 },
  lines: { gap: 10 },
  lineCard: { borderWidth: 1, borderRadius: 14, padding: 10, gap: 8 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  remove: { width: 32, height: 44, alignItems: 'center', justifyContent: 'center' },
  addLine: { minHeight: 42, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
});
