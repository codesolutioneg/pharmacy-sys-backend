import { AppError } from '../../src/utils/AppError';
import { slugifyRoleName } from '../../src/utils/slugify';
import { ttlToDate, hashToken } from '../../src/utils/tokens';

describe('AppError', () => {
  it('carries status, code, and message', () => {
    const err = new AppError(404, 'NOT_FOUND', 'Missing');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('Missing');
    expect(err.isOperational).toBe(true);
  });
});

describe('slugifyRoleName', () => {
  it('matches Laravel strtolower + space-to-underscore', () => {
    expect(slugifyRoleName('Administrator')).toBe('administrator');
    expect(slugifyRoleName('Sales Rep')).toBe('sales_rep');
    expect(slugifyRoleName(' sales rep ')).toBe('sales_rep');
  });
});

describe('tokens helpers', () => {
  it('hashes deterministically', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abc')).not.toBe(hashToken('abd'));
  });

  it('parses TTL to future date', () => {
    const from = new Date('2026-01-01T00:00:00.000Z');
    expect(ttlToDate('15m', from).toISOString()).toBe('2026-01-01T00:15:00.000Z');
    expect(ttlToDate('1h', from).toISOString()).toBe('2026-01-01T01:00:00.000Z');
    expect(ttlToDate('1d', from).toISOString()).toBe('2026-01-02T00:00:00.000Z');
  });
});
