import { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';

export function authorize(...requiredPermissions: string[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
        return;
      }

      if (requiredPermissions.length === 0) {
        next();
        return;
      }

      const links = await prisma.rolePermission.findMany({
        where: { roleId: req.user.roleId },
        include: { permission: true },
      });

      const owned = new Set(links.map((l) => l.permission.name));
      const missing = requiredPermissions.filter((p) => !owned.has(p));

      if (missing.length > 0) {
        next(
          new AppError(
            403,
            'FORBIDDEN',
            'You do not have permission to perform this action',
            { missing },
          ),
        );
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
