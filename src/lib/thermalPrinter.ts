import { Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BluetoothDevice, PaperWidth, Printer as PrinterType } from 'expo-bluetooth-thermal-printer';
import type { Sale } from '../data/types';
import type { ReceiptSettings } from './receiptSettings';
import { PAYMENT_MODE_LABEL } from '../data/saleExtras';
import { formatDay, formatRs, formatTime } from './format';

const SAVED_ADDRESS = 'kb_bt_printer_address';

type PrinterModule = typeof import('expo-bluetooth-thermal-printer');

/**
 * The native module throws at import time on any platform/runtime that doesn't
 * have it linked (web, Expo Go). Requiring it lazily — only once we're sure
 * we're on Android and actually about to print — keeps that crash from taking
 * down the whole bundle on startup.
 */
function loadPrinterModule(): PrinterModule {
  try {
    return require('expo-bluetooth-thermal-printer') as PrinterModule;
  } catch {
    throw new Error('Bluetooth printer is unavailable in this build (needs a native Android build, not Expo Go/web).');
  }
}

async function allowBluetooth() {
  if (Platform.OS !== 'android') return false;
  const result = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  ]);
  return Object.values(result).every((value) => value === PermissionsAndroid.RESULTS.GRANTED);
}

function printerScore(name: string) {
  const label = name.toLowerCase();
  if (/pt-?210/.test(label)) return 3;
  if (/le$|ble|headset|buds|watch|car|speaker|audio|mhc|avh/.test(label)) return 0;
  if (/mtp|mpt|pt-?200|rpp|printer|pos|thermal|innerprinter/.test(label)) return 2;
  return 1;
}

function orderPrinters(devices: BluetoothDevice[], saved: string | null) {
  const ranked = [...devices].sort((a, b) => printerScore(b.name ?? '') - printerScore(a.name ?? ''));
  const pt210 = ranked.filter((d) => printerScore(d.name ?? '') === 3);
  if (pt210.length) return pt210; // PT-210 irundha adhu mattum try pannu
  const likely = ranked.filter((d) => printerScore(d.name ?? '') > 0);
  const list = likely.length ? likely : ranked;
  if (!saved) return list;
  const remembered = list.find((device) => device.address === saved);
  if (!remembered) return list;
  return [remembered, ...list.filter((device) => device.address !== saved)];
}

/**
 * Finds a paired thermal printer, connects, runs `run` against it, then
 * disconnects — trying each candidate device in rank order and remembering
 * whichever one worked. Shared by the plain-text and styled-receipt paths
 * below so the device-discovery/retry logic only lives in one place.
 */
async function withThermalPrinter(paperWidth: PaperWidth, run: (printer: PrinterType) => Promise<void>) {
  if (Platform.OS !== 'android') {
    throw new Error('This Bluetooth printer works on Android only.');
  }
  const allowed = await allowBluetooth();
  if (!allowed) {
    throw new Error('Allow Bluetooth permission, then try again.');
  }
  const { Printer, getBondedDevices, isBluetoothEnabled } = loadPrinterModule();
  if (!isBluetoothEnabled()) {
    throw new Error('Turn Bluetooth on. Pair the printer in phone Settings. PIN is 0000.');
  }
  const devices = getBondedDevices();
  if (!devices.length) {
    throw new Error('No paired printer. Settings -> Bluetooth -> pair PT-210. PIN 0000.');
  }
  const saved = await AsyncStorage.getItem(SAVED_ADDRESS);
  const candidates = orderPrinters(devices, saved);
  const errors: string[] = [];
  for (const device of candidates) {
    const label = device.name || device.address;
    const printer = new Printer(paperWidth);
    try {
      await printer.connect(device.address);
      try {
        await run(printer);
      } finally {
        printer.disconnect();
      }
      await AsyncStorage.setItem(SAVED_ADDRESS, device.address);
      return device;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`${label}: ${msg}`);
      if (device.address === saved) await AsyncStorage.removeItem(SAVED_ADDRESS);
    }
  }
  throw new Error(
    `Print failed.\n${errors.join('\n')}\nTurn the printer off and on, close other apps/browsers using it, then try again.`
  );
}

/** Print plain text on a paired 58mm Bluetooth printer (PT-210 / MTP-II / PT200). */
export async function printThermalText(text: string) {
  return withThermalPrinter('58mm', async (printer) => {
    await printer.initialize();
    await printer.alignLeft();
    const width = printer.charsPerLine || 32;
    for (const line of text.split('\n')) {
      const row = line.length > width ? line.slice(0, width) : line;
      await printer.println(row);
    }
    await printer.feed(4);
  });
}

/**
 * Styled sale receipt on a paired Bluetooth printer. A thermal printer can't
 * reproduce BillReceipt's colours or rounded cards, but using the printer's
 * own bold/centered/double-height/two-column (`row`) formatting instead of a
 * flat `println` dump carries the same visual hierarchy — big bold shop name,
 * aligned item/amount columns, bold TOTAL — onto the paper tape.
 */
export async function printReceiptOnThermal(options: { shopName: string; sale: Sale; settings: ReceiptSettings }) {
  const { sale, settings } = options;
  const paperWidth: PaperWidth = settings.paperMm === 80 ? '80mm' : '58mm';
  const brand = (options.shopName || 'Shop').trim();
  const billNo = sale.invoiceNo ? `${settings.invoicePrefix}-${sale.invoiceNo}` : 'Bill';
  const lines = sale.items?.length
    ? sale.items
    : [{ name: 'Sale amount', qty: 1, unitPrice: sale.subtotal ?? sale.amount, lineTotal: sale.subtotal ?? sale.amount }];
  const off = sale.discount?.amount ?? 0;
  const subtotal = sale.subtotal ?? sale.amount + off;
  const mode = sale.paymentMode ?? 'cash';
  const paid = mode === 'credit' ? sale.paidAmount ?? 0 : sale.amount;
  const balance = Math.max(0, sale.amount - paid);

  return withThermalPrinter(paperWidth, async (printer) => {
    await printer.initialize();
    await printer.alignCenter();
    await printer.setSize('doubleHeight');
    await printer.bold(true);
    await printer.println(brand.toUpperCase());
    await printer.bold(false);
    await printer.setSize('normal');
    if (settings.shopLine.trim()) await printer.println(settings.shopLine.trim());
    await printer.println(`${billNo}  ·  ${formatDay(sale.createdAt)} ${formatTime(sale.createdAt)}`);
    await printer.alignLeft();
    await printer.separator();

    if (sale.customerName || sale.customerPhone) {
      await printer.row('Customer', sale.customerName || sale.customerPhone || '');
    }

    await printer.separator();
    for (const item of lines) {
      await printer.println((item.name || 'Item').trim());
      await printer.row(`  ${item.qty} x ${formatRs(item.unitPrice)}`, formatRs(item.lineTotal));
    }
    await printer.separator();

    if (off > 0) {
      await printer.row('Subtotal', formatRs(subtotal));
      const label = sale.discount?.type === 'percent' ? `Discount (${sale.discount.value}%)` : 'Discount';
      await printer.row(label, `-${formatRs(off)}`);
    }
    await printer.bold(true);
    await printer.setSize('doubleHeight');
    await printer.row('TOTAL', formatRs(sale.amount));
    await printer.setSize('normal');
    await printer.bold(false);

    await printer.row('Paid by', PAYMENT_MODE_LABEL[mode]);
    await printer.row('Received', formatRs(paid));
    if (balance > 0) {
      await printer.bold(true);
      await printer.row('Balance due', formatRs(balance));
      await printer.bold(false);
    }

    await printer.separator();
    await printer.alignCenter();
    await printer.println(settings.footerLine.trim() || 'Thank you!');
    await printer.println('Powered by SMART (PVT) LTD');
    await printer.feed(4);
  });
}
