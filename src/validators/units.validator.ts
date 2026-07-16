import { z } from 'zod';

export const createUnitSchema = z.object({
  name: z.string().min(1).max(255),
  status: z.coerce.number().int().min(0).max(1).default(1),
});

export const updateUnitSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  status: z.coerce.number().int().min(0).max(1).optional(),
});
