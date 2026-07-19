import request from 'supertest';
import { createApp } from '../../src/app';
import { config } from '../../src/config';

const app = createApp();

describe('BP1 integration', () => {
  let accessToken = '';
  let refreshToken = '';

  it('GET /api/health returns 200', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
  });

  it('GET /api/docs returns swagger UI or 200', async () => {
    const res = await request(app).get('/api/docs/');
    expect([200, 301, 302]).toContain(res.status);
  });

  it('login with seed admin', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: config.seed.adminEmail,
      password: config.seed.adminPassword,
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.refreshToken).toBeTruthy();
    expect(res.body.data.user.permissions.length).toBeGreaterThan(0);
    accessToken = res.body.data.accessToken as string;
    refreshToken = res.body.data.refreshToken as string;
  });

  it('rejects bad login', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: config.seed.adminEmail,
      password: 'wrong-password',
    });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('GET /auth/me', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(config.seed.adminEmail);
  });

  it('refresh rotates token', async () => {
    const res = await request(app).post('/api/v1/auth/refresh').send({
      refreshToken,
    });
    expect(res.status).toBe(200);
    const old = refreshToken;
    refreshToken = res.body.data.refreshToken as string;
    accessToken = res.body.data.accessToken as string;
    expect(refreshToken).not.toBe(old);

    const reuse = await request(app).post('/api/v1/auth/refresh').send({
      refreshToken: old,
    });
    expect(reuse.status).toBe(401);
  });

  it('lists permissions catalog', async () => {
    const res = await request(app)
      .get('/api/v1/permissions')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.Setting).toBeDefined();
    expect(res.body.data.User).toBeDefined();
  });

  it('gets and patches general settings', async () => {
    const getRes = await request(app)
      .get('/api/v1/settings/general')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.currency).toBe('EGP');
    expect(getRes.body.data.timeZone).toBe('Africa/Cairo');

    const patchRes = await request(app)
      .patch('/api/v1/settings/general')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currency: 'SAR',
        timeZone: 'Asia/Riyadh',
        locale: 'ar',
        taxMode: 'exclusive',
        taxRatePercent: 15,
        lowStockAlert: 5,
      });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.currency).toBe('SAR');
    expect(patchRes.body.data.tax.ratePercent).toBe('15.00');

    // restore Egypt defaults for other tests
    await request(app)
      .patch('/api/v1/settings/general')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currency: 'EGP',
        timeZone: 'Africa/Cairo',
        taxRatePercent: 0,
        lowStockAlert: 0,
      });
  });

  it('gets and patches POS printer settings (KV pos.printer)', async () => {
    const defaults = await request(app)
      .get('/api/v1/settings/pos-printer')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(defaults.status).toBe(200);
    expect(defaults.body.data).toEqual({
      autoPrint: false,
      preferredPrinter: null,
      paperSize: 'A4',
      receiptFooter: null,
    });

    const patched = await request(app)
      .patch('/api/v1/settings/pos-printer')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        autoPrint: true,
        preferredPrinter: 'EPSON TM-T20',
        paperSize: '80mm',
        receiptFooter: 'Thank you — Al Noor Pharmacy',
      });
    expect(patched.status).toBe(200);
    expect(patched.body.data).toEqual({
      autoPrint: true,
      preferredPrinter: 'EPSON TM-T20',
      paperSize: '80mm',
      receiptFooter: 'Thank you — Al Noor Pharmacy',
    });

    const again = await request(app)
      .get('/api/v1/settings/pos-printer')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(again.status).toBe(200);
    expect(again.body.data.paperSize).toBe('80mm');
    expect(again.body.data.autoPrint).toBe(true);

    const partial = await request(app)
      .patch('/api/v1/settings/pos-printer')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ paperSize: '58mm' });
    expect(partial.status).toBe(200);
    expect(partial.body.data.paperSize).toBe('58mm');
    expect(partial.body.data.autoPrint).toBe(true);
    expect(partial.body.data.preferredPrinter).toBe('EPSON TM-T20');

    const bad = await request(app)
      .patch('/api/v1/settings/pos-printer')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ paperSize: 'Letter' });
    expect(bad.status).toBe(400);

    // restore defaults for other suites
    await request(app)
      .patch('/api/v1/settings/pos-printer')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        autoPrint: false,
        preferredPrinter: null,
        paperSize: 'A4',
        receiptFooter: null,
      });
  });

  it('creates role with sync permissions and lists users', async () => {
    const displayName = `Cashier BP1 ${Date.now()}`;
    const roleRes = await request(app)
      .post('/api/v1/roles')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        displayName,
        permissionNames: ['sale.index', 'sale.store', 'customer.index'],
      });
    expect(roleRes.status).toBe(201);
    expect(roleRes.body.data.name).toBe(
      displayName.trim().toLowerCase().replace(/ /g, '_'),
    );
    expect(roleRes.body.data.permissionNames).toEqual(
      expect.arrayContaining(['sale.index', 'sale.store', 'customer.index']),
    );

    const usersRes = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(usersRes.status).toBe(200);
    expect(usersRes.body.data.meta.total).toBeGreaterThanOrEqual(1);
  });

  it('logout revokes refresh', async () => {
    const logout = await request(app)
      .post('/api/v1/auth/logout')
      .send({ refreshToken });
    expect(logout.status).toBe(200);

    const refresh = await request(app).post('/api/v1/auth/refresh').send({
      refreshToken,
    });
    expect(refresh.status).toBe(401);
  });
});
