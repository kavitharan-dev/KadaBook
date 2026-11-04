import { useAuth } from '../context/AuthContext';
import type { PermissionOverrides, ShopUser, StaffRole } from '../data/types';

/**
 * What each role may do in the app. Firestore rules enforce the same split on the server,
 * so hiding a button here is for clarity, not security. Keep the two templates below in step
 * with `staffPerm` in firebase/firestore.rules.
 */
export type Permission =
  | 'addSale'
  | 'editSale'
  | 'deleteSale'
  | 'addExpense'
  | 'manageProducts'
  | 'viewReports'
  | 'exportData'
  | 'manageStock'
  | 'collectCredit'
  | 'closeDay'
  | 'manageBranches'
  | 'manageStaff'
  | 'viewAudit'
  | 'shopSettings';

const CASHIER: Permission[] = ['addSale', 'collectCredit', 'closeDay'];

const MANAGER: Permission[] = [
  ...CASHIER,
  'editSale',
  'deleteSale',
  'addExpense',
  'manageProducts',
  'viewReports',
  'exportData',
  'manageStock',
  'viewAudit',
];

export const ROLE_LABEL: Record<StaffRole, string> = { owner: 'Owner', manager: 'Manager', cashier: 'Cashier' };

export const ROLE_HELP: Record<Exclude<StaffRole, 'owner'>, string> = {
  manager: 'Everything except staff, branches and shop settings: prices, expenses, stock, reports, edit and delete bills.',
  cashier: 'Billing only: new sales, drafts, customers, collect credit, close the day. Cannot delete or edit bills, see reports or change prices.',
};

/** The ticks the owner can change per staff member. "Edit bills" also covers deleting them. */
export const TICK_PERMISSIONS: { key: Permission; label: string }[] = [
  { key: 'addSale', label: 'New sales' },
  { key: 'editSale', label: 'Edit & delete bills' },
  { key: 'addExpense', label: 'Expenses' },
  { key: 'manageProducts', label: 'Products & prices' },
  { key: 'manageStock', label: 'Kitchen & stock' },
  { key: 'viewReports', label: 'Reports' },
  { key: 'collectCredit', label: 'Collect credit' },
  { key: 'closeDay', label: 'Close the day' },
];

export function roleOf(user: ShopUser | null): StaffRole {
  return user?.role ?? 'owner';
}

export function templateAllows(role: StaffRole, permission: Permission) {
  if (role === 'owner') return true;
  return (role === 'manager' ? MANAGER : CASHIER).includes(permission);
}

export function roleCan(role: StaffRole, overrides: PermissionOverrides | undefined, permission: Permission) {
  if (role === 'owner') return true;
  const override = overrides?.[permission === 'deleteSale' ? 'editSale' : permission];
  return typeof override === 'boolean' ? override : templateAllows(role, permission);
}

export function can(user: ShopUser | null, permission: Permission) {
  return roleCan(roleOf(user), user?.permissions, permission);
}

export function useRole() {
  const { user } = useAuth();
  return { role: roleOf(user), can: (permission: Permission) => can(user, permission) };
}
