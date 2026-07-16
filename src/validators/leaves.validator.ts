import { z } from 'zod';

export const createLeafSchema = z.object({
  name: z.string().min(1).max(255),
  amount: z.coerce.number().int().min(1).default(1),
});

export const updateLeafSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  amount: z.coerce.number().int().min(1).optional(),
});
