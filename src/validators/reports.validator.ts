import { z } from 'zod';

/** `from`/`to` are optional — reports.service defaults to the current calendar month
 * (shop timezone) when both are omitted. `from > to` -> 400 (reports.md acceptance criteria). */
export const reportDateRangeQuerySchema = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .refine((data) => !data.from || !data.to || data.from.getTime() <= data.to.getTime(), {
    message: '`from` must be less than or equal to `to`',
    path: ['to'],
  });
