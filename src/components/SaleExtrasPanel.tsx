import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import {
  PAYMENT_MODE_LABEL,
  discountAmount,
  type DiscountInput,
  type PaymentMode,
  type SaleExtrasInput,
} from '../data/saleExtras';
import { formatRs } from '../lib/format';
import { phoneKey } from '../lib/shopPlus';
import { fonts } from '../theme/fonts';

export type SaleExtrasState = {
  paymentMode: PaymentMode;
  discountType: 'amount' | 'percent';
  discountText: string;
  customerName: string;
  customerPhone: string;
  /** What the customer hands over now. Empty means the full bill is paid. */
  receivedText: string;
};

export const EMPTY_EXTRAS: SaleExtrasState = {
  paymentMode: 'cash',
  discountType: 'amount',
  discountText: '',
  customerName: '',
  customerPhone: '',
  receivedText: '',
};

/** Which parts of the panel this shop's plan unlocks. */
export type ExtrasAllow = { pay: boolean; discount: boolean; customer: boolean };

/** A customer already saved in the credit book, for suggestions. */
export type PanelCustomer = { name: string; phone: string; due: number };

/**
 * Turns the panel state into what BooksContext expects. Locked parts are never sent.
 * If the customer hands over less than the bill, the sale becomes a credit sale for the balance.
 */
export function buildExtras(
  state: SaleExtrasState,
  allow: ExtrasAllow,
  subtotal = 0,
): SaleExtrasInput | undefined {
  const out: SaleExtrasInput = {};

  let discount: DiscountInput | undefined;
  const discountValue = Number(state.discountText);
  if (allow.discount && Number.isFinite(discountValue) && discountValue > 0) {
    discount = { type: state.discountType, value: discountValue };
    out.discount = discount;
  }

  if (allow.pay) {
    let mode = state.paymentMode;
    const toPay = Math.max(0, subtotal - discountAmount(subtotal, discount));
    const typed = state.receivedText.trim();
    if (typed !== '' && toPay > 0) {
      const received = Math.round(Number(typed));
      if (Number.isFinite(received)) {
        if (received < toPay) {
          mode = 'credit';
          out.paidAmount = received;
        } else if (mode === 'credit') {
          mode = 'cash';
        }
      }
    }
    out.paymentMode = mode;
  }

  if (allow.customer) {
    if (state.customerName.trim()) out.customerName = state.customerName.trim();
    if (state.customerPhone.trim()) out.customerPhone = state.customerPhone.trim();
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Discount, amount to pay, and what goes to the credit book, as the panel shows them. */
export function extrasTotals(value: SaleExtrasState, allow: ExtrasAllow, subtotal: number) {
  const off = allow.discount
    ? discountAmount(subtotal, {
        type: value.discountType,
        value: Number(value.discountText) || 0,
      })
    : 0;
  const toPay = Math.max(0, subtotal - off);
  const typedReceived = value.receivedText.trim() === '' ? null : Math.round(Number(value.receivedText) || 0);
  let creditBalance = 0;
  if (allow.pay && toPay > 0) {
    if (typedReceived !== null && typedReceived < toPay) creditBalance = toPay - typedReceived;
    else if (typedReceived === null && value.paymentMode === 'credit') creditBalance = toPay;
  }
  return { off, toPay, creditBalance };
}

const MODES: PaymentMode[] = ['cash', 'card', 'credit'];

export function SaleExtrasPanel({
  value,
  onChange,
  subtotal,
  allow,
  customers,
  embedded,
}: {
  value: SaleExtrasState;
  onChange: (next: SaleExtrasState) => void;
  subtotal: number;
  allow: ExtrasAllow;
  /** No longer used: shops without the feature simply do not see the panel. */
  onLockedPress?: () => void;
  /** Customers already in the credit book, so the same person is not typed two different ways. */
  customers?: PanelCustomer[];
  /** Inside the checkout sheet: no frame, header or totals (the sheet shows those), always open. */
  embedded?: boolean;
}) {
  const { colors } = useTheme();
  const [openState, setOpen] = useState(true);
  const open = embedded || openState;
  const anyAllowed = allow.pay || allow.discount || allow.customer;

  if (!anyAllowed) return null;

  const list = customers ?? [];
  const { off, toPay, creditBalance } = extrasTotals(value, allow, subtotal);
  const needsPhone = allow.customer && creditBalance > 0 && phoneKey(value.customerPhone).length < 9;

  const phoneDigits = value.customerPhone.replace(/\D/g, '');
  const typedKey = phoneKey(value.customerPhone);
  const matched = typedKey.length >= 9 ? list.find((c) => phoneKey(c.phone) === typedKey) : undefined;
  const nameQuery = value.customerName.trim().toLowerCase();
  const suggestions = matched
    ? []
    : list
        .filter((c) => {
          const byPhone = phoneDigits.length >= 3 && c.phone.replace(/\D/g, '').includes(phoneDigits);
          const byName = nameQuery.length >= 2 && c.name.toLowerCase().includes(nameQuery);
          return byPhone || byName;
        })
        .slice(0, 5);

  const summary = [
    allow.pay ? PAYMENT_MODE_LABEL[creditBalance > 0 ? 'credit' : value.paymentMode] : null,
    off > 0 ? `-${formatRs(off)}` : null,
    creditBalance > 0 ? `Due ${formatRs(creditBalance)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  function patch(next: Partial<SaleExtrasState>) {
    onChange({ ...value, ...next });
  }

  function onPhoneChange(text: string) {
    const phone = text.replace(/[^\d+]/g, '').slice(0, 15);
    const key = phoneKey(phone);
    const hit = key.length >= 9 ? list.find((c) => phoneKey(c.phone) === key) : undefined;
    const nameIsFree = !value.customerName.trim() || value.customerName === matched?.name;
    patch({ customerPhone: phone, ...(hit && nameIsFree ? { customerName: hit.name } : {}) });
  }

  const showTotals = !embedded && (off > 0 || creditBalance > 0);

  return (
    <View
      style={
        embedded ? styles.bare : [styles.box, { borderColor: colors.line, backgroundColor: colors.white }]
      }
    >
      {embedded ? null : (
        <Pressable onPress={() => setOpen((v) => !v)} style={styles.headerInner}>
          <Text style={[styles.title, { color: colors.ink }]}>Customer and payment</Text>
          <Text style={[styles.summary, { color: colors.muted }]} numberOfLines={1}>
            {summary} {open ? '▴' : '▾'}
          </Text>
        </Pressable>
      )}

      {showTotals ? (
        <View style={styles.totals}>
          {off > 0 ? (
            <>
              <Text style={[styles.totalsText, { color: colors.muted }]}>Subtotal {formatRs(subtotal)}</Text>
              <Text style={[styles.totalsText, { color: colors.muted }]}>Discount -{formatRs(off)}</Text>
            </>
          ) : null}
          <Text style={[styles.totalsStrong, { color: colors.ink }]}>To pay {formatRs(toPay)}</Text>
          {creditBalance > 0 ? (
            <>
              <Text style={[styles.totalsText, { color: colors.muted }]}>
                Received {formatRs(toPay - creditBalance)}
              </Text>
              <Text style={[styles.totalsStrong, { color: colors.expenseText }]}>
                Balance to credit book {formatRs(creditBalance)}
              </Text>
            </>
          ) : null}
        </View>
      ) : null}

      {open ? (
        <View style={[styles.body, embedded ? styles.bodyBare : null]}>
          {allow.customer ? (
            <View style={styles.col}>
              <TextInput
                value={value.customerPhone}
                onChangeText={onPhoneChange}
                placeholder={needsPhone ? 'Customer phone (required for credit)' : 'Customer phone'}
                placeholderTextColor={needsPhone ? colors.expenseText : colors.muted}
                keyboardType="phone-pad"
                style={[
                  styles.input,
                  styles.inputFull,
                  { borderColor: needsPhone ? colors.expenseText : colors.line, color: colors.ink },
                ]}
              />
              {matched ? (
                <Text style={[styles.hint, { color: colors.muted }]}>
                  Existing customer{matched.due > 0 ? ` · due ${formatRs(matched.due)}` : ''}
                </Text>
              ) : null}
              {suggestions.length > 0 ? (
                <View style={styles.suggestCol}>
                  {suggestions.map((c) => (
                    <Pressable
                      key={`${c.phone}-${c.name}`}
                      onPress={() => patch({ customerPhone: c.phone, customerName: c.name })}
                      style={[styles.suggest, { backgroundColor: colors.keypad }]}
                    >
                      <Text style={[styles.chipText, { color: colors.ink }]} numberOfLines={1}>
                        {c.phone} · {c.name}
                        {c.due > 0 ? ` · due ${formatRs(c.due)}` : ''}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              <TextInput
                value={value.customerName}
                onChangeText={(text) => patch({ customerName: text.slice(0, 60) })}
                placeholder="Customer name (optional)"
                placeholderTextColor={colors.muted}
                style={[styles.input, styles.inputFull, { borderColor: colors.line, color: colors.ink }]}
              />
            </View>
          ) : null}

          {allow.pay ? (
            <View style={styles.row}>
              {MODES.map((mode) => {
                const on = value.paymentMode === mode;
                return (
                  <Pressable
                    key={mode}
                    onPress={() => patch({ paymentMode: mode })}
                    style={[styles.chip, { backgroundColor: on ? colors.brand : colors.keypad }]}
                  >
                    <Text style={[styles.chipText, { color: on ? colors.onFill : colors.ink }]}>
                      {mode === 'credit' ? 'Credit' : PAYMENT_MODE_LABEL[mode]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {allow.pay ? (
            <View style={styles.col}>
              <TextInput
                value={value.receivedText}
                onChangeText={(text) => patch({ receivedText: text.replace(/[^\d]/g, '').slice(0, 9) })}
                placeholder={toPay > 0 ? `Received (blank = full ${formatRs(toPay)})` : 'Received'}
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                style={[styles.input, styles.inputFull, { borderColor: colors.line, color: colors.ink }]}
              />
              {creditBalance > 0 ? (
                <Text style={[styles.hint, { color: colors.expenseText }]}>
                  {formatRs(creditBalance)} will be saved to the credit book.
                </Text>
              ) : null}
            </View>
          ) : null}

          {allow.discount ? (
            <View style={styles.row}>
              <View style={styles.unitRow}>
                {(['amount', 'percent'] as const).map((type) => {
                  const on = value.discountType === type;
                  return (
                    <Pressable
                      key={type}
                      onPress={() => patch({ discountType: type })}
                      style={[styles.unit, { backgroundColor: on ? colors.brand : colors.keypad }]}
                    >
                      <Text style={[styles.chipText, { color: on ? colors.onFill : colors.ink }]}>
                        {type === 'amount' ? 'Rs' : '%'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                value={value.discountText}
                onChangeText={(text) => patch({ discountText: text.replace(/[^\d.]/g, '').slice(0, 8) })}
                placeholder="Discount"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                style={[styles.input, { borderColor: colors.line, color: colors.ink }]}
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  bare: {},
  bodyBare: { paddingBottom: 0 },
  headerInner: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: { fontFamily: fonts.semibold, fontSize: 14 },
  summary: { fontFamily: fonts.semibold, fontSize: 13, flexShrink: 1 },
  totals: { gap: 2, paddingBottom: 8 },
  totalsText: { fontFamily: fonts.regular, fontSize: 13 },
  totalsStrong: { fontFamily: fonts.bold, fontSize: 15 },
  body: { gap: 10, paddingBottom: 12 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  col: { gap: 8 },
  chip: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontFamily: fonts.semibold, fontSize: 13 },
  hint: { fontFamily: fonts.regular, fontSize: 12 },
  unitRow: { flexDirection: 'row', gap: 6 },
  unit: {
    width: 44,
    minHeight: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputFull: { flex: 0, alignSelf: 'stretch' },
  suggestCol: { gap: 6 },
  suggest: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  input: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
});
