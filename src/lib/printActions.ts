import { useAuth } from '../context/AuthContext';
import { printOrShareReceipt, type PrintResult } from './printReceipt';

export async function handlePrintSale(shopName: string, sale: Parameters<typeof printOrShareReceipt>[1]): Promise<PrintResult> {
  return printOrShareReceipt(shopName, sale);
}

export function usePrintShopName() {
  const { user } = useAuth();
  return user?.shopName ?? 'KadaBook';
}
