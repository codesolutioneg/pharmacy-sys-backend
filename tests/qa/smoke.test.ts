import { adminLogin, auth, getApp, request } from './helpers';

describe('QA Smoke', () => {
  let token = '';

  beforeAll(async () => {
    token = (await adminLogin()).accessToken;
  });

  const lists = [
    '/api/health',
    '/api/docs/',
    '/api/v1/auth/me',
    '/api/v1/dashboard/summary',
    '/api/v1/users',
    '/api/v1/roles',
    '/api/v1/permissions',
    '/api/v1/customers',
    '/api/v1/suppliers',
    '/api/v1/vendors',
    '/api/v1/medicines',
    '/api/v1/purchases',
    '/api/v1/invoices',
    '/api/v1/batches',
    '/api/v1/stock/in-stock',
    '/api/v1/expenses',
    '/api/v1/accounts',
    '/api/v1/ledger-transactions',
    '/api/v1/reports/customer-dues',
    '/api/v1/reports/sale-purchase',
    '/api/v1/languages',
    '/api/v1/notifications',
    '/api/v1/doctors',
    '/api/v1/patients',
  ];

  it.each(lists)('%s returns success', async (url) => {
    const app = getApp();
    const req = request(app).get(url);
    if (!url.startsWith('/api/health') && !url.startsWith('/api/docs')) {
      req.set(auth(token));
    }
    const res = await req;
    expect([200, 301, 302]).toContain(res.status);
    if (url.startsWith('/api/v1') || url === '/api/health') {
      expect(res.body.success).toBe(true);
    }
  });

  it('rejects unauthenticated protected route', async () => {
    const res = await request(getApp()).get('/api/v1/customers');
    expect(res.status).toBe(401);
  });
});
