import { ActiveStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';

/** Global chart-of-accounts catalog — no shopId, mirrors Laravel's un-scoped account_types table. */
export const accountTypesService = {
  async list(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.accountType.findMany({
        orderBy: [{ serial: 'asc' }, { id: 'asc' }],
        skip,
        take: limit,
      }),
      prisma.accountType.count(),
    ]);
    return { items, meta: { page, limit, total } };
  },

  async getById(id: number) {
    const type = await prisma.accountType.findUnique({ where: { id } });
    if (!type) {
      throw new AppError(404, 'ACCOUNT_TYPE_NOT_FOUND', 'Account type not found');
    }
    return type;
  },

  async create(data: { name: string; status?: ActiveStatus; serial?: number }) {
    const clash = await prisma.accountType.findUnique({ where: { name: data.name } });
    if (clash) {
      throw new AppError(409, 'ACCOUNT_TYPE_EXISTS', 'Account type name already in use');
    }
    return prisma.accountType.create({
      data: {
        name: data.name,
        status: data.status ?? 'active',
        serial: data.serial ?? 1,
      },
    });
  },

  async update(id: number, data: { name?: string; status?: ActiveStatus; serial?: number }) {
    const type = await this.getById(id);
    if (data.name !== undefined && data.name !== type.name) {
      const clash = await prisma.accountType.findUnique({ where: { name: data.name } });
      if (clash) {
        throw new AppError(409, 'ACCOUNT_TYPE_EXISTS', 'Account type name already in use');
      }
    }
    return prisma.accountType.update({
      where: { id },
      data: { name: data.name, status: data.status, serial: data.serial },
    });
  },

  async remove(id: number) {
    const type = await this.getById(id);
    if (!type.isDeletable) {
      throw new AppError(409, 'ACCOUNT_TYPE_NOT_DELETABLE', 'This account type cannot be deleted');
    }
    const accountCount = await prisma.account.count({ where: { accountTypeId: id } });
    if (accountCount > 0) {
      throw new AppError(
        409,
        'ACCOUNT_TYPE_IN_USE',
        'Cannot delete an account type that still has accounts',
      );
    }
    await prisma.accountType.delete({ where: { id } });
    return { message: 'Account type deleted' };
  },
};
