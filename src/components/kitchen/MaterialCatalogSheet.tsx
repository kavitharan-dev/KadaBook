import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useKitchen } from '../../context/KitchenContext';
import { useTheme } from '../../context/ThemeContext';
import { CATALOG_CATEGORIES, RAW_MATERIAL_CATALOG } from '../../data/rawMaterialCatalog';
import { fonts } from '../../theme/fonts';
import { Chip, Sheet } from './KitchenUi';

type Props = {
  visible: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
};

export function MaterialCatalogSheet({ visible, onClose, onDone }: Props) {
  const { colors } = useTheme();
  const { data, seedCatalog } = useKitchen();
  const [category, setCategory] = useState<string | 'all'>('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const known = useMemo(() => new Set(data.materials.map((m) => m.name.toLowerCase())), [data.materials]);
  const rows = useMemo(
    () =>
      RAW_MATERIAL_CATALOG.filter((item) => category === 'all' || item.category === category).map((item) => ({
        ...item,
        already: known.has(item.name.toLowerCase()),
      })),
    [category, known],
  );
  const missing = rows.filter((r) => !r.already).length;

  async function addMissing() {
    setBusy(true);
    setError(null);
    try {
      const added = await seedCatalog(category === 'all' ? undefined : category);
      if (!added) {
        onDone('All selected materials are already in your list');
      } else {
        onDone(`Added ${added} raw material${added === 1 ? '' : 's'}`);
      }
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not add materials.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      visible={visible}
      title="Standard raw materials"
      subtitle="Burger / fast-food kitchen list. Already-added items are skipped."
      onClose={onClose}
      actionLabel={missing ? `Add ${missing} missing` : 'Nothing to add'}
      onAction={addMissing}
      busy={busy}
      error={error}
      actionDisabled={missing === 0}
    >
      <View style={styles.wrap}>
        <Chip label="All" on={category === 'all'} onPress={() => setCategory('all')} />
        {CATALOG_CATEGORIES.map((c) => (
          <Chip key={c} label={c} on={category === c} onPress={() => setCategory(c)} />
        ))}
      </View>
      <Text style={[styles.hint, { color: colors.muted }]}>
        {missing} new · {rows.length - missing} already in stock list
      </Text>
      {rows.map((item) => (
        <View key={item.name} style={[styles.row, { borderBottomColor: colors.hairline }]}>
          <View style={styles.flex}>
            <Text style={[styles.name, { color: item.already ? colors.muted : colors.ink }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.meta, { color: colors.muted }]}>
              {item.category} · {item.unit}
            </Text>
          </View>
          <Text style={[styles.badge, { color: item.already ? colors.saleText : colors.brand }]}>
            {item.already ? 'Added' : 'New'}
          </Text>
        </View>
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  hint: { fontFamily: fonts.regular, fontSize: 12, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  flex: { flex: 1 },
  name: { fontFamily: fonts.semibold, fontSize: 14 },
  meta: { fontFamily: fonts.regular, fontSize: 11, marginTop: 2 },
  badge: { fontFamily: fonts.semibold, fontSize: 12 },
});
