import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { add, round2, sub, toDecimal, toMoneyString } from '../utils/money';
import { ledgerService } from './ledger.service';
import { pdfService } from './pdf.service';
import { mailService } from './mail.service';

type InvoiceLineSnapshot = {
  medicineId: number;
  batchId: number;
  name: string | null;
  origQty: number;
  unitPrice: number;
  lineDiscount: number;
  origLineTotal: number;
  remainingQty: number;
};

function toLineSnapshots(json: Prisma.JsonValue | null): InvoiceLineSnapshot[] {
  if (!Array.isArray(json)) {
    return [];
  }
  return json.map((raw) => {
    const l = raw as Record<string, unknown>;
    return {
      medicineId: Number(l.medicineId),
      batchId: Number(l.batchId),
      name: (l.name as string | null | undefined) ?? null,
      origQty: Number(l.origQty ?? 0),
      unitPrice: Number(l.unitPrice ?? 0),
      lineDiscount: Number(l.lineDiscount ?? 0),
      origLineTotal: Number(l.origLineTotal ?? 0),
      remainingQty: Number(l.remainingQty ?? 0),
    };
  });
}

export const invoicesService = {
  async list(shopId: number, params: { page: number; limit: number; customerId?: number }) {
    const skip = (params.page - 1) * params.limit;
    const where: Prisma.InvoiceWhereInput = {
      shopId,
      ...(params.customerId ? { customerId: params.customerId } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.invoice.findMany({ where, orderBy: { id: 'desc' }, skip, take: params.limit }),
      prisma.invoice.count({ where }),
    ]);
    return { items, meta: { page: params.page, limit: params.limit, total } };
  },

  async getRaw(shopId: number, id: number) {
    const invoice = await prisma.invoice.findFirst({ where: { id, shopId } });
    if (!invoice) {
      throw new AppError(404, 'INVOICE_NOT_FOUND', 'Invoice not found');
    }
    return invoice;
  },

  async getById(shopId: number, id: number) {
    const invoice = await prisma.invoice.findFirst({
      where: { id, shopId },
      include: { customer: true, method: true, pays: true, saleReturns: true },
    });
    if (!invoice) {
      throw new AppError(404, 'INVOICE_NOT_FOUND', 'Invoice not found');
    }
    return invoice;
  },

  async getPdfBuffer(shopId: number, id: number) {
    const invoice = await this.getById(shopId, id);
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) {
      throw new AppError(404, 'SHOP_NOT_FOUND', 'Shop not found');
    }
    return pdfService.renderInvoicePdf(invoice, shop);
  },

  async sendEmail(shopId: number, id: number, to?: string) {
    const invoice = await this.getById(shopId, id);
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) {
      throw new AppError(404, 'SHOP_NOT_FOUND', 'Shop not found');
    }
    const recipient = to ?? invoice.customer?.email;
    if (!recipient) {
      throw new AppError(
        422,
        'EMAIL_REQUIRED',
        'No recipient email available — provide `to` or set an email on the invoice customer',
      );
    }
    const pdfBuffer = await pdfService.renderInvoicePdf(invoice, shop);
    await mailService.sendMail({
      to: recipient,
      subject: `Invoice ${invoice.invId}`,
      text: `Please find attached invoice ${invoice.invId}.`,
      attachments: [{ filename: `invoice-${invoice.invId}.pdf`, content: pdfBuffer }],
    });
    return { sent: true, to: recipient };
  },

  /** Pay down an invoice's outstanding due: method.balance += amount; customer.due -= amount. */
  async pay(shopId: number, id: number, input: { amount: number; paymentMethodId: number }) {
    const invoice = await this.getRaw(shopId, id);
    const due = toDecimal(invoice.duePrice.toString());
    if (toDecimal(input.amount).greaterThan(due)) {
      throw new AppError(422, 'AMOUNT_EXCEEDS_DUE', 'Payment amount exceeds outstanding due');
    }
    const method = await prisma.paymentMethod.findFirst({
      where: { id: input.paymentMethodId, shopId },
    });
    if (!method) {
      throw new AppError(400, 'INVALID_PAYMENT_METHOD', 'Payment method not found for this shop');
    }

    let customer = null;
    if (invoice.customerId) {
      customer = await prisma.customer.findFirst({ where: { id: invoice.customerId, shopId } });
    }

    const date = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: add(invoice.paidAmount.toString(), input.amount).toFixed(2),
          duePrice: sub(due, input.amount).toFixed(2),
        },
      });
      await tx.paymentMethod.update({
        where: { id: method.id },
        data: { balance: add(method.balance.toString(), input.amount).toFixed(2) },
      });
      if (customer) {
        await tx.customer.update({
          where: { id: customer.id },
          data: { due: sub(customer.due.toString(), input.amount).toFixed(2) },
        });
      }
      await tx.invoicePay.create({
        data: {
          shopId,
          invoiceId: invoice.id,
          customerId: customer?.id ?? null,
          methodId: method.id,
          amount: toMoneyString(input.amount),
          date,
        },
      });
    });

    return this.getById(shopId, id);
  },

  /** Write-off only: due_price = 0. No InvoicePay, no customer.due change, no method credit. */
  async approve(shopId: number, id: number) {
    const invoice = await this.getRaw(shopId, id);
    await prisma.invoice.update({ where: { id: invoice.id }, data: { duePrice: '0.00' } });
    return {
      invoice: await this.getById(shopId, id),
      message:
        'Invoice approved: outstanding due written off. No payment was collected, no payment method was credited, and customer due was not changed.',
    };
  },

  /** Fully reverses all side effects (stock, customer due, method balance, ledger, pays/returns) before deleting. */
  async remove(shopId: number, id: number) {
    const invoice = await this.getRaw(shopId, id);
    const lines = toLineSnapshots(invoice.medicines);

    await prisma.$transaction(async (tx) => {
      for (const line of lines) {
        if (line.remainingQty > 0) {
          await tx.batch.update({
            where: { id: line.batchId },
            data: { qty: { increment: line.remainingQty } },
          });
        }
      }

      if (invoice.customerId) {
        const customer = await tx.customer.findUnique({ where: { id: invoice.customerId } });
        if (customer) {
          await tx.customer.update({
            where: { id: customer.id },
            data: { due: sub(customer.due.toString(), invoice.duePrice.toString()).toFixed(2) },
          });
        }
      }

      const method = await tx.paymentMethod.findUnique({ where: { id: invoice.methodId } });
      if (method) {
        await tx.paymentMethod.update({
          where: { id: method.id },
          data: { balance: sub(method.balance.toString(), invoice.paidAmount.toString()).toFixed(2) },
        });
      }

      if (toDecimal(invoice.totalPrice.toString()).greaterThan(0)) {
        await ledgerService.reverseSaleTransaction(tx, {
          amount: invoice.totalPrice.toString(),
          invoiceId: invoice.invId,
          date: new Date(),
        });
      }

      await tx.invoicePay.deleteMany({ where: { invoiceId: invoice.id } });
      await tx.saleReturn.deleteMany({ where: { invoiceId: invoice.id } });
      await tx.invoice.delete({ where: { id: invoice.id } });
    });

    return { message: 'Invoice deleted; stock, customer due, payment method balance, and ledger fully reversed' };
  },

  async createReturn(shopId: number, id: number, input: { batchId: number; quantity: number }) {
    const invoice = await this.getRaw(shopId, id);
    const lines = toLineSnapshots(invoice.medicines);
    const idx = lines.findIndex((l) => l.batchId === input.batchId);
    if (idx < 0) {
      throw new AppError(400, 'INVALID_LINE', 'This batch is not part of the invoice');
    }
    const line = lines[idx];
    if (input.quantity > line.remainingQty) {
      throw new AppError(
        422,
        'RETURN_QTY_EXCEEDS_LINE',
        `Return quantity exceeds remaining line quantity (${line.remainingQty})`,
      );
    }
    if (line.origQty <= 0) {
      throw new AppError(400, 'INVALID_LINE', 'Invoice line has an invalid original quantity');
    }

    const unitPrice = toDecimal(line.origLineTotal).dividedBy(line.origQty);
    const returnAmount = round2(unitPrice.times(input.quantity));

    const dueBefore = toDecimal(invoice.duePrice.toString());
    const dueReduced = dueBefore.greaterThanOrEqualTo(returnAmount);

    const method = await prisma.paymentMethod.findFirst({ where: { id: invoice.methodId, shopId } });
    if (!method) {
      throw new AppError(400, 'INVALID_PAYMENT_METHOD', 'Payment method not found for this invoice');
    }
    if (toDecimal(method.balance.toString()).lessThan(returnAmount)) {
      throw new AppError(
        422,
        'INSUFFICIENT_METHOD_BALANCE',
        'Payment method balance is insufficient to reverse this return',
      );
    }

    let customer = null;
    if (invoice.customerId) {
      customer = await prisma.customer.findFirst({ where: { id: invoice.customerId, shopId } });
    }

    const date = new Date();
    const updatedLines = [...lines];
    updatedLines[idx] = { ...line, remainingQty: line.remainingQty - input.quantity };

    const result = await prisma.$transaction(async (tx) => {
      const updatedInvoice = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          subtotal: sub(invoice.subtotal.toString(), returnAmount).toFixed(2),
          totalPrice: sub(invoice.totalPrice.toString(), returnAmount).toFixed(2),
          paidAmount: sub(invoice.paidAmount.toString(), returnAmount).toFixed(2),
          duePrice: dueReduced ? sub(dueBefore, returnAmount).toFixed(2) : dueBefore.toFixed(2),
          qty: invoice.qty - input.quantity,
          medicines: updatedLines as unknown as Prisma.InputJsonValue,
        },
      });

      await tx.batch.update({
        where: { id: input.batchId },
        data: { qty: { increment: input.quantity } },
      });

      await tx.paymentMethod.update({
        where: { id: method.id },
        data: { balance: sub(method.balance.toString(), returnAmount).toFixed(2) },
      });

      // C4 / sale-returns.md: always reduce customer.due by return_amount (not orig line total).
      // May go negative when invoice.due_price was left unchanged (due < return_amount).
      if (customer) {
        await tx.customer.update({
          where: { id: customer.id },
          data: { due: sub(customer.due.toString(), returnAmount).toFixed(2) },
        });
      }

      const saleReturn = await tx.saleReturn.create({
        data: {
          shopId,
          invoiceId: invoice.id,
          batchId: input.batchId,
          amount: toMoneyString(returnAmount),
          quantity: input.quantity,
          date,
          medicines: [{ ...line, returnedQty: input.quantity }] as unknown as Prisma.InputJsonValue,
        },
      });

      await ledgerService.reverseSaleTransaction(tx, {
        amount: returnAmount,
        invoiceId: invoice.invId,
        date,
      });

      return { saleReturn, updatedInvoice };
    });

    return {
      ...result.saleReturn,
      invoiceDueAfter: result.updatedInvoice.duePrice,
      invoiceTotalAfter: result.updatedInvoice.totalPrice,
      dueReduced,
      customerDueReduced: !!customer,
    };
  },

  async listReturns(shopId: number, id: number, params: { page: number; limit: number }) {
    await this.getRaw(shopId, id);
    const skip = (params.page - 1) * params.limit;
    const where: Prisma.SaleReturnWhereInput = { shopId, invoiceId: id };
    const [items, total] = await Promise.all([
      prisma.saleReturn.findMany({ where, orderBy: { id: 'desc' }, skip, take: params.limit }),
      prisma.saleReturn.count({ where }),
    ]);
    return { items, meta: { page: params.page, limit: params.limit, total } };
  },
};
