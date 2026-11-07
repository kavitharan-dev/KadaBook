import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { CalendarIcon, CardIcon, CashIcon, CheckIcon, PersonIcon, PhoneIcon } from './Icons';
import { IconField } from './ui';

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

/** react-native-web draws its own black focus ring on inputs; our fields already show focus via border/icon tint. */
const webInputFix = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : undefined;

const MODES: PaymentMode[] = ['cash', 'card', 'credit'];
const MODE_ICON = { cash: CashIcon, card: CardIcon, credit: CalendarIcon };

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

  const twoCols = allow.pay && allow.discount;
  const hasBalance = allow.pay && creditBalance > 0;
  const receivedTyped = value.receivedText.trim() === '' ? null : Math.round(Number(value.receivedText) || 0);
  const changeDue = allow.pay && receivedTyped !== null && receivedTyped > toPay ? receivedTyped - toPay : 0;

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

      {open ? (
        <View style={[styles.body, embedded ? styles.bodyBare : null]}>
          {allow.customer ? (
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <View style={styles.sectionHeadLeft}>
                  <PersonIcon color={colors.brand} size={16} />
                  <Text style={[styles.sectionTitle, { color: colors.ink }]}>Customer Details</Text>
                </View>
                <View style={[styles.optionalBadge, { backgroundColor: colors.keypad }]}>
                  <Text style={[styles.optionalBadgeText, { color: colors.muted }]}>Optional</Text>
                </View>
              </View>
              <View style={styles.col}>
                <IconField
                  icon={<PhoneIcon color={colors.brand} size={17} />}
                  iconTint={colors.brand}
                  value={value.customerPhone}
                  onChangeText={onPhoneChange}
                  placeholder={needsPhone ? 'Phone number (required for credit)' : 'Customer Phone Number'}
                  keyboardType="phone-pad"
                  containerStyle={needsPhone ? { borderColor: colors.expenseText } : undefined}
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
                <IconField
                  icon={<PersonIcon color={colors.brand} size={17} />}
                  iconTint={colors.brand}
                  value={value.customerName}
                  onChangeText={(text) => patch({ customerName: text.slice(0, 60) })}
                  placeholder="Customer Name"
                />
              </View>
            </View>
          ) : null}

          {allow.pay ? (
            <View style={styles.section}>
              <View style={styles.sectionHeadLeft}>
                <CardIcon color={colors.brand} size={16} />
                <Text style={[styles.sectionTitle, { color: colors.ink }]}>Payment Method</Text>
              </View>
              <View style={styles.payRow}>
                {MODES.map((mode) => {
                  const on = value.paymentMode === mode;
                  const ModeIcon = MODE_ICON[mode];
                  return (
                    <Pressable
                      key={mode}
                      onPress={() => patch({ paymentMode: mode })}
                      style={[
                        styles.payCard,
                        {
                          borderColor: on ? colors.sale : colors.line,
                          backgroundColor: on ? colors.saleWash : colors.white,
                        },
                      ]}
                    >
                      {on ? (
                        <View style={[styles.payCheck, { backgroundColor: colors.sale }]}>
                          <CheckIcon color={colors.onFill} size={11} />
                        </View>
                      ) : null}
                      <ModeIcon color={on ? colors.saleText : colors.muted} size={20} />
                      <Text
                        style={[styles.payCardText, { color: on ? colors.saleText : colors.ink }]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >
                        {mode === 'credit' ? 'Credit / Due' : PAYMENT_MODE_LABEL[mode]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {allow.pay || allow.discount ? (
            <View style={twoCols ? styles.row : styles.col}>
              {allow.pay ? (
                <View style={[styles.col, twoCols ? styles.flex1 : null]}>
                  <Text style={[styles.fieldLabel, { color: colors.ink }]}>Amount Received</Text>
                  <IconField
                    icon={<CashIcon color={colors.sale} size={17} />}
                    iconTint={colors.sale}
                    value={value.receivedText}
                    onChangeText={(text) => patch({ receivedText: text.replace(/[^\d]/g, '').slice(0, 9) })}
                    placeholder={toPay > 0 ? formatRs(toPay) : 'Received'}
                    keyboardType="numeric"
                  />
                  {creditBalance > 0 ? (
                    <Text style={[styles.hint, { color: colors.expenseText }]}>
                      {formatRs(creditBalance)} will be saved to the credit book.
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {allow.discount ? (
                <View style={[styles.col, twoCols ? styles.flex1 : null]}>
                  <View style={styles.discountHead}>
                    <Text style={[styles.fieldLabel, { color: colors.ink }]}>Discount</Text>
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
                  </View>
                  <TextInput
                    value={value.discountText}
                    onChangeText={(text) => patch({ discountText: text.replace(/[^\d.]/g, '').slice(0, 8) })}
                    placeholder="0.00"
                    placeholderTextColor={colors.placeholder}
                    keyboardType="numeric"
                    style={[
                      styles.input,
                      styles.inputFull,
                      { borderColor: colors.line, backgroundColor: colors.keypad, color: colors.ink },
                      webInputFix,
                    ]}
                  />
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.payableWrap}>
            {off > 0 ? (
              <View style={styles.payableNote}>
                <Text style={[styles.totalsText, { color: colors.muted }]}>Subtotal {formatRs(subtotal)}</Text>
                <Text style={[styles.totalsText, { color: colors.muted }]}>Discount -{formatRs(off)}</Text>
              </View>
            ) : null}
            <View
              style={[
                styles.payableBar,
                {
                  backgroundColor: hasBalance
                    ? colors.expenseWash
                    : changeDue > 0
                      ? `${colors.brand}17`
                      : colors.saleWash,
                },
              ]}
            >
              <View style={styles.payableLeft}>
                <View
                  style={[
                    styles.payableCheck,
                    {
                      backgroundColor: hasBalance ? colors.expenseText : changeDue > 0 ? colors.brand : colors.sale,
                    },
                  ]}
                >
                  <CheckIcon color={colors.onFill} size={12} />
                </View>
                <Text style={[styles.payableLabel, { color: colors.ink }]}>
                  {hasBalance ? 'Balance Amount' : changeDue > 0 ? 'Change' : 'Payable Amount'}
                </Text>
              </View>
              <Text
                style={[
                  styles.payableValue,
                  { color: hasBalance ? colors.expenseText : changeDue > 0 ? colors.brand : colors.saleText },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formatRs(hasBalance ? creditBalance : changeDue > 0 ? changeDue : toPay)}
              </Text>
            </View>
            {hasBalance ? (
              <View style={styles.pills}>
                <View style={[styles.pill, { backgroundColor: colors.saleWash }]}>
                  <Text style={[styles.pillLabel, { color: colors.saleText }]}>Received</Text>
                  <Text style={[styles.pillValue, { color: colors.saleText }]}>
                    {formatRs(toPay - creditBalance)}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
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
  body: { gap: 16, paddingBottom: 12 },
  section: { gap: 10 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 14 },
  optionalBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  optionalBadgeText: { fontFamily: fonts.semibold, fontSize: 11 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  col: { gap: 8 },
  flex1: { flex: 1 },
  fieldLabel: { fontFamily: fonts.semibold, fontSize: 13, marginBottom: 2 },
  discountHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  payRow: { flexDirection: 'row', gap: 8 },
  payCard: {
    flex: 1,
    minHeight: 72,
    borderWidth: 1.5,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  payCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payCardText: { fontFamily: fonts.semibold, fontSize: 12, textAlign: 'center' },
  chipText: { fontFamily: fonts.semibold, fontSize: 13 },
  hint: { fontFamily: fonts.regular, fontSize: 12 },
  unitRow: { flexDirection: 'row', gap: 6 },
  unit: {
    width: 40,
    minHeight: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputFull: { flex: 0, alignSelf: 'stretch' },
  suggestCol: { gap: 6 },
  suggest: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  input: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  payableWrap: { gap: 8 },
  payableNote: { gap: 2 },
  totalsText: { fontFamily: fonts.regular, fontSize: 13 },
  payableBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  payableLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  payableCheck: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  payableLabel: { fontFamily: fonts.semibold, fontSize: 14 },
  payableValue: { fontFamily: fonts.bold, fontSize: 19, flexShrink: 1, textAlign: 'right' },
  pills: { flexDirection: 'row', gap: 8 },
  pill: { flex: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10, alignItems: 'center' },
  pillLabel: { fontFamily: fonts.semibold, fontSize: 11 },
  pillValue: { fontFamily: fonts.bold, fontSize: 15 },
});
