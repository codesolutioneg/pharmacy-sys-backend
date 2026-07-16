import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { toMoneyString } from '../utils/money';

type TxClient = Prisma.TransactionClient;

type MedicineEntry = { medicine: string; schedule: string; day: string };
type TestEntry = { test: string };

type CreatePrescriptionInput = {
  patientId: number;
  referredTo: number;
  visitNo: number;
  visitFees: number;
  description: string;
  advice: string;
  date?: Date;
  medicine: string[];
  schedule: string[];
  day: string[];
  test: string[];
};

type UpdatePrescriptionInput = Partial<CreatePrescriptionInput>;

/** Builds the `[{ medicine, schedule, day }, ...]` shape from parallel input arrays (PrescriptionController::store). */
function buildMedicines(medicine: string[], schedule: string[], day: string[]): MedicineEntry[] {
  if (medicine.length !== schedule.length || medicine.length !== day.length) {
    throw new AppError(
      400,
      'MEDICINES_LENGTH_MISMATCH',
      'medicine, schedule, and day arrays must have the same length',
    );
  }
  return medicine.map((m, i) => ({ medicine: m, schedule: schedule[i], day: day[i] }));
}

function buildTests(test: string[]): TestEntry[] {
  return test.map((t) => ({ test: t }));
}

/** Collision-checked replacement for Laravel's `uniqid()` (DIVERGENCE per spec). */
async function generateUniquePrescriptionNo(tx: TxClient, shopId: number): Promise<string> {
  const prefix = 'RX';
  const numberLen = 10;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const randomDigits = Array.from({ length: numberLen }, () =>
      Math.floor(Math.random() * 10),
    ).join('');
    const candidate = `${prefix}${randomDigits}`;
    const clash = await tx.prescription.findFirst({ where: { shopId, prescriptionNo: candidate } });
    if (!clash) {
      return candidate;
    }
  }
  throw new AppError(
    500,
    'PRESCRIPTION_NO_GENERATION_FAILED',
    'Failed to generate a unique prescription number',
  );
}

async function assertPatientExists(patientId: number) {
  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) {
    throw new AppError(400, 'INVALID_PATIENT', 'Patient not found');
  }
}

async function assertDoctorExists(doctorId: number) {
  const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
  if (!doctor) {
    throw new AppError(400, 'INVALID_DOCTOR', 'Referred doctor not found');
  }
}

export const prescriptionsService = {
  async list(shopId: number, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.prescription.findMany({
        where: { shopId },
        orderBy: { id: 'desc' },
        skip,
        take: limit,
        include: { patient: true, doctor: true },
      }),
      prisma.prescription.count({ where: { shopId } }),
    ]);
    return { items, meta: { page, limit, total } };
  },

  async getById(shopId: number, id: number) {
    const prescription = await prisma.prescription.findFirst({
      where: { id, shopId },
      include: { patient: true, doctor: true },
    });
    if (!prescription) {
      throw new AppError(404, 'PRESCRIPTION_NOT_FOUND', 'Prescription not found');
    }
    return prescription;
  },

  async create(shopId: number, input: CreatePrescriptionInput) {
    await assertPatientExists(input.patientId);
    await assertDoctorExists(input.referredTo);

    const medicines = buildMedicines(input.medicine, input.schedule, input.day);
    const tests = buildTests(input.test);
    const date = input.date ?? new Date();

    const createdId = await prisma.$transaction(async (tx) => {
      const prescriptionNo = await generateUniquePrescriptionNo(tx, shopId);
      const created = await tx.prescription.create({
        data: {
          shopId,
          prescriptionNo,
          patientId: input.patientId,
          doctorId: input.referredTo,
          date,
          visitNo: input.visitNo,
          visitFees: toMoneyString(input.visitFees),
          tests: tests as unknown as Prisma.InputJsonValue,
          medicines: medicines as unknown as Prisma.InputJsonValue,
          description: input.description,
          advice: input.advice,
        },
      });
      return created.id;
    });

    return this.getById(shopId, createdId);
  },

  /** Real, working PATCH — fixes Laravel's `dd(...)`-broken update() (spec DIVERGENCE / conflict C12). */
  async update(shopId: number, id: number, input: UpdatePrescriptionInput) {
    const existing = await prisma.prescription.findFirst({ where: { id, shopId } });
    if (!existing) {
      throw new AppError(404, 'PRESCRIPTION_NOT_FOUND', 'Prescription not found');
    }

    if (input.patientId !== undefined) {
      await assertPatientExists(input.patientId);
    }
    if (input.referredTo !== undefined) {
      await assertDoctorExists(input.referredTo);
    }

    let medicines: MedicineEntry[] | undefined;
    if (input.medicine !== undefined && input.schedule !== undefined && input.day !== undefined) {
      medicines = buildMedicines(input.medicine, input.schedule, input.day);
    }
    const tests = input.test !== undefined ? buildTests(input.test) : undefined;

    await prisma.prescription.update({
      where: { id },
      data: {
        patientId: input.patientId,
        doctorId: input.referredTo,
        date: input.date,
        visitNo: input.visitNo,
        visitFees: input.visitFees !== undefined ? toMoneyString(input.visitFees) : undefined,
        tests: tests !== undefined ? (tests as unknown as Prisma.InputJsonValue) : undefined,
        medicines:
          medicines !== undefined ? (medicines as unknown as Prisma.InputJsonValue) : undefined,
        description: input.description,
        advice: input.advice,
      },
    });

    return this.getById(shopId, id);
  },

  async remove(shopId: number, id: number) {
    const existing = await prisma.prescription.findFirst({ where: { id, shopId } });
    if (!existing) {
      throw new AppError(404, 'PRESCRIPTION_NOT_FOUND', 'Prescription not found');
    }
    await prisma.prescription.delete({ where: { id } });
    return { message: 'Prescription deleted' };
  },
};
