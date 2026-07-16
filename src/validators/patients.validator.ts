import { z } from 'zod';

export const createPatientSchema = z.object({
  name: z.string().min(1).max(199),
  phone: z.string().min(1).max(199),
  address: z.string().min(1).max(199),
  gender: z.enum(['male', 'female', 'other']),
  age: z.coerce.number().int().min(0),
});

export const updatePatientSchema = createPatientSchema.partial();
