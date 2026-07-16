import { z } from 'zod';

export const invoiceListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  customerId: z.coerce.number().int().positive().optional(),
});

export const invoiceIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const invoiceEmailSchema = z.object({
  to: z.string().email().optional(),
});

export const invoicePaymentSchema = z.object({
  amount: z.coerce.number().positive(),
  paymentMethodId: z.coerce.number().int().positive(),
});

export const invoiceReturnSchema = z.object({
  batchId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive(),
});

export const invoiceReturnListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
