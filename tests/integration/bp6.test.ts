import request from 'supertest';
import { createApp } from '../../src/app';
import { config } from '../../src/config';
import { prisma } from '../../src/lib/prisma';

const app = createApp();

describe('BP6 integration', () => {
  let accessToken = '';

  beforeAll(async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: config.seed.adminEmail,
      password: config.seed.adminPassword,
    });
    expect(res.status).toBe(200);
    accessToken = res.body.data.accessToken as string;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function auth() {
    return { Authorization: `Bearer ${accessToken}` };
  }

  function unique(prefix: string) {
    return `${prefix} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  async function createCategory(namePrefix: string) {
    const res = await request(app)
      .post('/api/v1/expense-categories')
      .set(auth())
      .send({ name: unique(namePrefix), description: 'Test category', status: 'active' });
    expect(res.status).toBe(201);
    return res.body.data as { id: number; name: string };
  }

  async function createAccountType(namePrefix: string) {
    const res = await request(app)
      .post('/api/v1/account-types')
      .set(auth())
      .send({ name: unique(namePrefix) });
    expect(res.status).toBe(201);
    return res.body.data as { id: number; name: string; isDeletable: boolean };
  }

  async function createAccount(namePrefix: string, accountTypeId: number) {
    const res = await request(app)
      .post('/api/v1/accounts')
      .set(auth())
      .send({ name: unique(namePrefix), accountTypeId });
    expect(res.status).toBe(201);
    return res.body.data as { id: number; name: string; accountTypeId: number; isDeletable: boolean };
  }

  async function postManualJe(debitAccountId: number, creditAccountId: number, amount: number, particular: string) {
    const res = await request(app)
      .post('/api/v1/ledger-transactions')
      .set(auth())
      .send({ debitAccountId, creditAccountId, amount, particular });
    expect(res.status).toBe(201);
    return res.body.data;
  }

  async function findAccountTypeByName(name: string) {
    const res = await request(app)
      .get('/api/v1/account-types')
      .query({ limit: 100 })
      .set(auth());
    expect(res.status).toBe(200);
    const type = res.body.data.items.find((t: { name: string }) => t.name === name);
    expect(type).toBeDefined();
    return type as { id: number; name: string };
  }

  describe('Expense Categories & Expenses', () => {
    let categoryId: number;
    let accountId: number;
    let expenseId: number;

    it('creates an expense category', async () => {
      const category = await createCategory('ExpCat');
      categoryId = category.id;
      expect(category.id).toBeGreaterThan(0);
    });

    it('rejects a duplicate expense category name with 409', async () => {
      const name = unique('DupExpCat');
      const first = await request(app)
        .post('/api/v1/expense-categories')
        .set(auth())
        .send({ name });
      expect(first.status).toBe(201);
      const dup = await request(app)
        .post('/api/v1/expense-categories')
        .set(auth())
        .send({ name });
      expect(dup.status).toBe(409);
    });

    it('creates an expense and posts a ledger entry: debit accountId, credit Accounts Payable (3)', async () => {
      const accType = await createAccountType('ExpenseAcctType');
      const account = await createAccount('ExpenseAcct', accType.id);
      accountId = account.id;

      const res = await request(app)
        .post('/api/v1/expenses')
        .set(auth())
        .send({
          date: '2026-01-15',
          title: 'Office supplies',
          categoryId,
          accountId,
          amount: 125.5,
          reference: 'REF-001',
          note: 'Stationery restock',
        });
      expect(res.status).toBe(201);
      expenseId = res.body.data.id;
      expect(Number(res.body.data.amount)).toBeCloseTo(125.5, 2);
      expect(res.body.data.accountId).toBe(accountId);

      const ledgerEntry = await prisma.ledgerTransaction.findFirst({
        where: { invoiceId: `EXP-${expenseId}`, invoiceType: 'expense' },
        orderBy: { id: 'asc' },
      });
      expect(ledgerEntry).not.toBeNull();
      expect(ledgerEntry!.debitAccountId).toBe(accountId);
      expect(ledgerEntry!.creditAccountId).toBe(3);
      expect(Number(ledgerEntry!.amount)).toBeCloseTo(125.5, 2);
    });

    it('rejects creating an expense without accountId (400)', async () => {
      const res = await request(app)
        .post('/api/v1/expenses')
        .set(auth())
        .send({ date: '2026-01-01', title: 'No account expense', categoryId, amount: 10 });
      expect(res.status).toBe(400);
    });

    it('rejects creating an expense with a non-positive amount (400)', async () => {
      const res = await request(app)
        .post('/api/v1/expenses')
        .set(auth())
        .send({ date: '2026-01-01', title: 'Bad amount', categoryId, accountId, amount: 0 });
      expect(res.status).toBe(400);
    });

    it("updates an expense's amount — ledger reflects the new amount; old entry is reversed", async () => {
      const patchRes = await request(app)
        .patch(`/api/v1/expenses/${expenseId}`)
        .set(auth())
        .send({ amount: 200 });
      expect(patchRes.status).toBe(200);
      expect(Number(patchRes.body.data.amount)).toBeCloseTo(200, 2);

      const entries = await prisma.ledgerTransaction.findMany({
        where: { invoiceId: `EXP-${expenseId}`, invoiceType: 'expense' },
        orderBy: { id: 'asc' },
      });
      // [0] original create, [1] reversal of original, [2] repost at new amount
      expect(entries).toHaveLength(3);
      expect(entries[0].debitAccountId).toBe(accountId);
      expect(entries[0].creditAccountId).toBe(3);
      expect(Number(entries[0].amount)).toBeCloseTo(125.5, 2);

      expect(entries[1].debitAccountId).toBe(3);
      expect(entries[1].creditAccountId).toBe(accountId);
      expect(Number(entries[1].amount)).toBeCloseTo(125.5, 2);

      expect(entries[2].debitAccountId).toBe(accountId);
      expect(entries[2].creditAccountId).toBe(3);
      expect(Number(entries[2].amount)).toBeCloseTo(200, 2);
    });

    it('does not touch the ledger when an unrelated field (note) changes', async () => {
      const patchRes = await request(app)
        .patch(`/api/v1/expenses/${expenseId}`)
        .set(auth())
        .send({ note: 'Updated note only' });
      expect(patchRes.status).toBe(200);

      const count = await prisma.ledgerTransaction.count({
        where: { invoiceId: `EXP-${expenseId}`, invoiceType: 'expense' },
      });
      expect(count).toBe(3);
    });

    it('deletes an expense — its ledger entry is reversed, not left dangling', async () => {
      const delRes = await request(app).delete(`/api/v1/expenses/${expenseId}`).set(auth());
      expect(delRes.status).toBe(200);

      const afterDelete = await request(app).get(`/api/v1/expenses/${expenseId}`).set(auth());
      expect(afterDelete.status).toBe(404);

      const entries = await prisma.ledgerTransaction.findMany({
        where: { invoiceId: `EXP-${expenseId}`, invoiceType: 'expense' },
        orderBy: { id: 'asc' },
      });
      expect(entries).toHaveLength(4);
      const last = entries[3];
      expect(last.debitAccountId).toBe(3);
      expect(last.creditAccountId).toBe(accountId);
      expect(Number(last.amount)).toBeCloseTo(200, 2);
    });

    it('filters /expenses by categoryId and date range', async () => {
      const category = await createCategory('FilterCat');
      const accType = await createAccountType('FilterAcctType');
      const account = await createAccount('FilterAcct', accType.id);

      const inRange = await request(app)
        .post('/api/v1/expenses')
        .set(auth())
        .send({
          date: '2026-03-10',
          title: 'In range expense',
          categoryId: category.id,
          accountId: account.id,
          amount: 50,
        });
      expect(inRange.status).toBe(201);

      const outOfRange = await request(app)
        .post('/api/v1/expenses')
        .set(auth())
        .send({
          date: '2024-01-01',
          title: 'Out of range expense',
          categoryId: category.id,
          accountId: account.id,
          amount: 60,
        });
      expect(outOfRange.status).toBe(201);

      const otherCategory = await createCategory('OtherFilterCat');
      const otherCategoryExpense = await request(app)
        .post('/api/v1/expenses')
        .set(auth())
        .send({
          date: '2026-03-11',
          title: 'Other category expense',
          categoryId: otherCategory.id,
          accountId: account.id,
          amount: 70,
        });
      expect(otherCategoryExpense.status).toBe(201);

      const list = await request(app)
        .get('/api/v1/expenses')
        .query({ categoryId: category.id, dateFrom: '2026-01-01', dateTo: '2026-12-31' })
        .set(auth());
      expect(list.status).toBe(200);
      const ids = list.body.data.items.map((e: { id: number }) => e.id);
      expect(ids).toContain(inRange.body.data.id);
      expect(ids).not.toContain(outOfRange.body.data.id);
      expect(ids).not.toContain(otherCategoryExpense.body.data.id);
    });

    it('rejects deleting an expense category that still has expenses (409)', async () => {
      const category = await createCategory('LockedCat');
      const accType = await createAccountType('LockedAcctType');
      const account = await createAccount('LockedAcct', accType.id);

      const expense = await request(app)
        .post('/api/v1/expenses')
        .set(auth())
        .send({
          date: '2026-01-01',
          title: 'Locked expense',
          categoryId: category.id,
          accountId: account.id,
          amount: 20,
        });
      expect(expense.status).toBe(201);

      const del = await request(app)
        .delete(`/api/v1/expense-categories/${category.id}`)
        .set(auth());
      expect(del.status).toBe(409);
    });
  });

  describe('Account Types & Accounts CRUD', () => {
    it('creates, lists, gets, and updates an account type', async () => {
      const type = await createAccountType('CrudType');

      const list = await request(app).get('/api/v1/account-types').query({ limit: 100 }).set(auth());
      expect(list.status).toBe(200);
      expect(list.body.data.items.some((t: { id: number }) => t.id === type.id)).toBe(true);

      const get = await request(app).get(`/api/v1/account-types/${type.id}`).set(auth());
      expect(get.status).toBe(200);

      const patch = await request(app)
        .patch(`/api/v1/account-types/${type.id}`)
        .set(auth())
        .send({ serial: 99 });
      expect(patch.status).toBe(200);
      expect(patch.body.data.serial).toBe(99);
    });

    it('creates, lists, gets, updates, and deletes an account', async () => {
      const type = await createAccountType('AcctCrudType');
      const account = await createAccount('AcctCrud', type.id);

      const list = await request(app).get('/api/v1/accounts').query({ limit: 100 }).set(auth());
      expect(list.status).toBe(200);
      expect(Array.isArray(list.body.data.items)).toBe(true);

      const get = await request(app).get(`/api/v1/accounts/${account.id}`).set(auth());
      expect(get.status).toBe(200);
      expect(get.body.data.accountType.id).toBe(type.id);

      const patch = await request(app)
        .patch(`/api/v1/accounts/${account.id}`)
        .set(auth())
        .send({ status: 'inactive' });
      expect(patch.status).toBe(200);
      expect(patch.body.data.status).toBe('inactive');

      const del = await request(app).delete(`/api/v1/accounts/${account.id}`).set(auth());
      expect(del.status).toBe(200);

      const afterDelete = await request(app).get(`/api/v1/accounts/${account.id}`).set(auth());
      expect(afterDelete.status).toBe(404);
    });

    it('rejects deleting a non-deletable seeded account (id 1-4) with 409', async () => {
      const res = await request(app).delete('/api/v1/accounts/3').set(auth());
      expect(res.status).toBe(409);
    });

    it('rejects deleting a non-deletable seeded account type with 409', async () => {
      const type = await findAccountTypeByName('Asset');
      const res = await request(app).delete(`/api/v1/account-types/${type.id}`).set(auth());
      expect(res.status).toBe(409);
    });

    it('rejects deleting an account referenced by ledger transactions with 409', async () => {
      const type = await createAccountType('RefdType');
      const account = await createAccount('RefdAcct', type.id);
      await postManualJe(account.id, 3, 15, 'Reference-creating JE');

      const res = await request(app).delete(`/api/v1/accounts/${account.id}`).set(auth());
      expect(res.status).toBe(409);
    });
  });

  describe('Manual ledger transactions', () => {
    let acctA: { id: number };
    let acctB: { id: number };

    beforeAll(async () => {
      const typeA = await createAccountType('ManualTypeA');
      const typeB = await createAccountType('ManualTypeB');
      acctA = await createAccount('ManualAcctA', typeA.id);
      acctB = await createAccount('ManualAcctB', typeB.id);
    });

    it('creates a manual journal entry with different debit/credit accounts', async () => {
      const entry = await postManualJe(acctA.id, acctB.id, 75.25, 'Manual test JE');
      expect(entry.debitAccountId).toBe(acctA.id);
      expect(entry.creditAccountId).toBe(acctB.id);
      expect(Number(entry.amount)).toBeCloseTo(75.25, 2);
      expect(entry.invoiceType).toBe('manual');
    });

    it('rejects a manual JE where debitAccountId == creditAccountId (400)', async () => {
      const res = await request(app)
        .post('/api/v1/ledger-transactions')
        .set(auth())
        .send({ debitAccountId: acctA.id, creditAccountId: acctA.id, amount: 10, particular: 'Invalid JE' });
      expect(res.status).toBe(400);
    });

    it('rejects a manual JE with a non-positive amount (400)', async () => {
      const res = await request(app)
        .post('/api/v1/ledger-transactions')
        .set(auth())
        .send({ debitAccountId: acctA.id, creditAccountId: acctB.id, amount: 0, particular: 'Zero amount' });
      expect(res.status).toBe(400);
    });

    it('rejects a manual JE referencing a non-existent account (400)', async () => {
      const res = await request(app)
        .post('/api/v1/ledger-transactions')
        .set(auth())
        .send({ debitAccountId: acctA.id, creditAccountId: 999999, amount: 10, particular: 'Bad account' });
      expect(res.status).toBe(400);
    });

    it('lists ledger transactions filtered by accountId and invoiceType', async () => {
      const list = await request(app)
        .get('/api/v1/ledger-transactions')
        .query({ accountId: acctA.id, invoiceType: 'manual' })
        .set(auth());
      expect(list.status).toBe(200);
      expect(list.body.data.items.length).toBeGreaterThan(0);
      expect(
        list.body.data.items.every((e: { invoiceType: string }) => e.invoiceType === 'manual'),
      ).toBe(true);
    });
  });

  describe('Accounting reports', () => {
    it('trial balance: per account Σ debit, Σ credit matches fixture postings', async () => {
      const typeA = await createAccountType('TBTypeA');
      const typeB = await createAccountType('TBTypeB');
      const acctA = await createAccount('TBAcctA', typeA.id);
      const acctB = await createAccount('TBAcctB', typeB.id);

      await postManualJe(acctA.id, acctB.id, 300, 'TB fixture 1');
      await postManualJe(acctB.id, acctA.id, 50, 'TB fixture 2');

      const res = await request(app).get('/api/v1/reports/accounting/trial-balance').set(auth());
      expect(res.status).toBe(200);
      const rowA = res.body.data.rows.find((r: { accountId: number }) => r.accountId === acctA.id);
      const rowB = res.body.data.rows.find((r: { accountId: number }) => r.accountId === acctB.id);
      expect(Number(rowA.debit)).toBeCloseTo(300, 2);
      expect(Number(rowA.credit)).toBeCloseTo(50, 2);
      expect(Number(rowB.debit)).toBeCloseTo(50, 2);
      expect(Number(rowB.credit)).toBeCloseTo(300, 2);
    });

    it('balance sheet: uses CONVENTIONAL debit-normal balance for Asset accounts (not Laravel credit-debit)', async () => {
      const assetType = await findAccountTypeByName('Asset');
      const account = await createAccount('BSAssetAcct', assetType.id);

      await postManualJe(account.id, 3, 400, 'BS fixture debit');
      await postManualJe(3, account.id, 150, 'BS fixture credit');

      const res = await request(app).get('/api/v1/reports/accounting/balance-sheet').set(auth());
      expect(res.status).toBe(200);
      const assetBucket = res.body.data.types.find(
        (t: { accountTypeName: string }) => t.accountTypeName === 'Asset',
      );
      expect(assetBucket.normalSide).toBe('debit');
      const row = assetBucket.accounts.find((a: { accountId: number }) => a.accountId === account.id);
      // Conventional: balance = debit - credit = 400 - 150 = 250 (Laravel's buggy formula
      // would have produced credit - debit = -250).
      expect(Number(row.balance)).toBeCloseTo(250, 2);
    });

    it('income statement: revenue/expense/net computed from fixture accounts', async () => {
      const revenueType = await findAccountTypeByName('Revenue');
      const expenseType = await findAccountTypeByName('Expense');
      const revenueAcct = await createAccount('ISRevenueAcct', revenueType.id);
      const expenseAcct = await createAccount('ISExpenseAcct', expenseType.id);

      await postManualJe(3, revenueAcct.id, 500, 'IS fixture revenue');
      await postManualJe(expenseAcct.id, 3, 200, 'IS fixture expense');

      const res = await request(app).get('/api/v1/reports/accounting/income-statement').set(auth());
      expect(res.status).toBe(200);
      const revRow = res.body.data.revenueAccounts.find(
        (a: { accountId: number }) => a.accountId === revenueAcct.id,
      );
      const expRow = res.body.data.expenseAccounts.find(
        (a: { accountId: number }) => a.accountId === expenseAcct.id,
      );
      expect(Number(revRow.balance)).toBeCloseTo(500, 2);
      expect(Number(expRow.balance)).toBeCloseTo(200, 2);
      expect(Number(res.body.data.net)).toBeCloseTo(
        Number(res.body.data.revenue) - Number(res.body.data.expense),
        2,
      );
    });
  });
});
