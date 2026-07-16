import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AuthUserPayload } from '../types/express';

export function signAccessToken(payload: AuthUserPayload): string {
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessTtl,
  } as jwt.SignOptions);
}

export function signRefreshToken(payload: { userId: number; jti: string }): string {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshTtl,
  } as jwt.SignOptions);
}

export function verifyRefreshToken(token: string): { userId: number; jti: string } {
  return jwt.verify(token, config.jwt.refreshSecret) as {
    userId: number;
    jti: string;
  };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateRawToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/** Parse TTL like 15m / 30d into a Date from now. */
export function ttlToDate(ttl: string, from = new Date()): Date {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) {
    throw new Error(`Invalid TTL format: ${ttl}`);
  }
  const amount = Number(match[1]);
  const unit = match[2];
  const ms =
    unit === 's'
      ? amount * 1000
      : unit === 'm'
        ? amount * 60_000
        : unit === 'h'
          ? amount * 3_600_000
          : amount * 86_400_000;
  return new Date(from.getTime() + ms);
}
