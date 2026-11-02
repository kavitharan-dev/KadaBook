import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Chip, Input } from '../components/kitchen/KitchenUi';
import { Header, Screen } from '../components/ui';
import { useBooks } from '../context/BooksContext';
import { useTheme } from '../context/ThemeContext';
import { formatDay, formatTime } from '../lib/format';
import { ROLE_LABEL, useRole } from '../lib/roles';
import { fonts } from '../theme/fonts';

const ICON: Record<string, string> = {
  'Sale deleted': '🗑',
  'Sale edited': '✏️',
  'Expense deleted': '🗑',
  'Product changed': '🏷',
  'Product deleted': '🗑',
  'Products imported': '📥',
  'Staff added': '👤',
  'Staff changed': '👤',
  'Stock count': '📋',
  'Stock transfer': '🚚',
  'Stock purchase': '🛒',
  Wastage: '♻️',
  'Stock entry deleted': '🗑',
  'Material deleted': '🗑',
  'Recipe saved': '🍔',
};

/** Who did what, newest first. Entries cannot be edited or deleted (enforced by Firestore rules). */
export function AuditLogScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { books } = useBooks();
  const { can } = useRole();
  const [who, setWho] = useState<string>('all');
  const [q, setQ] = useState('');

  const people = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of books.audit) if (a.actorUid) map.set(a.actorUid, a.actorName ?? 'Owner');
    return [...map.entries()];
  }, [books.audit]);

  const rows = books.audit
    .filter((a) => who === 'all' || a.actorUid === who)
    .filter((a) => !q.trim() || `${a.action} ${a.detail} ${a.actorName ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()))
    .slice(0, 300);

  if (!can('viewAudit')) {
    return (
      <Screen>
        <Header title="Audit log" onBack={() => navigation.goBack()} />
        <Text style={[styles.empty, { color: colors.muted }]}>Only the owner or a manager can see the audit log.</Text>
      </Screen>
    );
  }

  let lastDay = '';
  return (
    <Screen>
      <Header title="Audit log" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Input value={q} onChangeText={setQ} placeholder="Search: deleted, price, Kumar…" />
        {people.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            <Chip label="Everyone" on={who === 'all'} onPress={() => setWho('all')} />
            {people.map(([id, name]) => (
              <Chip key={id} label={name} on={who === id} onPress={() => setWho(id)} />
            ))}
          </ScrollView>
        ) : null}
        {rows.length === 0 ? <Text style={[styles.empty, { color: colors.muted }]}>Nothing logged yet.</Text> : null}
        {rows.map((a) => {
          const day = formatDay(a.createdAt);
          const header = day !== lastDay ? day : null;
          lastDay = day;
          const risky = /deleted|changed|count/i.test(a.action);
          return (
            <View key={a.id}>
              {header ? <Text style={[styles.day, { color: colors.muted }]}>{header}</Text> : null}
              <View style={[styles.item, { backgroundColor: colors.white, borderColor: risky ? colors.expenseWash : colors.hairline }]}>
                <Text style={styles.icon}>{ICON[a.action] ?? '•'}</Text>
                <View style={styles.flex}>
                  <Text style={[styles.action, { color: colors.ink }]}>{a.action}</Text>
                  <Text style={[styles.detail, { color: colors.muted }]}>{a.detail}</Text>
                  <Text style={[styles.meta, { color: colors.muted }]}>
                    {formatTime(a.createdAt)} · {a.actorName ?? 'Owner'} ({ROLE_LABEL[a.role ?? 'owner']})
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: 16, gap: 8, paddingBottom: 40 },
  row: { gap: 8 },
  empty: { fontFamily: fonts.regular, fontSize: 13, textAlign: 'center', padding: 24 },
  day: { fontFamily: fonts.semibold, fontSize: 12, marginTop: 8, marginBottom: 4 },
  item: { flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: 14, padding: 12 },
  icon: { fontSize: 18 },
  action: { fontFamily: fonts.semibold, fontSize: 14 },
  detail: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17 },
  meta: { fontFamily: fonts.regular, fontSize: 11, marginTop: 2 },
});
