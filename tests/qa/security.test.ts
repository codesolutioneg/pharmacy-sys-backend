import { adminLogin, auth, getApp, loadFixtures, qaLogin, request } from './helpers';

describe('QA Security', () => {
  it('invalid JWT → 401', async () => {
    const res = await request(getApp())
      .get('/api/v1/auth/me')
      .set({ Authorization: 'Bearer not-a-real-jwt' });
    expect(res.status).toBe(401);
  });

  it('SQL injection in search/query does not 500', async () => {
    const token = (await adminLogin()).accessToken;
    const payload = "1'; DROP TABLE users;--";
    const res = await request(getApp())
      .get('/api/v1/customers')
      .query({ search: payload, page: payload })
      .set(auth(token));
    expect(res.status).toBeLessThan(500);
  });

  it('XSS string in customer name is stored without 500', async () => {
    const token = (await adminLogin()).accessToken;
    const xss = `<script>alert('x')</script>`;
    const phone = `010${Date.now().toString().slice(-8)}`;
    const res = await request(getApp())
      .post('/api/v1/customers')
      .set(auth(token))
      .send({ name: xss, phone, email: `xss${Date.now()}@qa.eg` });
    expect([200, 201, 400, 422]).toContain(res.status);
    expect(res.status).toBeLessThan(500);
  });

  it('me/user responses never include password hash', async () => {
    const token = (await adminLogin()).accessToken;
    const me = await request(getApp()).get('/api/v1/auth/me').set(auth(token));
    expect(JSON.stringify(me.body)).not.toMatch(/"password"/i);
    const users = await request(getApp()).get('/api/v1/users').set(auth(token));
    expect(JSON.stringify(users.body)).not.toMatch(/\$2[aby]\$/);
  });

  it('cashier cannot create purchase (403)', async () => {
    const cashier = await qaLogin('cashier');
    const res = await request(getApp())
      .post('/api/v1/purchases/drafts')
      .set(auth(cashier.accessToken))
      .send({});
    expect(res.status).toBe(403);
  });

  it('IDOR: shop2 user cannot read shop1 customer', async () => {
    const f = await loadFixtures();
    const shop2 = await request(getApp())
      .post('/api/v1/auth/login')
      .send({ email: 'cashier@alsalam.eg', password: process.env.QA_PASSWORD || 'Pharmacy@123' });
    expect(shop2.status).toBe(200);
    const res = await request(getApp())
      .get(`/api/v1/customers/${f.customer!.id}`)
      .set(auth(shop2.body.data.accessToken));
    expect([403, 404]).toContain(res.status);
  });
});
