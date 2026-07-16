import { PrismaClient } from '@prisma/client';
import { config } from '../src/config';
import { PERMISSION_CATALOG, ALL_PERMISSION_NAMES } from '../src/config/permissions.catalog';
import { hashPassword } from '../src/utils/password';
import { slugifyRoleName } from '../src/utils/slugify';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  for (const perm of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      create: {
        name: perm.name,
        label: perm.label,
        module: perm.module,
      },
      update: {
        label: perm.label,
        module: perm.module,
      },
    });
  }

  const adminRoleName = slugifyRoleName('Administrator');
  const adminRole = await prisma.role.upsert({
    where: { name: adminRoleName },
    create: {
      name: adminRoleName,
      displayName: 'Administrator',
    },
    update: {
      displayName: 'Administrator',
    },
  });

  const permissions = await prisma.permission.findMany({
    where: { name: { in: ALL_PERMISSION_NAMES } },
  });

  await prisma.rolePermission.deleteMany({ where: { roleId: adminRole.id } });
  await prisma.rolePermission.createMany({
    data: permissions.map((p) => ({
      roleId: adminRole.id,
      permissionId: p.id,
    })),
    skipDuplicates: true,
  });

  const shop = await prisma.shop.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      name: config.seed.shopName,
      nameAr: config.seed.shopName,
      currency: config.market.defaultCurrency,
      timeZone: config.market.defaultTimezone,
      locale: config.market.defaultLocale,
      prefix: 'INV',
      invoiceNumberFormat: 'INV-{YYYY}-{SEQ:6}',
      taxMode: 'exclusive',
      taxRatePercent: 0,
      lowStockAlert: 0,
      upcomingExpireAlert: 7,
    },
    update: {
      name: config.seed.shopName,
    },
  });
  // Explicit `id: 1` above does not advance Postgres's autoincrement sequence — resync it so
  // subsequent `prisma.shop.create()` calls (e.g. tests creating additional shops) don't collide.
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('shops','id'), COALESCE((SELECT MAX(id) FROM shops), 1))`,
  );

  const password = await hashPassword(config.seed.adminPassword);
  const adminUser = await prisma.user.upsert({
    where: { email: config.seed.adminEmail },
    create: {
      name: config.seed.adminName,
      email: config.seed.adminEmail,
      password,
      shopId: shop.id,
      roleId: adminRole.id,
    },
    update: {
      name: config.seed.adminName,
      password,
      shopId: shop.id,
      roleId: adminRole.id,
    },
  });

  await seedBp2Catalog(shop.id);
  await seedAccounting();
  await seedBp3Purchases(shop.id);
  await seedBp5Clinical(shop.id);
  await seedBp6Expenses(shop.id);
  await seedBp7LanguagesAndNotifications(shop.id, adminUser.id);
}

/** Fixed account ids 1-4 mirror Laravel AccountEnum.php — required by ledger.service.ts. */
async function seedAccounting(): Promise<void> {
  const typeSeeds = [
    { name: 'Asset', serial: 1 },
    { name: 'Equity', serial: 2 },
    { name: 'Expense', serial: 3 },
    { name: 'Liability', serial: 4 },
    { name: 'Revenue', serial: 5 },
    { name: 'Withdrawal', serial: 6 },
  ];
  const typeIds = new Map<string, number>();
  for (const t of typeSeeds) {
    const created = await prisma.accountType.upsert({
      where: { name: t.name },
      create: { name: t.name, serial: t.serial, isDeletable: false },
      update: {},
    });
    typeIds.set(t.name, created.id);
  }

  const accountSeeds = [
    { id: 1, name: 'Cost of Sales', type: 'Expense' },
    { id: 2, name: 'Sales', type: 'Revenue' },
    { id: 3, name: 'Accounts Payable', type: 'Liability' },
    { id: 4, name: 'Accounts Receivable', type: 'Asset' },
  ];
  for (const a of accountSeeds) {
    await prisma.account.upsert({
      where: { id: a.id },
      create: {
        id: a.id,
        name: a.name,
        accountTypeId: typeIds.get(a.type)!,
        serial: a.id,
        isDeletable: false,
      },
      update: { name: a.name },
    });
  }
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('accounts','id'), COALESCE((SELECT MAX(id) FROM accounts), 1))`,
  );
}

/** Fund the Cash drawer generously and create one demo committed purchase with a batch. */
async function seedBp3Purchases(shopId: number): Promise<void> {
  const method = await prisma.paymentMethod.upsert({
    where: { shopId_name: { shopId, name: 'Cash' } },
    create: { shopId, name: 'Cash', balance: 1000000 },
    update: { balance: 1000000 },
  });

  const supplier = await prisma.supplier.findFirst({ where: { shopId }, orderBy: { id: 'asc' } });
  const medicine = await prisma.medicine.findFirst({ where: { shopId }, orderBy: { id: 'asc' } });
  if (!supplier || !medicine) {
    return;
  }

  const invId = 'PURSEED0001';
  const existing = await prisma.purchase.findFirst({ where: { shopId, invId } });
  if (existing) {
    return;
  }

  const quantity = 50;
  const buyPrice = Number(medicine.buyPrice);
  const price = Number(medicine.price);
  const totalPrice = buyPrice * quantity;
  const date = new Date();

  await prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.create({
      data: {
        shopId,
        supplierId: supplier.id,
        methodId: method.id,
        invId,
        date,
        subtotal: totalPrice,
        discount: 0,
        totalPrice,
        paidAmount: totalPrice,
        duePrice: 0,
        changeAmount: 0,
        qty: quantity,
      },
    });

    await tx.purchasePay.create({
      data: {
        shopId,
        purchaseId: purchase.id,
        supplierId: supplier.id,
        methodId: method.id,
        amount: totalPrice,
        date,
      },
    });

    await tx.paymentMethod.update({
      where: { id: method.id },
      data: { balance: { decrement: totalPrice } },
    });

    await tx.batch.create({
      data: {
        shopId,
        medicineId: medicine.id,
        name: 'Seed batch',
        qty: quantity,
        purchaseQty: quantity,
        price,
        buyPrice,
        purchaseId: purchase.id,
        invId: purchase.invId,
      },
    });

    await tx.ledgerTransaction.create({
      data: {
        tranId: `PURCHASE-SEED-${purchase.id}`,
        date,
        debitAccountId: 1,
        creditAccountId: 3,
        amount: totalPrice,
        invoiceType: 'purchase',
        invoiceId: purchase.invId,
        particular: `Paid on Purchase Invoice ${purchase.invId}`,
      },
    });
  });
}

/** BP5: one doctor, one patient, one lab test (all global/no shop_id) + one demo prescription. */
async function seedBp5Clinical(shopId: number): Promise<void> {
  const doctor =
    (await prisma.doctor.findFirst({ where: { name: 'Dr. Mona Youssef' } })) ??
    (await prisma.doctor.create({
      data: {
        name: 'Dr. Mona Youssef',
        title: 'Consultant',
        phone: '01033333333',
        speciality: 'Internal Medicine',
        address: 'Zamalek, Cairo',
        hospital: 'Nile Medical Center',
      },
    }));

  const patient =
    (await prisma.patient.findFirst({ where: { name: 'Hassan Ali', phone: '01044444444' } })) ??
    (await prisma.patient.create({
      data: {
        name: 'Hassan Ali',
        phone: '01044444444',
        address: 'Heliopolis, Cairo',
        gender: 'male',
        age: 34,
      },
    }));

  const labTest = await prisma.labTest.upsert({
    where: { name: 'Complete Blood Count' },
    create: { name: 'Complete Blood Count', center: 'Nile Medical Center' },
    update: {},
  });

  const existingPrescription = await prisma.prescription.findFirst({
    where: { shopId, prescriptionNo: 'RXSEED0000000001' },
  });
  if (!existingPrescription) {
    await prisma.prescription.create({
      data: {
        shopId,
        prescriptionNo: 'RXSEED0000000001',
        patientId: patient.id,
        doctorId: doctor.id,
        date: new Date(),
        visitNo: 1,
        visitFees: 150,
        tests: [{ test: labTest.name }],
        medicines: [{ medicine: 'Paracetamol 500mg', schedule: '1-0-1', day: '5' }],
        description: 'Routine follow-up visit',
        advice: 'Rest and stay hydrated',
      },
    });
  }
}

/** One demo expense category + one sample expense, posted to the ledger like a real POST /expenses call. */
async function seedBp6Expenses(shopId: number): Promise<void> {
  const category = await prisma.expenseCategory.upsert({
    where: { shopId_name: { shopId, name: 'Utilities' } },
    create: { shopId, name: 'Utilities', description: 'Electricity, water, internet', status: 'active' },
    update: {},
  });

  const existing = await prisma.pharmacyExpense.findFirst({
    where: { shopId, title: 'Electricity bill (seed)' },
  });
  if (existing) {
    return;
  }

  const amount = 350;
  const date = new Date();
  const accountId = 1; // Cost of Sales — arbitrary user-chosen account for the demo expense.

  await prisma.$transaction(async (tx) => {
    const expense = await tx.pharmacyExpense.create({
      data: {
        shopId,
        categoryId: category.id,
        accountId,
        date,
        title: 'Electricity bill (seed)',
        amount,
        reference: 'SEED-EXP-0001',
      },
    });

    await tx.ledgerTransaction.create({
      data: {
        tranId: `EXPENSE-SEED-${expense.id}`,
        date,
        debitAccountId: accountId,
        creditAccountId: 3,
        amount,
        invoiceType: 'expense',
        invoiceId: `EXP-${expense.id}`,
        particular: expense.title,
      },
    });
  });
}

/** BP7: ar/en language catalog rows with basic common UI terms + one unread admin notification. */
async function seedBp7LanguagesAndNotifications(shopId: number, adminUserId: number): Promise<void> {
  const commonTerms: Record<'en' | 'ar', Record<string, string>> = {
    en: {
      dashboard: 'Dashboard',
      login: 'Login',
      logout: 'Logout',
      save: 'Save',
      cancel: 'Cancel',
      customers: 'Customers',
      suppliers: 'Suppliers',
      purchases: 'Purchases',
      sales: 'Sales',
      reports: 'Reports',
      settings: 'Settings',
      search: 'Search',
      add: 'Add',
      edit: 'Edit',
      delete: 'Delete',
      yes: 'Yes',
      no: 'No',
      total: 'Total',
      date: 'Date',
      name: 'Name',
      phone: 'Phone',
      due: 'Due',
    },
    ar: {
      dashboard: 'لوحة التحكم',
      login: 'تسجيل الدخول',
      logout: 'تسجيل الخروج',
      save: 'حفظ',
      cancel: 'إلغاء',
      customers: 'العملاء',
      suppliers: 'الموردون',
      purchases: 'المشتريات',
      sales: 'المبيعات',
      reports: 'التقارير',
      settings: 'الإعدادات',
      search: 'بحث',
      add: 'إضافة',
      edit: 'تعديل',
      delete: 'حذف',
      yes: 'نعم',
      no: 'لا',
      total: 'الإجمالي',
      date: 'التاريخ',
      name: 'الاسم',
      phone: 'الهاتف',
      due: 'المستحق',
    },
  };

  await prisma.language.upsert({
    where: { iso: 'en' },
    create: { shopId, name: 'English', iso: 'en', status: 'active', terms: commonTerms.en },
    update: {},
  });
  await prisma.language.upsert({
    where: { iso: 'ar' },
    create: { shopId, name: 'العربية', iso: 'ar', status: 'active', terms: commonTerms.ar },
    update: {},
  });

  const notificationTitle = 'Welcome to Pharmacy Sys';
  const existingNotification = await prisma.notification.findFirst({
    where: { shopId, receiverId: adminUserId, title: notificationTitle },
  });
  if (!existingNotification) {
    await prisma.notification.create({
      data: {
        shopId,
        senderId: null,
        receiverId: adminUserId,
        title: notificationTitle,
        description: 'Your pharmacy management system is set up and ready to use.',
        seen: false,
      },
    });
  }
}

async function seedBp2Catalog(shopId: number): Promise<void> {
  await prisma.paymentMethod.upsert({
    where: { shopId_name: { shopId, name: 'Cash' } },
    create: { shopId, name: 'Cash', balance: 5000 },
    update: {},
  });

  const customerSeeds = [
    { name: 'Ahmed Mostafa', email: 'ahmed.mostafa@example.com', phone: '01011111111' },
    { name: 'Sara Ibrahim', email: 'sara.ibrahim@example.com', phone: '01022222222' },
  ];
  for (const c of customerSeeds) {
    await prisma.customer.upsert({
      where: { shopId_email: { shopId, email: c.email } },
      create: { shopId, name: c.name, email: c.email, phone: c.phone, due: 0 },
      update: {},
    });
  }

  const supplierSeeds = [
    { name: 'Delta Pharma Distributors', phone: '0221111111' },
    { name: 'Nile Med Supplies', phone: '0222222222' },
  ];
  const suppliers: { id: number; name: string }[] = [];
  for (const s of supplierSeeds) {
    const supplier = await prisma.supplier.upsert({
      where: { shopId_phone: { shopId, phone: s.phone } },
      create: { shopId, name: s.name, phone: s.phone, due: 0 },
      update: {},
    });
    suppliers.push(supplier);
  }

  const vendor =
    (await prisma.vendor.findFirst({ where: { shopId, name: 'PharmaCorp Egypt' } })) ??
    (await prisma.vendor.create({
      data: {
        shopId,
        name: 'PharmaCorp Egypt',
        phone: '19999',
        address: 'Industrial Zone, 6th of October City, Giza',
        due: 0,
        payable: 0,
      },
    }));

  const unit = await prisma.unit.upsert({
    where: { shopId_name: { shopId, name: 'Box' } },
    create: { shopId, name: 'Box', status: 1 },
    update: {},
  });
  const pieceUnit = await prisma.unit.upsert({
    where: { shopId_name: { shopId, name: 'Piece' } },
    create: { shopId, name: 'Piece', status: 1 },
    update: {},
  });

  const leaf = await prisma.leaf.upsert({
    where: { shopId_name: { shopId, name: 'Strip of 10' } },
    create: { shopId, name: 'Strip of 10', amount: 10 },
    update: {},
  });

  const medicineType = await prisma.medicineType.upsert({
    where: { shopId_name: { shopId, name: 'Tablet' } },
    create: { shopId, name: 'Tablet', status: 1 },
    update: {},
  });

  const category = await prisma.productCategory.upsert({
    where: { shopId_slug: { shopId, slug: 'pain-relief' } },
    create: {
      shopId,
      title: 'Pain Relief',
      slug: 'pain-relief',
      type: 'inventory',
      status: 'active',
      sorting: 1,
    },
    update: {},
  });

  const medicineSeeds = [
    {
      qrCode: 'QR-PARA-500-001',
      name: 'Paracetamol 500mg',
      genericName: 'Paracetamol',
      price: 15.5,
      buyPrice: 10,
      barcodes: ['6221031000019'],
    },
    {
      qrCode: 'QR-AMOX-250-002',
      name: 'Amoxicillin 250mg',
      genericName: 'Amoxicillin',
      price: 32.75,
      buyPrice: 22,
      barcodes: ['6221031000026'],
    },
    {
      qrCode: 'QR-IBUP-400-003',
      name: 'Ibuprofen 400mg',
      genericName: 'Ibuprofen',
      price: 20,
      buyPrice: 13.5,
      barcodes: ['6221031000033'],
    },
    {
      qrCode: 'QR-OMEP-020-004',
      name: 'Omeprazole 20mg',
      genericName: 'Omeprazole',
      price: 28.25,
      buyPrice: 18.9,
      barcodes: ['6221031000040'],
    },
    {
      qrCode: 'QR-CETI-010-005',
      name: 'Cetirizine 10mg',
      genericName: 'Cetirizine',
      price: 12,
      buyPrice: 7.25,
      barcodes: ['6221031000057'],
    },
  ];

  for (const [index, m] of medicineSeeds.entries()) {
    await prisma.medicine.upsert({
      where: { shopId_qrCode: { shopId, qrCode: m.qrCode } },
      create: {
        shopId,
        qrCode: m.qrCode,
        name: m.name,
        slug: `${m.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        genericName: m.genericName,
        price: m.price,
        buyPrice: m.buyPrice,
        quantity: 100,
        instock: 100,
        leafId: leaf.id,
        typeId: medicineType.id,
        purchaseUnitId: unit.id,
        sellUnitId: pieceUnit.id,
        unitConversion: 10,
        categoryIds: [category.id],
        barcodes: m.barcodes,
        supplierId: suppliers[index % suppliers.length].id,
        vendorId: vendor.id,
        kind: 'inventory',
        description: `${m.name} — demo seed medicine`,
        status: 'active',
      },
      update: {},
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
