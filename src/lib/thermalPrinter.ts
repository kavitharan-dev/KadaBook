import { Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Printer,
  getBondedDevices,
  isBluetoothEnabled,
  type BluetoothDevice,
} from 'expo-bluetooth-thermal-printer';

const SAVED_ADDRESS = 'kb_bt_printer_address';

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
  if (/le$|ble|headset|buds|watch|car/.test(label)) return 0;
  if (/mtp|mpt|pt-?200|rpp|printer|pos|thermal|innerprinter/.test(label)) return 2;
  return 1;
}

function orderPrinters(devices: BluetoothDevice[], saved: string | null) {
  const ranked = [...devices].sort((a, b) => printerScore(b.name ?? '') - printerScore(a.name ?? ''));
  if (!saved) return ranked;
  const remembered = ranked.find((device) => device.address === saved);
  if (!remembered) return ranked;
  return [remembered, ...ranked.filter((device) => device.address !== saved)];
}

/** Print plain text on a paired 58mm Bluetooth printer (MTP-II / PT200). */
export async function printThermalText(text: string) {
  if (Platform.OS !== 'android') {
    throw new Error('This Bluetooth printer works on Android only.');
  }
  const allowed = await allowBluetooth();
  if (!allowed) {
    throw new Error('Allow Bluetooth permission, then try again.');
  }
  if (!isBluetoothEnabled()) {
    throw new Error('Turn Bluetooth on. Pair the printer in phone Settings. PIN is 0000.');
  }
  const devices = getBondedDevices();
  if (!devices.length) {
    throw new Error('No paired printer. Settings → Bluetooth → pair MTP-II or PT200. PIN 0000.');
  }
  const saved = await AsyncStorage.getItem(SAVED_ADDRESS);
  const candidates = orderPrinters(devices, saved);
  let lastError: unknown = null;
  for (const device of candidates) {
    const printer = new Printer('58mm');
    try {
      await printer.connect(device.address);
      try {
        await printer.initialize();
        await printer.alignLeft();
        const width = printer.charsPerLine || 32;
        for (const line of text.split('\n')) {
          const row = line.length > width ? line.slice(0, width) : line;
          await printer.println(row);
        }
        await printer.feed(4);
      } finally {
        printer.disconnect();
      }
      await AsyncStorage.setItem(SAVED_ADDRESS, device.address);
      return device;
    } catch (error) {
      lastError = error;
      await AsyncStorage.removeItem(SAVED_ADDRESS);
    }
  }
  const names = candidates.map((device) => device.name || device.address).join(', ');
  const detail = lastError instanceof Error ? lastError.message : 'Could not connect.';
  throw new Error(`${detail} Tried: ${names}. Turn the printer off and on, then pair again in Bluetooth settings. PIN 0000.`);
}
