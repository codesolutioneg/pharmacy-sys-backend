import { z } from 'zod';

export const createDoctorSchema = z.object({
  name: z.string().min(1).max(199),
  title: z.string().min(1).max(199),
  phone: z.string().min(1).max(199),
  speciality: z.string().min(1).max(199),
  address: z.string().max(199).nullable().optional(),
  hospital: z.string().max(199).nullable().optional(),
});

export const updateDoctorSchema = createDoctorSchema.partial();
