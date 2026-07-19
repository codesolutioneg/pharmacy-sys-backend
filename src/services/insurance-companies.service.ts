import { ActiveStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { add, sub, toMoneyString } from '../utils/money';

export const insuranceCompaniesService = {
  async list(shopId: number, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.insuranceCompany.findMany({
        where: { shopId },
        orderBy: { id: 'asc' },
        skip,
        take: limit,
      }),
      prisma.insuranceCompany.count({ where: { shopId } }),
    ]);
    return { items, meta: { page, limit, total } };
  },

  async getById(shopId: number, id: number) {
    const company = await prisma.insuranceCompany.findFirst({ where: { id, shopId } });
    if (!company) {
      throw new AppError(404, 'INSURANCE_COMPANY_NOT_FOUND', 'Insurance company not found');
    }
    return company;
  },

  async create(
    shopId: number,
    data: {
      name: string;
      nameAr?: string | null;
      phone?: string | null;
      address?: string | null;
      defaultDiscountPercent?: number;
      status?: ActiveStatus;
    },
  ) {
    const clash = await prisma.insuranceCompany.findFirst({
      where: { shopId, name: data.name },
    });
    if (clash) {
      throw new AppError(409, 'INSURANCE_COMPANY_EXISTS', 'Insurance company name already in use');
    }
    return prisma.insuranceCompany.create({
      data: {
        shopId,
        name: data.name,
        nameAr: data.nameAr ?? null,
        phone: data.phone ?? null,
        address: data.address ?? null,
        defaultDiscountPercent: toMoneyString(data.defaultDiscountPercent ?? 0),
        status: data.status ?? 'active',
        due: 0,
      },
    });
  },

  async update(
    shopId: number,
    id: number,
    data: {
      name?: string;
      nameAr?: string | null;
      phone?: string | null;
      address?: string | null;
      defaultDiscountPercent?: number;
      status?: ActiveStatus;
    },
  ) {
    const company = await this.getById(shopId, id);
    if (data.name && data.name !== company.name) {
      const clash = await prisma.insuranceCompany.findFirst({
        where: { shopId, name: data.name },
      });
      if (clash) {
        throw new AppError(409, 'INSURANCE_COMPANY_EXISTS', 'Insurance company name already in use');
      }
    }
    return prisma.insuranceCompany.update({
      where: { id },
      data: {
        name: data.name,
        nameAr: data.nameAr,
        phone: data.phone,
        address: data.address,
        defaultDiscountPercent:
          data.defaultDiscountPercent !== undefined
            ? toMoneyString(data.defaultDiscountPercent)
            : undefined,
        status: data.status,
      },
    });
  },

  async remove(shopId: number, id: number) {
    const company = await this.getById(shopId, id);
    if (Number(company.due) > 0) {
      throw new AppError(
        409,
        'INSURANCE_HAS_DUE',
        'Cannot delete an insurance company with outstanding due',
      );
    }
    await prisma.insuranceCompany.delete({ where: { id } });
    return { message: 'Insurance company deleted' };
  },

  async payDue(
    shopId: number,
    id: number,
    input: { amount: number; paymentMethodId: number },
  ) {
    const company = await this.getById(shopId, id);
    const due = Number(company.due);
    if (input.amount > due + 0.001) {
      throw new AppError(422, 'AMOUNT_EXCEEDS_DUE', 'Payment exceeds outstanding insurance due');
    }
    const method = await prisma.paymentMethod.findFirst({
      where: { id: input.paymentMethodId, shopId },
    });
    if (!method) {
      throw new AppError(400, 'INVALID_PAYMENT_METHOD', 'Payment method not found for this shop');
    }
    if (method.isInsurance) {
      throw new AppError(
        422,
        'INVALID_SETTLEMENT_METHOD',
        'Cannot settle insurance due using an insurance payment method',
      );
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.insuranceCompany.update({
        where: { id },
        data: { due: sub(company.due.toString(), input.amount).toFixed(2) },
      });
      await tx.paymentMethod.update({
        where: { id: method.id },
        data: { balance: add(method.balance.toString(), input.amount).toFixed(2) },
      });
      return updated;
    });
  },

  async statement(shopId: number, id: number) {
    const company = await this.getById(shopId, id);
    const invoices = await prisma.invoice.findMany({
      where: { shopId, insuranceCompanyId: id },
      orderBy: { date: 'desc' },
      select: {
        id: true,
        invId: true,
        date: true,
        totalPrice: true,
        insurancePercent: true,
        insuranceAmount: true,
        paidAmount: true,
        duePrice: true,
        customer: { select: { id: true, name: true } },
      },
    });
    let billed = toMoneyString(0);
    for (const inv of invoices) {
      billed = add(billed, inv.insuranceAmount.toString()).toFixed(2);
    }
    return {
      company,
      invoices,
      summary: {
        invoiceCount: invoices.length,
        totalBilled: billed,
        outstandingDue: company.due.toFixed(2),
      },
    };
  },
};
