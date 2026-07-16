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
  totalPrice: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  duePrice: Prisma.Decimal;
  returnedAmount: Prisma.Decimal;
  medicines: Prisma.JsonValue;
  customer?: { name: string; phone: string; email: string } | null;
};

function money(value: Prisma.Decimal | number): string {
  return Number(value).toFixed(2);
}

export const pdfService = {
  /** Renders a simple, self-contained invoice PDF (shop branding + lines + totals). */
  async renderInvoicePdf(invoice: InvoiceForPdf, shop: Shop): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err: Error) => reject(err));

      doc.fontSize(18).text(shop.name, { align: 'left' });
      if (shop.nameAr) {
        doc.fontSize(12).text(shop.nameAr, { align: 'right' });
      }
      if (shop.address) {
        doc.fontSize(9).fillColor('gray').text(shop.address);
      }
      doc.fillColor('black').moveDown();

      doc.fontSize(14).text(`Invoice ${invoice.invId}`);
      doc.fontSize(10).text(`Date: ${new Date(invoice.date).toISOString().slice(0, 10)}`);
      const customerName = invoice.customer?.name || invoice.name;
      if (customerName) {
        doc.text(`Customer: ${customerName}`);
      }
      doc.moveDown();

      doc.fontSize(11).text('Items', { underline: true });
      const lines = Array.isArray(invoice.medicines) ? (invoice.medicines as InvoiceLine[]) : [];
      for (const line of lines) {
        const label = line.name ?? `Medicine #${line.medicineId ?? ''}`;
        const qty = line.origQty ?? 0;
        const unitPrice = Number(line.unitPrice ?? 0).toFixed(2);
        const lineTotal = Number(line.origLineTotal ?? 0).toFixed(2);
        doc.fontSize(10).text(`${label}  x${qty}  @ ${unitPrice}  =  ${lineTotal}`);
      }
      doc.moveDown();

      doc.fontSize(10).text(`Subtotal: ${money(invoice.subtotal)}`);
      doc.text(`Discount: ${money(invoice.discount)}`);
      doc.text(`Tax: ${money(invoice.tax)}`);
      doc.fontSize(13).text(`Total: ${money(invoice.totalPrice)}`, { underline: true });
      doc.fontSize(10).text(`Paid: ${money(invoice.paidAmount)}`);
      doc.text(`Due: ${money(invoice.duePrice)}`);
      doc.text(`Change: ${money(invoice.returnedAmount)}`);

      doc.end();
    });
  },
};
