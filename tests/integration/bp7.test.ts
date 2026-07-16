import request from 'supertest';
import ExcelJS from 'exceljs';
import { createApp } from '../../src/app';
import { config } from '../../src/config';
import { prisma } from '../../src/lib/prisma';
import { hashPassword } from '../../src/utils/password';
import { notificationsService } from '../../src/services/notifications.service';

const app = createApp();

function binaryParser(
  res: NodeJS.ReadableStream & { setEncoding: (enc: string) => void },
  callback: (err: Error | null, body: Buffer) => void,
) {
  res.setEncoding('binary');
  let data = '';
  res.on('data', (chunk: string) => {
    data += chunk;
  });
  res.on('end', () => {
    callback(null, Buffer.from(data, 'binary'));
  });
}

async function firstSheetHeaderRow(buffer: Buffer): Promise<string[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell((cell) => {
    headers.push(String(cell.value));
  });
  return headers;
}

describe('BP7 integration', () => {
  let accessToken = '';
  let adminUserId = 0;
  let shop1Id = 0;
  let adminRoleId = 0;

  beforeAll(async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: config.seed.adminEmail,
      password: config.seed.adminPassword,
    });
    expect(res.status).toBe(200);
    accessToken = res.body.data.accessToken as string;

    const adminUser = await prisma.user.findUnique({ where: { email: config.seed.adminEmail } });
    expect(adminUser).not.toBeNull();
    adminUserId = adminUser!.id;
    shop1Id = adminUser!.shopId;
    adminRoleId = adminUser!.roleId;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function auth(token: string = accessToken) {
    return { Authorization: `Bearer ${token}` };
  }

  function unique(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  async function createUserInShop(shopId: number, roleId: number, namePrefix: string) {
    const stamp = unique(namePrefix);
    const password = 'Test1234!';
    const hashed = await hashPassword(password);
    const email = `${stamp}@example.com`;
    const user = await prisma.user.create({
      data: { name: stamp, email, password: hashed, shopId, roleId },
    });
    const loginRes = await request(app).post('/api/v1/auth/login').send({ email, password });
    expect(loginRes.status).toBe(200);
    return { user, token: loginRes.body.data.accessToken as string };
  }

  async function createShopAndUser(namePrefix: string) {
    const stamp = unique(namePrefix);
    const shop = await prisma.shop.create({
      data: { name: stamp, currency: 'EGP', timeZone: 'Africa/Cairo', locale: 'ar' },
    });
    const { user, token } = await createUserInShop(shop.id, adminRoleId, namePrefix);
    return { shop, user, token };
  }

  let customerSeq = 0;
  async function createCustomer(token: string, namePrefix: string) {
    customerSeq += 1;
    const stamp = `${Date.now()}${customerSeq}${Math.floor(Math.random() * 10000)}`;
    const res = await request(app)
      .post('/api/v1/customers')
      .set(auth(token))
      .send({
        name: `${namePrefix} ${stamp}`,
        email: `${namePrefix.toLowerCase()}${stamp}@example.com`,
        phone: `0${stamp}`.slice(-13),
      });
    expect(res.status).toBe(201);
    return res.body.data as { id: number; due: string };
  }

  async function createSupplier(token: string, namePrefix: string) {
    const res = await request(app)
      .post('/api/v1/suppliers')
      .set(auth(token))
      .send({ name: unique(namePrefix), phone: `01${Date.now().toString().slice(-9)}` });
    expect(res.status).toBe(201);
    return res.body.data as { id: number; due: string };
  }

  function randomIso(): string {
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    const pick = () => letters[Math.floor(Math.random() * letters.length)];
    return `${pick()}${pick()}`;
  }

  async function createUniqueLanguage(namePrefix: string) {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const iso = randomIso();
      if (iso === 'en' || iso === 'ar') continue;
      const res = await request(app)
        .post('/api/v1/languages')
        .set(auth())
        .send({ name: `${namePrefix} ${iso}`, iso });
      if (res.status === 201) {
        return res.body.data as { id: number; iso: string; name: string; status: string };
      }
      if (res.status !== 409) {
        throw new Error(`Unexpected status creating language: ${res.status} ${JSON.stringify(res.body)}`);
      }
    }
    throw new Error('Failed to create a unique test language iso after 40 attempts');
  }

  describe('Languages', () => {
    it('creates, lists, gets, and patches basic fields', async () => {
      const language = await createUniqueLanguage('LangCrud');

      const list = await request(app).get('/api/v1/languages').query({ limit: 100 }).set(auth());
      expect(list.status).toBe(200);
      expect(list.body.data.items.some((l: { id: number }) => l.id === language.id)).toBe(true);

      const get = await request(app).get(`/api/v1/languages/${language.id}`).set(auth());
      expect(get.status).toBe(200);
      expect(get.body.data.iso).toBe(language.iso);

      const patch = await request(app)
        .patch(`/api/v1/languages/${language.id}`)
        .set(auth())
        .send({ name: 'Renamed Language', status: 'inactive' });
      expect(patch.status).toBe(200);
      expect(patch.body.data.name).toBe('Renamed Language');
      expect(patch.body.data.status).toBe('inactive');
    });

    it('excludes inactive languages from ?status=active but keeps them in the unfiltered admin list', async () => {
      const language = await createUniqueLanguage('LangActive');
      const deactivate = await request(app)
        .patch(`/api/v1/languages/${language.id}`)
        .set(auth())
        .send({ status: 'inactive' });
      expect(deactivate.status).toBe(200);

      const activeList = await request(app)
        .get('/api/v1/languages')
        .query({ status: 'active', limit: 100 })
        .set(auth());
      expect(activeList.status).toBe(200);
      expect(activeList.body.data.items.some((l: { id: number }) => l.id === language.id)).toBe(false);

      const fullList = await request(app).get('/api/v1/languages').query({ limit: 100 }).set(auth());
      expect(fullList.status).toBe(200);
      expect(fullList.body.data.items.some((l: { id: number }) => l.id === language.id)).toBe(true);
    });

    it('merges partial terms updates instead of replacing the whole map', async () => {
      const language = await createUniqueLanguage('LangTerms');

      const first = await request(app)
        .patch(`/api/v1/languages/${language.id}/terms`)
        .set(auth())
        .send({ terms: { welcome: 'Welcome', save: 'Save' } });
      expect(first.status).toBe(200);
      expect(first.body.data.terms).toMatchObject({ welcome: 'Welcome', save: 'Save' });

      const second = await request(app)
        .patch(`/api/v1/languages/${language.id}/terms`)
        .set(auth())
        .send({ terms: { cancel: 'Cancel' } });
      expect(second.status).toBe(200);
      // Merge, not replace: keys from the first PATCH must survive the second.
      expect(second.body.data.terms).toMatchObject({
        welcome: 'Welcome',
        save: 'Save',
        cancel: 'Cancel',
      });
    });

    it('rejects a duplicate iso on create with 409', async () => {
      const language = await createUniqueLanguage('LangDup');
      const dup = await request(app)
        .post('/api/v1/languages')
        .set(auth())
        .send({ name: 'Duplicate attempt', iso: language.iso });
      expect(dup.status).toBe(409);
    });

    it('deletes a language', async () => {
      const language = await createUniqueLanguage('LangDelete');
      const del = await request(app).delete(`/api/v1/languages/${language.id}`).set(auth());
      expect(del.status).toBe(200);

      const get = await request(app).get(`/api/v1/languages/${language.id}`).set(auth());
      expect(get.status).toBe(404);
    });
  });

  describe('Notifications', () => {
    it('unread-count increases when new notifications arrive and decreases as they are marked seen', async () => {
      const baseline = await request(app).get('/api/v1/notifications/unread-count').set(auth());
      expect(baseline.status).toBe(200);
      const baselineCount = baseline.body.data.unreadCount as number;

      const n1 = await notificationsService.createNotification({
        shopId: shop1Id,
        receiverId: adminUserId,
        title: 'Test notification 1',
        description: 'First test notification',
      });
      await notificationsService.createNotification({
        shopId: shop1Id,
        receiverId: adminUserId,
        title: 'Test notification 2',
        description: 'Second test notification',
      });

      const afterCreate = await request(app).get('/api/v1/notifications/unread-count').set(auth());
      expect(afterCreate.body.data.unreadCount).toBe(baselineCount + 2);

      const list = await request(app).get('/api/v1/notifications').query({ limit: 5 }).set(auth());
      expect(list.status).toBe(200);
      // Newest first.
      expect(list.body.data.items[0].title).toBe('Test notification 2');

      const getOne = await request(app).get(`/api/v1/notifications/${n1.id}`).set(auth());
      expect(getOne.status).toBe(200);
      expect(getOne.body.data.seen).toBe(true);

      const afterMarkOne = await request(app).get('/api/v1/notifications/unread-count').set(auth());
      expect(afterMarkOne.body.data.unreadCount).toBe(baselineCount + 1);

      // Idempotent: marking an already-seen notification again does not error or double-decrement.
      const markSeenAgain = await request(app).patch(`/api/v1/notifications/${n1.id}/seen`).set(auth());
      expect(markSeenAgain.status).toBe(200);
      const afterMarkAgain = await request(app).get('/api/v1/notifications/unread-count').set(auth());
      expect(afterMarkAgain.body.data.unreadCount).toBe(baselineCount + 1);

      const markAll = await request(app).patch('/api/v1/notifications/seen-all').set(auth());
      expect(markAll.status).toBe(200);
      const afterMarkAll = await request(app).get('/api/v1/notifications/unread-count').set(auth());
      expect(afterMarkAll.body.data.unreadCount).toBe(0);

      // No-op success on an already-empty inbox.
      const markAllAgain = await request(app).patch('/api/v1/notifications/seen-all').set(auth());
      expect(markAllAgain.status).toBe(200);
    });

    it('returns 404 for a nonexistent notification id', async () => {
      const res = await request(app).get('/api/v1/notifications/999999999').set(auth());
      expect(res.status).toBe(404);
    });

    it("cannot read or mark another user's notification (403, distinct from 404)", async () => {
      const { token: otherToken } = await createUserInShop(shop1Id, adminRoleId, 'NotifOtherUser');

      const notif = await notificationsService.createNotification({
        shopId: shop1Id,
        receiverId: adminUserId,
        title: 'Private to admin',
        description: 'Only admin should see this',
      });

      const getRes = await request(app).get(`/api/v1/notifications/${notif.id}`).set(auth(otherToken));
      expect(getRes.status).toBe(403);

      const patchRes = await request(app)
        .patch(`/api/v1/notifications/${notif.id}/seen`)
        .set(auth(otherToken));
      expect(patchRes.status).toBe(403);

      // Owner can still read/mark it.
      const ownerRes = await request(app).get(`/api/v1/notifications/${notif.id}`).set(auth());
      expect(ownerRes.status).toBe(200);
    });

    it('a user with zero notifications gets an empty list and zero unread-count', async () => {
      const { token } = await createUserInShop(shop1Id, adminRoleId, 'NotifEmptyUser');
      const list = await request(app).get('/api/v1/notifications').set(auth(token));
      expect(list.status).toBe(200);
      expect(list.body.data.items).toHaveLength(0);
      const unread = await request(app).get('/api/v1/notifications/unread-count').set(auth(token));
      expect(unread.body.data.unreadCount).toBe(0);
    });

    it('rejects limit=0 and negative limit with 400', async () => {
      const zero = await request(app).get('/api/v1/notifications').query({ limit: 0 }).set(auth());
      expect(zero.status).toBe(400);
      const negative = await request(app).get('/api/v1/notifications').query({ limit: -5 }).set(auth());
      expect(negative.status).toBe(400);
    });
  });

  describe('Operational reports', () => {
    it('customer-dues lists only customers with due > 0, sorted descending', async () => {
      const withDue = await createCustomer(accessToken, 'DueCust');
      const withoutDue = await createCustomer(accessToken, 'NoDueCust');
      await prisma.customer.update({ where: { id: withDue.id }, data: { due: '123.45' } });

      const res = await request(app).get('/api/v1/reports/customer-dues').set(auth());
      expect(res.status).toBe(200);
      expect(res.body.data.meta.generatedAt).toBeDefined();
      const ids = res.body.data.items.map((i: { id: number }) => i.id);
      expect(ids).toContain(withDue.id);
      expect(ids).not.toContain(withoutDue.id);
      const item = res.body.data.items.find((i: { id: number }) => i.id === withDue.id);
      expect(Number(item.due)).toBeCloseTo(123.45, 2);
    });

    it('supplier-payables lists only suppliers with due > 0', async () => {
      const withDue = await createSupplier(accessToken, 'PayableSup');
      const withoutDue = await createSupplier(accessToken, 'NoPayableSup');
      await prisma.supplier.update({ where: { id: withDue.id }, data: { due: '77.00' } });

      const res = await request(app).get('/api/v1/reports/supplier-payables').set(auth());
      expect(res.status).toBe(200);
      const ids = res.body.data.items.map((i: { id: number }) => i.id);
      expect(ids).toContain(withDue.id);
      expect(ids).not.toContain(withoutDue.id);
    });

    it('sale-purchase rejects from > to with 400 and defaults to current month when omitted', async () => {
      const invalid = await request(app)
        .get('/api/v1/reports/sale-purchase')
        .query({ from: '2026-02-01', to: '2026-01-01' })
        .set(auth());
      expect(invalid.status).toBe(400);

      const defaulted = await request(app).get('/api/v1/reports/sale-purchase').set(auth());
      expect(defaulted.status).toBe(200);
      expect(Array.isArray(defaulted.body.data.rows)).toBe(true);
      expect(defaulted.body.data.totals).toBeDefined();
      expect(defaulted.body.data.meta.generatedAt).toBeDefined();

      const explicit = await request(app)
        .get('/api/v1/reports/sale-purchase')
        .query({ from: '2026-01-01', to: '2026-12-31' })
        .set(auth());
      expect(explicit.status).toBe(200);
    });

    it('profit-loss returns revenue/costOfSales/netProfit consistent with revenue - cost', async () => {
      const res = await request(app)
        .get('/api/v1/reports/profit-loss')
        .query({ from: '2026-01-01', to: '2026-12-31' })
        .set(auth());
      expect(res.status).toBe(200);
      expect(Number(res.body.data.netProfit)).toBeCloseTo(
        Number(res.body.data.revenue) - Number(res.body.data.costOfSales),
        2,
      );
    });

    it('a user without the matching report permission receives 403', async () => {
      const barePassword = 'Test1234!';
      const hashed = await hashPassword(barePassword);
      const bareRole = await prisma.role.create({
        data: { name: unique('bare-role'), displayName: 'Bare Role (no perms)' },
      });
      const email = `${unique('bare-user')}@example.com`;
      await prisma.user.create({
        data: { name: 'Bare User', email, password: hashed, shopId: shop1Id, roleId: bareRole.id },
      });
      const login = await request(app).post('/api/v1/auth/login').send({ email, password: barePassword });
      expect(login.status).toBe(200);
      const bareToken = login.body.data.accessToken as string;

      const res = await request(app).get('/api/v1/reports/customer-dues').set(auth(bareToken));
      expect(res.status).toBe(403);
    });

    describe('Excel exports', () => {
      it('customer-dues export has expected headers and is a non-empty valid xlsx', async () => {
        const res = await request(app)
          .get('/api/v1/reports/customer-dues/export')
          .set(auth())
          .buffer(true)
          .parse(binaryParser as never);
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('spreadsheetml');
        const buffer = res.body as Buffer;
        expect(buffer.length).toBeGreaterThan(0);
        const headers = await firstSheetHeaderRow(buffer);
        expect(headers).toEqual(['SN', 'Name', 'Phone', 'Due']);
      });

      it('supplier-payables export has expected headers', async () => {
        const res = await request(app)
          .get('/api/v1/reports/supplier-payables/export')
          .set(auth())
          .buffer(true)
          .parse(binaryParser as never);
        expect(res.status).toBe(200);
        const headers = await firstSheetHeaderRow(res.body as Buffer);
        expect(headers).toEqual(['SN', 'Name', 'Phone', 'Due']);
      });

      it('sale-purchase export has expected headers', async () => {
        const res = await request(app)
          .get('/api/v1/reports/sale-purchase/export')
          .query({ from: '2026-01-01', to: '2026-12-31' })
          .set(auth())
          .buffer(true)
          .parse(binaryParser as never);
        expect(res.status).toBe(200);
        const headers = await firstSheetHeaderRow(res.body as Buffer);
        expect(headers).toEqual([
          'Date',
          'Total Sale Invoice',
          'Sales Amount',
          'Total Purchase Invoice',
          'Purchase Amount',
        ]);
      });

      it('profit-loss export has expected headers', async () => {
        const res = await request(app)
          .get('/api/v1/reports/profit-loss/export')
          .query({ from: '2026-01-01', to: '2026-12-31' })
          .set(auth())
          .buffer(true)
          .parse(binaryParser as never);
        expect(res.status).toBe(200);
        const headers = await firstSheetHeaderRow(res.body as Buffer);
        expect(headers).toEqual(['Period From', 'Period To', 'Revenue', 'Cost of Sales', 'Net Profit']);
      });

      it('an empty result set still exports a valid headers-only xlsx (fresh shop, no dues)', async () => {
        const { token } = await createShopAndUser('EmptyExportShop');
        const res = await request(app)
          .get('/api/v1/reports/customer-dues/export')
          .set(auth(token))
          .buffer(true)
          .parse(binaryParser as never);
        expect(res.status).toBe(200);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(res.body as unknown as ArrayBuffer);
        const sheet = workbook.worksheets[0];
        expect(sheet.rowCount).toBe(1); // header row only, no data rows
      });
    });
  });

  describe('Dashboard', () => {
    it('returns exactly the documented field list', async () => {
      const res = await request(app).get('/api/v1/dashboard/summary').set(auth());
      expect(res.status).toBe(200);
      const data = res.body.data as Record<string, unknown>;
      expect(Object.keys(data).sort()).toEqual(
        [
          'customerDueTotal',
          'expiredCount',
          'expiringCount',
          'lowStockCount',
          'salesThisMonth',
          'salesToday',
          'supplierDueTotal',
        ].sort(),
      );
      expect(typeof data.salesToday).toBe('string');
      expect(typeof data.customerDueTotal).toBe('string');
      expect(typeof data.lowStockCount).toBe('number');
    });

    it('is strictly shop-scoped: a brand-new shop with no data sees all-zero figures', async () => {
      const { token } = await createShopAndUser('DashIsoShop');
      const res = await request(app).get('/api/v1/dashboard/summary').set(auth(token));
      expect(res.status).toBe(200);
      expect(res.body.data.salesToday).toBe('0.00');
      expect(res.body.data.salesThisMonth).toBe('0.00');
      expect(res.body.data.customerDueTotal).toBe('0.00');
      expect(res.body.data.supplierDueTotal).toBe('0.00');
      expect(res.body.data.lowStockCount).toBe(0);
      expect(res.body.data.expiringCount).toBe(0);
      expect(res.body.data.expiredCount).toBe(0);
    });

    it("shop A's dues never leak into shop B's dashboard summary", async () => {
      const customer = await createCustomer(accessToken, 'DashDueCust');
      await prisma.customer.update({ where: { id: customer.id }, data: { due: '999.99' } });

      const shop1Dashboard = await request(app).get('/api/v1/dashboard/summary').set(auth());
      expect(shop1Dashboard.status).toBe(200);
      expect(Number(shop1Dashboard.body.data.customerDueTotal)).toBeGreaterThanOrEqual(999.99);

      const { token: shop2Token } = await createShopAndUser('DashLeakShop');
      const shop2Dashboard = await request(app).get('/api/v1/dashboard/summary').set(auth(shop2Token));
      expect(shop2Dashboard.status).toBe(200);
      expect(shop2Dashboard.body.data.customerDueTotal).toBe('0.00');
    });
  });
});
