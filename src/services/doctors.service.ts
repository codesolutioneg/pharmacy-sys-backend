import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';

type DoctorInput = {
  name: string;
  title: string;
  phone: string;
  speciality: string;
  address?: string | null;
  hospital?: string | null;
};

/** Global master data (no shop scoping) — mirrors Laravel's un-scoped doctors table. */
export const doctorsService = {
  async list(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.doctor.findMany({ orderBy: { id: 'desc' }, skip, take: limit }),
      prisma.doctor.count(),
    ]);
    return { items, meta: { page, limit, total } };
  },

  async getById(id: number) {
    const doctor = await prisma.doctor.findUnique({ where: { id } });
    if (!doctor) {
      throw new AppError(404, 'DOCTOR_NOT_FOUND', 'Doctor not found');
    }
    return doctor;
  },

  async create(data: DoctorInput) {
    const clash = await prisma.doctor.findFirst({ where: { name: data.name } });
    if (clash) {
      throw new AppError(409, 'DOCTOR_EXISTS', 'Doctor name already in use');
    }
    return prisma.doctor.create({
      data: {
        name: data.name,
        title: data.title,
        phone: data.phone,
        speciality: data.speciality,
        address: data.address ?? null,
        hospital: data.hospital ?? null,
      },
    });
  },

  async update(id: number, data: Partial<DoctorInput>) {
    const doctor = await this.getById(id);
    if (data.name && data.name !== doctor.name) {
      const clash = await prisma.doctor.findFirst({ where: { name: data.name, id: { not: id } } });
      if (clash) {
        throw new AppError(409, 'DOCTOR_EXISTS', 'Doctor name already in use');
      }
    }
    return prisma.doctor.update({
      where: { id },
      data: {
        name: data.name,
        title: data.title,
        phone: data.phone,
        speciality: data.speciality,
        address: data.address,
        hospital: data.hospital,
      },
    });
  },

  async remove(id: number) {
    await this.getById(id);
    await prisma.doctor.delete({ where: { id } });
    return { message: 'Doctor deleted' };
  },
};
