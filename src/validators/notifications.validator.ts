import { z } from 'zod';

/** `limit=0`/negative -> 400, not silently coerced (notifications.md edge case). */
export const notificationListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
