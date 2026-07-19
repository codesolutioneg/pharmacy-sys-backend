import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { Prisma, Shop } from '@prisma/client';

type InvoiceLine = {
  medicineId?: number;
  name?: string | null;
  origQty?: number;
  unitPrice?: number;
  origLineTotal?: number;
};

type InvoiceForPdf = {
  invId: string;
  date: Date;
  name: string;
  phone: string | null;
  subtotal: Prisma.Decimal;
  discount: Prisma.Decimal;
  tax: Prisma.Decimal;
  taxRatePercent?: Prisma.Decimal;
  totalPrice: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  duePrice: Prisma.Decimal;
  returnedAmount: Prisma.Decimal;
  insurancePercent?: Prisma.Decimal;
  insuranceAmount?: Prisma.Decimal;
  medicines: Prisma.JsonValue;
  customer?: { name: string; phone: string; email: string } | null;
  method?: { name: string } | null;
  insuranceCompany?: { name: string; nameAr: string | null } | null;
};

export type InvoicePdfOptions = {
  paperSize?: 'A4' | '80mm' | '58mm';
  receiptFooter?: string | null;
};

const FONT_REGULAR = 'NotoArabic';
const FONT_BOLD = 'NotoArabicBold';
const LATIN_REGULAR = 'Helvetica';
const LATIN_BOLD = 'Helvetica-Bold';
const ARABIC_RE = /[\u0600-\u06FF]/;

/**
 * PDFKit draws LTR. Fontkit shapes joined Arabic from logical char order within a word.
 * Reverse word order (keep each word intact) so centered RTL phrases read correctly
 * without arabic-persian-reshaper or bidi glyph scrambling.
 */
function prepareArabicForLtrCanvas(text: string): string {
  if (!text || !ARABIC_RE.test(text)) return text;
  // Keep whitespace/punctuation tokens; reverse the sequence for visual RTL.
  return text
    .split(/(\s+)/)
    .filter((t) => t.length > 0)
    .reverse()
    .join('');
}

/** Prefer cwd (PM2), then relative to compiled dist/services → project root. */
function resolveFont(fileName: string): string | null {
  const candidates = [
    path.join(process.cwd(), 'assets', 'fonts', fileName),
    path.join(__dirname, '..', '..', 'assets', 'fonts', fileName),
    path.join(__dirname, '..', 'assets', 'fonts', fileName),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function money(value: Prisma.Decimal | number): string {
  return Number(value).toFixed(2);
}

function pageSizeFor(paperSize: 'A4' | '80mm' | '58mm'): 'A4' | [number, number] {
  if (paperSize === '80mm') return [226.77, 1200];
  if (paperSize === '58mm') return [164.41, 1200];
  return 'A4';
}

function marginsFor(paperSize: 'A4' | '80mm' | '58mm'): number {
  if (paperSize === 'A4') return 40;
  if (paperSize === '58mm') return 8;
  return 10;
}

function formatDate(date: Date): string {
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function dashedLine(doc: PDFKit.PDFDocument, x: number, y: number, width: number): number {
  doc
    .save()
    .strokeColor('#000000')
    .lineWidth(0.6)
    .dash(2.5, { space: 1.5 })
    .moveTo(x, y)
    .lineTo(x + width, y)
    .stroke()
    .undash()
    .restore();
  return y + 6;
}

export const pdfService = {
  /**
   * Laravel/CAI-style POS receipt PDF.
   * Latin → Helvetica. Arabic → Noto Sans Arabic with logical Unicode as-is
   * (PDFKit/fontkit shapes joined forms). No arabic-persian-reshaper / bidi-js.
   */
  async renderInvoicePdf(
    invoice: InvoiceForPdf,
    shop: Shop,
    options: InvoicePdfOptions = {},
  ): Promise<Buffer> {
    const paperSize = options.paperSize ?? 'A4';
    const receiptFooter = options.receiptFooter?.trim().replace(/[—–]/g, '-') || null;
    const margin = marginsFor(paperSize);
    const size = pageSizeFor(paperSize);
    const isThermal = paperSize === '80mm' || paperSize === '58mm';
    const isNarrow = paperSize === '58mm';

    const regularFont = resolveFont('NotoSansArabic-Regular.ttf');
    const boldFont = resolveFont('NotoSansArabic-Bold.ttf');

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        margin,
        size,
        autoFirstPage: true,
        bufferPages: true,
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err: Error) => reject(err));

      if (regularFont) doc.registerFont(FONT_REGULAR, regularFont);
      if (boldFont) doc.registerFont(FONT_BOLD, boldFont);

      const hasArabicFonts = Boolean(regularFont);
      const arabicRegular = hasArabicFonts ? FONT_REGULAR : LATIN_REGULAR;
      const arabicBold =
        hasArabicFonts && boldFont ? FONT_BOLD : hasArabicFonts ? FONT_REGULAR : LATIN_BOLD;

      const contentWidth = doc.page.width - margin * 2;
      const left = margin;

      const titleSize = isNarrow ? 11 : isThermal ? 13 : 18;
      const arTitleSize = isNarrow ? 10 : isThermal ? 11 : 14;
      const metaSize = isNarrow ? 7.5 : isThermal ? 8.5 : 10;
      const tableSize = isNarrow ? 7 : isThermal ? 8 : 9.5;
      const totalSize = isNarrow ? 9 : isThermal ? 10 : 12;

      let y = margin;

      const pickFont = (text: string, bold: boolean) => {
        if (ARABIC_RE.test(text) && hasArabicFonts) {
          return bold ? arabicBold : arabicRegular;
        }
        return bold ? LATIN_BOLD : LATIN_REGULAR;
      };

      const drawText = (
        text: string,
        x: number,
        atY: number,
        opts: { width: number; align?: 'left' | 'center' | 'right'; bold?: boolean; size?: number },
      ) => {
        const display = ARABIC_RE.test(text) ? prepareArabicForLtrCanvas(text) : text;
        doc
          .font(pickFont(text, Boolean(opts.bold)))
          .fontSize(opts.size ?? metaSize)
          .fillColor('#000000')
          .text(display, x, atY, {
            width: opts.width,
            align: opts.align ?? 'left',
            lineGap: 1,
          });
      };

      // ——— Header ———
      drawText(shop.name || 'Pharmacy', left, y, {
        width: contentWidth,
        align: 'center',
        bold: true,
        size: titleSize,
      });
      y = doc.y + (isThermal ? 1 : 2);

      if (shop.nameAr) {
        drawText(shop.nameAr, left, y, {
          width: contentWidth,
          align: 'center',
          bold: true,
          size: arTitleSize,
        });
        y = doc.y + 1;
      }

      const contactBits: string[] = [];
      if (shop.address) contactBits.push(shop.address);
      if (shop.phone) contactBits.push(shop.phone);
      if (shop.email) contactBits.push(shop.email);
      if (contactBits.length) {
        doc
          .font(LATIN_REGULAR)
          .fontSize(metaSize - 0.5)
          .fillColor('#333333')
          .text(contactBits.join('  |  '), left, y, { width: contentWidth, align: 'center' });
        y = doc.y + 2;
      }

      y = dashedLine(doc, left, y + 2, contentWidth);

      // ——— Meta ———
      const customerName = invoice.customer?.name || invoice.name || 'Walk-in';
      const customerPhone = invoice.customer?.phone || invoice.phone || null;

      const metaRows: Array<[string, string]> = [
        ['Invoice', invoice.invId],
        ['Date', formatDate(invoice.date)],
        ['Customer', customerName],
      ];
      if (customerPhone) metaRows.push(['Phone', customerPhone]);

      for (const [label, value] of metaRows) {
        const rowY = y;
        const labelText = `${label}: `;
        doc.font(LATIN_BOLD).fontSize(metaSize).fillColor('#000000');
        const labelWidth = doc.widthOfString(labelText);
        doc.text(labelText, left, rowY, { lineBreak: false });
        drawText(value, left + labelWidth, rowY, {
          width: Math.max(20, contentWidth - labelWidth),
          align: ARABIC_RE.test(value) ? 'right' : 'left',
          size: metaSize,
          bold: ARABIC_RE.test(value),
        });
        y = Math.max(doc.y, rowY + metaSize) + (isThermal ? 1 : 2);
      }

      y = dashedLine(doc, left, y + 3, contentWidth);

      // ——— Items table ———
      const colHash = isNarrow ? 12 : isThermal ? 14 : 22;
      const colQty = isNarrow ? 20 : isThermal ? 24 : 36;
      const colPrice = isNarrow ? 32 : isThermal ? 40 : 60;
      const colTotal = isNarrow ? 34 : isThermal ? 44 : 66;
      const colName = Math.max(36, contentWidth - colHash - colQty - colPrice - colTotal);

      const headerY = y;
      doc.font(LATIN_BOLD).fontSize(tableSize).fillColor('#000000');
      doc.text('#', left, headerY, { width: colHash, align: 'left' });
      doc.text('Name', left + colHash, headerY, { width: colName, align: 'left' });
      doc.text('Qty', left + colHash + colName, headerY, { width: colQty, align: 'right' });
      doc.text('Price', left + colHash + colName + colQty, headerY, { width: colPrice, align: 'right' });
      doc.text('Total', left + colHash + colName + colQty + colPrice, headerY, {
        width: colTotal,
        align: 'right',
      });
      y = headerY + tableSize + 3;

      doc
        .save()
        .strokeColor('#000000')
        .lineWidth(0.8)
        .moveTo(left, y)
        .lineTo(left + contentWidth, y)
        .stroke()
        .restore();
      y += 4;

      const lines = Array.isArray(invoice.medicines) ? (invoice.medicines as InvoiceLine[]) : [];
      lines.forEach((line, index) => {
        const label = (line.name ?? `Medicine #${line.medicineId ?? ''}`).toString();
        const qty = line.origQty ?? 0;
        const unitPrice = money(line.unitPrice ?? 0);
        const lineTotal = money(line.origLineTotal ?? 0);
        const rowTop = y;

        doc.font(LATIN_REGULAR).fontSize(tableSize).fillColor('#000000');
        doc.text(String(index + 1), left, rowTop, { width: colHash, align: 'left' });
        drawText(label, left + colHash, rowTop, {
          width: colName,
          align: ARABIC_RE.test(label) ? 'right' : 'left',
          size: tableSize,
        });
        const nameBottom = doc.y;
        doc.font(LATIN_REGULAR).fontSize(tableSize);
        doc.text(String(qty), left + colHash + colName, rowTop, { width: colQty, align: 'right' });
        doc.text(unitPrice, left + colHash + colName + colQty, rowTop, {
          width: colPrice,
          align: 'right',
        });
        doc.text(lineTotal, left + colHash + colName + colQty + colPrice, rowTop, {
          width: colTotal,
          align: 'right',
        });
        y = Math.max(nameBottom, rowTop + tableSize + 2) + (isThermal ? 1 : 2);
      });

      if (lines.length === 0) {
        doc
          .font(LATIN_REGULAR)
          .fontSize(tableSize)
          .text('No items', left, y, { width: contentWidth, align: 'center' });
        y = doc.y + 4;
      }

      y = dashedLine(doc, left, y + 2, contentWidth);

      const drawTotalRow = (label: string, value: string) => {
        doc
          .font(LATIN_REGULAR)
          .fontSize(metaSize)
          .fillColor('#000000')
          .text(label, left, y, { width: contentWidth * 0.55, align: 'left' });
        doc.text(value, left + contentWidth * 0.55, y, {
          width: contentWidth * 0.45,
          align: 'right',
        });
        y += metaSize + (isThermal ? 3 : 4);
      };

      drawTotalRow('Subtotal', money(invoice.subtotal));
      drawTotalRow('Discount', money(invoice.discount));
      drawTotalRow('Tax', money(invoice.tax));

      // ——— Grand Total black bar ———
      const barH = isThermal ? 18 : 22;
      const barPad = 4;
      doc.save().rect(left, y, contentWidth, barH).fill('#000000').restore();
      doc
        .font(LATIN_BOLD)
        .fontSize(totalSize)
        .fillColor('#FFFFFF')
        .text('Grand Total', left + barPad, y + (barH - totalSize) / 2 - 1, {
          width: contentWidth * 0.5 - barPad,
          align: 'left',
        });
      doc.text(money(invoice.totalPrice), left + contentWidth * 0.45, y + (barH - totalSize) / 2 - 1, {
        width: contentWidth * 0.55 - barPad,
        align: 'right',
      });
      y += barH + 6;

      y = dashedLine(doc, left, y, contentWidth);
      drawTotalRow('Paid (patient)', money(invoice.paidAmount));
      drawTotalRow('Due (patient)', money(invoice.duePrice));
      drawTotalRow('Change', money(invoice.returnedAmount));
      if (invoice.method?.name) {
        drawTotalRow('Payment', invoice.method.name);
      }

      const insAmount = invoice.insuranceAmount ? Number(invoice.insuranceAmount) : 0;
      if (insAmount > 0) {
        y = dashedLine(doc, left, y + 2, contentWidth);
        const coName =
          invoice.insuranceCompany?.nameAr ||
          invoice.insuranceCompany?.name ||
          'Insurance';
        drawTotalRow('Insurance co.', coName);
        drawTotalRow(
          'Insurance %',
          `${Number(invoice.insurancePercent ?? 0).toFixed(0)}%`,
        );
        drawTotalRow('Insurance covers', money(invoice.insuranceAmount!));
        const patientShare = Number(invoice.totalPrice) - insAmount;
        drawTotalRow('Patient share', money(patientShare));
      }

      y = dashedLine(doc, left, y + 2, contentWidth);

      drawText('Thank you for your purchase', left, y, {
        width: contentWidth,
        align: 'center',
        bold: true,
        size: metaSize,
      });
      y = doc.y + 3;

      if (receiptFooter) {
        drawText(receiptFooter, left, y, {
          width: contentWidth,
          align: 'center',
          size: metaSize,
        });
        y = doc.y + 2;
      }

      doc
        .font(LATIN_REGULAR)
        .fontSize(metaSize - 1)
        .fillColor('#666666')
        .text('Powered by Pharmacy Sys', left, y + 4, {
          width: contentWidth,
          align: 'center',
        });

      doc.end();
    });
  },
};
