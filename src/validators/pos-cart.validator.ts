import { z } from 'zod';

export const cartIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const cartItemIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  itemId: z.string().min(1),
});

export const addCartItemSchema = z.object({
  medicineId: z.coerce.number().int().positive(),
});

export const updateCartItemSchema = z.object({
  qty: z.coerce.number().int().positive().optional(),
  batchId: z.coerce.number().int().positive().optional(),
  lineDiscount: z.coerce.number().min(0).optional(),
});

export const updateCartSchema = z
  .object({
    customerId: z.coerce.number().int().positive().nullable().optional(),
    paymentMethodId: z.coerce.number().int().positive().nullable().optional(),
    paidAmount: z.coerce.number().min(0).optional(),
    taxRate: z.coerce.number().min(0).max(100).nullable().optional(),
    taxAmount: z.coerce.number().min(0).nullable().optional(),
    invoiceDiscount: z
      .object({
        value: z.coerce.number().min(0),
        type: z.enum(['percent', 'fixed']),
      })
      .optional(),
  })
  .refine((data) => data.taxRate === undefined || data.taxAmount === undefined, {
    message: 'Provide either taxRate or taxAmount, not both',
    path: ['taxAmount'],
  });

export const checkoutSchema = z.object({
  cartId: z.coerce.number().int().positive(),
});
