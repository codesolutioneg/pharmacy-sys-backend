import { z } from 'zod';

export const createLabTestSchema = z.object({
  name: z.string().min(1).max(199),
  center: z.string().max(199).nullable().optional(),
});

export const updateLabTestSchema = createLabTestSchema.partial();
