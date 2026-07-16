import { z } from 'zod';

export const createPaymentMethodSchema = z.object({
  name: z.string().min(1).max(255),
  balance: z.coerce.number().min(0).default(0),
});

export const updatePaymentMethodSchema = z.object({
  name: z.string().min(1).max(255).optional(),
});

export const depositSchema = z.object({
  amount: z.coerce.number().positive(),
});
