import request from 'supertest';
import { createApp } from '../../src/app';
import { config } from '../../src/config';
import { prisma } from '../../src/lib/prisma';

const app = createApp();

describe('Sessions + Insurance integration', () => {
  let accessToken = '';
  let userId = 0;

  beforeAll(async () => {
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
    userId = res.body.data.user.id as number;

    // Close any leftover open session for this user
    await prisma.posSession.updateMany({
      where: { shopId: 1, userId, status: 'open' },
      data: { status: 'closed', closedAt: new Date() },
    });
  });

  afterAll(async () => {
    await prisma.posSession.updateMany({
      where: { shopId: 1, userId, status: 'open' },
      data: { status: 'closed', closedAt: new Date() },
    });
    await prisma.$disconnect();
  });

  function auth() {
    return { Authorization: `Bearer ${accessToken}` };
  }

  it('rejects duplicate open sessions with 409', async () => {
    const open1 = await request(app)
      .post('/api/v1/pos/sessions/open')
      .set(auth())
      .send({ openingFloat: 50 });
    expect(open1.status).toBe(201);

    const open2 = await request(app)
      .post('/api/v1/pos/sessions/open')
      .set(auth())
      .send({ openingFloat: 10 });
    expect(open2.status).toBe(409);
    expect(open2.body.code).toBe('SESSION_ALREADY_OPEN');

    await request(app)
      .post(`/api/v1/pos/sessions/${open1.body.data.id}/close`)
      .set(auth())
      .send({ countedCash: 50 });
  });

  it('blocks checkout without an open session', async () => {
    await prisma.posSession.updateMany({
      where: { shopId: 1, userId, status: 'open' },
      data: { status: 'closed', closedAt: new Date() },
    });

    const cart = await request(app).post('/api/v1/pos/carts').set(auth()).send({});
    expect(cart.status).toBe(201);

    const medicine = await prisma.medicine.findFirst({ where: { shopId: 1 }, orderBy: { id: 'asc' } });
    const batch = await prisma.batch.findFirst({
      where: { shopId: 1, medicineId: medicine!.id, qty: { gt: 0 } },
    });
    expect(medicine && batch).toBeTruthy();

    await request(app)
      .post(`/api/v1/pos/carts/${cart.body.data.id}/items`)
      .set(auth())
      .send({ medicineId: medicine!.id });

    const method = await prisma.paymentMethod.findFirst({ where: { shopId: 1, name: 'Cash' } });
    await request(app)
      .patch(`/api/v1/pos/carts/${cart.body.data.id}`)
      .set(auth())
      .send({ paymentMethodId: method!.id, paidAmount: 0 });

    const checkout = await request(app)
      .post('/api/v1/pos/checkout')
      .set(auth())
      .send({ cartId: cart.body.data.id });
    expect(checkout.status).toBe(409);
    expect(checkout.body.code).toBe('NO_OPEN_SESSION');
  });

  it('stamps sessionId, reconciles cash on close, and supports insurance split', async () => {
    const open = await request(app)
      .post('/api/v1/pos/sessions/open')
      .set(auth())
      .send({ openingFloat: 100 });
    expect(open.status).toBe(201);
    const sessionId = open.body.data.id as number;

    const cash = await prisma.paymentMethod.findFirst({ where: { shopId: 1, name: 'Cash' } });
    expect(cash).toBeTruthy();

    // Ensure an insurance payment method exists
    let insuranceMethod = await prisma.paymentMethod.findFirst({
      where: { shopId: 1, isInsurance: true },
    });
    if (!insuranceMethod) {
      insuranceMethod = await prisma.paymentMethod.create({
        data: { shopId: 1, name: `Insurance ${Date.now()}`, balance: 0, isInsurance: true },
      });
    }

    const company = await request(app)
      .post('/api/v1/insurance-companies')
      .set(auth())
      .send({
        name: `InsCo ${Date.now()}`,
        defaultDiscountPercent: 70,
      });
    expect(company.status).toBe(201);
    const companyId = company.body.data.id as number;

    const medicine = await prisma.medicine.findFirst({ where: { shopId: 1 }, orderBy: { id: 'asc' } });
    const batch = await prisma.batch.findFirst({
      where: { shopId: 1, medicineId: medicine!.id, qty: { gt: 0 } },
      orderBy: { id: 'asc' },
    });
    expect(medicine && batch).toBeTruthy();

    // Cash checkout
    const cart1 = await request(app).post('/api/v1/pos/carts').set(auth()).send({});
    await request(app)
      .post(`/api/v1/pos/carts/${cart1.body.data.id}/items`)
      .set(auth())
      .send({ medicineId: medicine!.id });
    const view1 = await request(app).get(`/api/v1/pos/carts/${cart1.body.data.id}`).set(auth());
    const grand1 = Number(view1.body.data.grandTotal);
    await request(app)
      .patch(`/api/v1/pos/carts/${cart1.body.data.id}`)
      .set(auth())
      .send({ paymentMethodId: cash!.id, paidAmount: grand1 });
    const checkout1 = await request(app)
      .post('/api/v1/pos/checkout')
      .set(auth())
      .send({ cartId: cart1.body.data.id });
    expect(checkout1.status).toBe(201);
    expect(checkout1.body.data.sessionId ?? (await prisma.invoice.findUnique({ where: { id: checkout1.body.data.id } }))!.sessionId).toBe(sessionId);

    // Insurance split checkout
    const customer = await prisma.customer.findFirst({ where: { shopId: 1 }, orderBy: { id: 'asc' } });
    const cart2 = await request(app).post('/api/v1/pos/carts').set(auth()).send({});
    await request(app)
      .post(`/api/v1/pos/carts/${cart2.body.data.id}/items`)
      .set(auth())
      .send({ medicineId: medicine!.id });
    const view2 = await request(app).get(`/api/v1/pos/carts/${cart2.body.data.id}`).set(auth());
    const grand2 = Number(view2.body.data.grandTotal);
    const insuranceAmount = Number((grand2 * 0.7).toFixed(2));
    const patientAmount = Number((grand2 - insuranceAmount).toFixed(2));

    await request(app)
      .patch(`/api/v1/pos/carts/${cart2.body.data.id}`)
      .set(auth())
      .send({
        customerId: customer!.id,
        paymentMethodId: insuranceMethod.id,
        insuranceCompanyId: companyId,
        insurancePercent: 70,
        patientMethodId: cash!.id,
        paidAmount: patientAmount,
      });

    const beforeDue = Number((await prisma.insuranceCompany.findUnique({ where: { id: companyId } }))!.due);
    const checkout2 = await request(app)
      .post('/api/v1/pos/checkout')
      .set(auth())
      .send({ cartId: cart2.body.data.id });
    expect(checkout2.status).toBe(201);

    const afterCompany = await prisma.insuranceCompany.findUnique({ where: { id: companyId } });
    expect(Number(afterCompany!.due).toFixed(2)).toBe((beforeDue + insuranceAmount).toFixed(2));

    const inv2 = await prisma.invoice.findUnique({ where: { id: checkout2.body.data.id } });
    expect(Number(inv2!.insuranceAmount).toFixed(2)).toBe(insuranceAmount.toFixed(2));
    expect(inv2!.sessionId).toBe(sessionId);

    const close = await request(app)
      .post(`/api/v1/pos/sessions/${sessionId}/close`)
      .set(auth())
      .send({ countedCash: 100 + grand1 + patientAmount });
    expect(close.status).toBe(200);
    expect(close.body.data.status).toBe('closed');
    expect(close.body.data.expectedCash).toBeDefined();
    expect(Number(close.body.data.difference)).toBeCloseTo(0, 1);
  });
});
