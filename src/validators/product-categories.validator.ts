import { z } from 'zod';
import { ActiveStatus, CategoryKind } from '@prisma/client';

export const createProductCategorySchema = z.object({
  title: z.string().min(1).max(255),
  type: z.nativeEnum(CategoryKind).optional().default('inventory'),
  status: z.nativeEnum(ActiveStatus).optional().default('active'),
  sorting: z.coerce.number().int().min(0).default(0),
  image: z.string().max(500).nullable().optional(),
  banner: z.string().max(500).nullable().optional(),
});

export const updateProductCategorySchema = z.object({
  title: z.string().min(1).max(255).optional(),
  type: z.nativeEnum(CategoryKind).optional(),
  status: z.nativeEnum(ActiveStatus).optional(),
  sorting: z.coerce.number().int().min(0).optional(),
  image: z.string().max(500).nullable().optional(),
  banner: z.string().max(500).nullable().optional(),
});
