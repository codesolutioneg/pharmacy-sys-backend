import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { add, sub, toDecimal, toMoneyString } from '../utils/money';

export const customersService = {
  async list(shopId: number, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.customer.findMany({
        where: { shopId },
        orderBy: { id: 'asc' },
        skip,
        take: limit,
      }),
      prisma.customer.count({ where: { shopId } }),
    ]);
    return { items, meta: { page, limit, total } };
  },

  async getById(shopId: number, id: number) {
    const customer = await prisma.customer.findFirst({ where: { id, shopId } });
    if (!customer) {
      throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found');
    }
    return customer;
  },

  async assertUnique(
    shopId: number,
    email: string,
    phone: string,
    excludeId?: number,
  ) {
    const [emailClash, phoneClash] = await Promise.all([
      prisma.customer.findFirst({
        where: { shopId, email, ...(excludeId ? { id: { not: excludeId } } : {}) },
      }),
      prisma.customer.findFirst({
        where: { shopId, phone, ...(excludeId ? { id: { not: excludeId } } : {}) },
      }),
    ]);
    if (emailClash) {
      throw new AppError(409, 'CUSTOMER_EMAIL_EXISTS', 'Email already in use for this shop');
    }
    if (phoneClash) {
      throw new AppError(409, 'CUSTOMER_PHONE_EXISTS', 'Phone already in use for this shop');
    }
  },

  async create(
    shopId: number,
    data: {
      name: string;
      email: string;
      phone: string;
      address?: string | null;
      gender?: string;
      age?: number;
    },
  ) {
    await this.assertUnique(shopId, data.email, data.phone);
    return prisma.customer.create({
      data: {
        shopId,
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address ?? null,
        gender: data.gender ?? 'Male',
        age: data.age ?? 0,
        due: 0,
      },
    });
  },

  async update(
    shopId: number,
    id: number,
    data: {
      name?: string;
      email?: string;
      phone?: string;
      address?: string | null;
      gender?: string;
      age?: number;
    },
  ) {
    const customer = await this.getById(shopId, id);
    if (
      (data.email && data.email !== customer.email) ||
      (data.phone && data.phone !== customer.phone)
    ) {
      await this.assertUnique(
        shopId,
        data.email ?? customer.email,
        data.phone ?? customer.phone,
        id,
      );
    }
    return prisma.customer.update({
      where: { id },
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        gender: data.gender,
        age: data.age,
      },
    });
  },

  async remove(shopId: number, id: number) {
    await this.getById(shopId, id);
    await prisma.customer.delete({ where: { id } });
    return { message: 'Customer deleted' };
  },

  async payDue(
    shopId: number,
    id: number,
    data: { amount: number; paymentMethodId: number; invoiceId?: number },
  ) {
    const customer = await this.getById(shopId, id);
    const due = customer.due.toString();
    if (toDecimal(data.amount).greaterThan(toDecimal(due))) {
      throw new AppError(400, 'AMOUNT_EXCEEDS_DUE', 'Payment amount exceeds outstanding due');
    }

    const method = await prisma.paymentMethod.findFirst({
      where: { id: data.paymentMethodId, shopId },
    });
    if (!method) {
      throw new AppError(400, 'INVALID_PAYMENT_METHOD', 'Payment method not found');
    }

    let invoice = null;
    if (data.invoiceId !== undefined) {
      invoice = await prisma.invoice.findFirst({
        where: { id: data.invoiceId, shopId, customerId: id },
      });
      if (!invoice) {
        throw new AppError(400, 'INVALID_INVOICE', 'Invoice not found for this customer');
      }
    }

    const newDue = sub(due, data.amount);
    const newBalance = add(method.balance.toString(), data.amount);

    const [updatedCustomer] = await prisma.$transaction(async (tx) => {
      const updated = await tx.customer.update({
        where: { id },
        data: { due: newDue.toFixed(2) },
      });
      await tx.paymentMethod.update({
        where: { id: method.id },
        data: { balance: newBalance.toFixed(2) },
      });

      if (invoice) {
        const invoicePaid = add(invoice.paidAmount.toString(), data.amount);
        const invoiceDueRaw = sub(invoice.duePrice.toString(), data.amount);
        const invoiceDue = invoiceDueRaw.isNegative() ? toDecimal(0) : invoiceDueRaw;
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            paidAmount: invoicePaid.toFixed(2),
            duePrice: invoiceDue.toFixed(2),
          },
        });
        await tx.invoicePay.create({
          data: {
            shopId,
            invoiceId: invoice.id,
            customerId: id,
            methodId: method.id,
            amount: toMoneyString(data.amount),
            date: new Date(),
          },
        });
      }

      return [updated] as const;
    });

    return updatedCustomer;
  },
};
