/**
 * Closed-cycle E2E smoke: open session → cash sale → insurance sale → close.
 * Run: npx tsx scripts/e2e-sessions-insurance.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE = process.env.API_BASE ?? 'http://127.0.0.1:3000/api/v1';
const EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@pharmacy.local';
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345';

async function api(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json()) as { success?: boolean; data?: unknown; code?: string; message?: string };
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(json)}`);
  }
  return json.data as Record<string, unknown>;
}

async function main() {
  const login = await api('POST', '/auth/login', undefined, { email: EMAIL, password: PASSWORD });
  const token = login.accessToken as string;
  const user = login.user as { id: number };
  console.log('logged in as', user.id);

  await prisma.posSession.updateMany({
    where: { shopId: 1, userId: user.id, status: 'open' },
    data: { status: 'closed', closedAt: new Date() },
  });

  const session = await api('POST', '/pos/sessions/open', token, { openingFloat: 100 });
  console.log('session open', session.id);

  const methods = (await api('GET', '/payment-methods?limit=50', token)) as {
    items: Array<{ id: number; name: string; isInsurance?: boolean }>;
  };
  const cash = methods.items.find((m) => m.name.toLowerCase() === 'cash');
  if (!cash) throw new Error('Cash method missing');

  let insurance = methods.items.find((m) => m.isInsurance);
  if (!insurance) {
    insurance = (await api('POST', '/payment-methods', token, {
      name: `Insurance ${Date.now()}`,
      isInsurance: true,
    })) as { id: number; name: string; isInsurance?: boolean };
  }

  const company = await api('POST', '/insurance-companies', token, {
    name: `E2E Co ${Date.now()}`,
    defaultDiscountPercent: 50,
  });

  const meds = (await api('GET', '/medicines?limit=1', token)) as {
    items: Array<{ id: number }>;
  };
  const medicineId = meds.items[0]?.id;
  if (!medicineId) throw new Error('No medicines');

  // Cash sale
  const cart1 = await api('POST', '/pos/carts', token, {});
  await api('POST', `/pos/carts/${cart1.id}/items`, token, { medicineId });
  const view1 = await api('GET', `/pos/carts/${cart1.id}`, token);
  await api('PATCH', `/pos/carts/${cart1.id}`, token, {
    paymentMethodId: cash.id,
    paidAmount: Number(view1.grandTotal),
  });
  const inv1 = await api('POST', '/pos/checkout', token, { cartId: cart1.id });
  console.log('cash invoice', inv1.invId ?? inv1.id);

  // Insurance sale
  const customers = (await api('GET', '/customers?limit=1', token)) as {
    items: Array<{ id: number }>;
  };
  const cart2 = await api('POST', '/pos/carts', token, {});
  await api('POST', `/pos/carts/${cart2.id}/items`, token, { medicineId });
  const view2 = await api('GET', `/pos/carts/${cart2.id}`, token);
  const grand = Number(view2.grandTotal);
  const patientAmount = Number((grand * 0.5).toFixed(2));
  await api('PATCH', `/pos/carts/${cart2.id}`, token, {
    customerId: customers.items[0].id,
    paymentMethodId: insurance.id,
    insuranceCompanyId: company.id,
    insurancePercent: 50,
    patientMethodId: cash.id,
    paidAmount: patientAmount,
  });
  const inv2 = await api('POST', '/pos/checkout', token, { cartId: cart2.id });
  console.log('insurance invoice', inv2.invId ?? inv2.id);

  const current = await api('GET', '/pos/sessions/current', token);
  const expected = Number((current as { expectedCash?: string }).expectedCash ?? 0);
  const closed = await api('POST', `/pos/sessions/${session.id}/close`, token, {
    countedCash: expected,
  });
  console.log('closed', closed.status, 'diff', closed.difference);
  console.log('E2E OK');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
