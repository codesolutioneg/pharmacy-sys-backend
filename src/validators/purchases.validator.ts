import { z } from 'zod';

export const draftLineSchema = z.object({
  medicineId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive(),
  buyPrice: z.coerce.number().min(0),
  price: z.coerce.number().min(0).default(0),
  batchName: z.string().max(255).nullable().optional(),
  expireDate: z.coerce.date().nullable().optional(),
  discount: z.coerce.number().min(0).default(0),
  discountType: z.enum(['percent', 'fixed']).default('fixed'),
});

export const updateDraftSchema = z.object({
  supplierId: z.coerce.number().int().positive().nullable().optional(),
  paymentMethodId: z.coerce.number().int().positive().nullable().optional(),
  paidAmount: z.coerce.number().min(0).optional(),
  invoiceDiscount: z
    .object({
      value: z.coerce.number().min(0),
      type: z.enum(['percent', 'fixed']),
    })
    .optional(),
});

export const draftIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const draftLineIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  lineId: z.string().min(1),
});

export const commitPurchaseSchema = z.object({
  draftId: z.coerce.number().int().positive(),
});

export const purchaseListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  supplierId: z.coerce.number().int().positive().optional(),
});

export const purchaseReturnSchema = z.object({
  medicineId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive(),
  batchId: z.coerce.number().int().positive().optional(),
});

export const purchaseReturnListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  purchaseId: z.coerce.number().int().positive().optional(),
  supplierId: z.coerce.number().int().positive().optional(),
});
