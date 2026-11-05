import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useBooks } from '../context/BooksContext';
import { useKitchen } from '../context/KitchenContext';
import { useTheme } from '../context/ThemeContext';
import { formatRs, startOfDay } from '../lib/format';
import { branchCard, branchReport, formatQty, formatUnitTotals } from '../lib/kitchenOps';
import { fonts } from '../theme/fonts';

/** Home: Received today, Sold today, In stock now, for the chosen branch. Hidden until items exist. */
export function BranchStockCard() {
  const { colors } = useTheme();
  const { data, scope } = useKitchen();
  const start = startOfDay(Date.now());
  const card = useMemo(() => branchCard(data, scope, start, start + 86_400_000), [data, scope, start]);
  if (!Object.keys(card.received).length && !Object.keys(card.sold).length && !Object.keys(card.inStock).length) return null;
  const rows: [string, string][] = [
    ['Received today', formatUnitTotals(card.received)],
    ['Sold today', formatUnitTotals(card.sold)],
    ['In stock now', formatUnitTotals(card.inStock)],
  ];
  return (
    <View style={[styles.card, { backgroundColor: colors.white, borderColor: colors.hairline }]}>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.line}>
          <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
          <Text style={[styles.value, { color: colors.ink }]}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

/** Reports: received, sold, remaining and adjustments per item, then the money for the period. */
export function BranchStockReport({ start, end }: { start: number; end: number }) {
  const { colors } = useTheme();
  const { books } = useBooks();
  const { data, scope } = useKitchen();
  const report = useMemo(() => branchReport(data, books.sales, scope, start, end), [data, books.sales, scope, start, end]);
  if (!report.rows.length) return null;
  const money: [string, string][] = [
    ['Sales', formatRs(report.sales)],
    ['Cost of what was sold', formatRs(report.cost)],
    ['Gross profit', formatRs(report.grossProfit)],
    [report.adjustValue < 0 ? 'Stock loss' : 'Stock adjustments', formatRs(report.adjustValue)],
  ];
  return (
    <View style={[styles.card, { backgroundColor: colors.white, borderColor: colors.hairline }]}>
      <Text style={[styles.title, { color: colors.ink }]}>Stock</Text>
      {report.rows.map((row) => (
        <View key={row.item.id} style={[styles.item, { borderBottomColor: colors.hairline }]}>
          <View style={styles.line}>
            <Text style={[styles.value, { color: colors.ink }]} numberOfLines={1}>{row.item.name}</Text>
            <Text style={[styles.value, { color: colors.ink }]}>{formatQty(row.remaining, row.item.unit)}</Text>
          </View>
          <Text style={[styles.label, { color: colors.muted }]}>
            In {formatQty(row.received, row.item.unit)} · Sold {formatQty(row.sold, row.item.unit)}
            {row.usedOrSent ? ` · Used or sent ${formatQty(row.usedOrSent, row.item.unit)}` : ''}
          </Text>
          {row.adjustQty ? (
            <Text style={[styles.label, { color: row.adjustValue < 0 ? colors.expenseText : colors.saleText }]}>
              {row.adjustValue < 0 ? 'Loss' : 'Gain'} {formatQty(Math.abs(row.adjustQty), row.item.unit)} · {formatRs(Math.abs(row.adjustValue))}
            </Text>
          ) : null}
        </View>
      ))}
      {money.map(([label, value]) => (
        <View key={label} style={styles.line}>
          <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
          <Text style={[styles.value, { color: colors.ink }]}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 8 },
  title: { fontFamily: fonts.semibold, fontSize: 14 },
  item: { gap: 2, paddingBottom: 8, borderBottomWidth: 1 },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  label: { fontFamily: fonts.regular, fontSize: 12, flexShrink: 1 },
  value: { fontFamily: fonts.semibold, fontSize: 13, flexShrink: 1 },
});
