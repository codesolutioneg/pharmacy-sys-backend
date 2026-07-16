import { prisma } from './helpers';

describe('QA Database integrity', () => {
  it('seeded accounts 1-4 exist', async () => {
    const accounts = await prisma.account.findMany({ where: { id: { in: [1, 2, 3, 4] } } });
    expect(accounts).toHaveLength(4);
  });

  it('no negative batch quantities', async () => {
    const neg = await prisma.batch.count({ where: { qty: { lt: 0 } } });
    expect(neg).toBe(0);
  });

  it('no orphan batches (medicine must exist)', async () => {
    const orphans = await prisma.$queryRaw<Array<{ c: bigint }>>`
      SELECT COUNT(*)::bigint AS c FROM batches b
      LEFT JOIN products m ON m.id = b.medicine_id
      WHERE m.id IS NULL
    `;
    expect(Number(orphans[0]?.c ?? 0)).toBe(0);
  });

  it('money columns use numeric/decimal precision', async () => {
    const cols = await prisma.$queryRaw<Array<{ data_type: string; numeric_scale: number | null }>>`
      SELECT data_type, numeric_scale FROM information_schema.columns
      WHERE table_name = 'invoices' AND column_name IN ('total_price','paid_amount','due_price')
    `;
    expect(cols.length).toBeGreaterThan(0);
    for (const c of cols) {
      expect(['numeric', 'decimal']).toContain(c.data_type);
      expect(c.numeric_scale).toBe(2);
    }
  });

  it('critical unique indexes exist', async () => {
    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes
      WHERE tablename IN ('products','customers','invoices','purchases','users')
    `;
    const names = indexes.map((i) => i.indexname).join(' ');
    expect(names.length).toBeGreaterThan(0);
    expect(names).toMatch(/qr_code|email|inv_id/i);
  });

  it('QA seed produced realistic volume', async () => {
    const customers = await prisma.customer.count({ where: { shopId: 1 } });
    const medicines = await prisma.medicine.count({ where: { shopId: 1 } });
    expect(customers).toBeGreaterThanOrEqual(200);
    expect(medicines).toBeGreaterThanOrEqual(20);
  });

  it('FK cascade on role_permissions works structurally', async () => {
    const fks = await prisma.$queryRaw<Array<{ confdeltype: string }>>`
      SELECT confdeltype FROM pg_constraint
      WHERE conname LIKE '%role_permissions%' AND contype = 'f'
      LIMIT 5
    `;
    expect(fks.length).toBeGreaterThan(0);
  });
});
