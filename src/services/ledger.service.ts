import { LedgerInvoiceType, Prisma } from '@prisma/client';
import { toMoneyString } from '../utils/money';

type TxClient = Prisma.TransactionClient;

/** Seeded fixed account ids — see AccountEnum.php and prisma/seed.ts. */
export const ACCOUNT_IDS = {
  COST_OF_SALES: 1,
  SALES: 2,
  ACCOUNTS_PAYABLE: 3,
  ACCOUNTS_RECEIVABLE: 4,
} as const;

function generateTranId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `${prefix}-${Date.now()}-${random}`;
}

async function createLedgerEntry(
  tx: TxClient,
  params: {
    debitAccountId: number;
    creditAccountId: number;
    amount: Prisma.Decimal.Value;
    invoiceType: LedgerInvoiceType;
    invoiceId?: string | null;
    particular: string;
    date: Date;
  },
) {
  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const tranId = generateTranId(params.invoiceType.toUpperCase());
    try {
      return await tx.ledgerTransaction.create({
        data: {
          tranId,
          date: params.date,
          debitAccountId: params.debitAccountId,
          creditAccountId: params.creditAccountId,
          amount: toMoneyString(params.amount),
          invoiceType: params.invoiceType,
          invoiceId: params.invoiceId ?? null,
          particular: params.particular,
        },
      });
    } catch (err) {
      const isUniqueClash =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
      if (isUniqueClash && attempt < maxAttempts - 1) {
        continue;
      }
      throw err;
    }
  }
  throw new Error('Failed to generate a unique ledger transaction id');
}

export const ledgerService = {
  /** debit Cost of Sales (1) / credit Accounts Payable (3) — TransactionService::purchaseTransaction. */
  async purchaseTransaction(
    tx: TxClient,
    params: { amount: Prisma.Decimal.Value; invoiceId: string; date?: Date },
  ) {
    return createLedgerEntry(tx, {
      debitAccountId: ACCOUNT_IDS.COST_OF_SALES,
      creditAccountId: ACCOUNT_IDS.ACCOUNTS_PAYABLE,
      amount: params.amount,
      invoiceType: 'purchase',
      invoiceId: params.invoiceId,
      particular: `Paid on Purchase Invoice ${params.invoiceId}`,
      date: params.date ?? new Date(),
    });
  },

  /** Reverse of purchaseTransaction: debit Accounts Payable (3) / credit Cost of Sales (1) — Node addition. */
  async reversePurchaseTransaction(
    tx: TxClient,
    params: { amount: Prisma.Decimal.Value; invoiceId: string; date?: Date },
  ) {
    return createLedgerEntry(tx, {
      debitAccountId: ACCOUNT_IDS.ACCOUNTS_PAYABLE,
      creditAccountId: ACCOUNT_IDS.COST_OF_SALES,
      amount: params.amount,
      invoiceType: 'purchase_return',
      invoiceId: params.invoiceId,
      particular: `Purchase Return for Invoice ${params.invoiceId}`,
      date: params.date ?? new Date(),
    });
  },

  /** debit Accounts Receivable (4) / credit Sales (2) — TransactionService::saleTransaction. */
  async saleTransaction(
    tx: TxClient,
    params: { amount: Prisma.Decimal.Value; invoiceId: string; date?: Date },
  ) {
    return createLedgerEntry(tx, {
      debitAccountId: ACCOUNT_IDS.ACCOUNTS_RECEIVABLE,
      creditAccountId: ACCOUNT_IDS.SALES,
      amount: params.amount,
      invoiceType: 'sale',
      invoiceId: params.invoiceId,
      particular: `Sale on Invoice ${params.invoiceId}`,
      date: params.date ?? new Date(),
    });
  },

  /** Reverse of saleTransaction: debit Sales (2) / credit Accounts Receivable (4) — Node addition. */
  async reverseSaleTransaction(
    tx: TxClient,
    params: { amount: Prisma.Decimal.Value; invoiceId: string; date?: Date },
  ) {
    return createLedgerEntry(tx, {
      debitAccountId: ACCOUNT_IDS.SALES,
      creditAccountId: ACCOUNT_IDS.ACCOUNTS_RECEIVABLE,
      amount: params.amount,
      invoiceType: 'sale_return',
      invoiceId: params.invoiceId,
      particular: `Sale Return for Invoice ${params.invoiceId}`,
      date: params.date ?? new Date(),
    });
  },

  /**
   * debit `accountId` (user-chosen) / credit Accounts Payable (3) — TransactionService::expenseTransaction.
   * Always credits AP, even for cash expenses — preserved Laravel behavior per
   * docs/DECISIONS.md "Expenses (v1)" and specs/expenses.md (conflict C11).
   */
  async expenseTransaction(
    tx: TxClient,
    params: {
      amount: Prisma.Decimal.Value;
      accountId: number;
      description: string;
      invoiceId?: string | null;
      date?: Date;
    },
  ) {
    return createLedgerEntry(tx, {
      debitAccountId: params.accountId,
      creditAccountId: ACCOUNT_IDS.ACCOUNTS_PAYABLE,
      amount: params.amount,
      invoiceType: 'expense',
      invoiceId: params.invoiceId ?? null,
      particular: params.description,
      date: params.date ?? new Date(),
    });
  },

  /**
   * Reverse of expenseTransaction: debit Accounts Payable (3) / credit `accountId` — Node
   * addition so PATCH/DELETE on an expense keeps the ledger in sync (specs/expenses.md
   * divergence; Laravel leaves the original entry standing).
   */
  async reverseExpenseTransaction(
    tx: TxClient,
    params: {
      amount: Prisma.Decimal.Value;
      accountId: number;
      description: string;
      invoiceId?: string | null;
      date?: Date;
    },
  ) {
    return createLedgerEntry(tx, {
      debitAccountId: ACCOUNT_IDS.ACCOUNTS_PAYABLE,
      creditAccountId: params.accountId,
      amount: params.amount,
      invoiceType: 'expense',
      invoiceId: params.invoiceId ?? null,
      particular: `Reversal: ${params.description}`,
      date: params.date ?? new Date(),
    });
  },

  /** Manual journal entry — human-posted, arbitrary debit/credit accounts (accounting.md acceptance criteria). */
  async manualTransaction(
    tx: TxClient,
    params: {
      amount: Prisma.Decimal.Value;
      debitAccountId: number;
      creditAccountId: number;
      particular: string;
      date?: Date;
    },
  ) {
    return createLedgerEntry(tx, {
      debitAccountId: params.debitAccountId,
      creditAccountId: params.creditAccountId,
      amount: params.amount,
      invoiceType: 'manual',
      invoiceId: null,
      particular: params.particular,
      date: params.date ?? new Date(),
    });
  },
};
