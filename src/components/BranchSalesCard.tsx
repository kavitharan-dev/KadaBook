import { StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../context/LocaleContext';
import { useTheme } from '../context/ThemeContext';
import type { Branch } from '../data/kitchenTypes';
import type { Sale } from '../data/types';
import { UNKNOWN_CASHIER, salesByBranchAndCashier } from '../lib/branchScope';
import { formatRs } from '../lib/format';
import { fonts } from '../theme/fonts';

/** Who sold how much in `sales`, grouped by branch. Shows nothing until there is a sale. */
export function BranchSalesCard({ sales, branches }: { sales: Sale[]; branches: Branch[] }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const rows = salesByBranchAndCashier(sales, branches).filter((row) => row.cashiers.length > 0);
  if (rows.length === 0) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.white, borderColor: colors.hairline }]}>
      <Text style={[styles.title, { color: colors.ink }]}>{t((m) => m.home.branchSalesTitle)}</Text>
      {rows.map((row) => (
        <View key={row.branchId} style={styles.branch}>
          {branches.length > 1 ? (
            <View style={styles.line}>
              <Text style={[styles.branchName, { color: colors.brand }]} numberOfLines={1}>{row.name}</Text>
              <Text style={[styles.branchName, { color: colors.brand }]}>{formatRs(row.total)}</Text>
            </View>
          ) : null}
          {row.cashiers.map((cashier) => (
            <View key={cashier.key} style={styles.line}>
              <Text style={[styles.cashier, { color: colors.ink }]} numberOfLines={1}>
                {cashier.key === UNKNOWN_CASHIER ? t((m) => m.home.cashierUnknown) : cashier.name} · {cashier.count}
              </Text>
              <Text style={[styles.amount, { color: colors.ink }]}>{formatRs(cashier.total)}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 10 },
  title: { fontFamily: fonts.semibold, fontSize: 14 },
  branch: { gap: 4 },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  branchName: { fontFamily: fonts.semibold, fontSize: 13, flexShrink: 1 },
  cashier: { fontFamily: fonts.regular, fontSize: 13, flexShrink: 1 },
  amount: { fontFamily: fonts.semibold, fontSize: 13 },
});
