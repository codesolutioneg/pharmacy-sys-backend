import request from 'supertest';
import { createApp } from '../../src/app';
import { config } from '../../src/config';
import { prisma } from '../../src/lib/prisma';
import { setMailTransport, SendMailOptions } from '../../src/services/mail.service';

const app = createApp();

function binaryParser(res: NodeJS.ReadableStream & { setEncoding: (enc: string) => void }, callback: (err: Error | null, body: Buffer) => void) {
  res.setEncoding('binary');
  let data = '';
  res.on('data', (chunk: string) => {
    data += chunk;
  });
  res.on('end', () => {
    callback(null, Buffer.from(data, 'binary'));
  });
}

describe('BP4 integration', () => {
  let accessToken = '';

  beforeAll(async () => {
    // Deterministic money math for BP4 assertions (qa-seed may set market VAT elsewhere).
    await prisma.shop.update({
      where: { id: 1 },
      data: { taxRatePercent: 0, taxMode: 'exclusive' },
    });
    const res = await request(app).post('/api/v1/auth/login').send({
      email: config.seed.adminEmail,
      password: config.seed.adminPassword,
    });
    expect(res.status).toBe(200);
    accessToken = res.body.data.accessToken as string;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function auth() {
    return { Authorization: `Bearer ${accessToken}` };
  }

  async function createSupplier(namePrefix: string) {
    const res = await request(app)
      .post('/api/v1/suppliers')
      .set(auth())
      .send({ name: `${namePrefix} ${Date.now()}`, phone: `01${Date.now().toString().slice(-9)}` });
    expect(res.status).toBe(201);
    return res.body.data as { id: number };
  }

  async function createMethod(namePrefix: string, balance: number) {
    const res = await request(app)
      .post('/api/v1/payment-methods')
      .set(auth())
      .send({ name: `${namePrefix} ${Date.now()}-${Math.random()}`, balance });
    expect(res.status).toBe(201);
    return res.body.data as { id: number; balance: string };
  }

  let customerSeq = 0;

  async function createCustomer(namePrefix: string) {
    customerSeq += 1;
    const stamp = `${Date.now()}${customerSeq}${Math.floor(Math.random() * 10000)}`;
    const res = await request(app)
      .post('/api/v1/customers')
      .set(auth())
      .send({
        name: `${namePrefix} ${stamp}`,
        email: `${namePrefix.toLowerCase()}${stamp}@example.com`,
        phone: `0${stamp}`.slice(-13),
      });
    expect(res.status).toBe(201);
    return res.body.data as { id: number; due: string; email: string; name: string };
  }

  async function createMedicine(namePrefix: string, supplierId: number) {
    const qrCode = `QR-${namePrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const res = await request(app).post('/api/v1/medicines').set(auth()).send({
      name: `${namePrefix} ${Date.now()}`,
      genericName: 'Generic',
      qrCode,
      description: 'BP4 test medicine',
      status: 'active',
      supplierId,
    });
    expect(res.status).toBe(201);
    return res.body.data as { id: number };
  }

  /** Creates a committed purchase (and thus a batch) via the BP3 flow. */
  async function createBatch(params: {
    supplierId: number;
    methodId: number;
    medicineId: number;
    quantity: number;
    buyPrice: number;
    price: number;
    expireDate?: string;
  }) {
    const draft = await request(app).post('/api/v1/purchases/drafts').set(auth()).send({});
    expect(draft.status).toBe(201);
    const draftId = draft.body.data.id;

    await request(app)
      .post(`/api/v1/purchases/drafts/${draftId}/lines`)
      .set(auth())
      .send({
        medicineId: params.medicineId,
        quantity: params.quantity,
        buyPrice: params.buyPrice,
        price: params.price,
        ...(params.expireDate ? { expireDate: params.expireDate } : {}),
      });

    await request(app)
      .patch(`/api/v1/purchases/drafts/${draftId}`)
      .set(auth())
      .send({ supplierId: params.supplierId, paymentMethodId: params.methodId, paidAmount: 0 });

    const commit = await request(app)
      .post('/api/v1/purchases')
      .set(auth())
      .send({ draftId });
    expect(commit.status).toBe(201);
    const batch = commit.body.data.batches.find(
      (b: { medicineId: number }) => b.medicineId === params.medicineId,
    );
    return batch as { id: number; qty: number; price: string };
  }

  async function createCart() {
    const res = await request(app).post('/api/v1/pos/carts').set(auth()).send({});
    expect(res.status).toBe(201);
    return res.body.data as { id: number };
  }

  async function addItem(cartId: number, medicineId: number) {
    const res = await request(app)
      .post(`/api/v1/pos/carts/${cartId}/items`)
      .set(auth())
      .send({ medicineId });
    return res;
  }

  describe('Cart: add item requires a sellable batch', () => {
    it('rejects with 422 code no_batch when the medicine has no batches at all', async () => {
      const supplier = await createSupplier('NoBatchSupplier');
      const medicine = await createMedicine('NoBatchMed', supplier.id);
      const cart = await createCart();

      const res = await addItem(cart.id, medicine.id);
      expect(res.status).toBe(422);
      expect(res.body.code).toBe('no_batch');
    });

    it('rejects with 422 no_batch when the only batch is expired', async () => {
      const supplier = await createSupplier('ExpiredBatchSupplier');
      const method = await createMethod('ExpiredCash', 1000);
      const medicine = await createMedicine('ExpiredBatchMed', supplier.id);
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      await createBatch({
        supplierId: supplier.id,
        methodId: method.id,
        medicineId: medicine.id,
        quantity: 10,
        buyPrice: 5,
        price: 8,
        expireDate: yesterday.toISOString().slice(0, 10),
      });

      const cart = await createCart();
      const res = await addItem(cart.id, medicine.id);
      expect(res.status).toBe(422);
      expect(res.body.code).toBe('no_batch');
    });
  });

  describe('Cart: qty rule allows selling the exact last unit (fix C14)', () => {
    it('allows setting qty equal to batch.qty (>=, not strict >)', async () => {
      const supplier = await createSupplier('LastUnitSupplier');
      const method = await createMethod('LastUnitCash', 1000);
      const medicine = await createMedicine('LastUnitMed', supplier.id);
      const batch = await createBatch({
        supplierId: supplier.id,
        methodId: method.id,
        medicineId: medicine.id,
        quantity: 1,
        buyPrice: 5,
        price: 12,
      });
      expect(batch.qty).toBe(1);

      const cart = await createCart();
      const addRes = await addItem(cart.id, medicine.id);
      expect(addRes.status).toBe(200);
      const item = addRes.body.data.items[0];
      expect(item.qty).toBe(1);
      expect(item.batchId).toBe(batch.id);

      const patchRes = await request(app)
        .patch(`/api/v1/pos/carts/${cart.id}/items/${item.id}`)
        .set(auth())
        .send({ qty: 1 });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.items[0].qty).toBe(1);

      const overRes = await request(app)
        .patch(`/api/v1/pos/carts/${cart.id}/items/${item.id}`)
        .set(auth())
        .send({ qty: 2 });
      expect(overRes.status).toBe(422);
      expect(overRes.body.code).toBe('INSUFFICIENT_STOCK');
    });
  });

  describe('Checkout happy path', () => {
    it('creates the invoice, decrements the batch, credits the method, raises customer due, and posts a ledger entry', async () => {
      const supplier = await createSupplier('HappyPosSupplier');
      const method = await createMethod('HappyPosCash', 1000);
      const customer = await createCustomer('HappyPosCust');
      const medicine = await createMedicine('HappyPosMed', supplier.id);
      const batch = await createBatch({
        supplierId: supplier.id,
        methodId: method.id,
        medicineId: medicine.id,
        quantity: 50,
        buyPrice: 10,
        price: 20,
      });

      const cart = await createCart();
      const addRes = await addItem(cart.id, medicine.id);
      const item = addRes.body.data.items[0];

      await request(app)
        .patch(`/api/v1/pos/carts/${cart.id}/items/${item.id}`)
        .set(auth())
        .send({ qty: 5 });

      const metaRes = await request(app)
        .patch(`/api/v1/pos/carts/${cart.id}`)
        .set(auth())
        .send({ customerId: customer.id, paymentMethodId: method.id, paidAmount: 50 });
      expect(metaRes.status).toBe(200);
      expect(metaRes.body.data.subtotal).toBe('100.00');
      expect(metaRes.body.data.grandTotal).toBe('100.00');
      expect(metaRes.body.data.due).toBe('50.00');

      const checkoutRes = await request(app)
        .post('/api/v1/pos/checkout')
        .set(auth())
        .send({ cartId: cart.id });
      expect(checkoutRes.status).toBe(201);
      const invoice = checkoutRes.body.data;
      expect(Number(invoice.totalPrice)).toBeCloseTo(100, 2);
      expect(Number(invoice.paidAmount)).toBeCloseTo(50, 2);
      expect(Number(invoice.duePrice)).toBeCloseTo(50, 2);
      expect(invoice.qty).toBe(5);
      expect(invoice.medicines).toHaveLength(1);
      expect(invoice.medicines[0].batchId).toBe(batch.id);
      expect(invoice.medicines[0].remainingQty).toBe(5);

      const batchAfter = await prisma.batch.findUnique({ where: { id: batch.id } });
      expect(batchAfter!.qty).toBe(45);

      const methodAfter = await request(app)
        .get(`/api/v1/payment-methods/${method.id}`)
        .set(auth());
      expect(Number(methodAfter.body.data.balance)).toBeCloseTo(1050, 2);

      const customerAfter = await request(app)
        .get(`/api/v1/customers/${customer.id}`)
        .set(auth());
      expect(Number(customerAfter.body.data.due)).toBeCloseTo(50, 2);

      const ledgerEntry = await prisma.ledgerTransaction.findFirst({
        where: { invoiceId: invoice.invId, invoiceType: 'sale' },
      });
      expect(ledgerEntry).not.toBeNull();
      expect(Number(ledgerEntry!.amount)).toBeCloseTo(100, 2);
      expect(ledgerEntry!.debitAccountId).toBe(4);
      expect(ledgerEntry!.creditAccountId).toBe(2);

      const cartAfter = await request(app).get(`/api/v1/pos/carts/${cart.id}`).set(auth());
      expect(cartAfter.status).toBe(404);
    });

    it('rejects checkout with due > 0 and no customer', async () => {
      const supplier = await createSupplier('NoCustSupplier');
      const method = await createMethod('NoCustCash', 1000);
      const medicine = await createMedicine('NoCustMed', supplier.id);
      await createBatch({
        supplierId: supplier.id,
        methodId: method.id,
        medicineId: medicine.id,
        quantity: 10,
        buyPrice: 5,
        price: 10,
      });

      const cart = await createCart();
      await addItem(cart.id, medicine.id);
      await request(app)
        .patch(`/api/v1/pos/carts/${cart.id}`)
        .set(auth())
        .send({ paymentMethodId: method.id, paidAmount: 0 });

      const res = await request(app)
        .post('/api/v1/pos/checkout')
        .set(auth())
        .send({ cartId: cart.id });
      expect(res.status).toBe(422);
      expect(res.body.code).toBe('CUSTOMER_REQUIRED');
    });

    it('rejects checkout with an empty cart', async () => {
      const cart = await createCart();
      const res = await request(app)
        .post('/api/v1/pos/checkout')
        .set(auth())
        .send({ cartId: cart.id });
      expect(res.status).toBe(422);
      expect(res.body.code).toBe('EMPTY_CART');
    });
  });

  describe('Checkout concurrency: no oversell (fix C15)', () => {
    it('allows exactly one of two simultaneous checkouts on the last unit; the other fails with 409', async () => {
      const supplier = await createSupplier('RaceSupplier');
      const method = await createMethod('RaceCash', 1000);
      const medicine = await createMedicine('RaceMed', supplier.id);
      const batch = await createBatch({
        supplierId: supplier.id,
        methodId: method.id,
        medicineId: medicine.id,
        quantity: 1,
        buyPrice: 5,
        price: 15,
      });

      const cartA = await createCart();
      const cartB = await createCart();
      await addItem(cartA.id, medicine.id);
      await addItem(cartB.id, medicine.id);

      await request(app)
        .patch(`/api/v1/pos/carts/${cartA.id}`)
        .set(auth())
        .send({ paymentMethodId: method.id, paidAmount: 15 });
      await request(app)
        .patch(`/api/v1/pos/carts/${cartB.id}`)
        .set(auth())
        .send({ paymentMethodId: method.id, paidAmount: 15 });

      const [resA, resB] = await Promise.all([
        request(app).post('/api/v1/pos/checkout').set(auth()).send({ cartId: cartA.id }),
        request(app).post('/api/v1/pos/checkout').set(auth()).send({ cartId: cartB.id }),
      ]);

      const statuses = [resA.status, resB.status].sort();
      expect(statuses).toEqual([201, 409]);
      const failed = resA.status === 409 ? resA : resB;
      expect(failed.body.code).toBe('INSUFFICIENT_STOCK');

      const batchAfter = await prisma.batch.findUnique({ where: { id: batch.id } });
      expect(batchAfter!.qty).toBe(0);
    });
  });

  describe('Sale returns', () => {
    async function checkoutInvoice(params: {
      supplierId: number;
      methodId: number;
      customerId: number;
      medicineId: number;
      qty: number;
      unitPrice: number;
      paid: number;
    }) {
      const cart = await createCart();
      const addRes = await addItem(cart.id, params.medicineId);
      const item = addRes.body.data.items[0];
      await request(app)
        .patch(`/api/v1/pos/carts/${cart.id}/items/${item.id}`)
        .set(auth())
        .send({ qty: params.qty });
      await request(app)
        .patch(`/api/v1/pos/carts/${cart.id}`)
        .set(auth())
        .send({
          customerId: params.customerId,
          paymentMethodId: params.methodId,
          paidAmount: params.paid,
        });
      const res = await request(app)
        .post('/api/v1/pos/checkout')
        .set(auth())
        .send({ cartId: cart.id });
      expect(res.status).toBe(201);
      return res.body.data;
    }

    it('partial return reduces customer.due by return_amount (not full line total) and restores batch qty', async () => {
      const supplier = await createSupplier('ReturnSupplier');
      const method = await createMethod('ReturnCash', 1000);
      const customer = await createCustomer('ReturnCust');
      const medicine = await createMedicine('ReturnMed', supplier.id);
      const batch = await createBatch({
        supplierId: supplier.id,
        methodId: method.id,
        medicineId: medicine.id,
        quantity: 20,
        buyPrice: 5,
        price: 10,
      });

      const invoice = await checkoutInvoice({
        supplierId: supplier.id,
        methodId: method.id,
        customerId: customer.id,
        medicineId: medicine.id,
        qty: 4,
        unitPrice: 10,
        paid: 10,
      });
      // subtotal/total = 40, paid = 10, due = 30
      expect(Number(invoice.duePrice)).toBeCloseTo(30, 2);

      const methodBefore = await request(app)
        .get(`/api/v1/payment-methods/${method.id}`)
        .set(auth());

      const returnRes = await request(app)
        .post(`/api/v1/invoices/${invoice.id}/returns`)
        .set(auth())
        .send({ batchId: batch.id, quantity: 1 });
      expect(returnRes.status).toBe(201);
      expect(Number(returnRes.body.data.amount)).toBeCloseTo(10, 2); // unit_price = 40/4 = 10
      expect(returnRes.body.data.dueReduced).toBe(true);

      const invoiceAfter = await request(app).get(`/api/v1/invoices/${invoice.id}`).set(auth());
      expect(Number(invoiceAfter.body.data.duePrice)).toBeCloseTo(20, 2); // 30 - 10
      expect(Number(invoiceAfter.body.data.paidAmount)).toBeCloseTo(0, 2); // 10 - 10
      expect(Number(invoiceAfter.body.data.totalPrice)).toBeCloseTo(30, 2); // 40 - 10
      expect(Number(invoiceAfter.body.data.subtotal)).toBeCloseTo(30, 2);

      const customerAfter = await request(app)
        .get(`/api/v1/customers/${customer.id}`)
        .set(auth());
      expect(Number(customerAfter.body.data.due)).toBeCloseTo(20, 2); // 30 - 10 (return_amount, not full line 40)

      const batchAfter = await prisma.batch.findUnique({ where: { id: batch.id } });
      expect(batchAfter!.qty).toBe(20 - 4 + 1); // 20 - checked out 4 + returned 1

      const methodAfter = await request(app)
        .get(`/api/v1/payment-methods/${method.id}`)
        .set(auth());
      expect(Number(methodAfter.body.data.balance)).toBeCloseTo(
        Number(methodBefore.body.data.balance) - 10,
        2,
      );

      const reverseLedger = await prisma.ledgerTransaction.findFirst({
        where: { invoiceId: invoice.invId, invoiceType: 'sale_return' },
      });
      expect(reverseLedger).not.toBeNull();
      expect(Number(reverseLedger!.amount)).toBeCloseTo(10, 2);
      expect(reverseLedger!.debitAccountId).toBe(2);
      expect(reverseLedger!.creditAccountId).toBe(4);
    });

    it('leaves due_price unchanged when due_price < return_amount, but still reduces customer.due by return_amount', async () => {
      const supplier = await createSupplier('LowDueReturnSupplier');
      const method = await createMethod('LowDueReturnCash', 1000);
      const customer = await createCustomer('LowDueReturnCust');
      const medicine = await createMedicine('LowDueReturnMed', supplier.id);
      const batch = await createBatch({
        supplierId: supplier.id,
        methodId: method.id,
        medicineId: medicine.id,
        quantity: 20,
        buyPrice: 5,
        price: 10,
      });

      // subtotal/total = 40, paid = 35, due = 5 (< return_amount of 10)
      const invoice = await checkoutInvoice({
        supplierId: supplier.id,
        methodId: method.id,
        customerId: customer.id,
        medicineId: medicine.id,
        qty: 4,
        unitPrice: 10,
        paid: 35,
      });
      expect(Number(invoice.duePrice)).toBeCloseTo(5, 2);

      const returnRes = await request(app)
        .post(`/api/v1/invoices/${invoice.id}/returns`)
        .set(auth())
        .send({ batchId: batch.id, quantity: 1 });
      expect(returnRes.status).toBe(201);
      expect(returnRes.body.data.dueReduced).toBe(false);

      const invoiceAfter = await request(app).get(`/api/v1/invoices/${invoice.id}`).set(auth());
      expect(Number(invoiceAfter.body.data.duePrice)).toBeCloseTo(5, 2); // unchanged

      const customerAfter = await request(app)
        .get(`/api/v1/customers/${customer.id}`)
        .set(auth());
      expect(Number(customerAfter.body.data.due)).toBeCloseTo(-5, 2); // 5 - 10 (unconditional, per C4 fix)

      const batchAfter = await prisma.batch.findUnique({ where: { id: batch.id } });
      expect(batchAfter!.qty).toBe(20 - 4 + 1);
    });

    it('rejects a return quantity exceeding the remaining line quantity with 422', async () => {
      const supplier = await createSupplier('OverReturnSupplier');
      const method = await createMethod('OverReturnCash', 1000);
      const customer = await createCustomer('OverReturnCust');
      const medicine = await createMedicine('OverReturnMed', supplier.id);
      const batch = await createBatch({
        supplierId: supplier.id,
        methodId: method.id,
        medicineId: medicine.id,
        quantity: 10,
        buyPrice: 5,
        price: 10,
      });

      const invoice = await checkoutInvoice({
        supplierId: supplier.id,
        methodId: method.id,
        customerId: customer.id,
        medicineId: medicine.id,
        qty: 2,
        unitPrice: 10,
        paid: 20,
      });

      const res = await request(app)
        .post(`/api/v1/invoices/${invoice.id}/returns`)
        .set(auth())
        .send({ batchId: batch.id, quantity: 5 });
      expect(res.status).toBe(422);
      expect(res.body.code).toBe('RETURN_QTY_EXCEEDS_LINE');
    });

    it('lists sale returns for an invoice', async () => {
      const supplier = await createSupplier('ListReturnSupplier');
      const method = await createMethod('ListReturnCash', 1000);
      const customer = await createCustomer('ListReturnCust');
      const medicine = await createMedicine('ListReturnMed', supplier.id);
      const batch = await createBatch({
        supplierId: supplier.id,
        methodId: method.id,
        medicineId: medicine.id,
        quantity: 10,
        buyPrice: 5,
        price: 10,
      });
      const invoice = await checkoutInvoice({
        supplierId: supplier.id,
        methodId: method.id,
        customerId: customer.id,
        medicineId: medicine.id,
        qty: 3,
        unitPrice: 10,
        paid: 30,
      });
      await request(app)
        .post(`/api/v1/invoices/${invoice.id}/returns`)
        .set(auth())
        .send({ batchId: batch.id, quantity: 1 });

      const res = await request(app).get(`/api/v1/invoices/${invoice.id}/returns`).set(auth());
      expect(res.status).toBe(200);
      expect(res.body.data.meta.total).toBe(1);
      expect(res.body.data.items[0].quantity).toBe(1);
    });
  });

  describe('DELETE invoice fully reverses side effects', () => {
    it('restores batch qty, reverses customer due & method balance, and reverses the ledger', async () => {
      const supplier = await createSupplier('DeleteSupplier');
      const method = await createMethod('DeleteCash', 1000);
      const customer = await createCustomer('DeleteCust');
      const medicine = await createMedicine('DeleteMed', supplier.id);
      const batch = await createBatch({
        supplierId: supplier.id,
        methodId: method.id,
        medicineId: medicine.id,
        quantity: 30,
        buyPrice: 5,
        price: 10,
      });

      const cart = await createCart();
      const addRes = await addItem(cart.id, medicine.id);
      const item = addRes.body.data.items[0];
      await request(app)
        .patch(`/api/v1/pos/carts/${cart.id}/items/${item.id}`)
        .set(auth())
        .send({ qty: 6 });
      await request(app)
        .patch(`/api/v1/pos/carts/${cart.id}`)
        .set(auth())
        .send({ customerId: customer.id, paymentMethodId: method.id, paidAmount: 20 });
      const checkoutRes = await request(app)
        .post('/api/v1/pos/checkout')
        .set(auth())
        .send({ cartId: cart.id });
      expect(checkoutRes.status).toBe(201);
      const invoice = checkoutRes.body.data;
      // subtotal/total = 60, paid = 20, due = 40

      const methodBefore = await request(app)
        .get(`/api/v1/payment-methods/${method.id}`)
        .set(auth());
      const customerBefore = await request(app)
        .get(`/api/v1/customers/${customer.id}`)
        .set(auth());
      const batchBefore = await prisma.batch.findUnique({ where: { id: batch.id } });
      expect(batchBefore!.qty).toBe(24); // 30 - 6

      const delRes = await request(app).delete(`/api/v1/invoices/${invoice.id}`).set(auth());
      expect(delRes.status).toBe(200);

      const batchAfter = await prisma.batch.findUnique({ where: { id: batch.id } });
      expect(batchAfter!.qty).toBe(30); // fully restored

      const methodAfter = await request(app)
        .get(`/api/v1/payment-methods/${method.id}`)
        .set(auth());
      expect(Number(methodAfter.body.data.balance)).toBeCloseTo(
        Number(methodBefore.body.data.balance) - 20,
        2,
      );

      const customerAfter = await request(app)
        .get(`/api/v1/customers/${customer.id}`)
        .set(auth());
      expect(Number(customerAfter.body.data.due)).toBeCloseTo(
        Number(customerBefore.body.data.due) - 40,
        2,
      );

      const getAfter = await request(app).get(`/api/v1/invoices/${invoice.id}`).set(auth());
      expect(getAfter.status).toBe(404);

      const reverseLedger = await prisma.ledgerTransaction.findFirst({
        where: { invoiceId: invoice.invId, invoiceType: 'sale_return' },
      });
      expect(reverseLedger).not.toBeNull();
      expect(Number(reverseLedger!.amount)).toBeCloseTo(60, 2);

      const pays = await prisma.invoicePay.findMany({ where: { invoiceId: invoice.id } });
      expect(pays).toHaveLength(0);
    });
  });

  describe('Pay due', () => {
    it('credits the payment method balance and reduces customer + invoice due', async () => {
      const supplier = await createSupplier('PayDueSupplier');
      const method = await createMethod('PayDueCash', 1000);
      const customer = await createCustomer('PayDueCust');
      const medicine = await createMedicine('PayDueMed', supplier.id);
      await createBatch({
        supplierId: supplier.id,
        methodId: method.id,
        medicineId: medicine.id,
        quantity: 10,
        buyPrice: 5,
        price: 10,
      });

      const cart = await createCart();
      const addRes = await addItem(cart.id, medicine.id);
      const item = addRes.body.data.items[0];
      await request(app)
        .patch(`/api/v1/pos/carts/${cart.id}/items/${item.id}`)
        .set(auth())
        .send({ qty: 5 });
      await request(app)
        .patch(`/api/v1/pos/carts/${cart.id}`)
        .set(auth())
        .send({ customerId: customer.id, paymentMethodId: method.id, paidAmount: 10 });
      const checkoutRes = await request(app)
        .post('/api/v1/pos/checkout')
        .set(auth())
        .send({ cartId: cart.id });
      const invoice = checkoutRes.body.data;
      // total = 50, paid = 10, due = 40

      const methodBefore = await request(app)
        .get(`/api/v1/payment-methods/${method.id}`)
        .set(auth());

      const payRes = await request(app)
        .post(`/api/v1/invoices/${invoice.id}/payments`)
        .set(auth())
        .send({ amount: 15, paymentMethodId: method.id });
      expect(payRes.status).toBe(201);

      const invoiceAfter = await request(app).get(`/api/v1/invoices/${invoice.id}`).set(auth());
      expect(Number(invoiceAfter.body.data.duePrice)).toBeCloseTo(25, 2);
      expect(Number(invoiceAfter.body.data.paidAmount)).toBeCloseTo(25, 2);

      const methodAfter = await request(app)
        .get(`/api/v1/payment-methods/${method.id}`)
        .set(auth());
      expect(Number(methodAfter.body.data.balance)).toBeCloseTo(
        Number(methodBefore.body.data.balance) + 15,
        2,
      );

      const customerAfter = await request(app)
        .get(`/api/v1/customers/${customer.id}`)
        .set(auth());
      expect(Number(customerAfter.body.data.due)).toBeCloseTo(25, 2); // 40 - 15

      const overpayRes = await request(app)
        .post(`/api/v1/invoices/${invoice.id}/payments`)
        .set(auth())
        .send({ amount: 999, paymentMethodId: method.id });
      expect(overpayRes.status).toBe(422);
      expect(overpayRes.body.code).toBe('AMOUNT_EXCEEDS_DUE');
    });
  });

  describe('Approve invoice (write-off)', () => {
    it('sets due_price = 0 without an InvoicePay, customer.due change, or method credit', async () => {
      const supplier = await createSupplier('ApproveSupplier');
      const method = await createMethod('ApproveCash', 1000);
      const customer = await createCustomer('ApproveCust');
      const medicine = await createMedicine('ApproveMed', supplier.id);
      await createBatch({
        supplierId: supplier.id,
        methodId: method.id,
        medicineId: medicine.id,
        quantity: 10,
        buyPrice: 5,
        price: 10,
      });

      const cart = await createCart();
      const addRes = await addItem(cart.id, medicine.id);
      const item = addRes.body.data.items[0];
      await request(app)
        .patch(`/api/v1/pos/carts/${cart.id}/items/${item.id}`)
        .set(auth())
        .send({ qty: 3 });
      await request(app)
        .patch(`/api/v1/pos/carts/${cart.id}`)
        .set(auth())
        .send({ customerId: customer.id, paymentMethodId: method.id, paidAmount: 0 });
      const checkoutRes = await request(app)
        .post('/api/v1/pos/checkout')
        .set(auth())
        .send({ cartId: cart.id });
      const invoice = checkoutRes.body.data;

      const methodBefore = await request(app)
        .get(`/api/v1/payment-methods/${method.id}`)
        .set(auth());
      const customerBefore = await request(app)
        .get(`/api/v1/customers/${customer.id}`)
        .set(auth());
      const paysBefore = await prisma.invoicePay.count({ where: { invoiceId: invoice.id } });

      const approveRes = await request(app)
        .post(`/api/v1/invoices/${invoice.id}/approve`)
        .set(auth());
      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.message).toMatch(/write.?off|written off/i);
      expect(Number(approveRes.body.data.invoice.duePrice)).toBe(0);

      const methodAfter = await request(app)
        .get(`/api/v1/payment-methods/${method.id}`)
        .set(auth());
      expect(Number(methodAfter.body.data.balance)).toBeCloseTo(
        Number(methodBefore.body.data.balance),
        2,
      );

      const customerAfter = await request(app)
        .get(`/api/v1/customers/${customer.id}`)
        .set(auth());
      expect(Number(customerAfter.body.data.due)).toBeCloseTo(Number(customerBefore.body.data.due), 2);

      const paysAfter = await prisma.invoicePay.count({ where: { invoiceId: invoice.id } });
      expect(paysAfter).toBe(paysBefore);
    });
  });

  describe('Invoice PDF and email', () => {
    let invoice: { id: number; invId: string };
    let customer: { id: number; email: string };

    beforeAll(async () => {
      const supplier = await createSupplier('PdfSupplier');
      const method = await createMethod('PdfCash', 1000);
      customer = await createCustomer('PdfCust');
      const medicine = await createMedicine('PdfMed', supplier.id);
      await createBatch({
        supplierId: supplier.id,
        methodId: method.id,
        medicineId: medicine.id,
        quantity: 10,
        buyPrice: 5,
        price: 10,
      });

      const cart = await createCart();
      const addRes = await addItem(cart.id, medicine.id);
      const item = addRes.body.data.items[0];
      await request(app)
        .patch(`/api/v1/pos/carts/${cart.id}/items/${item.id}`)
        .set(auth())
        .send({ qty: 2 });
      await request(app)
        .patch(`/api/v1/pos/carts/${cart.id}`)
        .set(auth())
        .send({ customerId: customer.id, paymentMethodId: method.id, paidAmount: 20 });
      const checkoutRes = await request(app)
        .post('/api/v1/pos/checkout')
        .set(auth())
        .send({ cartId: cart.id });
      invoice = checkoutRes.body.data;
    });

    it('returns a non-empty application/pdf buffer', async () => {
      const res = await request(app)
        .get(`/api/v1/invoices/${invoice.id}/pdf`)
        .set(auth())
        .buffer(true)
        .parse(binaryParser as never);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect((res.body as Buffer).length).toBeGreaterThan(0);
      // %PDF header magic bytes
      expect((res.body as Buffer).slice(0, 4).toString('ascii')).toBe('%PDF');
    });

    it('emails the invoice PDF using a mocked transporter', async () => {
      let captured: SendMailOptions | null = null;
      setMailTransport({
        sendMail: async (opts: SendMailOptions) => {
          captured = opts;
          return { messageId: 'mock-id' };
        },
      } as unknown as Parameters<typeof setMailTransport>[0]);

      const res = await request(app)
        .post(`/api/v1/invoices/${invoice.id}/email`)
        .set(auth())
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.data.to).toBe(customer.email);
      expect(captured).not.toBeNull();
      expect(captured!.to).toBe(customer.email);
      expect(captured!.attachments).toHaveLength(1);

      setMailTransport(null);
    });
  });
});
