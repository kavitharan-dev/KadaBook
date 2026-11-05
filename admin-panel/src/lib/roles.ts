import type { AdminRole } from '../types/models';

export type NavItem = {
  path: string;
  label: string;
  short: string;
  hint: string;
  roles: AdminRole[];
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

/**
 * Icon-first groups — daily work first, then billing, then settings.
 * Labels match NavIcons keys.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Home',
    items: [
      {
        path: '/',
        label: 'Dashboard',
        short: 'Home',
        hint: 'Overview',
        roles: ['super_admin', 'staff'],
      },
    ],
  },
  {
    label: 'Shops',
    items: [
      {
        path: '/approvals',
        label: 'Approvals',
        short: 'Approve',
        hint: 'New shops',
        roles: ['super_admin', 'staff'],
      },
      {
        path: '/users',
        label: 'Manage Shops',
        short: 'Shops',
        hint: 'Features & status',
        roles: ['super_admin'],
      },
    ],
  },
  {
    label: 'Plans & money',
    items: [
      {
        path: '/plans',
        label: 'Plans',
        short: 'Plans',
        hint: 'Basic / Standard',
        roles: ['super_admin'],
      },
      {
        path: '/features',
        label: 'Features',
        short: 'Add-ons',
        hint: 'Prices',
        roles: ['super_admin'],
      },
      {
        path: '/subscriptions',
        label: 'Subscriptions',
        short: 'Subs',
        hint: 'Activate',
        roles: ['super_admin'],
      },
      {
        path: '/payments',
        label: 'Payments',
        short: 'Pay',
        hint: 'Cash in',
        roles: ['super_admin', 'staff'],
      },
    ],
  },
  {
    label: 'More',
    items: [
      {
        path: '/announcements',
        label: 'Announcements',
        short: 'News',
        hint: 'Popups',
        roles: ['super_admin'],
      },
      {
        path: '/access-control',
        label: 'Access Control',
        short: 'Access',
        hint: 'Status gates',
        roles: ['super_admin'],
      },
      {
        path: '/app-control',
        label: 'App Control',
        short: 'App',
        hint: 'Force update',
        roles: ['super_admin'],
      },
      {
        path: '/support',
        label: 'Support',
        short: 'Help',
        hint: 'Tickets',
        roles: ['super_admin', 'staff'],
      },
      {
        path: '/audit',
        label: 'Audit Log',
        short: 'Audit',
        hint: 'History',
        roles: ['super_admin'],
      },
      {
        path: '/admins',
        label: 'Admin Roles',
        short: 'Admins',
        hint: 'Team',
        roles: ['super_admin'],
      },
    ],
  },
];

export const NAV: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

export function navForRole(role: AdminRole) {
  return NAV.filter((item) => item.roles.includes(role));
}

export function canAccess(role: AdminRole, path: string) {
  const item = NAV.find((n) => n.path === path);
  if (!item) return role === 'super_admin';
  return item.roles.includes(role);
}
