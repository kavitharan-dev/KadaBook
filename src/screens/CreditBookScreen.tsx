import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ErrorText, Field, FillButton, Header, Screen } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useBooks } from '../context/BooksContext';
import { useRole } from '../lib/roles';
import { useTheme } from '../context/ThemeContext';
import {
  DEFAULT_CREDIT_SETTINGS,
  fillTemplate,
  loadCreditSettings,
  type CreditSettings,
} from '../lib/creditSettings';
import { formatDay, formatRs, formatTime } from '../lib/format';
import {
  creditLedger,
  creditRows,
  creditTotals,
  customerBalance,
  waMe,
  type CreditRow,
} from '../lib/shopPlus';
import type { AppStackParamList } from '../navigation/types';
import type { ColorPalette } from '../theme/palettes';
import { useStyleSheet } from '../theme/useStyleSheet';
import { fonts } from '../theme/fonts';

/* ------------------------------------------------------------------ */
/* Credit book: every customer, what they owe, search                  */
/* ------------------------------------------------------------------ */

export function CreditBookScreen() {
  const styles = useStyleSheet(creditStyles);
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { colors } = useTheme();
  const { books } = useBooks();
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);

  const totals = creditTotals(books);

  const rows = useMemo(() => {
    const owing = creditRows(books);
    const owingById = new Map(owing.map((row) => [row.customer.id, row]));
    const base: CreditRow[] = showAll
      ? books.customers.map((customer) => owingById.get(customer.id) ?? { customer, due: 0, oldestDays: 0 })
      : owing;
    const q = search.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    return base
      .filter(
        (row) =>
          !q ||
          row.customer.name.toLowerCase().includes(q) ||
          (digits.length > 0 && row.customer.phone.replace(/\D/g, '').includes(digits)),
      )
      .sort((a, b) => b.due - a.due || a.customer.name.localeCompare(b.customer.name));
  }, [books, search, showAll]);

  return (
    <Screen>
      <Header
        title="Credit book"
        onBack={() => navigation.goBack()}
        right={
          <Pressable
            onPress={() => navigation.navigate('CreditSettings')}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Credit and WhatsApp settings"
            style={styles.gear}
          >
            <Text style={styles.gearText}>⚙</Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={[styles.summary, { borderColor: totals.count > 0 ? colors.expenseText : colors.hairline }]}>
          <Text style={styles.summaryLabel}>Total credit due</Text>
          <Text style={[styles.summaryValue, { color: totals.count > 0 ? colors.expenseText : colors.saleText }]}>
            {formatRs(totals.total)}
          </Text>
          <Text style={styles.summarySub}>
            {totals.count} customer{totals.count === 1 ? '' : 's'} with a balance
          </Text>
        </View>

        <Field value={search} onChangeText={setSearch} placeholder="Search name or phone" />

        <View style={styles.toggleRow}>
          {[
            { key: false, label: 'With dues' },
            { key: true, label: 'All customers' },
          ].map((tab) => {
            const on = showAll === tab.key;
            return (
              <Pressable
                key={tab.label}
                onPress={() => setShowAll(tab.key)}
                style={[styles.toggle, { backgroundColor: on ? colors.brand : colors.keypad }]}
              >
                <Text style={[styles.toggleText, { color: on ? colors.onFill : colors.ink }]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {rows.length === 0 ? (
          <Text style={styles.empty}>
            {books.customers.length === 0
              ? 'No customers yet. Enter a phone number on a sale and the customer is saved here.'
              : showAll || search
                ? 'No customers match.'
                : 'Nobody owes anything right now.'}
          </Text>
        ) : null}

        {rows.map((row) => (
          <Pressable
            key={row.customer.id}
            onPress={() => navigation.navigate('CreditLedger', { customerId: row.customer.id })}
            style={styles.row}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {row.customer.name}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {row.customer.phone}
                {row.due > 0 && row.oldestDays > 0 ? ` · oldest ${row.oldestDays} day${row.oldestDays === 1 ? '' : 's'}` : ''}
              </Text>
            </View>
            <Text style={[styles.amount, { color: row.due > 0 ? colors.expenseText : colors.muted }]}>
              {row.due > 0 ? formatRs(row.due) : 'Paid up'}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* One customer: bills, payments, collect payment, WhatsApp reminder   */
/* ------------------------------------------------------------------ */

type Panel = 'none' | 'collect' | 'remind';

export function CreditLedgerScreen() {
  const styles = useStyleSheet(creditStyles);
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, 'CreditLedger'>>();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { books, collectPayment } = useBooks();
  const { can } = useRole();
  const { customerId } = route.params;

  const customer = books.customers.find((c) => c.id === customerId);
  const due = customerBalance(books, customerId);
  const entries = useMemo(() => creditLedger(books, customerId), [books, customerId]);

  const [panel, setPanel] = useState<Panel>('none');
  const [amountText, setAmountText] = useState('');
  const [method, setMethod] = useState<'cash' | 'card'>('cash');
  const [note, setNote] = useState('');
  const [reminder, setReminder] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [settings, setSettings] = useState<CreditSettings>(DEFAULT_CREDIT_SETTINGS);
  // The last payment collected here, so its receipt can go out on WhatsApp.
  const [lastPaid, setLastPaid] = useState<number | null>(null);

  // Reload on focus so edits made in Credit & WhatsApp settings show up straight away.
  useEffect(
    () => navigation.addListener('focus', () => void loadCreditSettings().then(setSettings)),
    [navigation],
  );

  if (!customer) {
    return (
      <Screen>
        <Header title="Credit book" onBack={() => navigation.goBack()} />
        <Text style={styles.empty}>This customer was not found.</Text>
      </Screen>
    );
  }

  function messageValues(paid?: number, balance = due) {
    return {
      customer: customer!.name,
      amount: formatRs(balance),
      paid: paid ? formatRs(paid) : '',
      shop: user?.shopName ?? 'our shop',
      shopPhone: settings.shopWhatsApp,
      date: formatDay(Date.now()),
    };
  }

  function defaultReminder() {
    return fillTemplate(settings.reminderTemplate, messageValues());
  }

  async function sendReceipt() {
    if (!lastPaid) return;
    try {
      await Linking.openURL(waMe(customer!.phone, fillTemplate(settings.receiptTemplate, messageValues(lastPaid))));
    } catch {
      setError('Could not open WhatsApp on this phone.');
    }
  }

  function openPanel(next: Panel) {
    setError(null);
    setNotice(null);
    setLastPaid(null);
    if (panel === next) {
      setPanel('none');
      return;
    }
    if (next === 'remind') setReminder(defaultReminder());
    if (next === 'collect') setAmountText('');
    setPanel(next);
  }

  async function saveCollect() {
    setError(null);
    setNotice(null);
    const amount = Math.round(Number(amountText) || 0);
    if (amount <= 0) {
      setError('Enter the amount received.');
      return;
    }
    setBusy(true);
    try {
      await collectPayment(customerId, amount, method, note);
      setNotice(`Collected ${formatRs(amount)}.`);
      setLastPaid(settings.offerReceipt ? amount : null);
      setAmountText('');
      setNote('');
      setPanel('none');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the payment.');
    } finally {
      setBusy(false);
    }
  }

  async function sendReminder() {
    setError(null);
    const text = reminder.trim();
    if (!text) {
      setError('Write a message first.');
      return;
    }
    try {
      await Linking.openURL(waMe(customer!.phone, text));
    } catch {
      setError('Could not open WhatsApp on this phone.');
    }
  }

  return (
    <Screen>
      <Header title={customer.name} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={[styles.summary, { borderColor: due > 0 ? colors.expenseText : colors.hairline }]}>
          <Text style={styles.summaryLabel}>{customer.phone}</Text>
          <Text style={[styles.summaryValue, { color: due > 0 ? colors.expenseText : colors.saleText }]}>
            {due > 0 ? formatRs(due) : 'No balance due'}
          </Text>
          {due > 0 ? <Text style={styles.summarySub}>Balance to collect</Text> : null}
        </View>

        {notice ? <Text style={[styles.notice, { color: colors.saleText }]}>{notice}</Text> : null}
        {lastPaid ? (
          <Pressable onPress={sendReceipt} style={[styles.receiptBtn, { backgroundColor: colors.saleWash, borderColor: colors.sale }]}>
            <Text style={[styles.receiptText, { color: colors.saleText }]}>💬  Send receipt on WhatsApp</Text>
          </Pressable>
        ) : null}

        <View style={styles.actions}>
          <View style={{ flex: 1 }}>
            <FillButton
              label="Collect payment"
              color={colors.saleText}
              onPress={() => openPanel('collect')}
              disabled={due <= 0 || !can('collectCredit')}
            />
          </View>
          <View style={{ flex: 1 }}>
            <FillButton label="WhatsApp reminder" onPress={() => openPanel('remind')} />
          </View>
        </View>

        {panel === 'collect' ? (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Collect payment</Text>
            <Field
              value={amountText}
              onChangeText={(text) => setAmountText(text.replace(/[^\d]/g, '').slice(0, 9))}
              placeholder={`Amount (owes ${formatRs(due)})`}
              keyboardType="numeric"
            />
            <View style={styles.toggleRow}>
              <Pressable onPress={() => setAmountText(String(due))} style={[styles.toggle, { backgroundColor: colors.keypad }]}>
                <Text style={[styles.toggleText, { color: colors.ink }]}>Full {formatRs(due)}</Text>
              </Pressable>
              {(['cash', 'card'] as const).map((item) => {
                const on = method === item;
                return (
                  <Pressable
                    key={item}
                    onPress={() => setMethod(item)}
                    style={[styles.toggle, { backgroundColor: on ? colors.brand : colors.keypad }]}
                  >
                    <Text style={[styles.toggleText, { color: on ? colors.onFill : colors.ink }]}>
                      {item === 'cash' ? 'Cash' : 'Card'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Field value={note} onChangeText={(text) => setNote(text.slice(0, 120))} placeholder="Note (optional)" />
            <FillButton label="Save payment" color={colors.saleText} onPress={saveCollect} busy={busy} />
          </View>
        ) : null}

        {panel === 'remind' ? (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Reminder message</Text>
            <TextInput
              value={reminder}
              onChangeText={setReminder}
              multiline
              textAlignVertical="top"
              placeholder="Type your message"
              placeholderTextColor={colors.muted}
              style={[styles.message, { borderColor: colors.line, color: colors.ink, backgroundColor: colors.white }]}
            />
            <View style={styles.linkRow}>
              <Pressable onPress={() => setReminder(defaultReminder())} style={styles.linkBtn}>
                <Text style={[styles.linkText, { color: colors.brand }]}>Reset message</Text>
              </Pressable>
              <Pressable onPress={() => navigation.navigate('CreditSettings')} style={styles.linkBtn}>
                <Text style={[styles.linkText, { color: colors.brand }]}>Edit default & shop number ›</Text>
              </Pressable>
            </View>
            <FillButton label="Open WhatsApp" onPress={sendReminder} />
          </View>
        ) : null}

        <ErrorText message={error} />

        <Text style={styles.heading}>Bills and payments</Text>
        {entries.length === 0 ? <Text style={styles.empty}>No credit bills yet.</Text> : null}
        {entries.map((entry) =>
          entry.kind === 'bill' ? (
            <View key={`b-${entry.id}`} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{entry.label}</Text>
                <Text style={styles.meta}>
                  {formatDay(entry.at)} · {formatTime(entry.at)}
                </Text>
                <Text style={styles.meta}>
                  Bill {formatRs(entry.total)}
                  {entry.received > 0 ? ` · received ${formatRs(entry.received)}` : ''}
                </Text>
              </View>
              <Text style={[styles.amount, { color: colors.expenseText }]}>+{formatRs(entry.due)}</Text>
            </View>
          ) : (
            <View key={`p-${entry.id}`} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{entry.label}</Text>
                <Text style={styles.meta}>
                  {formatDay(entry.at)} · {formatTime(entry.at)}
                </Text>
                {entry.note ? <Text style={styles.meta}>{entry.note}</Text> : null}
              </View>
              <Text style={[styles.amount, { color: colors.saleText }]}>-{formatRs(entry.amount)}</Text>
            </View>
          ),
        )}
      </ScrollView>
    </Screen>
  );
}

function creditStyles(c: ColorPalette) {
  return {
    body: {
      paddingHorizontal: 16,
      paddingBottom: 32,
      gap: 12,
    },
    summary: {
      borderWidth: 1,
      borderRadius: 16,
      paddingHorizontal: 18,
      paddingVertical: 16,
      gap: 2,
    },
    summaryLabel: {
      fontFamily: fonts.regular,
      fontSize: 13,
      color: c.muted,
    },
    summaryValue: {
      fontFamily: fonts.bold,
      fontSize: 30,
    },
    summarySub: {
      fontFamily: fonts.regular,
      fontSize: 12,
      color: c.muted,
    },
    toggleRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    toggle: {
      minHeight: 40,
      paddingHorizontal: 14,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    toggleText: {
      fontFamily: fonts.semibold,
      fontSize: 13,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 60,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: c.rowLine,
    },
    name: {
      fontFamily: fonts.semibold,
      fontSize: 15,
      color: c.ink,
    },
    meta: {
      fontFamily: fonts.regular,
      fontSize: 12,
      color: c.muted,
    },
    amount: {
      fontFamily: fonts.bold,
      fontSize: 15,
    },
    empty: {
      textAlign: 'center',
      fontFamily: fonts.regular,
      fontSize: 13,
      lineHeight: 19,
      color: c.muted,
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    heading: {
      marginTop: 4,
      fontFamily: fonts.bold,
      fontSize: 16,
      color: c.ink,
    },
    actions: {
      flexDirection: 'row',
      gap: 10,
    },
    panel: {
      borderWidth: 1,
      borderColor: c.hairline,
      borderRadius: 16,
      padding: 14,
      gap: 10,
    },
    panelTitle: {
      fontFamily: fonts.semibold,
      fontSize: 15,
      color: c.ink,
    },
    message: {
      minHeight: 120,
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontFamily: fonts.regular,
      fontSize: 14,
      lineHeight: 20,
    },
    linkBtn: {
      minHeight: 36,
      justifyContent: 'center',
    },
    linkRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 8,
    },
    gear: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    gearText: {
      fontSize: 22,
      color: c.ink,
    },
    receiptBtn: {
      minHeight: 48,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    receiptText: {
      fontFamily: fonts.semibold,
      fontSize: 14,
    },
    linkText: {
      fontFamily: fonts.semibold,
      fontSize: 13,
    },
    notice: {
      textAlign: 'center',
      fontFamily: fonts.semibold,
      fontSize: 13,
    },
  };
}
