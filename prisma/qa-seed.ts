/**
 * Realistic Egyptian pharmacy demo dataset for QA.
 * Idempotent — safe to re-run. Does not wipe production-like rows aggressively.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { ALL_PERMISSION_NAMES, PERMISSION_CATALOG } from '../src/config/permissions.catalog';
import { hashPassword } from '../src/utils/password';
import { slugifyRoleName } from '../src/utils/slugify';

const prisma = new PrismaClient();
const QA_PASSWORD = process.env.QA_PASSWORD || 'Pharmacy@123';

const ARABIC_FIRST = [
  'أحمد', 'محمد', 'محمود', 'علي', 'حسن', 'حسين', 'إبراهيم', 'يوسف', 'عمر', 'خالد',
  'سعيد', 'طارق', 'كريم', 'أمير', 'ياسر', 'وليد', 'سامي', 'نادر', 'هشام', 'فادي',
  'فاطمة', 'مريم', 'سارة', 'نورا', 'هدى', 'دينا', 'ياسمين', 'سلمى', 'رانا', 'منال',
  'إيمان', 'شيماء', 'أمل', 'نجلاء', 'هبة', 'رانيا', 'لمياء', 'آية', 'منى', 'سعاد',
];
const ARABIC_LAST = [
  'حسن', 'علي', 'إبراهيم', 'عبدالله', 'محمود', 'السيد', 'الشافعي', 'الفقي', 'الجندي',
  'عبدالرحمن', 'عثمان', 'سالم', 'كامل', 'فتحي', 'زكي', 'رمضان', 'نصر', 'عطية', 'فهمي',
  'الشربيني', 'المنصور', 'الخولي', 'الدسوقي', 'المصري', 'القاهري', 'الإسكندراني', 'الغزاوي',
];

const MEDICINES: Array<{
  name: string;
  nameAr: string;
  generic: string;
  price: number;
  buy: number;
  vendor: string;
  strength?: string;
}> = [
  { name: 'Panadol Extra', nameAr: 'بانادول إكسترا', generic: 'Paracetamol + Caffeine', price: 45, buy: 28, vendor: 'GSK Egypt', strength: '500mg' },
  { name: 'Augmentin 1g', nameAr: 'أوجمنتين 1 جم', generic: 'Amoxicillin + Clavulanate', price: 185, buy: 120, vendor: 'GSK Egypt', strength: '1g' },
  { name: 'Cataflam 50mg', nameAr: 'كاتافلام 50 مجم', generic: 'Diclofenac Potassium', price: 55, buy: 32, vendor: 'Novartis', strength: '50mg' },
  { name: 'Congestal', nameAr: 'كونجستال', generic: 'Paracetamol + Chlorpheniramine + Pseudoephedrine', price: 38, buy: 22, vendor: 'EVA Pharma' },
  { name: 'Otrivin', nameAr: 'أوتريفين', generic: 'Xylometazoline', price: 65, buy: 40, vendor: 'GSK Egypt' },
  { name: 'Brufen', nameAr: 'بروفين', generic: 'Ibuprofen', price: 42, buy: 25, vendor: 'Abbott', strength: '400mg' },
  { name: 'Ventolin', nameAr: 'فنتولين', generic: 'Salbutamol', price: 95, buy: 60, vendor: 'GSK Egypt' },
  { name: 'Flagyl', nameAr: 'فلاجيل', generic: 'Metronidazole', price: 28, buy: 15, vendor: 'Sanofi', strength: '500mg' },
  { name: 'Amoxil', nameAr: 'أموكسيل', generic: 'Amoxicillin', price: 48, buy: 28, vendor: 'GSK Egypt', strength: '500mg' },
  { name: 'Voltaren Gel', nameAr: 'فولتارين جل', generic: 'Diclofenac', price: 75, buy: 45, vendor: 'Novartis' },
  { name: 'Concor 5mg', nameAr: 'كونكور 5 مجم', generic: 'Bisoprolol', price: 110, buy: 70, vendor: 'Merck', strength: '5mg' },
  { name: 'Lipitor 20mg', nameAr: 'ليبيتور 20 مجم', generic: 'Atorvastatin', price: 195, buy: 130, vendor: 'Pfizer', strength: '20mg' },
  { name: 'Zithromax 500mg', nameAr: 'زيثروماكس', generic: 'Azithromycin', price: 88, buy: 55, vendor: 'Pfizer', strength: '500mg' },
  { name: 'Glucophage 500mg', nameAr: 'جلوكوفاج', generic: 'Metformin', price: 35, buy: 18, vendor: 'Merck', strength: '500mg' },
  { name: 'Antinal', nameAr: 'أنتينال', generic: 'Nifuroxazide', price: 32, buy: 18, vendor: 'EVA Pharma' },
  { name: 'Catafast 50mg', nameAr: 'كاتافاست', generic: 'Diclofenac', price: 60, buy: 35, vendor: 'Novartis', strength: '50mg' },
  { name: 'Tavanic 500mg', nameAr: 'تافانيك', generic: 'Levofloxacin', price: 145, buy: 95, vendor: 'Sanofi', strength: '500mg' },
  { name: 'Plavix 75mg', nameAr: 'بلافكس', generic: 'Clopidogrel', price: 220, buy: 150, vendor: 'Sanofi', strength: '75mg' },
  { name: 'Nexium 40mg', nameAr: 'نكسيوم', generic: 'Esomeprazole', price: 165, buy: 110, vendor: 'AstraZeneca', strength: '40mg' },
  { name: 'Cipralex 10mg', nameAr: 'سيبرالكس', generic: 'Escitalopram', price: 210, buy: 140, vendor: 'Lundbeck', strength: '10mg' },
  { name: 'Adol 500mg', nameAr: 'أدول', generic: 'Paracetamol', price: 18, buy: 9, vendor: 'Pharco', strength: '500mg' },
  { name: 'Cataflam Drops', nameAr: 'كاتافلام نقط', generic: 'Diclofenac', price: 48, buy: 28, vendor: 'Novartis' },
  { name: 'Augmentin Syrup', nameAr: 'أوجمنتين شراب', generic: 'Amoxicillin + Clavulanate', price: 95, buy: 60, vendor: 'GSK Egypt' },
  { name: 'Hikma Amoxicillin', nameAr: 'أموكسيسيلين حكمة', generic: 'Amoxicillin', price: 40, buy: 22, vendor: 'Hikma', strength: '500mg' },
  { name: 'EIPICO Ceftriaxone', nameAr: 'سيفترياكسون إيبيكو', generic: 'Ceftriaxone', price: 55, buy: 30, vendor: 'EIPICO', strength: '1g' },
  { name: 'Pharco Vitamin C', nameAr: 'فيتامين سي فاركو', generic: 'Ascorbic Acid', price: 25, buy: 12, vendor: 'Pharco' },
  { name: 'Strepsils', nameAr: 'ستربسلز', generic: 'Amylmetacresol', price: 55, buy: 32, vendor: 'Reckitt' },
  { name: 'Gaviscon', nameAr: 'جافيسكون', generic: 'Sodium Alginate', price: 85, buy: 50, vendor: 'Reckitt' },
  { name: 'Buscopan', nameAr: 'بوسكوبان', generic: 'Hyoscine', price: 42, buy: 24, vendor: 'Sanofi' },
  { name: 'Motilium', nameAr: 'موتيليوم', generic: 'Domperidone', price: 38, buy: 22, vendor: 'Janssen' },
];

const VENDORS = [
  'GSK Egypt', 'Hikma', 'EVA Pharma', 'EIPICO', 'Pharco', 'Sanofi', 'Pfizer', 'Novartis',
  'Abbott', 'Merck', 'AstraZeneca', 'Lundbeck', 'Reckitt', 'Janssen',
];

const SUPPLIERS = [
  { name: 'United Pharma Distributors', phone: '01012345601', address: 'Nasr City, Cairo' },
  { name: 'Cairo Medical Supply Co.', phone: '01012345602', address: 'Heliopolis, Cairo' },
  { name: 'Delta Drug Wholesalers', phone: '01012345603', address: 'Mansoura, Dakahlia' },
  { name: 'Alexandria Pharma Hub', phone: '01012345604', address: 'Smouha, Alexandria' },
  { name: 'Giza Health Traders', phone: '01012345605', address: 'Dokki, Giza' },
  { name: 'Nile Valley Pharmaceuticals', phone: '01012345606', address: 'Assiut' },
  { name: 'Misr Scientific Stores', phone: '01012345607', address: 'Downtown, Cairo' },
  { name: 'Sahara Med Distributors', phone: '01012345608', address: '6th October City' },
];

type RoleSpec = { display: string; perms: (all: string[]) => string[] };

const ROLE_SPECS: RoleSpec[] = [
  { display: 'Owner', perms: (all) => all },
  {
    display: 'Manager',
    perms: (all) => all.filter((p) => !['role.destroy', 'user.destroy'].includes(p)),
  },
  {
    display: 'Pharmacist',
    perms: (all) =>
      all.filter(
        (p) =>
          p.startsWith('sale.') ||
          p.startsWith('medicine.') ||
          p.startsWith('report.') ||
          p.startsWith('prescription.') ||
          p.startsWith('customer.') ||
          p.startsWith('doctor.') ||
          p.startsWith('patient.') ||
          p.startsWith('test.') ||
          p === 'setting.generalSetting',
      ),
  },
  {
    display: 'Cashier',
    perms: (all) =>
      all.filter(
        (p) =>
          ['sale.index', 'sale.create', 'sale.store', 'sale.show', 'sale.update'].includes(p) ||
          ['customer.index', 'customer.store', 'customer.create', 'customer.show', 'customer.edit'].includes(p) ||
          p.startsWith('paymentmethod.') ||
          p === 'report.instock',
      ),
  },
  {
    display: 'Store Keeper',
    perms: (all) =>
      all.filter(
        (p) =>
          p.startsWith('purchase.') ||
          p.startsWith('supplier.') ||
          p.startsWith('medicine.') ||
          p.startsWith('vendor.') ||
          ['report.instock', 'report.low_stock', 'report.stockout', 'report.upcoming_expire', 'report.already_expire'].includes(p),
      ),
  },
];

async function ensurePermissions(): Promise<void> {
  for (const perm of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      create: { name: perm.name, label: perm.label, module: perm.module },
      update: { label: perm.label, module: perm.module },
    });
  }
}

async function ensureRole(display: string, permissionNames: string[]) {
  const name = slugifyRoleName(display);
  const role = await prisma.role.upsert({
    where: { name },
    create: { name, displayName: display },
    update: { displayName: display },
  });
  const permissions = await prisma.permission.findMany({
    where: { name: { in: permissionNames } },
  });
  await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
  if (permissions.length) {
    await prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
  }
  return role;
}

async function main(): Promise<void> {
  await ensurePermissions();

  const shop = await prisma.shop.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      name: 'Al-Noor Pharmacy',
      nameAr: 'صيدلية النور',
      address: '12 Tahrir St, Downtown, Cairo',
      phone: '0227945000',
      email: 'info@alnoor.eg',
      currency: 'EGP',
      currencySymbol: 'ج.م',
      timeZone: 'Africa/Cairo',
      locale: 'ar',
      prefix: 'INV',
      invoiceNumberFormat: 'INV-{YYYY}-{SEQ:6}',
      taxMode: 'exclusive',
      taxRatePercent: 0,
      lowStockAlert: 10,
      upcomingExpireAlert: 30,
    },
    update: {
      name: 'Al-Noor Pharmacy',
      nameAr: 'صيدلية النور',
      // Keep taxRate 0 on shop 1 for deterministic integration tests.
      // Egypt VAT 14% is applied via settings API / shop 2 demo config.
      taxRatePercent: 0,
      lowStockAlert: 10,
      upcomingExpireAlert: 30,
      currency: 'EGP',
      timeZone: 'Africa/Cairo',
      locale: 'ar',
    },
  });

  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('shops','id'), COALESCE((SELECT MAX(id) FROM shops), 1))`,
  );

  const passwordHash = await hashPassword(QA_PASSWORD);
  const roleIds = new Map<string, number>();
  for (const spec of ROLE_SPECS) {
    const role = await ensureRole(spec.display, spec.perms(ALL_PERMISSION_NAMES));
    roleIds.set(spec.display, role.id);
  }
  // Keep Administrator fully privileged for existing tests
  await ensureRole('Administrator', ALL_PERMISSION_NAMES);

  const staff: Array<{ email: string; name: string; role: string }> = [
    { email: 'owner@alnoor.eg', name: 'أحمد النور', role: 'Owner' },
    { email: 'manager@alnoor.eg', name: 'منى عبدالرحمن', role: 'Manager' },
    { email: 'pharmacist@alnoor.eg', name: 'د. كريم حسني', role: 'Pharmacist' },
    { email: 'cashier@alnoor.eg', name: 'سارة محمود', role: 'Cashier' },
    { email: 'storekeeper@alnoor.eg', name: 'محمود فتحي', role: 'Store Keeper' },
  ];
  for (const u of staff) {
    await prisma.user.upsert({
      where: { email: u.email },
      create: {
        email: u.email,
        name: u.name,
        password: passwordHash,
        shopId: shop.id,
        roleId: roleIds.get(u.role)!,
      },
      update: {
        name: u.name,
        password: passwordHash,
        shopId: shop.id,
        roleId: roleIds.get(u.role)!,
      },
    });
  }

  const methods = ['Cash', 'Vodafone Cash', 'InstaPay', 'Banque Misr'];
  for (const name of methods) {
    await prisma.paymentMethod.upsert({
      where: { shopId_name: { shopId: shop.id, name } },
      create: {
        shopId: shop.id,
        name,
        balance: name === 'Cash' ? 500000 : 50000,
      },
      update: name === 'Cash' ? { balance: 500000 } : {},
    });
  }

  const vendorIds = new Map<string, number>();
  let vPhone = 100;
  for (const name of VENDORS) {
    const existing = await prisma.vendor.findFirst({ where: { shopId: shop.id, name } });
    const vendor =
      existing ??
      (await prisma.vendor.create({
        data: {
          shopId: shop.id,
          name,
          phone: `02255${String(vPhone++).padStart(5, '0')}`,
          address: `${name} HQ, Egypt`,
        },
      }));
    vendorIds.set(name, vendor.id);
  }

  const supplierIds: number[] = [];
  for (const s of SUPPLIERS) {
    const existing = await prisma.supplier.findFirst({ where: { shopId: shop.id, phone: s.phone } });
    const row =
      existing ??
      (await prisma.supplier.create({
        data: { shopId: shop.id, name: s.name, phone: s.phone, address: s.address, due: 0 },
      }));
    supplierIds.push(row.id);
  }

  const category = await prisma.productCategory.upsert({
    where: { shopId_slug: { shopId: shop.id, slug: 'general-medicines' } },
    create: {
      shopId: shop.id,
      title: 'General Medicines',
      slug: 'general-medicines',
      status: 'active',
      sorting: 1,
    },
    update: {},
  });

  const type = await prisma.medicineType.upsert({
    where: { shopId_name: { shopId: shop.id, name: 'Tablet' } },
    create: { shopId: shop.id, name: 'Tablet', status: 1 },
    update: {},
  });
  const unit = await prisma.unit.upsert({
    where: { shopId_name: { shopId: shop.id, name: 'Box' } },
    create: { shopId: shop.id, name: 'Box', status: 1 },
    update: {},
  });
  const leaf = await prisma.leaf.upsert({
    where: { shopId_name: { shopId: shop.id, name: 'Strip' } },
    create: { shopId: shop.id, name: 'Strip', amount: 10 },
    update: {},
  });

  const primarySupplierId = supplierIds[0]!;
  const medicineIds: number[] = [];
  for (let i = 0; i < MEDICINES.length; i += 1) {
    const m = MEDICINES[i]!;
    const qrCode = `QA-MED-${String(i + 1).padStart(4, '0')}`;
    const vendorId = vendorIds.get(m.vendor) ?? [...vendorIds.values()][0]!;
    const existing = await prisma.medicine.findFirst({ where: { shopId: shop.id, qrCode } });
    const row =
      existing ??
      (await prisma.medicine.create({
        data: {
          shopId: shop.id,
          qrCode,
          name: m.name,
          nameAr: m.nameAr,
          genericName: m.generic,
          price: m.price,
          buyPrice: m.buy,
          strength: m.strength ?? null,
          description: `${m.name} — Egyptian market pack`,
          status: 'active',
          supplierId: primarySupplierId,
          vendorId,
          typeId: type.id,
          purchaseUnitId: unit.id,
          sellUnitId: unit.id,
          leafId: leaf.id,
          categoryIds: [category.id] as unknown as Prisma.InputJsonValue,
          barcodes: [`6223001${String(100000 + i).slice(-6)}`] as unknown as Prisma.InputJsonValue,
        },
      }));
    medicineIds.push(row.id);
  }

  // 220 Arabic customers
  const customerData: Prisma.CustomerCreateManyInput[] = [];
  for (let i = 0; i < 220; i += 1) {
    const first = ARABIC_FIRST[i % ARABIC_FIRST.length]!;
    const last = ARABIC_LAST[Math.floor(i / ARABIC_FIRST.length) % ARABIC_LAST.length]!;
    const phone = `010${String(20000000 + i).padStart(8, '0')}`;
    customerData.push({
      shopId: shop.id,
      name: `${first} ${last}`,
      phone,
      email: `customer${i + 1}@qa.alnoor.eg`,
      address: i % 3 === 0 ? 'المعادي، القاهرة' : i % 3 === 1 ? 'المهندسين، الجيزة' : 'سموحة، الإسكندرية',
      due: i % 17 === 0 ? new Prisma.Decimal((i % 5) * 50 + 25) : new Prisma.Decimal(0),
    });
  }
  await prisma.customer.createMany({ data: customerData, skipDuplicates: true });

  const cash = await prisma.paymentMethod.findFirstOrThrow({
    where: { shopId: shop.id, name: 'Cash' },
  });
  const today = new Date();
  const in90 = new Date(today);
  in90.setDate(in90.getDate() + 90);
  const in15 = new Date(today);
  in15.setDate(in15.getDate() + 15);
  const expired = new Date(today);
  expired.setDate(expired.getDate() - 10);

  // Ensure stock batches for first 15 medicines
  for (let i = 0; i < Math.min(15, medicineIds.length); i += 1) {
    const medicineId = medicineIds[i]!;
    const med = await prisma.medicine.findUniqueOrThrow({ where: { id: medicineId } });
    const existingBatch = await prisma.batch.findFirst({
      where: { shopId: shop.id, medicineId, name: 'QA-LOT-A' },
    });
    if (!existingBatch) {
      await prisma.batch.create({
        data: {
          shopId: shop.id,
          medicineId,
          name: 'QA-LOT-A',
          qty: 80 + i * 3,
          purchaseQty: 80 + i * 3,
          expire: i % 5 === 0 ? expired : i % 4 === 0 ? in15 : in90,
          price: med.price,
          buyPrice: med.buyPrice,
          invId: `QA-BATCH-${i + 1}`,
        },
      });
    }
  }

  // Demo purchase if missing
  const purInv = 'QAPUR-0001';
  if (!(await prisma.purchase.findFirst({ where: { shopId: shop.id, invId: purInv } }))) {
    const medId = medicineIds[0]!;
    const med = await prisma.medicine.findUniqueOrThrow({ where: { id: medId } });
    const qty = 100;
    const total = Number(med.buyPrice) * qty;
    await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.create({
        data: {
          shopId: shop.id,
          supplierId: primarySupplierId,
          methodId: cash.id,
          invId: purInv,
          date: today,
          subtotal: total,
          discount: 0,
          totalPrice: total,
          paidAmount: total * 0.7,
          duePrice: total * 0.3,
          changeAmount: 0,
          qty,
        },
      });
      await tx.supplier.update({
        where: { id: primarySupplierId },
        data: { due: { increment: total * 0.3 } },
      });
      await tx.paymentMethod.update({
        where: { id: cash.id },
        data: { balance: { decrement: total * 0.7 } },
      });
      await tx.purchasePay.create({
        data: {
          shopId: shop.id,
          purchaseId: purchase.id,
          supplierId: primarySupplierId,
          methodId: cash.id,
          amount: total * 0.7,
          date: today,
        },
      });
      await tx.batch.create({
        data: {
          shopId: shop.id,
          medicineId: medId,
          name: 'QA-PUR-LOT',
          qty,
          purchaseQty: qty,
          expire: in90,
          price: med.price,
          buyPrice: med.buyPrice,
          purchaseId: purchase.id,
          invId: purInv,
        },
      });
      await tx.ledgerTransaction.create({
        data: {
          tranId: `QA-PUR-${purchase.id}`,
          date: today,
          debitAccountId: 1,
          creditAccountId: 3,
          amount: total,
          invoiceType: 'purchase',
          invoiceId: purInv,
          particular: `QA purchase ${purInv}`,
        },
      });
    });
  }

  // Demo sale invoice if missing
  const saleInv = 'QASALE-0001';
  if (!(await prisma.invoice.findFirst({ where: { shopId: shop.id, invId: saleInv } }))) {
    const medId = medicineIds[0]!;
    const batch = await prisma.batch.findFirst({
      where: { shopId: shop.id, medicineId: medId, qty: { gt: 5 } },
      orderBy: { id: 'asc' },
    });
    const customer = await prisma.customer.findFirst({ where: { shopId: shop.id }, orderBy: { id: 'asc' } });
    if (batch && customer) {
      const qty = 2;
      const unitPrice = Number(batch.price);
      const total = unitPrice * qty;
      await prisma.$transaction(async (tx) => {
        await tx.batch.update({ where: { id: batch.id }, data: { qty: { decrement: qty } } });
        const invoice = await tx.invoice.create({
          data: {
            shopId: shop.id,
            customerId: customer.id,
            methodId: cash.id,
            invId: saleInv,
            name: customer.name,
            phone: customer.phone,
            date: today,
            subtotal: total,
            discount: 0,
            tax: 0,
            totalPrice: total,
            paidAmount: total,
            duePrice: 0,
            returnedAmount: 0,
            qty,
            medicines: [
              {
                batchId: batch.id,
                medicineId: medId,
                qty,
                remainingQty: qty,
                unitPrice,
                origQty: qty,
                origLineTotal: total,
              },
            ] as unknown as Prisma.InputJsonValue,
          },
        });
        await tx.paymentMethod.update({
          where: { id: cash.id },
          data: { balance: { increment: total } },
        });
        await tx.invoicePay.create({
          data: {
            shopId: shop.id,
            invoiceId: invoice.id,
            customerId: customer.id,
            methodId: cash.id,
            amount: total,
            date: today,
          },
        });
        await tx.ledgerTransaction.create({
          data: {
            tranId: `QA-SALE-${invoice.id}`,
            date: today,
            debitAccountId: 4,
            creditAccountId: 2,
            amount: total,
            invoiceType: 'sale',
            invoiceId: saleInv,
            particular: `QA sale ${saleInv}`,
          },
        });
      });
    }
  }

  // Expense category + expense
  const expCat = await prisma.expenseCategory.upsert({
    where: { shopId_name: { shopId: shop.id, name: 'Rent' } },
    create: { shopId: shop.id, name: 'Rent', description: 'Shop rent', status: 'active' },
    update: {},
  });
  if (!(await prisma.pharmacyExpense.findFirst({ where: { shopId: shop.id, title: 'QA Monthly Rent' } }))) {
    const amount = 8000;
    await prisma.$transaction(async (tx) => {
      const expense = await tx.pharmacyExpense.create({
        data: {
          shopId: shop.id,
          categoryId: expCat.id,
          accountId: 1,
          date: today,
          title: 'QA Monthly Rent',
          amount,
          reference: 'QA-RENT-01',
        },
      });
      await tx.ledgerTransaction.create({
        data: {
          tranId: `QA-EXP-${expense.id}`,
          date: today,
          debitAccountId: 1,
          creditAccountId: 3,
          amount,
          invoiceType: 'expense',
          invoiceId: `EXP-${expense.id}`,
          particular: expense.title,
        },
      });
    });
  }

  // Second shop for isolation tests
  const shop2 = await prisma.shop.upsert({
    where: { id: 2 },
    create: {
      id: 2,
      name: 'Al-Salam Pharmacy',
      nameAr: 'صيدلية السلام',
      currency: 'EGP',
      timeZone: 'Africa/Cairo',
      locale: 'ar',
      taxMode: 'exclusive',
      taxRatePercent: 14,
    },
    update: { name: 'Al-Salam Pharmacy', taxRatePercent: 14, taxMode: 'exclusive' },
  });
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('shops','id'), COALESCE((SELECT MAX(id) FROM shops), 1))`,
  );
  const cashierRoleId = roleIds.get('Cashier')!;
  await prisma.user.upsert({
    where: { email: 'cashier@alsalam.eg' },
    create: {
      email: 'cashier@alsalam.eg',
      name: 'عادل سالم',
      password: passwordHash,
      shopId: shop2.id,
      roleId: cashierRoleId,
    },
    update: { shopId: shop2.id, roleId: cashierRoleId, password: passwordHash },
  });
  await prisma.customer.createMany({
    data: [
      {
        shopId: shop2.id,
        name: 'عميل السلام',
        phone: '01199999001',
        email: 'shop2-customer@qa.eg',
      },
    ],
    skipDuplicates: true,
  });

  const counts = {
    customers: await prisma.customer.count({ where: { shopId: shop.id } }),
    medicines: await prisma.medicine.count({ where: { shopId: shop.id } }),
    suppliers: await prisma.supplier.count({ where: { shopId: shop.id } }),
    vendors: await prisma.vendor.count({ where: { shopId: shop.id } }),
    batches: await prisma.batch.count({ where: { shopId: shop.id } }),
    users: await prisma.user.count({ where: { shopId: shop.id } }),
  };
  // eslint-disable-next-line no-console
  console.log('QA seed complete:', counts, `password=${QA_PASSWORD}`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
