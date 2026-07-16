import { Decimal } from 'decimal.js';

export type MoneyInput = Decimal.Value;

export function toDecimal(value: MoneyInput): Decimal {
  return new Decimal(value as Decimal.Value);
}

/** Round to 2 decimal places using half-up rounding (money-safe). */
export function round2(value: MoneyInput): Decimal {
  return toDecimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function add(a: MoneyInput, b: MoneyInput): Decimal {
  return round2(toDecimal(a).plus(toDecimal(b)));
}

export function sub(a: MoneyInput, b: MoneyInput): Decimal {
  return round2(toDecimal(a).minus(toDecimal(b)));
}

export function mul(a: MoneyInput, b: MoneyInput): Decimal {
  return round2(toDecimal(a).times(toDecimal(b)));
}

/** Percentage of `value`, e.g. pct(200, 15) => 30.00 (15% of 200). */
export function pct(value: MoneyInput, percent: MoneyInput): Decimal {
  return round2(toDecimal(value).times(toDecimal(percent)).dividedBy(100));
}

/** String form suitable for Prisma Decimal columns. */
export function toMoneyString(value: MoneyInput): string {
  return round2(value).toFixed(2);
}

/** Fixed-precision string for non-money decimals (e.g. unit conversion factors). */
export function toFixedString(value: MoneyInput, decimalPlaces: number): string {
  return toDecimal(value).toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP).toFixed(
    decimalPlaces,
  );
}

export type DiscountValueType = 'percent' | 'fixed' | string;

/**
 * Discount AMOUNT (not net price), capped at `min(discountAmount, price)`.
 * Mirrors Laravel `app/Helpers/global.php:141-156` `calculateDiscountedPrice`.
 */
export function calculateDiscountedPrice(
  price: MoneyInput,
  discountValue: MoneyInput,
  discountType: DiscountValueType,
): Decimal {
  const priceDec = toDecimal(price);
  let discountAmount: Decimal;
  if (discountType === 'percent') {
    discountAmount = priceDec.times(toDecimal(discountValue)).dividedBy(100);
  } else if (discountType === 'fixed') {
    discountAmount = toDecimal(discountValue);
  } else {
    discountAmount = toDecimal(0);
  }
  return round2(Decimal.min(discountAmount, priceDec));
}

/**
 * `amount = grandTotal - paid`; negative → all change, no due. Otherwise all due, no change.
 * Mirrors `resources/views/npurchase/create.blade.php:201-213`.
 */
export function deriveDueChange(
  grandTotal: MoneyInput,
  paid: MoneyInput,
): { due: Decimal; change: Decimal } {
  const amount = sub(grandTotal, paid);
  if (amount.isNegative()) {
    return { due: toDecimal(0), change: amount.abs() };
  }
  return { due: amount, change: toDecimal(0) };
}
