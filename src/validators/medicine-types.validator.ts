import { z } from 'zod';

export const createMedicineTypeSchema = z.object({
  name: z.string().min(1).max(255),
  status: z.coerce.number().int().min(0).max(1).default(1),
});

export const updateMedicineTypeSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  status: z.coerce.number().int().min(0).max(1).optional(),
});
