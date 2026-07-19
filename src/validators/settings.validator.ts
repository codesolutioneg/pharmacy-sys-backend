import { TaxMode } from '@prisma/client';
import { z } from 'zod';
import { config } from '../config';

const currencyEnum = z.enum(
  config.market.supportedCurrencies as [string, ...string[]],
);
const timezoneEnum = z.enum(
  config.market.supportedTimezones as [string, ...string[]],
);
const localeEnum = z.enum(
  config.market.supportedLocales as [string, ...string[]],
);

export const patchGeneralSettingsSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    nameAr: z.string().min(1).max(255).nullable().optional(),
    siteTitle: z.string().max(255).nullable().optional(),
    siteLogo: z.string().max(500).nullable().optional(),
    address: z.string().nullable().optional(),
    phone: z.string().max(50).nullable().optional(),
    email: z.string().email().nullable().optional(),
    currency: currencyEnum.optional(),
    currencySymbol: z.string().max(16).nullable().optional(),
    timeZone: timezoneEnum.optional(),
    locale: localeEnum.optional(),
    prefix: z
      .string()
      .min(1)
      .max(20)
      .regex(/^[A-Za-z0-9_-]+$/, 'Prefix must be alphanumeric')
      .optional(),
    invoiceNumberFormat: z.string().min(1).max(100).optional(),
    taxMode: z.nativeEnum(TaxMode).optional(),
    taxRatePercent: z.coerce.number().min(0).max(100).optional(),
    lowStockAlert: z.coerce.number().int().min(0).optional(),
    upcomingExpireAlert: z.coerce.number().int().min(0).optional(),
  })
  .strict();

export const patchEmailSettingsSchema = z
  .object({
    smtpHost: z.string().max(255).nullable().optional(),
    smtpPort: z.coerce.number().int().positive().nullable().optional(),
    smtpUser: z.string().max(255).nullable().optional(),
    smtpPass: z.string().max(255).nullable().optional(),
    smtpSecure: z.boolean().optional(),
    smtpFrom: z.string().email().nullable().optional(),
  })
  .strict();

export const kvQuerySchema = z.object({
  name: z.string().min(1).optional(),
});

export const kvUpsertSchema = z.object({
  name: z.string().min(1),
  value: z.string().nullable(),
});

export const patchPosPrinterSchema = z
  .object({
    autoPrint: z.boolean().optional(),
    preferredPrinter: z.string().max(255).nullable().optional(),
    paperSize: z.enum(['A4', '80mm', '58mm']).optional(),
    receiptFooter: z.string().max(500).nullable().optional(),
  })
  .strict();
