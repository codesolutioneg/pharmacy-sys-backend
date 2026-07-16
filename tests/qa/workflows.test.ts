import { adminLogin, auth, getApp, loadFixtures, prisma, request } from './helpers';

describe('QA Business workflows', () => {
  let token = '';

  beforeAll(async () => {
    token = (await adminLogin()).accessToken;
  });

  it('Purchase → stock ↑ → supplier due → method ↓ → ledger', async () => {
    const app = getApp();
    const f = await loadFixtures();
    expect(f.medicine && f.supplier && f.method).toBeTruthy();

    const stockBefore = await prisma.batch.aggregate({
      where: { shopId: 1, medicineId: f.medicine!.id },
      _sum: { qty: true },
    });
    const supplierBefore = await prisma.supplier.findUniqueOrThrow({ where: { id: f.supplier!.id } });
    const methodBefore = await prisma.paymentMethod.findUniqueOrThrow({ where: { id: f.method!.id } });

    const draft = await request(app).post('/api/v1/purchases/drafts').set(auth(token)).send({});
    expect(draft.status).toBeLessThan(300);
    const draftId = draft.body.data.id as number;

    const line = await request(app)
      .post(`/api/v1/purchases/drafts/${draftId}/lines`)
      .set(auth(token))
      .send({
        medicineId: f.medicine!.id,
        quantity: 5,
        buyPrice: Number(f.medicine!.buyPrice),
        price: Number(f.medicine!.price),
        batchName: `WF-LOT-${Date.now()}`,
        expireDate: '2027-12-31',
        discount: 0,
        discountType: 'percent',
      });
    expect(line.status).toBeLessThan(300);

    const patch = await request(app)
      .patch(`/api/v1/purchases/drafts/${draftId}`)
      .set(auth(token))
      .send({
        supplierId: f.supplier!.id,
        paymentMethodId: f.method!.id,
        paidAmount: Number(f.medicine!.buyPrice) * 5,
        invoiceDiscount: { value: 0, type: 'percent' },
      });
    expect(patch.status).toBeLessThan(300);

    const commit = await request(app)
      .post('/api/v1/purchases')
      .set(auth(token))
      .send({ draftId });
    expect([200, 201]).toContain(commit.status);

    const stockAfter = await prisma.batch.aggregate({
      where: { shopId: 1, medicineId: f.medicine!.id },
      _sum: { qty: true },
    });
    expect((stockAfter._sum.qty ?? 0) - (stockBefore._sum.qty ?? 0)).toBe(5);

    const methodAfter = await prisma.paymentMethod.findUniqueOrThrow({ where: { id: f.method!.id } });
    expect(Number(methodAfter.balance)).toBeLessThan(Number(methodBefore.balance));

    const invId = commit.body.data.invId as string;
    const ledger = await prisma.ledgerTransaction.findFirst({
      where: { invoiceId: invId, invoiceType: 'purchase' },
    });
    expect(ledger).toBeTruthy();

    // supplier due unchanged when fully paid
    const supplierAfter = await prisma.supplier.findUniqueOrThrow({ where: { id: f.supplier!.id } });
    expect(Number(supplierAfter.due)).toBe(Number(supplierBefore.due));
  });

  it('POS checkout → stock ↓ → method ↑ → ledger sale', async () => {
    const app = getApp();
    const f = await loadFixtures();
    const batch = await prisma.batch.findFirst({
      where: { shopId: 1, qty: { gte: 2 }, expire: { gt: new Date() } },
      orderBy: { id: 'desc' },
    });
    expect(batch).toBeTruthy();

    const cart = await request(app).post('/api/v1/pos/carts').set(auth(token)).send({});
    expect(cart.status).toBeLessThan(300);
    const cartId = cart.body.data.id as number;

    const add = await request(app)
      .post(`/api/v1/pos/carts/${cartId}/items`)
      .set(auth(token))
      .send({ medicineId: batch!.medicineId });
    expect(add.status).toBeLessThan(300);
    const itemId = add.body.data.items?.[0]?.id ?? add.body.data?.items?.[0]?.id;

    const items = (await request(app).get(`/api/v1/pos/carts/${cartId}`).set(auth(token))).body.data
      .items as Array<{ id: string; qty: number }>;
    const firstItem = items[0]!;
    await request(app)
      .patch(`/api/v1/pos/carts/${cartId}/items/${firstItem.id}`)
      .set(auth(token))
      .send({ batchId: batch!.id, qty: 1 });

    await request(app)
      .patch(`/api/v1/pos/carts/${cartId}`)
      .set(auth(token))
      .send({
        customerId: f.customer!.id,
        paymentMethodId: f.method!.id,
        paidAmount: 999999,
      });

    const qtyBefore = (
      await prisma.batch.findUniqueOrThrow({ where: { id: batch!.id } })
    ).qty;
    const methodBefore = Number(
      (await prisma.paymentMethod.findUniqueOrThrow({ where: { id: f.method!.id } })).balance,
    );

    const checkout = await request(app)
      .post('/api/v1/pos/checkout')
      .set(auth(token))
      .send({ cartId });
    expect([200, 201]).toContain(checkout.status);

    const qtyAfter = (await prisma.batch.findUniqueOrThrow({ where: { id: batch!.id } })).qty;
    expect(qtyAfter).toBe(qtyBefore - 1);
    const methodAfter = Number(
      (await prisma.paymentMethod.findUniqueOrThrow({ where: { id: f.method!.id } })).balance,
    );
    expect(methodAfter).toBeGreaterThan(methodBefore);

    const invId = checkout.body.data.invId as string;
    const ledger = await prisma.ledgerTransaction.findFirst({
      where: { invoiceId: invId, invoiceType: 'sale' },
    });
    expect(ledger).toBeTruthy();
    void itemId;
  });

  it('Expense create posts AP credit ledger', async () => {
    const app = getApp();
    const f = await loadFixtures();
    const res = await request(app)
      .post('/api/v1/expenses')
      .set(auth(token))
      .send({
        date: new Date().toISOString().slice(0, 10),
        title: `QA WF Expense ${Date.now()}`,
        categoryId: f.category!.id,
        accountId: 1,
        amount: 125.5,
        reference: 'QA-WF',
      });
    expect([200, 201]).toContain(res.status);
    const expenseId = res.body.data.id as number;
    const ledger = await prisma.ledgerTransaction.findFirst({
      where: { invoiceId: `EXP-${expenseId}`, invoiceType: 'expense' },
    });
    expect(ledger).toBeTruthy();
    expect(ledger!.creditAccountId).toBe(3);
    expect(Number(ledger!.amount)).toBe(125.5);
  });

  it('Concurrent checkout cannot drive batch qty negative', async () => {
    const app = getApp();
    const f = await loadFixtures();
    const batch = await prisma.batch.create({
      data: {
        shopId: 1,
        medicineId: f.medicine!.id,
        name: `CONCUR-${Date.now()}`,
        qty: 1,
        purchaseQty: 1,
        expire: new Date('2028-01-01'),
        price: f.medicine!.price,
        buyPrice: f.medicine!.buyPrice,
      },
    });

    async function oneCheckout() {
      const cart = await request(app).post('/api/v1/pos/carts').set(auth(token)).send({});
      const cartId = cart.body.data.id as number;
      await request(app)
        .post(`/api/v1/pos/carts/${cartId}/items`)
        .set(auth(token))
        .send({ medicineId: batch.medicineId });
      const got = await request(app).get(`/api/v1/pos/carts/${cartId}`).set(auth(token));
      const itemId = got.body.data.items[0].id as string;
      await request(app)
        .patch(`/api/v1/pos/carts/${cartId}/items/${itemId}`)
        .set(auth(token))
        .send({ batchId: batch.id, qty: 1 });
      await request(app)
        .patch(`/api/v1/pos/carts/${cartId}`)
        .set(auth(token))
        .send({ paymentMethodId: f.method!.id, paidAmount: 999999, customerId: f.customer!.id });
      return request(app).post('/api/v1/pos/checkout').set(auth(token)).send({ cartId });
    }

    const [a, b] = await Promise.all([oneCheckout(), oneCheckout()]);
    const ok = [a, b].filter((r) => r.status < 300);
    const fail = [a, b].filter((r) => r.status >= 400);
    expect(ok.length).toBe(1);
    expect(fail.length).toBe(1);
    expect(fail[0]!.status).toBe(409);
    const final = await prisma.batch.findUniqueOrThrow({ where: { id: batch.id } });
    expect(final.qty).toBe(0);
  });
});
