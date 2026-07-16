import { z } from 'zod';

export const batchListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  medicineId: z.coerce.number().int().positive().optional(),
  expireBefore: z.coerce.date().optional(),
});

export const batchIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const updateBatchPriceSchema = z.object({
  price: z.coerce.number().min(0),
});

export const medicineIdParamSchema = z.object({
  medicineId: z.coerce.number().int().positive(),
});
