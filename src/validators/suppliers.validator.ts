import { z } from 'zod';

export const createSupplierSchema = z.object({
  name: z.string().min(1).max(255),
  phone: z.string().min(1).max(50),
  address: z.string().max(500).nullable().optional(),
});

export const updateSupplierSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  phone: z.string().min(1).max(50).optional(),
  address: z.string().max(500).nullable().optional(),
});

export const paySupplierDueSchema = z.object({
  amount: z.coerce.number().positive(),
  paymentMethodId: z.coerce.number().int().positive(),
  purchaseId: z.coerce.number().int().positive().optional(),
});
