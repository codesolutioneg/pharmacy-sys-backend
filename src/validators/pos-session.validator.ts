import { z } from 'zod';

export const openSessionSchema = z.object({
  openingFloat: z.coerce.number().min(0).default(0),
});

export const closeSessionSchema = z.object({
  countedCash: z.coerce.number().min(0),
  note: z.string().max(1000).nullable().optional(),
});

export const sessionIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
