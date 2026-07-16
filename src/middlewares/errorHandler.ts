import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError, ZodTypeAny } from 'zod';
import { AppError } from '../utils/AppError';
import { config } from '../config';
import { logger } from '../utils/logger';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code,
      ...(err.details !== undefined && !config.isProd
        ? { details: err.details }
        : {}),
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: err.flatten(),
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2003') {
      res.status(409).json({
        success: false,
        message: 'Cannot delete or update this record because related data still exists',
        code: 'FK_CONSTRAINT',
      });
      return;
    }
    if (err.code === 'P2002') {
      res.status(409).json({
        success: false,
        message: 'A record with this unique value already exists',
        code: 'UNIQUE_CONSTRAINT',
      });
      return;
    }
  }

  logger.error({ err }, 'Unhandled error');
  res.status(500).json({
    success: false,
    message: config.isProd ? 'Internal server error' : String(err),
    code: 'INTERNAL_ERROR',
  });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    code: 'NOT_FOUND',
  });
}

type RequestTarget = 'body' | 'query' | 'params';

export function validate(schema: ZodTypeAny, target: RequestTarget = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      next(
        new AppError(400, 'VALIDATION_ERROR', 'Validation failed', result.error.flatten()),
      );
      return;
    }
    req[target] = result.data;
    next();
  };
}
