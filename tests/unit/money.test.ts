import {
  add,
  calculateDiscountedPrice,
  deriveDueChange,
  mul,
  pct,
  round2,
  sub,
  toMoneyString,
} from '../../src/utils/money';

describe('money basics', () => {
  it('rounds half-up to 2dp', () => {
    expect(round2(1.005).toFixed(2)).toBe('1.01');
    expect(round2(1.004).toFixed(2)).toBe('1.00');
  });

  it('adds/subtracts/multiplies with 2dp rounding', () => {
    expect(add(10, 5.555).toFixed(2)).toBe('15.56');
    expect(sub(10, 5.555).toFixed(2)).toBe('4.45');
    expect(mul(3, 2.005).toFixed(2)).toBe('6.02');
  });

  it('computes percentage', () => {
    expect(pct(200, 15).toFixed(2)).toBe('30.00');
  });

  it('formats money strings to 2dp', () => {
    expect(toMoneyString(9.999)).toBe('10.00');
  });
});

describe('calculateDiscountedPrice (Laravel global.php parity)', () => {
  it('percent: discountAmount = price * value / 100', () => {
    expect(calculateDiscountedPrice(200, 10, 'percent').toFixed(2)).toBe('20.00');
    expect(calculateDiscountedPrice(99.99, 50, 'percent').toFixed(2)).toBe('50.00');
  });

  it('fixed: discountAmount = value', () => {
    expect(calculateDiscountedPrice(200, 15, 'fixed').toFixed(2)).toBe('15.00');
  });

  it('unknown type: discountAmount = 0', () => {
    expect(calculateDiscountedPrice(200, 15, 'bogus').toFixed(2)).toBe('0.00');
  });

  it('caps the discount amount at the price (never exceeds/negative-totals)', () => {
    expect(calculateDiscountedPrice(50, 100, 'fixed').toFixed(2)).toBe('50.00');
    expect(calculateDiscountedPrice(50, 500, 'percent').toFixed(2)).toBe('50.00');
  });

  it('returns a discount AMOUNT, not a net price', () => {
    const amount = calculateDiscountedPrice(100, 20, 'percent');
    expect(amount.toFixed(2)).toBe('20.00');
    expect(amount.toFixed(2)).not.toBe('80.00');
  });
});

describe('deriveDueChange', () => {
  it('underpaid → due > 0, change = 0', () => {
    const { due, change } = deriveDueChange(100, 60);
    expect(due.toFixed(2)).toBe('40.00');
    expect(change.toFixed(2)).toBe('0.00');
  });

  it('overpaid → change > 0, due = 0', () => {
    const { due, change } = deriveDueChange(100, 150);
    expect(due.toFixed(2)).toBe('0.00');
    expect(change.toFixed(2)).toBe('50.00');
  });

  it('exact payment → due = 0, change = 0', () => {
    const { due, change } = deriveDueChange(100, 100);
    expect(due.toFixed(2)).toBe('0.00');
    expect(change.toFixed(2)).toBe('0.00');
  });
});
