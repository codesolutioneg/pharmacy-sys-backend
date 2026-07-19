import fs from 'fs';
import { Prisma } from '@prisma/client';
import { pdfService } from '../src/services/pdf.service';

const shop = {
  id: 1,
  name: 'Al-Noor Pharmacy',
  nameAr: 'صيدلية النور',
  address: '12 Tahrir St, Downtown, Cairo',
  phone: '0227945000',
  email: 'info@alnoor.eg',
  currency: 'EGP',
  currencySymbol: 'EGP',
} as never;

const invoice = {
  shopId: 1,
  invId: 'INV6812881',
  date: new Date('2026-07-19'),
  createdAt: new Date('2026-07-19T12:40:00'),
  name: '',
  phone: null,
  subtotal: new Prisma.Decimal(55),
  discount: new Prisma.Decimal(0),
  tax: new Prisma.Decimal(0),
  totalPrice: new Prisma.Decimal(55),
  paidAmount: new Prisma.Decimal(55),
  duePrice: new Prisma.Decimal(0),
  returnedAmount: new Prisma.Decimal(0),
  medicines: [{ medicineId: 1, name: 'Cataflam 50mg', origQty: 1, unitPrice: 55, origLineTotal: 55 }],
  customer: null,
  method: { name: 'Cash' },
};

async function main() {
  const buf = await pdfService.renderInvoicePdf(invoice as never, shop, {
    paperSize: '80mm',
    receiptFooter: 'شكراً لزيارتكم — صيدلية النور',
  });
  const out = process.argv[2] || '/tmp/pharmacy-receipt-80mm.pdf';
  fs.writeFileSync(out, buf);
  console.log(`wrote ${buf.length} bytes -> ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
