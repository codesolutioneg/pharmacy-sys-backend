import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';

type LabTestInput = {
  name: string;
  center?: string | null;
};

/** Global master data (no shop scoping) — mirrors Laravel's un-scoped tests table. */
export const labTestsService = {
  async list(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.labTest.findMany({ orderBy: { id: 'desc' }, skip, take: limit }),
      prisma.labTest.count(),
    ]);
    return { items, meta: { page, limit, total } };
  },

  async getById(id: number) {
    const test = await prisma.labTest.findUnique({ where: { id } });
    if (!test) {
      throw new AppError(404, 'LAB_TEST_NOT_FOUND', 'Lab test not found');
    }
    return test;
  },

  async create(data: LabTestInput) {
    const clash = await prisma.labTest.findUnique({ where: { name: data.name } });
    if (clash) {
      throw new AppError(409, 'LAB_TEST_EXISTS', 'Lab test name already in use');
    }
    return prisma.labTest.create({ data: { name: data.name, center: data.center ?? null } });
  },

  async update(id: number, data: Partial<LabTestInput>) {
    const test = await this.getById(id);
    if (data.name && data.name !== test.name) {
      const clash = await prisma.labTest.findUnique({ where: { name: data.name } });
      if (clash) {
        throw new AppError(409, 'LAB_TEST_EXISTS', 'Lab test name already in use');
      }
    }
    return prisma.labTest.update({ where: { id }, data: { name: data.name, center: data.center } });
  },

  async remove(id: number) {
    await this.getById(id);
    await prisma.labTest.delete({ where: { id } });
    return { message: 'Lab test deleted' };
  },
};
