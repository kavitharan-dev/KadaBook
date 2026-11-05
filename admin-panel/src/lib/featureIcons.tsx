import type { LucideIcon } from 'lucide-react';
import {
  BadgePercent,
  Barcode,
  Building2,
  Calculator,
  ChefHat,
  CreditCard,
  FileSpreadsheet,
  FileText,
  Infinity,
  NotebookPen,
  PackagePlus,
  ShoppingBag,
  Truck,
  Users,
  Wallet,
} from 'lucide-react';
import type { PlanFeature } from './planFeatures';

export const FEATURE_ICONS: Record<PlanFeature, LucideIcon> = {
  quickSale: Calculator,
  products: PackagePlus,
  productSale: ShoppingBag,
  expenses: Wallet,
  fullReports: FileText,
  creditBook: NotebookPen,
  barcode: Barcode,
  discount: BadgePercent,
  paymentModes: CreditCard,
  unlimitedProducts: Infinity,
  exportData: FileSpreadsheet,
  staff: Users,
  kitchenStock: ChefHat,
  branches: Building2,
  suppliers: Truck,
};
