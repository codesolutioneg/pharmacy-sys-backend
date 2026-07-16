import { z } from 'zod';
import { ActiveStatus } from '@prisma/client';

/** ISO 639-1 code, optionally with a region subtag (e.g. "en", "en-us"). Normalized to lowercase. */
const isoSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z]{2}(-[a-z]{2})?$/, 'iso must be a valid locale code, e.g. "en" or "en-us"');

export const createLanguageSchema = z.object({
  name: z.string().trim().min(1).max(255),
  iso: isoSchema,
  icon: z.string().trim().max(500).nullable().optional(),
  status: z.nativeEnum(ActiveStatus).optional().default('active'),
});

export const updateLanguageSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    icon: z.string().trim().max(500).nullable().optional(),
    status: z.nativeEnum(ActiveStatus).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

/** Partial-merge payload (languages.md: PATCH terms merges, never replaces the whole map). */
export const updateLanguageTermsSchema = z.object({
  terms: z
    .record(z.string(), z.unknown())
    .refine((obj) => Object.keys(obj).length > 0, { message: 'terms must not be empty' }),
});

export const languageListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.nativeEnum(ActiveStatus).optional(),
});
