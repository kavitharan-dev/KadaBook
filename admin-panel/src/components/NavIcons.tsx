import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  Lock,
  Megaphone,
  Puzzle,
  Settings2,
  Shield,
  Store,
  Tags,
  UserCheck,
  Wallet,
} from 'lucide-react';

export const NAV_ICONS: Record<string, LucideIcon> = {
  Dashboard: LayoutDashboard,
  Approvals: UserCheck,
  'Manage Shops': Store,
  Plans: Tags,
  Features: Puzzle,
  Subscriptions: CreditCard,
  Payments: Wallet,
  Announcements: Megaphone,
  'Access Control': Lock,
  'App Control': Settings2,
  Support: Bell,
  'Audit Log': ClipboardList,
  'Admin Roles': Shield,
};

export { Settings2 };
