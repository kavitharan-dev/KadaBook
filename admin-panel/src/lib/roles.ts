import type { AdminRole } from '../types/models';

export type NavItem = {
  path: string;
  label: string;
  roles: AdminRole[];
};

/** Sidebar order from design file. */
export const NAV: NavItem[] = [
  { path: '/', label: 'Dashboard', roles: ['super_admin', 'staff'] },
  { path: '/approvals', label: 'Approvals', roles: ['super_admin', 'staff'] },
  { path: '/users', label: 'Users / Shops', roles: ['super_admin'] },
  { path: '/subscriptions', label: 'Subscriptions', roles: ['super_admin'] },
  { path: '/payments', label: 'Payments', roles: ['super_admin', 'staff'] },
  { path: '/announcements', label: 'Announcements', roles: ['super_admin'] },
  { path: '/access-control', label: 'Access Control', roles: ['super_admin'] },
  { path: '/app-control', label: 'App Control', roles: ['super_admin'] },
  { path: '/support', label: 'Support', roles: ['super_admin', 'staff'] },
  { path: '/audit', label: 'Audit Log', roles: ['super_admin'] },
  { path: '/admins', label: 'Admin Roles', roles: ['super_admin'] },
];

export function navForRole(role: AdminRole) {
  return NAV.filter((item) => item.roles.includes(role));
}

export function canAccess(role: AdminRole, path: string) {
  const item = NAV.find((n) => n.path === path);
  if (!item) return role === 'super_admin';
  return item.roles.includes(role);
}
