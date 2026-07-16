import { z } from 'zod';

export const createVendorSchema = z.object({
  name: z.string().min(1).max(255),
  phone: z.string().min(1).max(50),
  address: z.string().min(1).max(500),
});

export const updateVendorSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  phone: z.string().min(1).max(50).optional(),
  address: z.string().min(1).max(500).optional(),
});
