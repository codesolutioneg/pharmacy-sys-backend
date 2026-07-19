import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import bidiFactory from 'bidi-js';
import { Prisma, Shop } from '@prisma/client';
import { settingsService } from './settings.service';

const bidi = bidiFactory();

type InvoiceLine = {
  medicineId?: number;
  name?: string | null;
  origQty?: number;
  unitPrice?: number;
  origLineTotal?: number;
};

type InvoiceForPdf = {
  shopId: number;
  invId: string;
  date: Date;
  createdAt?: Date;
  name: string;
  phone: string | null;
  address?: string | null;
  subtotal: Prisma.Decimal;
  discount: Prisma.Decimal;
  tax: Prisma.Decimal;
  totalPrice: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  duePrice: Prisma.Decimal;
  returnedAmount: Prisma.Decimal;
  medicines: Prisma.JsonValue;
  customer?: { name: string; phone: string; email?: string | null; address?: string | null } | null;
  method?: { name: string } | null;
};

type PaperSize = 'A4' | '80mm' | '58mm';

const MM_TO_PT = 72 / 25.4;
const FONT_REG = 'Receipt';
const FONT_BOLD = 'Receipt-Bold';
const ARABIC_REG = 'ReceiptAr';
const ARABIC_BOLD = 'ReceiptAr-Bold';

function money(value: Prisma.Decimal | number, symbol: string): string {
  return `${Number(value).toFixed(2)} ${symbol}`;
}

function hasArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

/**
 * Reorder logical Arabic for LTR PDF drawing. Keep Unicode letters as-is so
 * PDFKit/fontkit can shape/join them — do not run arabic-persian-reshaper.
 */
function forPdfRtl(text: string): string {
  if (!hasArabic(text)) return text;
  const embedding = bidi.getEmbeddingLevels(text, 'rtl');
  return bidi.getReorderedString(text, embedding);
}

function pageGeometry(paperSize: PaperSize): { size: [number, number] | 'A4'; margin: number; narrow: boolean } {
  if (paperSize === '80mm') {
    return { size: [80 * MM_TO_PT, 900], margin: 10, narrow: true };
  }
  if (paperSize === '58mm') {
    return { size: [58 * MM_TO_PT, 900], margin: 8, narrow: true };
  }
  return { size: 'A4', margin: 40, narrow: false };
}

function formatInvoiceDate(date: Date, createdAt?: Date): string {
  const d = createdAt ?? date;
  const day = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = (createdAt ?? date).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return `${day} ${time}`;
}

function resolveFonts(): { latinReg?: string; latinBold?: string; arReg?: string; arBold?: string } {
  const candidates = [
    path.join(__dirname, '../../assets/fonts'),
    path.join(process.cwd(), 'assets/fonts'),
    path.join(process.cwd(), 'dist/../assets/fonts'),
  ];
  for (const dir of candidates) {
    const arReg = path.join(dir, 'NotoSansArabic-Regular.ttf');
    const arBold = path.join(dir, 'NotoSansArabic-Bold.ttf');
    if (fs.existsSync(arReg) && fs.existsSync(arBold)) {
      return { arReg, arBold };
    }
  }
  return {};
}

function registerFonts(doc: PDFKit.PDFDocument) {
  const fonts = resolveFonts();
  // Built-in Latin (Helvetica) — crisp for EN thermal receipts.
  doc.registerFont(FONT_REG, 'Helvetica');
  doc.registerFont(FONT_BOLD, 'Helvetica-Bold');
  if (fonts.arReg && fonts.arBold) {
    doc.registerFont(ARABIC_REG, fonts.arReg);
    doc.registerFont(ARABIC_BOLD, fonts.arBold);
  }
  return Boolean(fonts.arReg);
}

export type InvoicePdfOptions = {
  paperSize?: PaperSize;
  receiptFooter?: string | null;
};

export const pdfService = {
  /**
   * Professional pharmacy receipt PDF (Laravel POS print.blade + cai_ thermal cues).
   * Respects shop `pos.printer` KV: paperSize + receiptFooter. Returns raw PDF bytes.
   */
  async renderInvoicePdf(
    invoice: InvoiceForPdf,
    shop: Shop,
    options?: InvoicePdfOptions,
  ): Promise<Buffer> {
    const printer = options
      ? {
          paperSize: options.paperSize ?? 'A4',
          receiptFooter: options.receiptFooter ?? null,
        }
      : await settingsService.getPosPrinter(invoice.shopId);
    const paperSize = (printer.paperSize ?? 'A4') as PaperSize;
    const footer = printer.receiptFooter?.trim() || null;
    const { size, margin, narrow } = pageGeometry(paperSize);
    const symbol = shop.currencySymbol?.trim() || shop.currency || 'EGP';

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        margin,
        size,
        autoFirstPage: true,
        info: {
          Title: `Invoice ${invoice.invId}`,
          Author: shop.name,
        },
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err: Error) => reject(err));

      const hasArFont = registerFonts(doc);
      const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const left = doc.page.margins.left;
      const right = left + pageW;

      const fontSize = {
        shop: narrow ? 13 : 18,
        meta: narrow ? 8 : 10,
        body: narrow ? 8 : 10,
        title: narrow ? 11 : 14,
        total: narrow ? 10 : 12,
        tiny: narrow ? 7 : 9,
      };

      const setLatin = (bold = false) => doc.font(bold ? FONT_BOLD : FONT_REG);
      const setArabic = (bold = false) => {
        if (hasArFont) doc.font(bold ? ARABIC_BOLD : ARABIC_REG);
        else setLatin(bold);
      };

      const drawText = (
        text: string,
        opts: PDFKit.Mixins.TextOptions & { bold?: boolean; size?: number; color?: string } = {},
      ) => {
        const { bold = false, size = fontSize.body, color = '#111111', ...rest } = opts;
        const y = doc.y;
        doc.fillColor(color).fontSize(size);
        const content = hasArabic(text) && hasArFont ? forPdfRtl(text) : text;
        if (hasArabic(text) && hasArFont) setArabic(bold);
        else setLatin(bold);
        doc.text(content, left, y, {
          width: pageW,
          lineGap: 1,
          ...rest,
        });
      };

      const hr = (style: 'solid' | 'dashed' = 'dashed') => {
        const y = doc.y + 2;
        doc.save();
        doc.strokeColor('#222222').lineWidth(0.7);
        if (style === 'dashed') doc.dash(3, { space: 2 });
        else doc.undash();
        doc.moveTo(left, y).lineTo(right, y).stroke();
        doc.undash();
        doc.restore();
        doc.x = left;
        doc.y = y + 6;
      };

      const metaRow = (label: string, value: string) => {
        const y = doc.y;
        const labelW = pageW * 0.34;
        setLatin(true);
        doc.fillColor('#111').fontSize(fontSize.meta);
        doc.text(label, left, y, { width: labelW, lineBreak: false });
        setLatin(false);
        const valueText = hasArabic(value) && hasArFont ? forPdfRtl(value) : value;
        if (hasArabic(value) && hasArFont) setArabic(false);
        doc.fontSize(fontSize.meta).text(valueText, left + labelW, y, {
          width: pageW - labelW,
          align: 'left',
        });
        doc.x = left;
        doc.y = y + fontSize.meta + 5;
      };

      const amountRow = (label: string, value: string, opts?: { bold?: boolean; box?: boolean }) => {
        const pad = opts?.box ? 4 : 0;
        const rowH = (opts?.box ? fontSize.total : fontSize.body) + 8;
        const y = doc.y;
        if (opts?.box) {
          doc.save();
          doc.rect(left, y - 1, pageW, rowH).fill('#111111');
          doc.restore();
          doc.fillColor('#FFFFFF');
        } else {
          doc.fillColor('#111111');
        }
        setLatin(Boolean(opts?.bold || opts?.box));
        doc.fontSize(opts?.box ? fontSize.total : fontSize.body);
        const labelW = pageW * 0.58;
        doc.text(label, left + pad, y + 2, { width: labelW - pad, lineBreak: false });
        doc.text(value, left + labelW, y + 2, {
          width: pageW - labelW - pad,
          align: 'right',
          lineBreak: false,
        });
        doc.fillColor('#111111');
        doc.x = left;
        doc.y = y + rowH + 2;
      };

      // ── Header (centered, Laravel-style) ─────────────────────────────
      drawText(shop.name, { bold: true, size: fontSize.shop, align: 'center', width: pageW });
      if (shop.nameAr) {
        drawText(shop.nameAr, { bold: true, size: fontSize.title, align: 'center', width: pageW });
      }
      if (shop.address) {
        drawText(shop.address, { size: fontSize.tiny, align: 'center', width: pageW, color: '#444444' });
      }
      const contactBits = [
        shop.phone ? `Tel: ${shop.phone}` : null,
        shop.email ? `Email: ${shop.email}` : null,
      ].filter(Boolean) as string[];
      if (contactBits.length) {
        drawText(contactBits.join('  ·  '), {
          size: fontSize.tiny,
          align: 'center',
          width: pageW,
          color: '#444444',
        });
      }

      hr('solid');

      // ── Meta ────────────────────────────────────────────────────────
      metaRow('Date:', formatInvoiceDate(new Date(invoice.date), invoice.createdAt ? new Date(invoice.createdAt) : undefined));
      metaRow('Invoice ID:', invoice.invId);

      const customerName = invoice.customer?.name || invoice.name || 'Walking Customer';
      metaRow('Customer:', customerName);
      const phone = invoice.customer?.phone || invoice.phone;
      if (phone) metaRow('Phone:', phone);
      const address = invoice.customer?.address || invoice.address;
      if (address) metaRow('Address:', address);

      hr();

      drawText('INVOICE', { bold: true, size: fontSize.title, align: 'center', width: pageW });
      doc.moveDown(0.3);
      hr('solid');

      // ── Column headers ──────────────────────────────────────────────
      const cols = narrow
        ? { idx: 0.1, name: 0.42, qty: 0.12, price: 0.18, total: 0.18 }
        : { idx: 0.08, name: 0.44, qty: 0.12, price: 0.18, total: 0.18 };

      const headerY = doc.y;
      setLatin(true);
      doc.fillColor('#111').fontSize(fontSize.meta);
      let x = left;
      doc.text('#', x, headerY, { width: pageW * cols.idx, align: 'center', lineBreak: false });
      x += pageW * cols.idx;
      doc.text('Name', x, headerY, { width: pageW * cols.name, lineBreak: false });
      x += pageW * cols.name;
      doc.text('Qty', x, headerY, { width: pageW * cols.qty, align: 'center', lineBreak: false });
      x += pageW * cols.qty;
      doc.text('Price', x, headerY, { width: pageW * cols.price, align: 'right', lineBreak: false });
      x += pageW * cols.price;
      doc.text('Total', x, headerY, { width: pageW * cols.total, align: 'right', lineBreak: false });
      doc.x = left;
      doc.y = headerY + fontSize.meta + 3;
      hr();

      // ── Lines ───────────────────────────────────────────────────────
      const lines = Array.isArray(invoice.medicines) ? (invoice.medicines as InvoiceLine[]) : [];
      lines.forEach((line, i) => {
        const label = line.name ?? `Medicine #${line.medicineId ?? ''}`;
        const qty = line.origQty ?? 0;
        const unitPrice = Number(line.unitPrice ?? 0).toFixed(2);
        const lineTotal = Number(line.origLineTotal ?? 0).toFixed(2);
        const y = doc.y;
        setLatin(false);
        doc.fillColor('#111').fontSize(fontSize.body);
        let cx = left;
        doc.text(String(i + 1), cx, y, { width: pageW * cols.idx, align: 'center', lineBreak: false });
        cx += pageW * cols.idx;
        const nameH = doc.heightOfString(label, { width: pageW * cols.name });
        doc.text(label, cx, y, { width: pageW * cols.name });
        cx += pageW * cols.name;
        doc.text(String(qty), cx, y, { width: pageW * cols.qty, align: 'center', lineBreak: false });
        cx += pageW * cols.qty;
        doc.text(unitPrice, cx, y, { width: pageW * cols.price, align: 'right', lineBreak: false });
        cx += pageW * cols.price;
        doc.text(lineTotal, cx, y, { width: pageW * cols.total, align: 'right', lineBreak: false });
        doc.x = left;
        doc.y = y + Math.max(nameH, fontSize.body) + 3;
      });

      if (lines.length === 0) {
        drawText('No items', { size: fontSize.meta, align: 'center', width: pageW, color: '#666' });
      }

      hr('solid');

      // ── Totals (Laravel stack + cai_ TOTAL bar) ─────────────────────
      amountRow('Sub Total:', money(invoice.subtotal, symbol));
      amountRow('Discount:', money(invoice.discount, symbol));
      amountRow('Tax:', money(invoice.tax, symbol));
      amountRow('Grand Total:', money(invoice.totalPrice, symbol), { bold: true, box: true });
      amountRow('Due:', money(invoice.duePrice, symbol));

      hr();

      // ── Payments ────────────────────────────────────────────────────
      drawText('Payment Details', { bold: true, size: fontSize.meta, width: pageW });
      doc.moveDown(0.2);
      amountRow('Payment Method:', invoice.method?.name || 'Cash');
      amountRow('Total Amount:', money(invoice.totalPrice, symbol));
      amountRow('Received:', money(invoice.paidAmount, symbol));
      amountRow('Change / Returned:', money(invoice.returnedAmount, symbol));

      hr();

      // ── Footer ──────────────────────────────────────────────────────
      drawText('Thank you for choosing us!', {
        bold: true,
        size: fontSize.meta,
        align: 'center',
        width: pageW,
      });

      if (footer) {
        doc.moveDown(0.25);
        drawText(footer, {
          size: fontSize.body,
          align: 'center',
          width: pageW,
          color: '#333333',
        });
      }

      doc.moveDown(0.35);
      drawText(`Currency: ${shop.currency || 'EGP'}`, {
        size: fontSize.tiny,
        align: 'center',
        width: pageW,
        color: '#666666',
      });

      doc.end();
    });
  },
};
