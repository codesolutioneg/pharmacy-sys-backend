import pino from 'pino';
import { config } from '../config';

export const logger = pino({
  level: config.logLevel,
  transport:
    config.env === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  redact: {
    paths: [
      'password',
      'req.headers.authorization',
      'body.password',
      'body.currentPassword',
      'body.newPassword',
      'body.refreshToken',
      'smtpPass',
    ],
    remove: true,
  },
});
