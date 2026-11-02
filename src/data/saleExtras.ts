/**
 * Extra fields for sales and expenses: payment mode, discount, customer, notes, back-dated entries.
 * Everything here is optional, so old records and old callers keep working.
 */

export type PaymentMode = 'cash' | 'card' | 'credit';

export const PAYMENT_MODE_LABEL: Record<PaymentMode, string> = {
  cash: 'Cash',
  card: 'Card',
  credit: 'Credit (Udhaar)',
};

/** What the New Sale screen sends: the discount as typed (Rs or %). */
export type DiscountInput = { type: 'amount' | 'percent'; value: number };

/** What is stored on the sale: the discount plus the rupee value it came to. */
export type SaleDiscount = DiscountInput & { amount: number };

export type SaleExtrasInput = {
  paymentMode?: PaymentMode;
  discount?: DiscountInput;
  customerName?: string;
  customerPhone?: string;
  customerId?: string;
  note?: string;
  createdAt?: number;
  /** Rupees the customer paid now when the rest of the bill goes to credit. */
  paidAmount?: number;
  branchId?: string;
};

export type SaleExtras = {
  paymentMode?: PaymentMode;
  discount?: SaleDiscount;
  /** Bill total before the discount. */
  subtotal?: number;
  customerName?: string;
  customerPhone?: string;
  customerId?: string;
  note?: string;
  createdAt?: number;
  editedAt?: number;
  /** Received at the counter on a credit bill. The balance is amount - paidAmount. */
  paidAmount?: number;
  /** Kitchen & Stock: the branch that made the sale. */
  branchId?: string;
};

export type ExpenseExtras = { note?: string; createdAt?: number; branchId?: string };

/** Rupees taken off the bill. Never more than the bill itself. */
export function discountAmount(subtotal: number, discount?: DiscountInput): number {
  if (!discount || !Number.isFinite(discount.value) || discount.value <= 0) return 0;
  const raw =
    discount.type === 'percent'
      ? Math.round((subtotal * Math.min(discount.value, 100)) / 100)
      : Math.round(discount.value);
  return Math.min(Math.max(raw, 0), subtotal);
}

const MAX_FUTURE_MS = 60 * 1000;

function cleanCreatedAt(createdAt?: number) {
  if (createdAt === undefined) return undefined;
  if (!Number.isFinite(createdAt) || createdAt > Date.now() + MAX_FUTURE_MS) {
    throw new Error('The date cannot be in the future.');
  }
  return Math.round(createdAt);
}

/**
 * Validates and tidies the extras. Keys with no value are left out on purpose:
 * Firestore rejects `undefined` field values.
 */
export function cleanSaleExtras(input: SaleExtrasInput | undefined, subtotal: number): SaleExtras {
  const out: SaleExtras = {};
  if (!input) return out;

  const customerName = input.customerName?.trim().slice(0, 60);
  const customerPhone = input.customerPhone?.replace(/[^\d+]/g, '').slice(0, 20);
  const note = input.note?.trim().slice(0, 120);
  const createdAt = cleanCreatedAt(input.createdAt);

  const phoneDigits = (customerPhone ?? '').replace(/\D/g, '').length;
  if (input.paymentMode) {
    // WhatsApp reminders need the phone, so credit needs a phone. The name is optional.
    if (input.paymentMode === 'credit' && phoneDigits < 9) {
      throw new Error('Enter the customer phone number for a credit sale.');
    }
    out.paymentMode = input.paymentMode;
  }
  if (customerPhone && phoneDigits < 9) {
    throw new Error('Enter a valid phone number (at least 9 digits).');
  }

  const off = discountAmount(subtotal, input.discount);
  if (input.discount && off > 0) {
    if (off >= subtotal) throw new Error('The discount cannot be the full bill amount.');
    out.discount = { type: input.discount.type, value: input.discount.value, amount: off };
    out.subtotal = subtotal;
  }

  if (input.paymentMode === 'credit' && input.paidAmount !== undefined) {
    const paid = Math.round(input.paidAmount);
    if (!Number.isFinite(paid) || paid < 0) throw new Error('Enter a valid received amount.');
    if (paid >= subtotal - off) {
      throw new Error('Received amount covers the full bill. Choose Cash or Card instead of Credit.');
    }
    if (paid > 0) out.paidAmount = paid;
  }

  if (customerPhone) out.customerPhone = customerPhone;
  if (customerName) out.customerName = customerName;
  else if (customerPhone) out.customerName = `Customer ${customerPhone}`;
  if (input.customerId?.trim()) out.customerId = input.customerId.trim();
  if (note) out.note = note;
  if (createdAt !== undefined) out.createdAt = createdAt;
  if (input.branchId?.trim()) out.branchId = input.branchId.trim().slice(0, 64);
  return out;
}

export function cleanExpenseExtras(input?: ExpenseExtras): ExpenseExtras {
  const out: ExpenseExtras = {};
  if (!input) return out;
  const note = input.note?.trim().slice(0, 120);
  const createdAt = cleanCreatedAt(input.createdAt);
  if (note) out.note = note;
  if (createdAt !== undefined) out.createdAt = createdAt;
  if (input.branchId?.trim()) out.branchId = input.branchId.trim().slice(0, 64);
  return out;
}
