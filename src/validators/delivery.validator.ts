import { z } from 'zod';

export const deliveryListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z
    .enum(['pending', 'assigned', 'out_for_delivery', 'settled', 'cancelled'])
    .optional(),
  assignedCashierId: z.coerce.number().int().positive().optional(),
  createdById: z.coerce.number().int().positive().optional(),
  mine: z
    .union([z.literal('1'), z.literal('true'), z.literal('0'), z.literal('false')])
    .optional()
    .transform((v) => v === '1' || v === 'true'),
  unsettledOnly: z
    .union([z.literal('1'), z.literal('true'), z.literal('0'), z.literal('false')])
    .optional()
    .transform((v) => v === '1' || v === 'true'),
  from: z.string().optional(),
  to: z.string().optional(),
  search: z.string().max(255).optional(),
});

export const deliveryIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const assignDeliverySchema = z.object({
  cashierId: z.coerce.number().int().positive(),
});

export const settleDeliverySchema = z.object({
  paymentMethodId: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive().optional(),
  note: z.string().max(500).optional(),
});

export const updateDeliveryStatusSchema = z.object({
  status: z.enum(['out_for_delivery', 'assigned', 'pending']),
});

export const cancelDeliverySchema = z
  .object({
    note: z.string().max(500).optional(),
  })
  .default({});
