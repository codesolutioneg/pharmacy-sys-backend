import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_NAME: z.string().default('Pharmacy Sys API'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).default(10),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  LOG_LEVEL: z.string().default('info'),
  DEFAULT_CURRENCY: z.string().default('EGP'),
  DEFAULT_TIMEZONE: z.string().default('Africa/Cairo'),
  DEFAULT_LOCALE: z.string().default('ar'),
  SUPPORTED_CURRENCIES: z.string().default('EGP,SAR'),
  SUPPORTED_TIMEZONES: z.string().default('Africa/Cairo,Asia/Riyadh'),
  SUPPORTED_LOCALES: z.string().default('ar,en'),
  SEED_ADMIN_EMAIL: z.string().email().default('admin@pharmacy.local'),
  SEED_ADMIN_PASSWORD: z.string().min(8).default('Admin123!'),
  SEED_ADMIN_NAME: z.string().default('System Admin'),
  SEED_SHOP_NAME: z.string().default('Default Pharmacy'),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  SMTP_FROM: z.string().default('noreply@pharmacy.local'),
  SMTP_SECURE: z
    .string()
    .optional()
    .default('false')
    .transform((v) => v === 'true'),
  APP_DEMO: z
    .string()
    .optional()
    .default('false')
    .transform((v) => v === 'true'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((i) => `${i.path.join('.')}: ${i.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${details}`);
}

const env = parsed.data;

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export const config = {
  env: env.NODE_ENV,
  isProd: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  port: env.PORT,
  appName: env.APP_NAME,
  appUrl: env.APP_URL,
  databaseUrl: env.DATABASE_URL,
  jwt: {
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessTtl: env.JWT_ACCESS_TTL,
    refreshTtl: env.JWT_REFRESH_TTL,
  },
  bcryptRounds: env.BCRYPT_ROUNDS,
  corsOrigins: splitCsv(env.CORS_ORIGINS),
  logLevel: env.LOG_LEVEL,
  market: {
    defaultCurrency: env.DEFAULT_CURRENCY,
    defaultTimezone: env.DEFAULT_TIMEZONE,
    defaultLocale: env.DEFAULT_LOCALE,
    supportedCurrencies: splitCsv(env.SUPPORTED_CURRENCIES),
    supportedTimezones: splitCsv(env.SUPPORTED_TIMEZONES),
    supportedLocales: splitCsv(env.SUPPORTED_LOCALES),
  },
  seed: {
    adminEmail: env.SEED_ADMIN_EMAIL,
    adminPassword: env.SEED_ADMIN_PASSWORD,
    adminName: env.SEED_ADMIN_NAME,
    shopName: env.SEED_SHOP_NAME,
  },
  smtp: {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    from: env.SMTP_FROM,
    secure: env.SMTP_SECURE,
  },
  appDemo: env.APP_DEMO,
} as const;

export type AppConfig = typeof config;
