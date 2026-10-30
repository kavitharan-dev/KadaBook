import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  Lock,
  Megaphone,
  Settings2,
  Shield,
  SlidersHorizontal,
  Store,
  UserCheck,
  Users,
} from 'lucide-react';

export const NAV_ICONS: Record<string, LucideIcon> = {
  Dashboard: LayoutDashboard,
  Approvals: UserCheck,
  'Users / Shops': Users,
  Subscriptions: CreditCard,
  Payments: Store,
  Announcements: Megaphone,
  'Access Control': Lock,
  'App Control': SlidersHorizontal,
  Support: Bell,
  'Audit Log': ClipboardList,
  'Admin Roles': Shield,
};

export { Settings2 };
