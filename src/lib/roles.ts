import { useAuth } from '../context/AuthContext';
import type { ShopUser, StaffRole } from '../data/types';

/**
 * What each role may do in the app. Firestore rules enforce the same split on the server,
 * so hiding a button here is for clarity, not security.
 */
export type Permission =
  | 'editSale'
  | 'deleteSale'
  | 'addExpense'
  | 'manageProducts'
  | 'viewReports'
  | 'exportData'
  | 'manageStock'
  | 'manageBranches'
  | 'manageStaff'
  | 'viewAudit'
  | 'shopSettings';

const MANAGER: Permission[] = [
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
  cashier: 'Billing only: new sales, drafts, customers, collect credit. Cannot delete or edit bills, see reports or change prices.',
};

export function roleOf(user: ShopUser | null): StaffRole {
  return user?.role ?? 'owner';
}

export function can(user: ShopUser | null, permission: Permission) {
  const role = roleOf(user);
  if (role === 'owner') return true;
  if (role === 'manager') return MANAGER.includes(permission);
  return false;
}

export function useRole() {
  const { user } = useAuth();
  return { role: roleOf(user), can: (permission: Permission) => can(user, permission) };
}
