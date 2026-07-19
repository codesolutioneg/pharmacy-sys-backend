import { z } from 'zod';

export const createInsuranceCompanySchema = z.object({
  name: z.string().min(1).max(255),
  nameAr: z.string().max(255).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  defaultDiscountPercent: z.coerce.number().min(0).max(100).default(0),
  status: z.enum(['active', 'inactive']).optional().default('active'),
});

export const updateInsuranceCompanySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  nameAr: z.string().max(255).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  defaultDiscountPercent: z.coerce.number().min(0).max(100).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export const payInsuranceDueSchema = z.object({
  amount: z.coerce.number().positive(),
  paymentMethodId: z.coerce.number().int().positive(),
});
