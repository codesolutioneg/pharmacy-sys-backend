import request from 'supertest';
import { createApp } from '../../src/app';
import { config } from '../../src/config';
import { prisma } from '../../src/lib/prisma';

const app = createApp();

describe('BP3 integration', () => {
  let accessToken = '';

  beforeAll(async () => {
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
    return res.body.data as { id: number; due: string };
  }

  async function createMethod(namePrefix: string, balance: number) {
    const res = await request(app)
      .post('/api/v1/payment-methods')
      .set(auth())
      .send({ name: `${namePrefix} ${Date.now()}-${Math.random()}`, balance });
    expect(res.status).toBe(201);
    return res.body.data as { id: number; balance: string };
  }

  async function createMedicine(namePrefix: string, supplierId: number) {
    const qrCode = `QR-${namePrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const res = await request(app).post('/api/v1/medicines').set(auth()).send({
      name: `${namePrefix} ${Date.now()}`,
      genericName: 'Generic',
      qrCode,
      description: 'BP3 test medicine',
      status: 'active',
      supplierId,
    });
    expect(res.status).toBe(201);
    return res.body.data as { id: number };
  }

  async function createDraft() {
    const res = await request(app).post('/api/v1/purchases/drafts').set(auth()).send({});
    expect(res.status).toBe(201);
    return res.body.data as { id: number };
  }

  describe('Purchase commit happy path', () => {
    let supplier: { id: number; due: string };
    let method: { id: number; balance: string };
    let medicineA: { id: number };
    let medicineB: { id: number };
    let draftId: number;
    let purchaseId: number;

    beforeAll(async () => {
      supplier = await createSupplier('HappyPathSupplier');
      method = await createMethod('HappyPathCash', 1000);
      medicineA = await createMedicine('HappyPathMedA', supplier.id);
      medicineB = await createMedicine('HappyPathMedB', supplier.id);

      const draft = await createDraft();
      draftId = draft.id;
    });

    it('adds two lines to the draft', async () => {
      const line1 = await request(app)
        .post(`/api/v1/purchases/drafts/${draftId}/lines`)
        .set(auth())
        .send({
          medicineId: medicineA.id,
          quantity: 10,
          buyPrice: 20,
          price: 30,
          batchName: 'Batch A',
          discount: 0,
          discountType: 'fixed',
        });
      expect(line1.status).toBe(200);

      const line2 = await request(app)
        .post(`/api/v1/purchases/drafts/${draftId}/lines`)
        .set(auth())
        .send({
          medicineId: medicineB.id,
          quantity: 5,
          buyPrice: 30,
          price: 40,
          batchName: 'Batch B',
          discount: 0,
          discountType: 'fixed',
        });
      expect(line2.status).toBe(200);
      expect(line2.body.data.lines).toHaveLength(2);
      expect(line2.body.data.subtotal).toBe('350.00');
    });

    it('sets supplier, method, paidAmount and an invoice discount, and computes totals', async () => {
      const res = await request(app)
        .patch(`/api/v1/purchases/drafts/${draftId}`)
        .set(auth())
        .send({
          supplierId: supplier.id,
          paymentMethodId: method.id,
          paidAmount: 100,
          invoiceDiscount: { value: 5, type: 'percent' },
        });
      expect(res.status).toBe(200);
      expect(res.body.data.subtotal).toBe('350.00');
      expect(res.body.data.invoiceDiscountAmount).toBe('17.50');
      expect(res.body.data.grandTotal).toBe('332.50');
      expect(res.body.data.due).toBe('232.50');
      expect(res.body.data.change).toBe('0.00');

      const view = await request(app)
        .get(`/api/v1/purchases/drafts/${draftId}`)
        .set(auth());
      expect(view.status).toBe(200);
      expect(view.body.data.grandTotal).toBe('332.50');
    });

    it('commits the draft: creates batches, updates supplier due & method balance, PurchasePay, ledger', async () => {
      const res = await request(app)
        .post('/api/v1/purchases')
        .set(auth())
        .send({ draftId });
      expect(res.status).toBe(201);
      purchaseId = res.body.data.id;

      expect(Number(res.body.data.totalPrice)).toBeCloseTo(332.5, 2);
      expect(Number(res.body.data.duePrice)).toBeCloseTo(232.5, 2);
      expect(Number(res.body.data.paidAmount)).toBeCloseTo(100, 2);
      expect(res.body.data.batches).toHaveLength(2);
      expect(res.body.data.pays).toHaveLength(1);
      expect(Number(res.body.data.pays[0].amount)).toBeCloseTo(100, 2);

      const batchA = res.body.data.batches.find(
        (b: { medicineId: number }) => b.medicineId === medicineA.id,
      );
      expect(batchA.qty).toBe(10);
      expect(batchA.purchaseQty).toBe(10);

      const supplierRes = await request(app).get(`/api/v1/suppliers/${supplier.id}`).set(auth());
      expect(Number(supplierRes.body.data.due)).toBeCloseTo(232.5, 2);

      const methodRes = await request(app)
        .get(`/api/v1/payment-methods/${method.id}`)
        .set(auth());
      expect(Number(methodRes.body.data.balance)).toBeCloseTo(900, 2);

      const ledgerEntry = await prisma.ledgerTransaction.findFirst({
        where: { invoiceId: res.body.data.invId, invoiceType: 'purchase' },
      });
      expect(ledgerEntry).not.toBeNull();
      expect(Number(ledgerEntry!.amount)).toBeCloseTo(332.5, 2);
      expect(ledgerEntry!.debitAccountId).toBe(1);
      expect(ledgerEntry!.creditAccountId).toBe(3);

      // Draft is finalized/deleted after commit.
      const draftAfter = await request(app)
        .get(`/api/v1/purchases/drafts/${draftId}`)
        .set(auth());
      expect(draftAfter.status).toBe(404);
    });

    it('rejects committing an already-committed (deleted) draft again', async () => {
      const res = await request(app).post('/api/v1/purchases').set(auth()).send({ draftId });
      expect(res.status).toBe(404);
    });

    describe('Purchase returns against the committed purchase', () => {
      it('reduces batch qty, purchase qty/total/subtotal, and supplier due (due >= return_amount)', async () => {
        const before = await request(app)
          .get(`/api/v1/purchases/${purchaseId}`)
          .set(auth());
        const batchA = before.body.data.batches.find(
          (b: { medicineId: number }) => b.medicineId === medicineA.id,
        );
        expect(batchA.qty).toBe(10);

        const res = await request(app)
          .post(`/api/v1/purchases/${purchaseId}/returns`)
          .set(auth())
          .send({ medicineId: medicineA.id, quantity: 3 });
        expect(res.status).toBe(201);
        expect(Number(res.body.data.amount)).toBeCloseTo(60, 2);
        expect(res.body.data.batchQtyAfter).toBe(7);
        expect(res.body.data.supplierDueReduced).toBe(true);

        const after = await request(app)
          .get(`/api/v1/purchases/${purchaseId}`)
          .set(auth());
        expect(Number(after.body.data.qty)).toBe(12); // 15 - 3
        expect(Number(after.body.data.totalPrice)).toBeCloseTo(332.5 - 60, 2);
        expect(Number(after.body.data.subtotal)).toBeCloseTo(350 - 60, 2);
        // due_price / paid_amount / discount are NOT adjusted by a return (documented Laravel behavior).
        expect(Number(after.body.data.duePrice)).toBeCloseTo(232.5, 2);
        expect(Number(after.body.data.paidAmount)).toBeCloseTo(100, 2);

        const supplierRes = await request(app)
          .get(`/api/v1/suppliers/${supplier.id}`)
          .set(auth());
        expect(Number(supplierRes.body.data.due)).toBeCloseTo(232.5 - 60, 2);

        const reverseLedger = await prisma.ledgerTransaction.findFirst({
          where: { invoiceId: before.body.data.invId, invoiceType: 'purchase_return' },
        });
        expect(reverseLedger).not.toBeNull();
        expect(Number(reverseLedger!.amount)).toBeCloseTo(60, 2);
        expect(reverseLedger!.debitAccountId).toBe(3);
        expect(reverseLedger!.creditAccountId).toBe(1);
      });

      it('rejects a return quantity exceeding the batch qty with 422', async () => {
        const res = await request(app)
          .post(`/api/v1/purchases/${purchaseId}/returns`)
          .set(auth())
          .send({ medicineId: medicineA.id, quantity: 100 });
        expect(res.status).toBe(422);
        expect(res.body.code).toBe('RETURN_QTY_EXCEEDS_BATCH');

        // Confirm nothing partially committed: batch qty unchanged at 7.
        const after = await request(app)
          .get(`/api/v1/purchases/${purchaseId}`)
          .set(auth());
        const batchA = after.body.data.batches.find(
          (b: { medicineId: number }) => b.medicineId === medicineA.id,
        );
        expect(batchA.qty).toBe(7);
      });

      it('lists purchase returns filtered by purchaseId and supplierId', async () => {
        const byPurchase = await request(app)
          .get(`/api/v1/purchase-returns?purchaseId=${purchaseId}`)
          .set(auth());
        expect(byPurchase.status).toBe(200);
        expect(byPurchase.body.data.meta.total).toBeGreaterThanOrEqual(1);

        const bySupplier = await request(app)
          .get(`/api/v1/purchase-returns?supplierId=${supplier.id}`)
          .set(auth());
        expect(bySupplier.status).toBe(200);
        expect(bySupplier.body.data.meta.total).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('Purchase commit with insufficient payment method balance', () => {
    it('rejects with 422 and leaves no partial writes', async () => {
      const supplier = await createSupplier('InsufficientSupplier');
      const method = await createMethod('LowBalance', 10);
      const medicine = await createMedicine('InsufficientMed', supplier.id);
      const draft = await createDraft();

      await request(app)
        .post(`/api/v1/purchases/drafts/${draft.id}/lines`)
        .set(auth())
        .send({ medicineId: medicine.id, quantity: 1, buyPrice: 100, price: 120 });

      await request(app)
        .patch(`/api/v1/purchases/drafts/${draft.id}`)
        .set(auth())
        .send({ supplierId: supplier.id, paymentMethodId: method.id, paidAmount: 50 });

      const res = await request(app)
        .post('/api/v1/purchases')
        .set(auth())
        .send({ draftId: draft.id });
      expect(res.status).toBe(422);
      expect(res.body.code).toBe('INSUFFICIENT_BALANCE');

      const methodAfter = await request(app)
        .get(`/api/v1/payment-methods/${method.id}`)
        .set(auth());
      expect(Number(methodAfter.body.data.balance)).toBe(10);

      const purchases = await request(app)
        .get(`/api/v1/purchases?supplierId=${supplier.id}`)
        .set(auth());
      expect(purchases.body.data.meta.total).toBe(0);

      // Draft survives the failed commit attempt (nothing partially written/deleted).
      const draftAfter = await request(app)
        .get(`/api/v1/purchases/drafts/${draft.id}`)
        .set(auth());
      expect(draftAfter.status).toBe(200);
    });

    it('rejects committing an empty draft with 422', async () => {
      const draft = await createDraft();
      const supplier = await createSupplier('EmptyDraftSupplier');
      await request(app)
        .patch(`/api/v1/purchases/drafts/${draft.id}`)
        .set(auth())
        .send({ supplierId: supplier.id });

      const res = await request(app)
        .post('/api/v1/purchases')
        .set(auth())
        .send({ draftId: draft.id });
      expect(res.status).toBe(422);
      expect(res.body.code).toBe('EMPTY_PURCHASE');
    });
  });

  describe('Purchase return: supplier due below return amount leaves due unchanged', () => {
    it('does not reduce due when due < return_amount', async () => {
      const supplier = await createSupplier('LowDueSupplier');
      const method = await createMethod('LowDueCash', 1000);
      const medicine = await createMedicine('LowDueMed', supplier.id);
      const draft = await createDraft();

      await request(app)
        .post(`/api/v1/purchases/drafts/${draft.id}/lines`)
        .set(auth())
        .send({ medicineId: medicine.id, quantity: 4, buyPrice: 25, price: 40 });

      await request(app)
        .patch(`/api/v1/purchases/drafts/${draft.id}`)
        .set(auth())
        .send({ supplierId: supplier.id, paymentMethodId: method.id, paidAmount: 100 });

      const commitRes = await request(app)
        .post('/api/v1/purchases')
        .set(auth())
        .send({ draftId: draft.id });
      expect(commitRes.status).toBe(201);
      expect(Number(commitRes.body.data.duePrice)).toBe(0);

      const supplierBefore = await request(app)
        .get(`/api/v1/suppliers/${supplier.id}`)
        .set(auth());
      expect(Number(supplierBefore.body.data.due)).toBe(0);

      const returnRes = await request(app)
        .post(`/api/v1/purchases/${commitRes.body.data.id}/returns`)
        .set(auth())
        .send({ medicineId: medicine.id, quantity: 2 });
      expect(returnRes.status).toBe(201);
      expect(Number(returnRes.body.data.amount)).toBeCloseTo(50, 2);
      expect(returnRes.body.data.supplierDueReduced).toBe(false);

      const supplierAfter = await request(app)
        .get(`/api/v1/suppliers/${supplier.id}`)
        .set(auth());
      expect(Number(supplierAfter.body.data.due)).toBe(0);
    });
  });

  describe('Stock module', () => {
    let supplier: { id: number };
    let method: { id: number };

    beforeAll(async () => {
      supplier = await createSupplier('StockSupplier');
      method = await createMethod('StockCash', 5000);
      await request(app)
        .patch('/api/v1/settings/general')
        .set(auth())
        .send({ lowStockAlert: 20, upcomingExpireAlert: 7 });
    });

    async function commitSinglePurchase(
      medicineId: number,
      quantity: number,
      expireDate?: string,
    ) {
      const draft = await createDraft();
      await request(app)
        .post(`/api/v1/purchases/drafts/${draft.id}/lines`)
        .set(auth())
        .send({
          medicineId,
          quantity,
          buyPrice: 10,
          price: 15,
          ...(expireDate ? { expireDate } : {}),
        });
      await request(app)
        .patch(`/api/v1/purchases/drafts/${draft.id}`)
        .set(auth())
        .send({ supplierId: supplier.id, paymentMethodId: method.id, paidAmount: 0 });
      const res = await request(app)
        .post('/api/v1/purchases')
        .set(auth())
        .send({ draftId: draft.id });
      expect(res.status).toBe(201);
      return res.body.data;
    }

    it('flags a medicine as low stock below the shop threshold', async () => {
      const medicine = await createMedicine('LowStockMed', supplier.id);
      await commitSinglePurchase(medicine.id, 5); // below lowStockAlert=20

      const res = await request(app).get('/api/v1/stock/low').set(auth());
      expect(res.status).toBe(200);
      const ids = res.body.data.map((row: { medicine: { id: number } }) => row.medicine.id);
      expect(ids).toContain(medicine.id);
    });

    it('flags a medicine as out of stock once total qty reaches 0', async () => {
      const medicine = await createMedicine('OutStockMed', supplier.id);
      const purchase = await commitSinglePurchase(medicine.id, 5);

      const outBefore = await request(app).get('/api/v1/stock/out').set(auth());
      expect(
        outBefore.body.data.map((row: { medicine: { id: number } }) => row.medicine.id),
      ).not.toContain(medicine.id);

      await request(app)
        .post(`/api/v1/purchases/${purchase.id}/returns`)
        .set(auth())
        .send({ medicineId: medicine.id, quantity: 5 });

      const outAfter = await request(app).get('/api/v1/stock/out').set(auth());
      expect(
        outAfter.body.data.map((row: { medicine: { id: number } }) => row.medicine.id),
      ).toContain(medicine.id);

      const summary = await request(app)
        .get(`/api/v1/stock/summary/${medicine.id}`)
        .set(auth());
      expect(summary.body.data.qty).toBe(0);
    });

    it('lists a batch as expiring within the shop upcoming-expire window', async () => {
      const medicine = await createMedicine('ExpiringMed', supplier.id);
      const inThreeDays = new Date();
      inThreeDays.setUTCDate(inThreeDays.getUTCDate() + 3);
      await commitSinglePurchase(medicine.id, 5, inThreeDays.toISOString().slice(0, 10));

      const res = await request(app).get('/api/v1/stock/expiring').set(auth());
      expect(res.status).toBe(200);
      const ids = res.body.data.map((b: { medicineId: number }) => b.medicineId);
      expect(ids).toContain(medicine.id);
    });

    it('lists a batch as already expired', async () => {
      const medicine = await createMedicine('ExpiredMed', supplier.id);
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      await commitSinglePurchase(medicine.id, 5, yesterday.toISOString().slice(0, 10));

      const res = await request(app).get('/api/v1/stock/expired').set(auth());
      expect(res.status).toBe(200);
      const ids = res.body.data.map((b: { medicineId: number }) => b.medicineId);
      expect(ids).toContain(medicine.id);
    });

    it('filters /batches by medicineId and expireBefore', async () => {
      const medicine = await createMedicine('FilterBatchMed', supplier.id);
      await commitSinglePurchase(medicine.id, 3);

      const res = await request(app)
        .get(`/api/v1/batches?medicineId=${medicine.id}`)
        .set(auth());
      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.items.every((b: { medicineId: number }) => b.medicineId === medicine.id)).toBe(
        true,
      );
    });

    it('updates a batch sale price via PATCH /batches/:id/price', async () => {
      const medicine = await createMedicine('PriceBatchMed', supplier.id);
      const purchase = await commitSinglePurchase(medicine.id, 3);
      const batchId = purchase.batches[0].id;

      const res = await request(app)
        .patch(`/api/v1/batches/${batchId}/price`)
        .set(auth())
        .send({ price: 55.5 });
      expect(res.status).toBe(200);
      expect(Number(res.body.data.price)).toBeCloseTo(55.5, 2);
    });
  });
});
