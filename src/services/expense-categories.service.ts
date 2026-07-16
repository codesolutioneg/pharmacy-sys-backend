import { ActiveStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';

export const expenseCategoriesService = {
  async list(shopId: number, params: { page: number; limit: number; status?: ActiveStatus }) {
    const skip = (params.page - 1) * params.limit;
    const where: Prisma.ExpenseCategoryWhereInput = {
      shopId,
      ...(params.status ? { status: params.status } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.expenseCategory.findMany({
        where,
        orderBy: { id: 'desc' },
        skip,
        take: params.limit,
      }),
      prisma.expenseCategory.count({ where }),
    ]);
    return { items, meta: { page: params.page, limit: params.limit, total } };
  },

  async getById(shopId: number, id: number) {
    const category = await prisma.expenseCategory.findFirst({ where: { id, shopId } });
    if (!category) {
      throw new AppError(404, 'EXPENSE_CATEGORY_NOT_FOUND', 'Expense category not found');
    }
    return category;
  },

  async create(
    shopId: number,
    data: { name: string; description?: string | null; status?: ActiveStatus },
  ) {
    const clash = await prisma.expenseCategory.findFirst({ where: { shopId, name: data.name } });
    if (clash) {
      throw new AppError(409, 'EXPENSE_CATEGORY_EXISTS', 'Expense category name already in use');
    }
    return prisma.expenseCategory.create({
      data: {
        shopId,
        name: data.name,
        description: data.description ?? null,
        status: data.status ?? 'active',
      },
    });
  },

  async update(
    shopId: number,
    id: number,
    data: { name?: string; description?: string | null; status?: ActiveStatus },
  ) {
    await this.getById(shopId, id);
    if (data.name !== undefined) {
      const clash = await prisma.expenseCategory.findFirst({
        where: { shopId, name: data.name, id: { not: id } },
      });
      if (clash) {
        throw new AppError(409, 'EXPENSE_CATEGORY_EXISTS', 'Expense category name already in use');
      }
    }
    return prisma.expenseCategory.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        status: data.status,
      },
    });
  },

  async remove(shopId: number, id: number) {
    await this.getById(shopId, id);
    const expenseCount = await prisma.pharmacyExpense.count({ where: { categoryId: id, shopId } });
    if (expenseCount > 0) {
      throw new AppError(
        409,
        'EXPENSE_CATEGORY_IN_USE',
        'Cannot delete an expense category that has expenses',
      );
    }
    await prisma.expenseCategory.delete({ where: { id } });
    return { message: 'Expense category deleted' };
  },
};
