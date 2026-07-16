import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { toDecimal } from '../utils/money';
import { shopMonthRange, shopToday } from '../utils/timezone';
import { stockService } from './stock.service';

function decimalOrZero(value: { toString(): string } | null | undefined) {
  return toDecimal(value?.toString() ?? '0');
}

export const dashboardService = {
  /**
   * Auth-only, strictly shop-scoped summary (dashboard.md). `shopId` is always resolved
   * server-side from the JWT — never client-supplied (closes Laravel F19's scoping gap).
   * Stock alert counts delegate to `stockService` — the single threshold source of truth
   * shared with reports.md/stock.md (shops.low_stock_alert / shops.upcoming_expire_alert).
   */
  async summary(shopId: number) {
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) {
      throw new AppError(404, 'SHOP_NOT_FOUND', 'Shop not found');
    }

    const today = shopToday(shop.timeZone);
    const { from: monthStart, to: monthEnd } = shopMonthRange(shop.timeZone);

    const [
      salesTodayAgg,
      salesMonthAgg,
      lowStockRows,
      expiringRows,
      expiredRows,
      customerDueAgg,
      supplierDueAgg,
    ] = await Promise.all([
      prisma.invoice.aggregate({ where: { shopId, date: today }, _sum: { totalPrice: true } }),
      prisma.invoice.aggregate({
        where: { shopId, date: { gte: monthStart, lte: monthEnd } },
        _sum: { totalPrice: true },
      }),
      stockService.lowStock(shopId),
      stockService.expiring(shopId),
      stockService.expired(shopId),
      prisma.customer.aggregate({ where: { shopId }, _sum: { due: true } }),
      prisma.supplier.aggregate({ where: { shopId }, _sum: { due: true } }),
    ]);

    return {
      salesToday: decimalOrZero(salesTodayAgg._sum.totalPrice).toFixed(2),
      salesThisMonth: decimalOrZero(salesMonthAgg._sum.totalPrice).toFixed(2),
      lowStockCount: lowStockRows.length,
      expiringCount: expiringRows.length,
      expiredCount: expiredRows.length,
      customerDueTotal: decimalOrZero(customerDueAgg._sum.due).toFixed(2),
      supplierDueTotal: decimalOrZero(supplierDueAgg._sum.due).toFixed(2),
    };
  },
};
