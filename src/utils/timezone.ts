/**
 * Shop-timezone-aware date boundary helpers.
 *
 * Purchase/Invoice `date` columns are `@db.Date` (calendar date, no time component) — Prisma
 * always returns/accepts these as UTC-midnight `Date` instances. Resolving "today"/"this month"
 * in the shop's configured `timeZone` (not the server's local time) only matters for figuring out
 * *which* calendar date is "today" right now; once that calendar date is known, comparisons against
 * the stored date-only columns are timezone-agnostic (see dashboard.md / reports.md edge cases).
 */

export type DateParts = { year: number; month: number; day: number };

export function shopDateParts(timeZone: string, now: Date = new Date()): DateParts {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(now);
  const map: Record<string, string> = {};
  for (const part of parts) {
    map[part.type] = part.value;
  }
  return { year: Number(map.year), month: Number(map.month), day: Number(map.day) };
}

/** "Today" as a UTC-midnight Date, resolved in the shop's timezone. */
export function shopToday(timeZone: string, now: Date = new Date()): Date {
  const { year, month, day } = shopDateParts(timeZone, now);
  return new Date(Date.UTC(year, month - 1, day));
}

/** First/last calendar day of the current month, resolved in the shop's timezone. */
export function shopMonthRange(timeZone: string, now: Date = new Date()): { from: Date; to: Date } {
  const { year, month } = shopDateParts(timeZone, now);
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 0));
  return { from, to };
}

export function addDaysUtc(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}
