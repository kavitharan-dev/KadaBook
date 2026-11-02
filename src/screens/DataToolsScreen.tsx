import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Chip } from '../components/kitchen/KitchenUi';
import { Toast, useToast } from '../components/Toast';
import { FillButton, Header, Screen } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useBooks } from '../context/BooksContext';
import { useKitchen } from '../context/KitchenContext';
import { useTheme } from '../context/ThemeContext';
import { exportBooksToExcel, pickProductSheet, shareProductTemplate, type ImportPreview } from '../lib/excel';
import { formatDay, formatRs, startOfDay } from '../lib/format';
import { fonts } from '../theme/fonts';

type Range = 'month' | 'lastMonth' | 'quarter' | 'year' | 'all';

function bounds(range: Range, now = Date.now()) {
  const d = new Date(now);
  const end = startOfDay(now) + 86_400_000;
  if (range === 'month') return { start: new Date(d.getFullYear(), d.getMonth(), 1).getTime(), end };
  if (range === 'lastMonth') {
    return { start: new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime(), end: new Date(d.getFullYear(), d.getMonth(), 1).getTime() };
  }
  if (range === 'quarter') return { start: new Date(d.getFullYear(), d.getMonth() - 2, 1).getTime(), end };
  if (range === 'year') return { start: new Date(d.getFullYear(), 0, 1).getTime(), end };
  return { start: 0, end };
}

/** Excel export of the books, and bulk product import from Excel / CSV. */
export function DataToolsScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { books, importProducts } = useBooks();
  const { data: kitchen } = useKitchen();
  const toast = useToast();
  const [range, setRange] = useState<Range>('month');
  const [exporting, setExporting] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const { start, end } = bounds(range);
  const salesInRange = books.sales.filter((s) => s.createdAt >= start && s.createdAt < end);

  async function doExport() {
    setExporting(true);
    try {
      await exportBooksToExcel({ shopName: user?.shopName ?? 'KadaBook', books, kitchen, start, end });
      toast.show('success', 'Excel file ready to share');
    } catch (caught) {
      toast.show('error', caught instanceof Error ? caught.message : 'Could not create the Excel file.');
    } finally {
      setExporting(false);
    }
  }

  async function choose() {
    try {
      const result = await pickProductSheet(books.products.map((p) => p.name));
      if (result) setPreview(result);
    } catch (caught) {
      toast.show('error', caught instanceof Error ? caught.message : 'Could not read that file.');
    }
  }

  async function doImport() {
    if (!preview) return;
    setImporting(true);
    try {
      const count = await importProducts(preview.rows);
      setPreview(null);
      toast.show('success', `${count} product${count === 1 ? '' : 's'} imported`);
    } catch (caught) {
      toast.show('error', caught instanceof Error ? caught.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <Screen>
      <Header title="Excel export & import" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={[styles.card, { backgroundColor: colors.white, borderColor: colors.hairline }]}>
          <View style={styles.head}>
            <Text style={styles.icon}>📤</Text>
            <View style={styles.flex}>
              <Text style={[styles.title, { color: colors.ink }]}>Export to Excel</Text>
              <Text style={[styles.sub, { color: colors.muted }]}>
                Sales, items sold, expenses, products{kitchen.materials.length ? ', kitchen stock and stock moves' : ''} — one .xlsx file. Share to WhatsApp, email or Drive.
              </Text>
            </View>
          </View>
          <View style={styles.chips}>
            {(
              [
                ['month', 'This month'],
                ['lastMonth', 'Last month'],
                ['quarter', 'Last 3 months'],
                ['year', 'This year'],
                ['all', 'Everything'],
              ] as [Range, string][]
            ).map(([key, label]) => (
              <Chip key={key} label={label} on={range === key} onPress={() => setRange(key)} />
            ))}
          </View>
          <Text style={[styles.sub, { color: colors.muted }]}>
            {range === 'all' ? 'All dates' : `${formatDay(start)} – ${formatDay(end - 1)}`} · {salesInRange.length} sales ·{' '}
            {formatRs(salesInRange.reduce((sum, s) => sum + s.amount, 0))}
          </Text>
          <FillButton label="Export Excel file" onPress={doExport} busy={exporting} color={colors.sale} />
        </View>

        <View style={[styles.card, { backgroundColor: colors.white, borderColor: colors.hairline }]}>
          <View style={styles.head}>
            <Text style={styles.icon}>📥</Text>
            <View style={styles.flex}>
              <Text style={[styles.title, { color: colors.ink }]}>Import products</Text>
              <Text style={[styles.sub, { color: colors.muted }]}>
                From .xlsx or .csv. First row = column names: Name, Selling price, Purchase price, Stock, Unit, Category, Barcode. Tamil and Sinhala names work too.
              </Text>
            </View>
          </View>
          <View style={styles.row}>
            <Pressable onPress={() => shareProductTemplate().catch(() => toast.show('error', 'Could not create the template.'))} style={[styles.ghost, { borderColor: colors.brand }]}>
              <Text style={[styles.ghostText, { color: colors.brand }]}>Get template</Text>
            </Pressable>
            <Pressable onPress={choose} style={[styles.ghost, { borderColor: colors.brand, backgroundColor: colors.gradientTop }]}>
              <Text style={[styles.ghostText, { color: colors.brand }]}>Choose file</Text>
            </Pressable>
          </View>

          {preview ? (
            <View style={[styles.preview, { backgroundColor: colors.gradientTop }]}>
              <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>{preview.fileName}</Text>
              <Text style={[styles.big, { color: colors.saleText }]}>{preview.rows.length} new products</Text>
              {preview.duplicates.length ? (
                <Text style={[styles.sub, { color: colors.muted }]}>
                  {preview.duplicates.length} skipped (already in your shop): {preview.duplicates.slice(0, 5).join(', ')}
                  {preview.duplicates.length > 5 ? '…' : ''}
                </Text>
              ) : null}
              {preview.problems.length ? (
                <View style={styles.problems}>
                  <Text style={[styles.sub, { color: colors.expenseText }]}>{preview.problems.length} row(s) need fixing:</Text>
                  {preview.problems.slice(0, 6).map((p) => (
                    <Text key={`${p.row}-${p.reason}`} style={[styles.sub, { color: colors.expenseText }]}>
                      Row {p.row}: {p.reason}
                    </Text>
                  ))}
                </View>
              ) : null}
              {preview.rows.slice(0, 5).map((r) => (
                <View key={r.name} style={[styles.prow, { borderBottomColor: colors.hairline }]}>
                  <Text style={[styles.pname, { color: colors.ink }]} numberOfLines={1}>{r.name}</Text>
                  <Text style={[styles.sub, { color: colors.muted }]}>{r.category} · {r.stock} {r.unit}</Text>
                  <Text style={[styles.pprice, { color: colors.ink }]}>{formatRs(r.sellingPrice)}</Text>
                </View>
              ))}
              {preview.rows.length > 5 ? <Text style={[styles.sub, { color: colors.muted }]}>…and {preview.rows.length - 5} more</Text> : null}
              <View style={styles.row}>
                <Pressable onPress={() => setPreview(null)} style={[styles.ghost, { borderColor: colors.line }]}>
                  <Text style={[styles.ghostText, { color: colors.muted }]}>Cancel</Text>
                </Pressable>
                <View style={styles.flex}>
                  <FillButton label={`Import ${preview.rows.length}`} onPress={doImport} busy={importing} disabled={!preview.rows.length} />
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>
      <Toast toast={toast.toast} onHide={toast.hide} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: 16, gap: 14, paddingBottom: 40 },
  card: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 12 },
  head: { flexDirection: 'row', gap: 12 },
  icon: { fontSize: 28 },
  title: { fontFamily: fonts.bold, fontSize: 15 },
  sub: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17 },
  big: { fontFamily: fonts.bold, fontSize: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  ghost: { flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  ghostText: { fontFamily: fonts.semibold, fontSize: 14 },
  preview: { borderRadius: 14, padding: 12, gap: 8 },
  problems: { gap: 2 },
  prow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  pname: { flex: 1, fontFamily: fonts.semibold, fontSize: 13 },
  pprice: { fontFamily: fonts.semibold, fontSize: 13 },
});
