import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import type { Branch, BranchScope, ItemKind, RawMaterial } from '../../data/kitchenTypes';
import { formatQty } from '../../lib/kitchenOps';
import { itemKind } from '../../lib/stockEngine';
import { fonts } from '../../theme/fonts';
import { ErrorText, FillButton } from '../ui';

const KIND_GRADIENT: Record<ItemKind, readonly [string, string]> = {
  raw: ['#15803D', '#22A447'],
  finished: ['#6D28D9', '#8B5CF6'],
  direct: ['#0F766E', '#14A38E'],
};

const KIND_MARK: Record<ItemKind, string> = {
  raw: 'R',
  finished: 'F',
  direct: 'D',
};

/** Dashboard-style tappable item tiles (icon + name). */
export function ItemIconGrid({
  materials,
  selectedId,
  onSelect,
  stock,
}: {
  materials: RawMaterial[];
  selectedId?: string;
  onSelect: (id: string) => void;
  stock?: Record<string, number>;
}) {
  const { colors } = useTheme();
  if (!materials.length) {
    return <Text style={[styles.sub, { color: colors.muted }]}>No items yet. Load starter list, or add under Kitchen → List.</Text>;
  }
  return (
    <View style={styles.iconGrid}>
      {materials.map((m) => {
        const kind = itemKind(m);
        const on = selectedId === m.id;
        const gradient = KIND_GRADIENT[kind];
        return (
          <Pressable
            key={m.id}
            onPress={() => onSelect(m.id)}
            accessibilityRole="button"
            accessibilityLabel={m.name}
            style={[
              styles.iconTile,
              {
                borderColor: on ? gradient[1] : colors.hairline,
                backgroundColor: colors.white,
              },
            ]}
          >
            <LinearGradient colors={[...gradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.iconBadge}>
              <Text style={styles.iconMark}>{KIND_MARK[kind]}</Text>
            </LinearGradient>
            <Text style={[styles.iconName, { color: colors.ink }]} numberOfLines={2}>
              {m.name}
            </Text>
            {stock ? (
              <Text style={[styles.iconStock, { color: colors.muted }]} numberOfLines={1}>
                {formatQty(stock[m.id] ?? 0, m.unit)}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Centered popup used by every kitchen form. */
export function Sheet({
  visible,
  title,
  subtitle,
  onClose,
  children,
  /** Sticky strip under the list (qty / Add) — stays visible when an item is tapped. */
  dock,
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
  dock?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  busy?: boolean;
  error?: string | null;
  actionColor?: string;
  actionDisabled?: boolean;
}) {
  const { colors } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    if (!visible) {
      setKbHeight(0);
      return;
    }
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) =>
      setKbHeight(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setKbHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [visible]);

  const sheetMax = Math.max(280, Math.min(windowHeight * 0.92, windowHeight - (kbHeight || 0) - 28));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[
          styles.backdrop,
          Platform.OS === 'android' && kbHeight > 0
            ? { justifyContent: 'flex-end', paddingBottom: kbHeight }
            : { justifyContent: 'center', paddingBottom: 16 },
        ]}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.card, { backgroundColor: colors.white, maxHeight: sheetMax }]}>
          <View style={styles.head}>
            <View style={styles.flex}>
              <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
              {subtitle ? <Text style={[styles.sub, { color: colors.muted }]}>{subtitle}</Text> : null}
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={[styles.close, { backgroundColor: colors.keypad }]}>
              <Text style={{ color: colors.muted, fontFamily: fonts.bold }}>✕</Text>
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            contentContainerStyle={[styles.body, { paddingBottom: 12 }]}
            style={{ flexGrow: 0, flexShrink: 1 }}
          >
            {children}
            <ErrorText message={error ?? null} />
          </ScrollView>
          {dock ? <View style={styles.dock}>{dock}</View> : null}
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

export function Chip({
  label,
  on,
  onPress,
  onLongPress,
  tone,
  emphasis,
}: {
  label: string;
  on?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  tone?: string;
  /** Filled brand look — for primary actions like Add branch. */
  emphasis?: boolean;
}) {
  const { colors } = useTheme();
  const filled = Boolean(emphasis || on);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={380}
      style={[
        styles.chip,
        emphasis ? styles.chipAdd : null,
        {
          backgroundColor: filled ? tone ?? colors.brand : colors.keypad,
          borderWidth: emphasis ? 0 : StyleSheet.hairlineWidth,
          borderColor: colors.hairline,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: filled ? colors.onFill : colors.ink }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Branch switcher chips; optional subtle + and × delete. Add branch UX lives on Staff & roles. */
export function BranchChips({
  branches,
  value,
  onChange,
  allowAll = true,
  onAdd,
  onDelete,
}: {
  branches: Branch[];
  value: BranchScope;
  onChange: (next: BranchScope) => void;
  allowAll?: boolean;
  onAdd?: () => void;
  /** Shows a red × on each branch (keeps at least one). */
  onDelete?: (branchId: string) => void;
}) {
  const { colors } = useTheme();
  const canDelete = Boolean(onDelete) && branches.length > 1;
  return (
    <View style={styles.branchBar}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {allowAll && branches.length > 1 ? (
          <Chip label="All branches" on={value === 'all'} onPress={() => onChange('all')} />
        ) : null}
        {branches.map((b) => {
          const selected = value === b.id;
          return (
            <View
              key={b.id}
              style={[
                styles.branchChipWrap,
                {
                  backgroundColor: selected ? colors.brand : colors.white,
                  borderColor: selected ? colors.brand : colors.hairline,
                },
              ]}
            >
              <Pressable onPress={() => onChange(b.id)} style={styles.branchChipMain}>
                <Text
                  style={[styles.chipText, { color: selected ? colors.onFill : colors.ink }]}
                  numberOfLines={1}
                >
                  {b.isMain ? `★ ${b.name}` : b.name}
                </Text>
              </Pressable>
              {canDelete ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${b.name}`}
                  hitSlop={8}
                  onPress={() => onDelete?.(b.id)}
                  style={[styles.branchDelete, { backgroundColor: selected ? 'rgba(255,255,255,0.22)' : colors.expenseWash }]}
                >
                  <Text style={{ color: selected ? colors.onFill : colors.danger, fontFamily: fonts.bold, fontSize: 14 }}>
                    ×
                  </Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
        {onAdd ? <Chip label="＋" on={false} onPress={onAdd} /> : null}
      </ScrollView>
    </View>
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
          {chosen ? chosen.name : 'Choose item'}
        </Text>
        <Text style={{ color: colors.muted }}>▾</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={[styles.card, { backgroundColor: colors.white }]}>
            <Input value={q} onChangeText={setQ} placeholder="Search items" autoFocus />
            <ScrollView keyboardShouldPersistTaps="handled">
              {list.length === 0 ? (
                <Text style={[styles.sub, { color: colors.muted, padding: 12 }]}>No items. Add under Kitchen → List.</Text>
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
                    {stock ? formatQty(stock[m.id] ?? 0, m.unit) : m.unit}
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
  dock: { gap: 8 },
  label: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1, marginTop: 2 },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontFamily: fonts.regular, fontSize: 14 },
  chip: { minHeight: 36, borderRadius: 999, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  chipAdd: {
    minHeight: 40,
    paddingHorizontal: 16,
    shadowColor: '#1D5FE0',
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  chipText: { fontFamily: fonts.semibold, fontSize: 13 },
  chipRow: { gap: 8, paddingVertical: 2, paddingHorizontal: 2, alignItems: 'center' },
  branchBar: { paddingVertical: 4 },
  branchChipWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  branchChipMain: { paddingLeft: 14, paddingRight: 10, paddingVertical: 8, maxWidth: 160 },
  branchDelete: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconTile: {
    width: '30%',
    flexGrow: 1,
    minWidth: 96,
    maxWidth: 140,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconMark: { fontFamily: fonts.bold, fontSize: 16, color: '#FFFFFF' },
  iconName: { fontFamily: fonts.semibold, fontSize: 12, textAlign: 'center', minHeight: 30 },
  iconStock: { fontFamily: fonts.regular, fontSize: 11 },
});
