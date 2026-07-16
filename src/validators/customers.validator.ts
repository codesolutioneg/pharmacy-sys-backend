import { z } from 'zod';

export const createCustomerSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  phone: z.string().min(1).max(50),
  address: z.string().max(500).nullable().optional(),
  gender: z.enum(['Male', 'Female']).optional().default('Male'),
  age: z.coerce.number().int().min(0).default(0),
});

export const updateCustomerSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(1).max(50).optional(),
  address: z.string().max(500).nullable().optional(),
  gender: z.enum(['Male', 'Female']).optional(),
  age: z.coerce.number().int().min(0).optional(),
});

export const payCustomerDueSchema = z.object({
  amount: z.coerce.number().positive(),
  paymentMethodId: z.coerce.number().int().positive(),
  invoiceId: z.coerce.number().int().positive().optional(),
});
