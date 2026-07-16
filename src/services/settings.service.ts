import { Prisma, TaxMode } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';

function mapShop(shop: {
  id: number;
  name: string;
  nameAr: string | null;
  siteTitle: string | null;
  siteLogo: string | null;
  favicon: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  currency: string;
  currencySymbol: string | null;
  timeZone: string;
  locale: string;
  prefix: string | null;
  invoiceNumberFormat: string;
  taxMode: TaxMode;
  taxRatePercent: Prisma.Decimal;
  lowStockAlert: number;
  upcomingExpireAlert: number;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpPass: string | null;
  smtpSecure: boolean;
  smtpFrom: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: shop.id,
    name: shop.name,
    nameAr: shop.nameAr,
    siteTitle: shop.siteTitle,
    siteLogo: shop.siteLogo,
    favicon: shop.favicon,
    address: shop.address,
    phone: shop.phone,
    email: shop.email,
    currency: shop.currency,
    currencySymbol: shop.currencySymbol,
    timeZone: shop.timeZone,
    locale: shop.locale,
    prefix: shop.prefix,
    invoiceNumberFormat: shop.invoiceNumberFormat,
    tax: {
      mode: shop.taxMode,
      ratePercent: shop.taxRatePercent.toFixed(2),
    },
    lowStockAlert: shop.lowStockAlert,
    upcomingExpireAlert: shop.upcomingExpireAlert,
    createdAt: shop.createdAt,
    updatedAt: shop.updatedAt,
  };
}

function mapEmailSettings(shop: {
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpPass: string | null;
  smtpSecure: boolean;
  smtpFrom: string | null;
}) {
  return {
    smtpHost: shop.smtpHost,
    smtpPort: shop.smtpPort,
    smtpUser: shop.smtpUser,
    smtpPass: shop.smtpPass ? '********' : null,
    smtpSecure: shop.smtpSecure,
    smtpFrom: shop.smtpFrom,
  };
}

export const settingsService = {
  async getShop(shopId: number) {
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) {
      throw new AppError(404, 'SHOP_NOT_FOUND', 'Shop not found');
    }
    return mapShop(shop);
  },

  async getGeneral(shopId: number) {
    return this.getShop(shopId);
  },

  async patchGeneral(
    shopId: number,
    data: {
      name?: string;
      nameAr?: string | null;
      siteTitle?: string | null;
      siteLogo?: string | null;
      address?: string | null;
      phone?: string | null;
      email?: string | null;
      currency?: string;
      currencySymbol?: string | null;
      timeZone?: string;
      locale?: string;
      prefix?: string;
      invoiceNumberFormat?: string;
      taxMode?: TaxMode;
      taxRatePercent?: number;
      lowStockAlert?: number;
      upcomingExpireAlert?: number;
    },
  ) {
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) {
      throw new AppError(404, 'SHOP_NOT_FOUND', 'Shop not found');
    }

    const updated = await prisma.shop.update({
      where: { id: shopId },
      data: {
        name: data.name,
        nameAr: data.nameAr,
        siteTitle: data.siteTitle,
        siteLogo: data.siteLogo,
        address: data.address,
        phone: data.phone,
        email: data.email,
        currency: data.currency,
        currencySymbol: data.currencySymbol,
        timeZone: data.timeZone,
        locale: data.locale,
        prefix: data.prefix,
        invoiceNumberFormat: data.invoiceNumberFormat,
        taxMode: data.taxMode,
        taxRatePercent:
          data.taxRatePercent !== undefined
            ? new Prisma.Decimal(data.taxRatePercent.toFixed(2))
            : undefined,
        lowStockAlert: data.lowStockAlert,
        upcomingExpireAlert: data.upcomingExpireAlert,
      },
    });
    return mapShop(updated);
  },

  async getEmail(shopId: number) {
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) {
      throw new AppError(404, 'SHOP_NOT_FOUND', 'Shop not found');
    }
    return mapEmailSettings(shop);
  },

  async patchEmail(
    shopId: number,
    data: {
      smtpHost?: string | null;
      smtpPort?: number | null;
      smtpUser?: string | null;
      smtpPass?: string | null;
      smtpSecure?: boolean;
      smtpFrom?: string | null;
    },
  ) {
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) {
      throw new AppError(404, 'SHOP_NOT_FOUND', 'Shop not found');
    }
    const updated = await prisma.shop.update({
      where: { id: shopId },
      data,
    });
    return mapEmailSettings(updated);
  },

  async getKv(shopId: number, name?: string) {
    if (name) {
      const row = await prisma.setting.findUnique({
        where: { shopId_name: { shopId, name } },
      });
      return row ? { name: row.name, value: row.value } : null;
    }
    const rows = await prisma.setting.findMany({ where: { shopId } });
    return rows.map((r) => ({ name: r.name, value: r.value }));
  },

  async upsertKv(shopId: number, name: string, value: string | null) {
    const row = await prisma.setting.upsert({
      where: { shopId_name: { shopId, name } },
      create: { shopId, name, value },
      update: { value },
    });
    return { name: row.name, value: row.value };
  },
};
