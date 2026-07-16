import { prisma } from '../lib/prisma';
import { add, sub, toDecimal } from '../utils/money';

/**
 * Node uses CONVENTIONAL accounting (docs/DECISIONS.md "Accounting" + specs/accounting.md
 * ⚠️ ASSUMPTION/CONFLICT + ❓ NEEDS HUMAN INPUT). Laravel's `credit − debit` for every account
 * type (including debit-normal assets/expenses) is a documented bug and is intentionally NOT
 * reproduced here. See docs/validation/BP6-validation.md for the full rationale.
 */
const DEBIT_NORMAL_TYPES = new Set(['Asset', 'Expense', 'Withdrawal']);

type DateRange = { dateFrom?: Date; dateTo?: Date };

function dateWhere(range: DateRange) {
  if (!range.dateFrom && !range.dateTo) {
    return {};
  }
  return {
    date: {
      ...(range.dateFrom ? { gte: range.dateFrom } : {}),
      ...(range.dateTo ? { lte: range.dateTo } : {}),
    },
  };
}

export const accountingReportsService = {
  /** Per account: Σ debits, Σ credits (accounting.md acceptance criteria). */
  async trialBalance(range: DateRange = {}) {
    const accounts = await prisma.account.findMany({
      include: { accountType: true },
      orderBy: [{ serial: 'asc' }, { id: 'asc' }],
    });
    const where = dateWhere(range);

    const rows = await Promise.all(
      accounts.map(async (account) => {
        const [debitAgg, creditAgg] = await Promise.all([
          prisma.ledgerTransaction.aggregate({
            where: { debitAccountId: account.id, ...where },
            _sum: { amount: true },
          }),
          prisma.ledgerTransaction.aggregate({
            where: { creditAccountId: account.id, ...where },
            _sum: { amount: true },
          }),
        ]);
        const debit = toDecimal(debitAgg._sum.amount?.toString() ?? '0');
        const credit = toDecimal(creditAgg._sum.amount?.toString() ?? '0');
        return {
          accountId: account.id,
          accountName: account.name,
          accountTypeId: account.accountTypeId,
          accountTypeName: account.accountType.name,
          debit: debit.toFixed(2),
          credit: credit.toFixed(2),
        };
      }),
    );

    const totals = rows.reduce(
      (acc, r) => ({
        totalDebit: add(acc.totalDebit, r.debit),
        totalCredit: add(acc.totalCredit, r.credit),
      }),
      { totalDebit: toDecimal(0), totalCredit: toDecimal(0) },
    );

    return {
      rows,
      totals: { totalDebit: totals.totalDebit.toFixed(2), totalCredit: totals.totalCredit.toFixed(2) },
    };
  },

  /** Conventional balances (debit-normal vs credit-normal), bucketed by account type, with subtotals. */
  async balanceSheet(range: DateRange = {}) {
    const trial = await this.trialBalance(range);

    const bucketsByType = new Map<
      number,
      {
        accountTypeId: number;
        accountTypeName: string;
        normalSide: 'debit' | 'credit';
        accounts: Array<{ accountId: number; accountName: string; debit: string; credit: string; balance: string }>;
        subtotal: string;
      }
    >();

    for (const row of trial.rows) {
      const normalSide: 'debit' | 'credit' = DEBIT_NORMAL_TYPES.has(row.accountTypeName)
        ? 'debit'
        : 'credit';
      const balance =
        normalSide === 'debit' ? sub(row.debit, row.credit) : sub(row.credit, row.debit);

      let bucket = bucketsByType.get(row.accountTypeId);
      if (!bucket) {
        bucket = {
          accountTypeId: row.accountTypeId,
          accountTypeName: row.accountTypeName,
          normalSide,
          accounts: [],
          subtotal: '0.00',
        };
        bucketsByType.set(row.accountTypeId, bucket);
      }
      bucket.accounts.push({
        accountId: row.accountId,
        accountName: row.accountName,
        debit: row.debit,
        credit: row.credit,
        balance: balance.toFixed(2),
      });
      bucket.subtotal = add(bucket.subtotal, balance).toFixed(2);
    }

    const types = Array.from(bucketsByType.values());
    const totalAssets = types
      .filter((t) => t.accountTypeName === 'Asset')
      .reduce((acc, t) => add(acc, t.subtotal), toDecimal(0));
    const totalLiabilities = types
      .filter((t) => t.accountTypeName === 'Liability')
      .reduce((acc, t) => add(acc, t.subtotal), toDecimal(0));
    const totalEquity = types
      .filter((t) => t.accountTypeName === 'Equity')
      .reduce((acc, t) => add(acc, t.subtotal), toDecimal(0));

    return {
      types,
      totals: {
        totalAssets: totalAssets.toFixed(2),
        totalLiabilities: totalLiabilities.toFixed(2),
        totalEquity: totalEquity.toFixed(2),
        totalLiabilitiesAndEquity: add(totalLiabilities, totalEquity).toFixed(2),
      },
    };
  },

  /** revenue = Σ(balance) for Revenue accounts; expense = Σ(balance) for Expense accounts; net = revenue - expense. */
  async incomeStatement(range: DateRange = {}) {
    const balanceSheet = await this.balanceSheet(range);

    const revenueBucket = balanceSheet.types.find((t) => t.accountTypeName === 'Revenue');
    const expenseBucket = balanceSheet.types.find((t) => t.accountTypeName === 'Expense');

    const revenue = toDecimal(revenueBucket?.subtotal ?? '0');
    const expense = toDecimal(expenseBucket?.subtotal ?? '0');
    const net = sub(revenue, expense);

    return {
      revenueAccounts: revenueBucket?.accounts ?? [],
      expenseAccounts: expenseBucket?.accounts ?? [],
      revenue: revenue.toFixed(2),
      expense: expense.toFixed(2),
      net: net.toFixed(2),
    };
  },
};
