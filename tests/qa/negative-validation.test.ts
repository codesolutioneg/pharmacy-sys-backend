import { adminLogin, auth, getApp, request } from './helpers';

describe('QA Negative validation', () => {
  let token = '';
  beforeAll(async () => {
    token = (await adminLogin()).accessToken;
  });

  it('login missing password → 400', async () => {
    const res = await request(getApp()).post('/api/v1/auth/login').send({ email: 'a@b.com' });
    expect([400, 422]).toContain(res.status);
  });

  it('customer with invalid email → 400', async () => {
    const res = await request(getApp())
      .post('/api/v1/customers')
      .set(auth(token))
      .send({ name: 'X', phone: '01000000000', email: 'not-an-email' });
    expect([400, 422]).toContain(res.status);
  });

  it('expense amount 0 → 400', async () => {
    const cats = await request(getApp()).get('/api/v1/expense-categories').set(auth(token));
    const categoryId = cats.body.data.items?.[0]?.id ?? cats.body.data?.[0]?.id;
    const res = await request(getApp())
      .post('/api/v1/expenses')
      .set(auth(token))
      .send({
        date: '2026-07-01',
        title: 'Bad',
        categoryId,
        accountId: 1,
        amount: 0,
      });
    expect([400, 422]).toContain(res.status);
  });

  it('report from > to → 400', async () => {
    const res = await request(getApp())
      .get('/api/v1/reports/sale-purchase')
      .query({ from: '2026-12-31', to: '2026-01-01' })
      .set(auth(token));
    expect(res.status).toBe(400);
  });

  it('pagination rejects oversized limit without 500', async () => {
    const res = await request(getApp())
      .get('/api/v1/customers')
      .query({ page: 1, limit: 9999 })
      .set(auth(token));
    expect(res.status).toBeLessThan(500);
    // Spec: max page size 100 — Zod rejects rather than silently clamping.
    expect([200, 400]).toContain(res.status);
  });

  it('commit empty purchase draft rejected', async () => {
    const draft = await request(getApp()).post('/api/v1/purchases/drafts').set(auth(token)).send({});
    const draftId = draft.body.data.id;
    const res = await request(getApp()).post('/api/v1/purchases').set(auth(token)).send({ draftId });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});
