import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useKitchen } from '../context/KitchenContext';
import { useTheme } from '../context/ThemeContext';
import type { Expense, Product, Sale } from '../data/types';
import { formatRs } from '../lib/format';
import { expenseBreakdown, itemReport, monthlyReport } from '../lib/fullReports';
import { fonts } from '../theme/fonts';

type Sort = 'qty' | 'revenue' | 'profit';

/** Top sellers, profit per item, expense split and month-by-month totals for the chosen period. */
export function FullReports({
  sales,
  expenses,
  allSales,
  allExpenses,
  products,
  expenseLabel,
}: {
  sales: Sale[];
  expenses: Expense[];
  /** For the monthly table, which always shows the last 6 months. */
  allSales: Sale[];
  allExpenses: Expense[];
  products: Product[];
  expenseLabel: (category: string) => string;
}) {
  const { colors } = useTheme();
  const { data } = useKitchen();
  const [sort, setSort] = useState<Sort>('qty');
  const [showAll, setShowAll] = useState(false);

  const items = useMemo(() => itemReport(sales, products, data), [sales, products, data]);
  const sorted = [...items].sort((a, b) => b[sort] - a[sort]);
  const shown = showAll ? sorted : sorted.slice(0, 8);
  const expenseSplit = useMemo(() => expenseBreakdown(expenses), [expenses]);
  const months = useMemo(() => monthlyReport(allSales, allExpenses), [allSales, allExpenses]);
  const monthMax = Math.max(1, ...months.map((m) => Math.max(m.sales, m.expenses)));
  const palette = [colors.expense, colors.brand, colors.product, colors.barOrange, colors.barYellow, colors.sale];
  const quickTotal = sales.filter((s) => !s.items?.length).reduce((sum, s) => sum + s.amount, 0);
  const profitTotal = items.reduce((sum, r) => sum + r.profit, 0);

  return (
    <View style={styles.wrap}>
      {/* Top sellers and profit per item */}
      <View style={[styles.card, { backgroundColor: colors.white, borderColor: colors.hairline }]}>
        <Text style={[styles.title, { color: colors.ink }]}>Top sellers & profit per item</Text>
        <View style={styles.seg}>
          {(
            [
              ['qty', 'Most sold'],
              ['revenue', 'Most sales'],
              ['profit', 'Most profit'],
            ] as [Sort, string][]
          ).map(([key, label]) => (
            <Pressable key={key} onPress={() => setSort(key)} style={[styles.segBtn, { backgroundColor: sort === key ? colors.brand : colors.keypad }]}>
              <Text style={[styles.segText, { color: sort === key ? colors.onFill : colors.ink }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        {items.length === 0 ? (
          <Text style={[styles.empty, { color: colors.muted }]}>No item bills in this period. Quick (calculator) sales have no item detail.</Text>
        ) : (
          <>
            <View style={[styles.th, { backgroundColor: colors.keypad }]}>
              <Text style={[styles.thText, styles.colName, { color: colors.ink }]}>Item</Text>
              <Text style={[styles.thText, styles.colNum, { color: colors.ink }]}>Qty</Text>
              <Text style={[styles.thText, styles.colMoney, { color: colors.ink }]}>Sales</Text>
              <Text style={[styles.thText, styles.colMoney, { color: colors.ink }]}>Profit</Text>
            </View>
            {shown.map((r, i) => (
              <View key={r.key} style={[styles.tr, { borderBottomColor: colors.hairline }]}>
                <View style={[styles.colName, styles.nameCell]}>
                  <Text style={[styles.rank, { backgroundColor: i < 3 ? colors.barYellow : colors.keypad, color: colors.ink }]}>{i + 1}</Text>
                  <Text style={[styles.td, styles.flex, { color: colors.ink }]} numberOfLines={1}>{r.name}</Text>
                </View>
                <Text style={[styles.td, styles.colNum, { color: colors.ink }]}>{r.qty}</Text>
                <Text style={[styles.td, styles.colMoney, { color: colors.ink }]}>{r.revenue.toLocaleString('en-IN')}</Text>
                <View style={styles.colMoney}>
                  <Text style={[styles.tdStrong, { color: !r.costKnown ? colors.muted : r.profit >= 0 ? colors.saleText : colors.expenseText }]}>
                    {r.costKnown ? r.profit.toLocaleString('en-IN') : '—'}
                  </Text>
                  {r.costKnown ? <Text style={[styles.small, { color: colors.muted }]}>{r.marginPercent}%</Text> : null}
                </View>
              </View>
            ))}
            {items.length > 8 ? (
              <Pressable onPress={() => setShowAll((v) => !v)}>
                <Text style={[styles.more, { color: colors.brand }]}>{showAll ? 'Show top 8' : `Show all ${items.length}`}</Text>
              </Pressable>
            ) : null}
            <Text style={[styles.small, { color: colors.muted }]}>
              Profit uses the recipe cost (Kitchen & Stock) or the product's purchase price. "—" means no cost is set.
              {profitTotal ? ` Item profit total ${formatRs(profitTotal)}.` : ''}
              {quickTotal ? ` Quick sales without items: ${formatRs(quickTotal)}.` : ''}
            </Text>
          </>
        )}
      </View>

      {/* Expense chart */}
      <View style={[styles.card, { backgroundColor: colors.white, borderColor: colors.hairline }]}>
        <Text style={[styles.title, { color: colors.ink }]}>Where the money went</Text>
        {expenseSplit.length === 0 ? (
          <Text style={[styles.empty, { color: colors.muted }]}>No expenses in this period.</Text>
        ) : (
          <>
            <View style={styles.stack}>
              {expenseSplit.map((e, i) => (
                <View key={e.category} style={{ flex: Math.max(e.percent, 1), backgroundColor: palette[i % palette.length] }} />
              ))}
            </View>
            {expenseSplit.map((e, i) => (
              <View key={e.category} style={styles.legendRow}>
                <View style={[styles.dot, { backgroundColor: palette[i % palette.length] }]} />
                <Text style={[styles.td, styles.flex, { color: colors.ink }]} numberOfLines={1}>{expenseLabel(e.category)}</Text>
                <Text style={[styles.small, { color: colors.muted }]}>{e.percent}%</Text>
                <Text style={[styles.tdStrong, styles.legendAmt, { color: colors.ink }]}>{formatRs(e.amount)}</Text>
              </View>
            ))}
          </>
        )}
      </View>

      {/* Monthly */}
      <View style={[styles.card, { backgroundColor: colors.white, borderColor: colors.hairline }]}>
        <Text style={[styles.title, { color: colors.ink }]}>Month by month</Text>
        <View style={styles.legendInline}>
          <View style={[styles.dot, { backgroundColor: colors.sale }]} />
          <Text style={[styles.small, { color: colors.muted }]}>Sales</Text>
          <View style={[styles.dot, { backgroundColor: colors.expense, marginLeft: 10 }]} />
          <Text style={[styles.small, { color: colors.muted }]}>Expenses</Text>
        </View>
        {months.map((m) => (
          <View key={m.key} style={[styles.monthRow, { borderBottomColor: colors.hairline }]}>
            <View style={styles.monthHead}>
              <Text style={[styles.tdStrong, { color: colors.ink }]}>{m.label}</Text>
              <Text style={[styles.small, { color: colors.muted }]}>{m.bills} bills</Text>
              <Text style={[styles.tdStrong, styles.monthProfit, { color: m.profit >= 0 ? colors.saleText : colors.expenseText }]}>
                {m.profit >= 0 ? '' : '−'}
                {formatRs(Math.abs(m.profit))}
              </Text>
            </View>
            <View style={[styles.barTrack, { backgroundColor: colors.keypad }]}>
              <View style={[styles.barFill, { width: `${(m.sales / monthMax) * 100}%`, backgroundColor: colors.sale }]} />
            </View>
            <View style={[styles.barTrack, { backgroundColor: colors.keypad }]}>
              <View style={[styles.barFill, { width: `${(m.expenses / monthMax) * 100}%`, backgroundColor: colors.expense }]} />
            </View>
            <Text style={[styles.small, { color: colors.muted }]}>
              Sales {formatRs(m.sales)} · Expenses {formatRs(m.expenses)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  flex: { flex: 1 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 8 },
  title: { fontFamily: fonts.bold, fontSize: 15 },
  empty: { fontFamily: fonts.regular, fontSize: 13, paddingVertical: 8 },
  seg: { flexDirection: 'row', gap: 6 },
  segBtn: { flex: 1, minHeight: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  segText: { fontFamily: fonts.semibold, fontSize: 12 },
  th: { flexDirection: 'row', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 6 },
  thText: { fontFamily: fonts.bold, fontSize: 11 },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  colName: { flex: 1 },
  colNum: { width: 40, textAlign: 'right' },
  colMoney: { width: 76, alignItems: 'flex-end', textAlign: 'right' },
  nameCell: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rank: { width: 20, height: 20, borderRadius: 10, textAlign: 'center', lineHeight: 20, fontFamily: fonts.bold, fontSize: 11, overflow: 'hidden' },
  td: { fontFamily: fonts.regular, fontSize: 13 },
  tdStrong: { fontFamily: fonts.semibold, fontSize: 13 },
  small: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 16 },
  more: { fontFamily: fonts.semibold, fontSize: 13, textAlign: 'center', paddingVertical: 4 },
  stack: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', gap: 2 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendInline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendAmt: { width: 90, textAlign: 'right' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  monthRow: { gap: 4, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  monthHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  monthProfit: { marginLeft: 'auto' },
  barTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
});
