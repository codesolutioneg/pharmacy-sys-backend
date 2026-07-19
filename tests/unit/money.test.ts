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

describe('insurance split formulas', () => {
  it('splits grandTotal by insurance percent', () => {
    const grandTotal = 200;
    const insurancePercent = 70;
    const insuranceAmount = pct(grandTotal, insurancePercent);
    const patientAmount = sub(grandTotal, insuranceAmount);
    expect(insuranceAmount.toFixed(2)).toBe('140.00');
    expect(patientAmount.toFixed(2)).toBe('60.00');
  });

  it('patient due/change when underpaying co-pay', () => {
    const patientAmount = 60;
    const paid = 40;
    const patientDue = sub(patientAmount, paid);
    const change = paid > patientAmount ? sub(paid, patientAmount) : round2(0);
    expect(patientDue.toFixed(2)).toBe('20.00');
    expect(change.toFixed(2)).toBe('0.00');
  });

  it('patient change when overpaying co-pay', () => {
    const patientAmount = 60;
    const paid = 80;
    const patientDue = paid >= patientAmount ? round2(0) : sub(patientAmount, paid);
    const change = sub(paid, patientAmount);
    expect(patientDue.toFixed(2)).toBe('0.00');
    expect(change.toFixed(2)).toBe('20.00');
  });
});

describe('tax formulas', () => {
  it('exclusive tax = taxable * rate / 100', () => {
    const taxable = 100;
    const tax = pct(taxable, 14);
    const grand = add(taxable, tax);
    expect(tax.toFixed(2)).toBe('14.00');
    expect(grand.toFixed(2)).toBe('114.00');
  });

  it('inclusive tax embedded in taxable', () => {
    const taxable = 114;
    const rate = 14;
    const beforeTax = round2(toMoneyString(taxable / (1 + rate / 100)));
    // Using string path: 114 / 1.14 = 100
    expect(Number((114 / 1.14).toFixed(2))).toBe(100);
    const tax = sub(taxable, 100);
    expect(tax.toFixed(2)).toBe('14.00');
    expect(beforeTax.toFixed(2)).toBe('100.00');
  });

  it('zero-rated / exempt → tax = 0, grand = taxable', () => {
    const taxable = 100;
    const tax = round2(0);
    const grand = taxable;
    expect(tax.toFixed(2)).toBe('0.00');
    expect(grand).toBe(100);
  });
});

describe('insurance checkout paid defaults', () => {
  it('zero paid → settle full patient share (due 0)', () => {
    const grandTotal = 65;
    const insurancePercent = 75;
    const insuranceAmount = pct(grandTotal, insurancePercent);
    const patientAmount = sub(grandTotal, insuranceAmount);
    const enteredPaid = 0;
    const paid =
      enteredPaid <= 0 || enteredPaid >= grandTotal || enteredPaid >= Number(patientAmount)
          ? patientAmount
          : round2(enteredPaid);
    const due = sub(patientAmount, paid);
    expect(insuranceAmount.toFixed(2)).toBe('48.75');
    expect(patientAmount.toFixed(2)).toBe('16.25');
    expect(paid.toFixed(2)).toBe('16.25');
    expect(due.toFixed(2)).toBe('0.00');
  });

  it('paid full grandTotal → still only patient share recorded as paid', () => {
    const grandTotal = 75;
    const insuranceAmount = pct(grandTotal, 50);
    const patient = sub(grandTotal, insuranceAmount);
    const enteredPaid = 75;
    const paid = enteredPaid >= Number(patient) ? patient : round2(enteredPaid);
    expect(patient.toFixed(2)).toBe('37.50');
    expect(paid.toFixed(2)).toBe('37.50');
  });
});

describe('session cash reconciliation formula', () => {
  it('expectedCash = openingFloat + cashPays - cashReturns', () => {
    const openingFloat = 100;
    const cashPays = 250;
    const cashReturns = 30;
    const expected = sub(add(openingFloat, cashPays), cashReturns);
    const counted = 310;
    const difference = sub(counted, expected);
    expect(expected.toFixed(2)).toBe('320.00');
    expect(difference.toFixed(2)).toBe('-10.00');
  });
});
