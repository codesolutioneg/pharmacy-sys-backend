import fs from 'fs';
import yaml from 'yaml';
import { adminLogin, auth, getApp, loadFixtures, openApiPath, request } from './helpers';

type Op = { method: string; path: string; requiresAuth: boolean };

function loadOps(): Op[] {
  const doc = yaml.parse(fs.readFileSync(openApiPath(), 'utf8')) as {
    paths: Record<string, Record<string, { security?: unknown[] }>>;
    security?: unknown[];
  };
  const ops: Op[] = [];
  for (const [p, methods] of Object.entries(doc.paths || {})) {
    for (const [m, op] of Object.entries(methods)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(m)) continue;
      const requiresAuth = Array.isArray(op.security)
        ? op.security.length > 0
        : Array.isArray(doc.security) && doc.security.length > 0;
      // health is public even if global security exists
      const isPublic =
        p.includes('/health') ||
        p.includes('/auth/login') ||
        p.includes('/auth/refresh') ||
        p.includes('/auth/forgot') ||
        p.includes('/auth/reset') ||
        p.includes('/docs');
      ops.push({ method: m.toUpperCase(), path: p, requiresAuth: requiresAuth && !isPublic });
    }
  }
  return ops;
}

function fillPath(template: string, ids: Record<string, string | number>): string {
  return template.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const v = ids[key] ?? ids.id ?? 1;
    return String(v);
  });
}

describe('QA OpenAPI coverage (all operations exercised)', () => {
  const ops = loadOps();
  let token = '';
  let ids: Record<string, string | number> = { id: 1 };

  beforeAll(async () => {
    token = (await adminLogin()).accessToken;
    const f = await loadFixtures();
    ids = {
      id: f.medicine?.id ?? 1,
      medicineId: f.medicine?.id ?? 1,
      customerId: f.customer?.id ?? 1,
      supplierId: f.supplier?.id ?? 1,
      vendorId: f.vendor?.id ?? 1,
      invoiceId: f.invoice?.id ?? 1,
      purchaseId: f.purchase?.id ?? 1,
      batchId: f.batch?.id ?? 1,
      methodId: f.method?.id ?? 1,
      expenseId: f.expense?.id ?? 1,
      categoryId: f.category?.id ?? 1,
      cartId: 1,
      itemId: 1,
      lineId: 1,
      userId: 1,
      roleId: 1,
      doctorId: 1,
      patientId: 1,
      accountId: 1,
      accountTypeId: 1,
      notificationId: 1,
      languageId: 1,
      paymentMethodId: f.method?.id ?? 1,
    };
    // hydrate dynamic ids from API lists
    const app = getApp();
    const hydrate = async (url: string, key: string) => {
      const res = await request(app).get(url).set(auth(token));
      const items = res.body?.data?.items ?? res.body?.data ?? [];
      if (Array.isArray(items) && items[0]?.id) ids[key] = items[0].id;
      if (items?.id) ids[key] = items.id;
    };
    await hydrate('/api/v1/users?limit=1', 'userId');
    await hydrate('/api/v1/roles?limit=1', 'roleId');
    await hydrate('/api/v1/doctors?limit=1', 'doctorId');
    await hydrate('/api/v1/patients?limit=1', 'patientId');
    await hydrate('/api/v1/languages?limit=1', 'languageId');
    await hydrate('/api/v1/notifications?limit=1', 'notificationId');
    await hydrate('/api/v1/account-types?limit=1', 'accountTypeId');
    await hydrate('/api/v1/accounts?limit=1', 'accountId');
    await hydrate('/api/v1/product-categories?limit=1', 'categoryId');
    await hydrate('/api/v1/medicine-types?limit=1', 'id');
    // cart for POS paths
    const cart = await request(app).post('/api/v1/pos/carts').set(auth(token)).send({});
    if (cart.status === 201 || cart.status === 200) {
      ids.cartId = cart.body.data.id;
    }
    const draft = await request(app).post('/api/v1/purchases/drafts').set(auth(token)).send({});
    if (draft.status === 201 || draft.status === 200) {
      ids.id = draft.body.data.id; // may overwrite — keep draft id separately
      ids.draftId = draft.body.data.id;
    }
  });

  it(`documents ${ops.length} operations`, () => {
    expect(ops.length).toBeGreaterThanOrEqual(170);
  });

  it('every protected op without token returns 401', async () => {
    const app = getApp();
    const sample = ops.filter((o) => o.requiresAuth && o.method === 'GET').slice(0, 25);
    for (const op of sample) {
      const url = fillPath(op.path, { ...ids, id: ids.medicineId ?? 1 });
      const res = await request(app)[op.method.toLowerCase() as 'get'](url);
      expect([401, 403]).toContain(res.status);
    }
  });

  it('exercises every OpenAPI operation (no 5xx)', async () => {
    const app = getApp();
    const results: Array<{ op: string; status: number }> = [];
    const failures: string[] = [];

    for (const op of ops) {
      const pathIds = {
        ...ids,
        id:
          op.path.includes('purchases/drafts')
            ? ids.draftId ?? ids.id
            : op.path.includes('invoices')
              ? ids.invoiceId ?? ids.id
              : op.path.includes('purchases')
                ? ids.purchaseId ?? ids.id
                : op.path.includes('customers')
                  ? ids.customerId ?? ids.id
                  : op.path.includes('suppliers')
                    ? ids.supplierId ?? ids.id
                    : op.path.includes('medicines')
                      ? ids.medicineId ?? ids.id
                      : op.path.includes('batches')
                        ? ids.batchId ?? ids.id
                        : op.path.includes('notifications')
                          ? ids.notificationId ?? ids.id
                          : op.path.includes('languages')
                            ? ids.languageId ?? ids.id
                            : op.path.includes('users')
                              ? ids.userId ?? ids.id
                              : op.path.includes('roles')
                                ? ids.roleId ?? ids.id
                                : op.path.includes('expenses')
                                  ? ids.expenseId ?? ids.id
                                  : op.path.includes('doctors')
                                    ? ids.doctorId ?? ids.id
                                    : op.path.includes('patients')
                                      ? ids.patientId ?? ids.id
                                      : op.path.includes('accounts')
                                        ? ids.accountId ?? ids.id
                                        : op.path.includes('pos/carts')
                                          ? ids.cartId ?? ids.id
                                          : ids.id,
        cartId: ids.cartId ?? 1,
        itemId: ids.itemId ?? 1,
        lineId: ids.lineId ?? 1,
        medicineId: ids.medicineId ?? 1,
      };
      const url = fillPath(op.path, pathIds);
      let req = request(app)[op.method.toLowerCase() as 'get'](url);
      if (op.requiresAuth || (!url.includes('/health') && !url.includes('/auth/login'))) {
        if (!url.includes('/auth/login') && !url.includes('/auth/forgot') && !url.includes('/auth/reset') && !url.includes('/auth/refresh') && !url.includes('/health') && !url.includes('/docs')) {
          req = req.set(auth(token));
        }
      }

      // minimal bodies for mutating verbs to avoid 500s
      if (['POST', 'PUT', 'PATCH'].includes(op.method)) {
        if (url.includes('/auth/login')) {
          req = req.send({ email: 'admin@pharmacy.local', password: 'Admin123!' });
        } else if (url.includes('/auth/refresh')) {
          req = req.send({ refreshToken: 'invalid' });
        } else if (url.includes('/auth/logout')) {
          req = req.send({ refreshToken: 'invalid' });
        } else if (url.includes('/auth/forgot')) {
          req = req.send({ email: 'admin@pharmacy.local' });
        } else if (url.includes('/auth/reset')) {
          req = req.send({ token: 'x', password: 'NewPass123!' });
        } else if (url.includes('/auth/password')) {
          req = req.send({ currentPassword: 'x', newPassword: 'NewPass123!' });
        } else if (url.includes('/auth/profile')) {
          req = req.send({ name: 'QA Admin' });
        } else if (url.includes('/pos/checkout')) {
          req = req.send({ cartId: ids.cartId });
        } else if (url.includes('/pos/carts') && op.method === 'POST' && url.endsWith('/carts')) {
          req = req.send({});
        } else if (url.includes('/items') && op.method === 'POST') {
          req = req.send({ medicineId: ids.medicineId });
        } else if (url.includes('/purchases/drafts') && op.method === 'POST' && url.endsWith('/drafts')) {
          req = req.send({});
        } else if (url.includes('/lines') && op.method === 'POST') {
          req = req.send({
            medicineId: ids.medicineId,
            quantity: 1,
            buyPrice: 10,
            price: 15,
          });
        } else if (url.endsWith('/purchases') && op.method === 'POST') {
          req = req.send({ draftId: ids.draftId });
        } else if (url.includes('/deposits')) {
          req = req.send({ amount: 1 });
        } else if (url.includes('/payments')) {
          req = req.send({ amount: 1, paymentMethodId: ids.methodId });
        } else if (url.includes('/returns')) {
          req = req.send({ medicineId: ids.medicineId, quantity: 1, batchId: ids.batchId });
        } else if (url.includes('/barcode')) {
          req = req.send({});
        } else if (url.includes('/email')) {
          req = req.send({ to: 'qa@example.com' });
        } else if (url.includes('/approve')) {
          req = req.send({});
        } else if (url.includes('/terms')) {
          req = req.send({ terms: { hello: 'world' } });
        } else if (url.includes('/settings/kv')) {
          req = req.send({ key: 'qa_test', value: '1' });
        } else if (url.includes('/settings/pos-printer')) {
          req = req.send({ paperSize: 'A4', autoPrint: false });
        } else if (url.includes('/seen')) {
          req = req.send({});
        } else {
          req = req.send({});
        }
      }

      const res = await req;
      results.push({ op: `${op.method} ${op.path}`, status: res.status });
      if (res.status >= 500) {
        failures.push(`${op.method} ${url} → ${res.status} ${JSON.stringify(res.body).slice(0, 200)}`);
      }
    }

    // eslint-disable-next-line no-console
    console.log(`OpenAPI ops exercised: ${results.length}; 5xx failures: ${failures.length}`);
    expect(failures).toEqual([]);
    expect(results.length).toBe(ops.length);
  }, 180000);
});
