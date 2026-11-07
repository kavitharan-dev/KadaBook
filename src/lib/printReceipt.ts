import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { Sale } from '../data/types';
import { buildReceiptHtml } from './receipt';
import { loadReceiptSettings, type ReceiptSettings } from './receiptSettings';
import { printReceiptOnThermal, printThermalText } from './thermalPrinter';

export type PrintResult = { ok: true } | { ok: false; message: string };

function friendlyPrintError(error: unknown): string {
  if (error instanceof Error && error.message) {
    const msg = error.message;
    if (/cancel/i.test(msg)) return 'Print cancelled.';
    return msg;
  }
  return 'Could not print. Try again or share the PDF.';
}

async function outputHtml(html: string, dialogTitle: string): Promise<PrintResult> {
  try {
    if (Platform.OS === 'web') {
      const win = (globalThis as { open?: (url: string, target?: string) => Window | null }).open?.('', '_blank');
      if (!win) return { ok: false, message: 'Allow pop-ups to print in the browser.' };
      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();
      return { ok: true };
    }

    const file = await Print.printToFileAsync({ html });
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle });
        return { ok: true };
      }
    } catch (shareError) {
      try {
        await Print.printAsync({ html });
        return { ok: true };
      } catch (printError) {
        return { ok: false, message: friendlyPrintError(printError ?? shareError) };
      }
    }

    await Print.printAsync({ html });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: friendlyPrintError(error) };
  }
}

export async function printOrShareReceipt(
  shopName: string,
  sale: Sale,
  settingsOverride?: ReceiptSettings,
  /** Shop logo as a data: URI (device-local avatar) — shown at the top of the HTML/PDF receipt when set. */
  logoDataUri?: string | null,
): Promise<PrintResult> {
  try {
    const settings = settingsOverride ?? (await loadReceiptSettings());
    if (Platform.OS === 'android') {
      await printReceiptOnThermal({ shopName, sale, settings });
      return { ok: true };
    }
    const html = buildReceiptHtml({ shopName, sale, settings, logoDataUri });
    return outputHtml(html, 'Receipt');
  } catch (error) {
    return { ok: false, message: friendlyPrintError(error) };
  }
}

/** PDF share sheet (WhatsApp, Drive, Save). Does not send the bill to the Bluetooth printer. */
export async function shareReceiptPdf(
  shopName: string,
  sale: Sale,
  settingsOverride?: ReceiptSettings,
  logoDataUri?: string | null,
): Promise<PrintResult> {
  const settings = settingsOverride ?? (await loadReceiptSettings());
  const html = buildReceiptHtml({ shopName, sale, settings, logoDataUri });
  return outputHtml(html, 'Share receipt');
}

export async function printTextReport(title: string, body: string): Promise<PrintResult> {
  if (Platform.OS === 'android') {
    try {
      await printThermalText(`${title}\n${body}`);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: friendlyPrintError(error) };
    }
  }
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title></head><body><pre style="font-family:monospace;font-size:13px;line-height:1.4;padding:16px">${escapeHtml(body)}</pre></body></html>`;
  return outputHtml(html, title);
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
