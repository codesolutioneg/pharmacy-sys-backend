import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { sub, toDecimal } from '../utils/money';
import { shopMonthRange } from '../utils/timezone';
import { buildExcelBuffer } from './excel-export.service';

type DateRange = { from?: Date; to?: Date };
type ResolvedRange = { from: Date; to: Date };

function decimalOrZero(value: { toString(): string } | null | undefined) {
  return toDecimal(value?.toString() ?? '0');
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function resolveShop(shopId: number) {
  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) {
    throw new AppError(404, 'SHOP_NOT_FOUND', 'Shop not found');
  }
  return shop;
}

/** `from > to` -> 400. Missing either bound -> default to the current calendar month
 * in the shop's timezone (reports.md acceptance criteria + edge cases). */
async function resolveRange(shopId: number, range: DateRange): Promise<ResolvedRange> {
  if (range.from && range.to && range.from.getTime() > range.to.getTime()) {
    throw new AppError(400, 'INVALID_DATE_RANGE', '`from` must be less than or equal to `to`');
  }
  if (range.from && range.to) {
    return { from: range.from, to: range.to };
  }
  const shop = await resolveShop(shopId);
  const monthRange = shopMonthRange(shop.timeZone);
  return {
    from: range.from ?? monthRange.from,
    to: range.to ?? monthRange.to,
  };
}

function generatedAtMeta() {
  return { generatedAt: new Date().toISOString() };
}

export const reportsService = {
  /** Point-in-time snapshot: customers with due > 0, sorted by due descending. Never mutates `due`. */
  async customerDues(shopId: number) {
    const customers = await prisma.customer.findMany({
      where: { shopId, due: { gt: 0 } },
      orderBy: [{ due: 'desc' }, { id: 'asc' }],
    });
    return {
      items: customers.map((c, index) => ({
        sn: index + 1,
        id: c.id,
        name: c.name,
        phone: c.phone,
        due: c.due.toFixed(2),
      })),
      meta: { ...generatedAtMeta(), total: customers.length },
    };
  },

  async customerDuesExport(shopId: number): Promise<Buffer> {
    const data = await this.customerDues(shopId);
    return buildExcelBuffer(
      'Customer Due Report',
      [
        { header: 'SN', key: 'sn', width: 6 },
        { header: 'Name', key: 'name', width: 28 },
        { header: 'Phone', key: 'phone', width: 18 },
        { header: 'Due', key: 'due', width: 14 },
      ],
      data.items,
    );
  },

  /** Point-in-time snapshot: suppliers with due > 0, sorted by due descending. */
  async supplierPayables(shopId: number) {
    const suppliers = await prisma.supplier.findMany({
      where: { shopId, due: { gt: 0 } },
      orderBy: [{ due: 'desc' }, { id: 'asc' }],
    });
    return {
      items: suppliers.map((s, index) => ({
        sn: index + 1,
        id: s.id,
        name: s.name,
        phone: s.phone,
        due: s.due.toFixed(2),
      })),
      meta: { ...generatedAtMeta(), total: suppliers.length },
    };
  },

  async supplierPayablesExport(shopId: number): Promise<Buffer> {
    const data = await this.supplierPayables(shopId);
    return buildExcelBuffer(
      'Supplier Payable Report',
      [
        { header: 'SN', key: 'sn', width: 6 },
        { header: 'Name', key: 'name', width: 28 },
        { header: 'Phone', key: 'phone', width: 18 },
        { header: 'Due', key: 'due', width: 14 },
      ],
      data.items,
    );
  },

  /** Totals of sales vs. purchases per day for the given (shop-scoped) date range. */
  async salePurchase(shopId: number, range: DateRange) {
    const { from, to } = await resolveRange(shopId, range);

    const [sales, purchases] = await Promise.all([
      prisma.invoice.groupBy({
        by: ['date'],
        where: { shopId, date: { gte: from, lte: to } },
        _sum: { totalPrice: true },
        _count: { _all: true },
      }),
      prisma.purchase.groupBy({
        by: ['date'],
        where: { shopId, date: { gte: from, lte: to } },
        _sum: { totalPrice: true },
        _count: { _all: true },
      }),
    ]);

    type Row = { date: string; salesCount: number; salesTotal: string; purchasesCount: number; purchasesTotal: string };
    const rowMap = new Map<string, Row>();
    const getRow = (dateKey: string): Row => {
      let row = rowMap.get(dateKey);
      if (!row) {
        row = { date: dateKey, salesCount: 0, salesTotal: '0.00', purchasesCount: 0, purchasesTotal: '0.00' };
        rowMap.set(dateKey, row);
      }
      return row;
    };

    for (const s of sales) {
      const row = getRow(isoDate(s.date));
      row.salesCount = s._count._all;
      row.salesTotal = decimalOrZero(s._sum.totalPrice).toFixed(2);
    }
    for (const p of purchases) {
      const row = getRow(isoDate(p.date));
      row.purchasesCount = p._count._all;
      row.purchasesTotal = decimalOrZero(p._sum.totalPrice).toFixed(2);
    }

    const rows = Array.from(rowMap.values()).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    const totals = rows.reduce(
      (acc, row) => ({
        salesCount: acc.salesCount + row.salesCount,
        salesTotal: acc.salesTotal.plus(row.salesTotal),
        purchasesCount: acc.purchasesCount + row.purchasesCount,
        purchasesTotal: acc.purchasesTotal.plus(row.purchasesTotal),
      }),
      { salesCount: 0, salesTotal: toDecimal(0), purchasesCount: 0, purchasesTotal: toDecimal(0) },
    );

    return {
      from: isoDate(from),
      to: isoDate(to),
      rows,
      totals: {
        salesCount: totals.salesCount,
        salesTotal: totals.salesTotal.toFixed(2),
        purchasesCount: totals.purchasesCount,
        purchasesTotal: totals.purchasesTotal.toFixed(2),
      },
      meta: generatedAtMeta(),
    };
  },

  async salePurchaseExport(shopId: number, range: DateRange): Promise<Buffer> {
    const data = await this.salePurchase(shopId, range);
    const rows = [
      ...data.rows,
      {
        date: 'Total',
        salesCount: data.totals.salesCount,
        salesTotal: data.totals.salesTotal,
        purchasesCount: data.totals.purchasesCount,
        purchasesTotal: data.totals.purchasesTotal,
      },
    ];
    return buildExcelBuffer(
      'Sales and Purchase Report',
      [
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Total Sale Invoice', key: 'salesCount', width: 18 },
        { header: 'Sales Amount', key: 'salesTotal', width: 16 },
        { header: 'Total Purchase Invoice', key: 'purchasesCount', width: 20 },
        { header: 'Purchase Amount', key: 'purchasesTotal', width: 16 },
      ],
      rows,
    );
  },

  /**
   * Revenue / cost-of-sales / net profit for the shop over the given range.
   *
   * DIVERGENCE (documented in docs/validation/BP7-validation.md): `accounting.md`'s Income
   * Statement (Σ balance for Revenue/Expense account types) is NOT shop-scoped in this schema
   * — `accounts`/`ledger_transactions` carry no `shop_id` (single global chart of accounts,
   * see BP6). Since reports.md/dashboard.md LOCK strict shop-scoping for every report
   * (docs/DECISIONS.md has no override here), profit-loss is instead computed directly from
   * the shop-scoped commerce tables using the same revenue-minus-cost formula shape:
   * revenue = Σ(invoices.total_price), costOfSales = Σ(purchases.total_price), net = revenue - cost.
   * This is "sales − purchases" per reports.md's own fallback wording, not an independently
   * invented calculation.
   */
  async profitLoss(shopId: number, range: DateRange) {
    const { from, to } = await resolveRange(shopId, range);

    const [salesAgg, purchasesAgg] = await Promise.all([
      prisma.invoice.aggregate({
        where: { shopId, date: { gte: from, lte: to } },
        _sum: { totalPrice: true },
      }),
      prisma.purchase.aggregate({
        where: { shopId, date: { gte: from, lte: to } },
        _sum: { totalPrice: true },
      }),
    ]);

    const revenue = decimalOrZero(salesAgg._sum.totalPrice);
    const costOfSales = decimalOrZero(purchasesAgg._sum.totalPrice);
    const netProfit = sub(revenue, costOfSales);

    return {
      from: isoDate(from),
      to: isoDate(to),
      revenue: revenue.toFixed(2),
      costOfSales: costOfSales.toFixed(2),
      netProfit: netProfit.toFixed(2),
      meta: generatedAtMeta(),
    };
  },

  async profitLossExport(shopId: number, range: DateRange): Promise<Buffer> {
    const data = await this.profitLoss(shopId, range);
    return buildExcelBuffer(
      'Profit and Loss Report',
      [
        { header: 'Period From', key: 'from', width: 14 },
        { header: 'Period To', key: 'to', width: 14 },
        { header: 'Revenue', key: 'revenue', width: 16 },
        { header: 'Cost of Sales', key: 'costOfSales', width: 16 },
        { header: 'Net Profit', key: 'netProfit', width: 16 },
      ],
      [data],
    );
  },
};
