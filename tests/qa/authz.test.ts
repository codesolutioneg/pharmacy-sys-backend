import { auth, getApp, qaLogin, request } from './helpers';

describe('QA Authorization by role', () => {
  it('pharmacist can list medicines and create POS cart', async () => {
    const { accessToken } = await qaLogin('pharmacist');
    const meds = await request(getApp()).get('/api/v1/medicines').set(auth(accessToken));
    expect(meds.status).toBe(200);
    const cart = await request(getApp()).post('/api/v1/pos/carts').set(auth(accessToken)).send({});
    expect(cart.status).toBeLessThan(300);
  });

  it('cashier cannot access expenses', async () => {
    const { accessToken } = await qaLogin('cashier');
    const res = await request(getApp()).get('/api/v1/expenses').set(auth(accessToken));
    expect(res.status).toBe(403);
  });

  it('storekeeper can open purchase draft', async () => {
    const { accessToken } = await qaLogin('storekeeper');
    const res = await request(getApp()).post('/api/v1/purchases/drafts').set(auth(accessToken)).send({});
    expect(res.status).toBeLessThan(300);
  });

  it('storekeeper cannot checkout POS', async () => {
    const { accessToken } = await qaLogin('storekeeper');
    const res = await request(getApp()).post('/api/v1/pos/carts').set(auth(accessToken)).send({});
    expect(res.status).toBe(403);
  });
});
