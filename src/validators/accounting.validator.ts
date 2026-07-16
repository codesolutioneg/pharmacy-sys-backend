import { z } from 'zod';
import { ActiveStatus } from '@prisma/client';

export const createAccountTypeSchema = z.object({
  name: z.string().min(1).max(255),
  status: z.nativeEnum(ActiveStatus).optional().default('active'),
  serial: z.coerce.number().int().min(0).optional().default(1),
});

export const updateAccountTypeSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  status: z.nativeEnum(ActiveStatus).optional(),
  serial: z.coerce.number().int().min(0).optional(),
});

export const createAccountSchema = z.object({
  name: z.string().min(1).max(255),
  accountTypeId: z.coerce.number().int().positive(),
  status: z.nativeEnum(ActiveStatus).optional().default('active'),
  serial: z.coerce.number().int().min(0).optional().default(1),
});

export const updateAccountSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  accountTypeId: z.coerce.number().int().positive().optional(),
  status: z.nativeEnum(ActiveStatus).optional(),
  serial: z.coerce.number().int().min(0).optional(),
});

export const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

/** Manual journal entry — accounting.md acceptance criteria: debitAccountId != creditAccountId, amount > 0. */
export const createManualLedgerEntrySchema = z
  .object({
    date: z.coerce.date().optional(),
    debitAccountId: z.coerce.number().int().positive(),
    creditAccountId: z.coerce.number().int().positive(),
    amount: z.coerce.number().positive(),
    particular: z.string().min(1).max(500),
  })
  .refine((data) => data.debitAccountId !== data.creditAccountId, {
    message: 'debitAccountId and creditAccountId must differ',
    path: ['creditAccountId'],
  });

export const ledgerListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  accountId: z.coerce.number().int().positive().optional(),
  invoiceType: z
    .enum(['sale', 'purchase', 'expense', 'manual', 'sale_return', 'purchase_return'])
    .optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export const reportsQuerySchema = z.object({
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
