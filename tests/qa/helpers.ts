import path from 'path';
import request from 'supertest';
import { createApp } from '../../src/app';
import { config } from '../../src/config';
import { prisma } from '../../src/lib/prisma';

const app = createApp();

export function getApp() {
  return app;
}

export async function login(email: string, password: string) {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`Login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return {
    accessToken: res.body.data.accessToken as string,
    refreshToken: res.body.data.refreshToken as string,
    user: res.body.data.user as { id: number; shopId: number; email: string; permissions: string[] },
  };
}

export async function adminLogin() {
  return login(config.seed.adminEmail, config.seed.adminPassword);
}

export async function qaLogin(role: 'owner' | 'manager' | 'pharmacist' | 'cashier' | 'storekeeper') {
  const map = {
    owner: 'owner@alnoor.eg',
    manager: 'manager@alnoor.eg',
    pharmacist: 'pharmacist@alnoor.eg',
    cashier: 'cashier@alnoor.eg',
    storekeeper: 'storekeeper@alnoor.eg',
  } as const;
  return login(map[role], process.env.QA_PASSWORD || 'Pharmacy@123');
}

export function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function loadFixtures() {
  const shopId = 1;
  const [medicine, customer, supplier, method, invoice, purchase, batch, vendor, expense, category] =
    await Promise.all([
      prisma.medicine.findFirst({ where: { shopId }, orderBy: { id: 'asc' } }),
      prisma.customer.findFirst({ where: { shopId }, orderBy: { id: 'asc' } }),
      prisma.supplier.findFirst({ where: { shopId }, orderBy: { id: 'asc' } }),
      prisma.paymentMethod.findFirst({ where: { shopId, name: 'Cash' } }),
      prisma.invoice.findFirst({ where: { shopId }, orderBy: { id: 'desc' } }),
      prisma.purchase.findFirst({ where: { shopId }, orderBy: { id: 'desc' } }),
      prisma.batch.findFirst({ where: { shopId, qty: { gt: 0 } }, orderBy: { id: 'asc' } }),
      prisma.vendor.findFirst({ where: { shopId }, orderBy: { id: 'asc' } }),
      prisma.pharmacyExpense.findFirst({ where: { shopId }, orderBy: { id: 'asc' } }),
      prisma.expenseCategory.findFirst({ where: { shopId }, orderBy: { id: 'asc' } }),
    ]);
  return {
    shopId,
    medicine,
    customer,
    supplier,
    method,
    invoice,
    purchase,
    batch,
    vendor,
    expense,
    category,
  };
}

export function openApiPath(): string {
  return path.join(__dirname, '../../openapi/openapi.yaml');
}

export { prisma, request, config };
