import { z } from 'zod';

const stringArray = z.array(z.string().min(1));

export const createPrescriptionSchema = z
  .object({
    patientId: z.coerce.number().int().positive(),
    referredTo: z.coerce.number().int().positive(),
    visitNo: z.coerce.number().int().positive(),
    visitFees: z.coerce.number().min(0).default(0),
    description: z.string().min(1),
    advice: z.string().min(1),
    date: z.coerce.date().optional(),
    medicine: stringArray.default([]),
    schedule: stringArray.default([]),
    day: stringArray.default([]),
    test: stringArray.default([]),
  })
  .superRefine((data, ctx) => {
    if (data.medicine.length !== data.schedule.length || data.medicine.length !== data.day.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'medicine, schedule, and day arrays must have the same length',
        path: ['medicine'],
      });
    }
  });

export const updatePrescriptionSchema = z
  .object({
    patientId: z.coerce.number().int().positive().optional(),
    referredTo: z.coerce.number().int().positive().optional(),
    visitNo: z.coerce.number().int().positive().optional(),
    visitFees: z.coerce.number().min(0).optional(),
    description: z.string().min(1).optional(),
    advice: z.string().min(1).optional(),
    date: z.coerce.date().optional(),
    medicine: stringArray.optional(),
    schedule: stringArray.optional(),
    day: stringArray.optional(),
    test: stringArray.optional(),
  })
  .superRefine((data, ctx) => {
    const anyProvided =
      data.medicine !== undefined || data.schedule !== undefined || data.day !== undefined;
    if (!anyProvided) {
      return;
    }
    if (data.medicine === undefined || data.schedule === undefined || data.day === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'medicine, schedule, and day must all be provided together',
        path: ['medicine'],
      });
      return;
    }
    if (data.medicine.length !== data.schedule.length || data.medicine.length !== data.day.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'medicine, schedule, and day arrays must have the same length',
        path: ['medicine'],
      });
    }
  });

export const prescriptionListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
