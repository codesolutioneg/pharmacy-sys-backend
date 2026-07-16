import { Gender } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';

type PatientInput = {
  name: string;
  phone: string;
  address: string;
  gender: Gender;
  age: number;
};

/** Global master data (no shop scoping) — mirrors Laravel's un-scoped patients table. */
export const patientsService = {
  async list(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.patient.findMany({ orderBy: { id: 'desc' }, skip, take: limit }),
      prisma.patient.count(),
    ]);
    return { items, meta: { page, limit, total } };
  },

  async getById(id: number) {
    const patient = await prisma.patient.findUnique({ where: { id } });
    if (!patient) {
      throw new AppError(404, 'PATIENT_NOT_FOUND', 'Patient not found');
    }
    return patient;
  },

  async create(data: PatientInput) {
    return prisma.patient.create({ data });
  },

  async update(id: number, data: Partial<PatientInput>) {
    await this.getById(id);
    return prisma.patient.update({ where: { id }, data });
  },

  async remove(id: number) {
    await this.getById(id);
    await prisma.patient.delete({ where: { id } });
    return { message: 'Patient deleted' };
  },
};
