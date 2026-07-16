import { z } from 'zod';
import { ActiveStatus } from '@prisma/client';

export const createExpenseCategorySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).nullable().optional(),
  status: z.nativeEnum(ActiveStatus).optional().default('active'),
});

export const updateExpenseCategorySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  status: z.nativeEnum(ActiveStatus).optional(),
});

export const expenseCategoryListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  /** Node-only filter for "new expense" pickers (specs/expenses.md); admin list omits this to see all statuses. */
  status: z.nativeEnum(ActiveStatus).optional(),
});

export const createExpenseSchema = z.object({
  date: z.coerce.date(),
  title: z.string().min(1).max(255),
  categoryId: z.coerce.number().int().positive(),
  /** Required on create — closes Laravel's validation gap (specs/expenses.md divergence). */
  accountId: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive(),
  reference: z.string().max(255).nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
});

export const updateExpenseSchema = z.object({
  date: z.coerce.date().optional(),
  title: z.string().min(1).max(255).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  accountId: z.coerce.number().int().positive().optional(),
  amount: z.coerce.number().positive().optional(),
  reference: z.string().max(255).nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
});

export const expenseListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  categoryId: z.coerce.number().int().positive().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
